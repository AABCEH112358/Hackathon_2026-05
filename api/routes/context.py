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

# Maps internal step markers to David.md / Kristen frontend SSE fields.
STEP_SSE: dict[str, tuple[str, str]] = {
    "step:reading": ("reading", "Reading repo structure..."),
    "step:abstraction": ("analyzing", "Identifying core abstraction..."),
    "step:patterns": ("analyzing", "Identifying patterns..."),
    "step:why_contribute": ("analyzing", "Explaining why to contribute..."),
    "step:rebuild_prompt": ("generating", "Generating rebuild prompt..."),
    "step:assembling": ("assembling", "Assembling final context..."),
}


def _format_sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def event_stream(
    repo_id: str,
    db: AsyncSession,
    *,
    regenerate: bool,
) -> AsyncGenerator[str, None]:
    cached = False
    tokens_used = 0
    markdown: str | None = None

    try:
        async for chunk in generate_context(repo_id, db, skip_cache=regenerate):
            if chunk == "cache_hit":
                cached = True
            elif chunk.startswith("tokens:"):
                tokens_used = int(chunk.split(":", 1)[1])
            elif chunk.startswith("step:"):
                step, message = STEP_SSE.get(chunk, ("working", chunk))
                yield _format_sse("progress", {"step": step, "message": message})
            else:
                markdown = chunk
                yield _format_sse("chunk", {"content": chunk})

        if markdown is not None:
            yield _format_sse("complete", {"cached": cached, "tokens_used": tokens_used})
    except Exception as e:
        logger.exception("context.generate_failed", repo_id=repo_id, error=str(e))
        yield _format_sse("error", {"message": str(e)})


@router.get("/generate")
async def generate_context_endpoint(
    repo_id: str,
    regenerate: bool = False,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    return StreamingResponse(
        event_stream(repo_id, db, regenerate=regenerate),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
