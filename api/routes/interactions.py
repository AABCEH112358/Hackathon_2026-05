"""User interaction tracking endpoints."""

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Repo, UserInteraction
from db.session import get_db
from schemas import InteractionRequest, InteractionResponse

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post("", response_model=InteractionResponse)
async def record_interaction(
    body: InteractionRequest,
    db: AsyncSession = Depends(get_db),
) -> InteractionResponse:
    """Record a user interaction with a repo on the map."""
    repo_result = await db.execute(select(Repo.id).where(Repo.id == body.repo_id))
    if repo_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="repo_not_found")

    interaction = UserInteraction(
        user_id=body.user_id,
        repo_id=body.repo_id,
        action=body.action,
        duration_ms=body.duration_ms,
    )
    db.add(interaction)
    await db.flush()

    logger.info(
        "interactions.recorded",
        user_id=body.user_id,
        repo_id=body.repo_id,
        action=body.action,
    )
    return InteractionResponse(ok=True)
