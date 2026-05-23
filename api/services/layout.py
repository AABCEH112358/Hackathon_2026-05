"""UMAP layout + 64x64 grid snapping and building heights."""

import math
from typing import Sequence

import numpy as np
import structlog
import umap
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from db.models import Repo

logger = structlog.get_logger(__name__)


class LayoutService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._grid_size = get_settings().layout_grid_size

    @staticmethod
    def height_from_stars(stars: int) -> int:
        """Map log(stars) to tile height 1–6."""
        if stars <= 0:
            return 1
        log_stars = math.log1p(stars)
        # Typical range: log(1)≈0, log(200k)≈12 — normalize to 1-6
        normalized = min(1.0, log_stars / 12.0)
        return max(1, min(6, int(round(1 + normalized * 5))))

    @staticmethod
    def _snap_to_grid(coords: np.ndarray, grid_size: int) -> np.ndarray:
        """Scale UMAP output to [0, grid_size-1] integer tiles."""
        if len(coords) == 0:
            return coords
        mins = coords.min(axis=0)
        maxs = coords.max(axis=0)
        span = np.where(maxs - mins < 1e-9, 1.0, maxs - mins)
        normalized = (coords - mins) / span
        scaled = normalized * (grid_size - 1)
        return np.round(scaled).astype(int)

    async def layout_is_cached(self) -> bool:
        result = await self._session.execute(
            select(Repo.id).where(Repo.tile_x.is_not(None), Repo.tile_y.is_not(None)).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def compute_and_cache_layout(self) -> int:
        result = await self._session.execute(
            select(Repo).where(Repo.embedding.is_not(None)).order_by(Repo.stars.desc())
        )
        repos = list(result.scalars().all())
        if not repos:
            logger.warning("layout.no_repos")
            return 0

        embeddings = np.array([list(r.embedding) for r in repos], dtype=np.float32)
        n = len(embeddings)

        if n == 1:
            coords = np.array([[self._grid_size // 2, self._grid_size // 2]], dtype=int)
        elif n == 2:
            coords = np.array([[self._grid_size // 3, self._grid_size // 2],
                               [2 * self._grid_size // 3, self._grid_size // 2]])
        else:
            n_neighbors = min(15, max(2, n - 1))
            reducer = umap.UMAP(
                n_components=2,
                n_neighbors=n_neighbors,
                min_dist=0.1,
                metric="cosine",
                random_state=42,
            )
            embedding_2d = reducer.fit_transform(embeddings)
            coords = self._snap_to_grid(embedding_2d, self._grid_size)

        updated = 0
        for repo, (tx, ty) in zip(repos, coords, strict=True):
            h = self.height_from_stars(repo.stars)
            await self._session.execute(
                update(Repo)
                .where(Repo.id == repo.id)
                .values(tile_x=int(tx), tile_y=int(ty), height=h)
            )
            updated += 1

        await self._session.flush()
        logger.info("layout.cached", repos=updated, grid=self._grid_size)
        return updated

    async def ensure_layout(self) -> None:
        if not await self.layout_is_cached():
            await self.compute_and_cache_layout()

    @staticmethod
    def description_short(description: str | None, max_len: int = 120) -> str:
        if not description:
            return ""
        text = description.strip()
        if len(text) <= max_len:
            return text
        return text[: max_len - 3] + "..."
