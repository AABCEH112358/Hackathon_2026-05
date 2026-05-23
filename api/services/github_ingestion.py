"""Fetch top GitHub repositories and persist with embeddings."""

from datetime import UTC, datetime
from typing import Any

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import retry, stop_after_attempt, wait_exponential

from config import get_settings
from db.models import Repo, StarHistory
from services.embeddings import EmbeddingService, get_embedding_service

logger = structlog.get_logger(__name__)

GITHUB_API = "https://api.github.com"


class GitHubIngestionService:
    def __init__(
        self,
        session: AsyncSession,
        embedding_service: EmbeddingService | None = None,
    ) -> None:
        self._session = session
        self._embeddings = embedding_service or get_embedding_service()
        self._settings = get_settings()

    def _headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self._settings.github_token:
            headers["Authorization"] = f"Bearer {self._settings.github_token}"
        return headers

    @retry(
        wait=wait_exponential(multiplier=1, min=2, max=60),
        stop=stop_after_attempt(6),
        reraise=True,
    )
    async def _fetch_page(
        self, client: httpx.AsyncClient, page: int, per_page: int
    ) -> list[dict[str, Any]]:
        """Search repos sorted by stars (GitHub Search API, max 1000 results)."""
        response = await client.get(
            f"{GITHUB_API}/search/repositories",
            params={
                "q": "stars:>100",
                "sort": "stars",
                "order": "desc",
                "per_page": per_page,
                "page": page,
            },
            headers=self._headers(),
            timeout=30.0,
        )
        if response.status_code == 403:
            logger.warning("github.rate_limited", page=page, headers=dict(response.headers))
            response.raise_for_status()
        response.raise_for_status()
        data = response.json()
        return list(data.get("items", []))

    @staticmethod
    def _repo_id(owner: str, name: str) -> str:
        return f"{owner}/{name}"

    @staticmethod
    def _parse_repo(item: dict[str, Any]) -> dict[str, Any]:
        owner = item["owner"]["login"]
        name = item["name"]
        pushed = item.get("pushed_at")
        last_commit_at = (
            datetime.fromisoformat(pushed.replace("Z", "+00:00")) if pushed else None
        )
        topics = item.get("topics") or []
        return {
            "id": GitHubIngestionService._repo_id(owner, name),
            "github_id": item["id"],
            "owner": owner,
            "name": name,
            "description": item.get("description"),
            "stars": item.get("stargazers_count", 0),
            "forks": item.get("forks_count", 0),
            "language": item.get("language"),
            "topics": topics,
            "last_commit_at": last_commit_at,
        }

    async def ingest_top_repos(self, limit: int | None = None) -> int:
        target = limit if limit is not None else self._settings.github_seed_limit
        per_page = min(100, target)
        pages_needed = (target + per_page - 1) // per_page
        collected: list[dict[str, Any]] = []

        async with httpx.AsyncClient() as client:
            for page in range(1, pages_needed + 1):
                if len(collected) >= target:
                    break
                items = await self._fetch_page(client, page, per_page)
                if not items:
                    break
                for item in items:
                    collected.append(self._parse_repo(item))
                    if len(collected) >= target:
                        break
                logger.info("github.page_fetched", page=page, total=len(collected))

        if not collected:
            return 0

        texts = [
            self._embeddings.repo_text(r.get("description"), r.get("topics") or [])
            for r in collected
        ]
        vectors = await self._embeddings.encode_batch(texts)

        ingested = 0
        now = datetime.now(UTC)
        for repo_data, vector in zip(collected, vectors, strict=True):
            repo_data["embedding"] = vector
            stmt = insert(Repo).values(**repo_data)
            stmt = stmt.on_conflict_do_update(
                index_elements=[Repo.id],
                set_={
                    "stars": stmt.excluded.stars,
                    "forks": stmt.excluded.forks,
                    "description": stmt.excluded.description,
                    "topics": stmt.excluded.topics,
                    "language": stmt.excluded.language,
                    "last_commit_at": stmt.excluded.last_commit_at,
                    "embedding": stmt.excluded.embedding,
                    "updated_at": now,
                },
            )
            await self._session.execute(stmt)

            history_stmt = insert(StarHistory).values(
                repo_id=repo_data["id"],
                date=now.date(),
                stars=repo_data["stars"],
            )
            history_stmt = history_stmt.on_conflict_do_update(
                index_elements=["repo_id", "date"],
                set_={"stars": history_stmt.excluded.stars},
            )
            await self._session.execute(history_stmt)
            ingested += 1

        await self._session.flush()
        logger.info("github.ingest_complete", count=ingested)
        return ingested

    async def count_repos(self) -> int:
        result = await self._session.execute(select(Repo.id))
        return len(result.scalars().all())
