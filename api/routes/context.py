"""STEP 6 — SSE endpoint for streaming context generation."""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator

import structlog
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from services.context_agent.agent import generate_context

logger = structlog.get_logger(__name__)
router = APIRouter()

STEP_MESSAGES: dict[str, str] = {
    "step:reading": "Reading repo from GitHub...",
    "step:abstraction": "Identifying core abstraction...",
    "step:patterns": "Extracting architectural patterns...",
    "step:rebuild_prompt": "Generating rebuild prompt...",
    "step:assembling": "Assembling final context...",
}


async def event_stream(repo_id: str, db: AsyncSession) -> AsyncGenerator[str, None]:
    try:
        async for chunk in generate_context(repo_id, db):
            if chunk == "cache_hit":
                yield f"data: {json.dumps({'type': 'cache_hit'})}\n\n"
            elif chunk.startswith("step:"):
                message = STEP_MESSAGES.get(chunk, chunk)
                yield f"data: {json.dumps({'type': 'progress', 'message': message})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'content', 'markdown': chunk})}\n\n"
    except Exception as e:
        logger.exception("context.generate_failed", repo_id=repo_id, error=str(e))
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


@router.get("/generate")
async def generate_context_endpoint(
    repo_id: str,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    return StreamingResponse(
        event_stream(repo_id, db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
