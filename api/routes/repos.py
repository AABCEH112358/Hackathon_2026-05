"""Repository seed and layout endpoints."""

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Repo
from db.session import get_db
from schemas import LayoutRepoItem, LayoutResponse, SeedRequest, SeedResponse
from services.github_ingestion import GitHubIngestionService
from services.layout import LayoutService

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post("/seed", response_model=SeedResponse)
async def seed_repos(
    body: SeedRequest | None = None,
    db: AsyncSession = Depends(get_db),
) -> SeedResponse:
    """Fetch top N repos from GitHub, embed, and store."""
    limit = body.limit if body else None
    ingestion = GitHubIngestionService(db)
    try:
        ingested = await ingestion.ingest_top_repos(limit=limit)
    except Exception as exc:
        logger.exception("repos.seed_failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"GitHub ingestion failed: {exc}") from exc
    return SeedResponse(ingested=ingested)


@router.get("/layout", response_model=LayoutResponse)
async def get_layout(db: AsyncSession = Depends(get_db)) -> LayoutResponse:
    """
    Return all repos with tile positions for the isometric map.
    Computes UMAP layout on first call, then serves cached tiles from DB.
    """
    layout_service = LayoutService(db)
    await layout_service.ensure_layout()

    result = await db.execute(
        select(Repo)
        .where(Repo.tile_x.is_not(None), Repo.tile_y.is_not(None))
        .order_by(Repo.stars.desc())
    )
    repos = result.scalars().all()

    items: list[LayoutRepoItem] = []
    for repo in repos:
        if repo.tile_x is None or repo.tile_y is None:
            continue
        items.append(
            LayoutRepoItem(
                id=repo.id,
                name=repo.name,
                owner=repo.owner,
                stars=repo.stars,
                language=repo.language,
                tile_x=repo.tile_x,
                tile_y=repo.tile_y,
                height=repo.height,
                trending_score=repo.trending_score,
                description_short=LayoutService.description_short(repo.description),
            )
        )

    logger.info("repos.layout_served", count=len(items))
    return LayoutResponse(repos=items)
