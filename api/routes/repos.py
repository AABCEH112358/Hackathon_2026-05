"""Repository seed and layout endpoints."""

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Repo
from db.session import get_db
from schemas import (
    LayoutRepoItem,
    LayoutResponse,
    RepoDetailResponse,
    SeedRequest,
    SeedResponse,
)
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


@router.get("/{repo_id:path}", response_model=RepoDetailResponse)
async def get_repo(repo_id: str, db: AsyncSession = Depends(get_db)) -> RepoDetailResponse:
    """Return full repo metadata plus the 3 most similar repos by embedding."""
    result = await db.execute(select(Repo).where(Repo.id == repo_id))
    repo = result.scalar_one_or_none()
    if repo is None:
        raise HTTPException(status_code=404, detail="repo_not_found")

    similar_repo_ids: list[str] = []
    if repo.embedding is not None:
        similar_result = await db.execute(
            select(Repo.id)
            .where(Repo.id != repo_id, Repo.embedding.is_not(None))
            .order_by(Repo.embedding.cosine_distance(repo.embedding))
            .limit(3)
        )
        similar_repo_ids = list(similar_result.scalars().all())

    logger.info("repos.detail_served", repo_id=repo_id, similar_count=len(similar_repo_ids))
    return RepoDetailResponse(
        id=repo.id,
        github_id=repo.github_id,
        owner=repo.owner,
        name=repo.name,
        description=repo.description or "",
        stars=repo.stars,
        forks=repo.forks,
        language=repo.language or "",
        topics=[str(topic) for topic in (repo.topics or [])],
        last_commit_at=repo.last_commit_at,
        tile_x=repo.tile_x,
        tile_y=repo.tile_y,
        height=repo.height,
        trending_score=repo.trending_score,
        similar_repo_ids=similar_repo_ids,
    )
