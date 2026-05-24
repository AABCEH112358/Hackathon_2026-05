"""STEP 5 — orchestrate context generation and assemble final markdown."""

from __future__ import annotations

import time
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ContextCache, Repo
from services.context_agent.analyzer import (
    extract_architecture_patterns,
    identify_core_abstraction,
)
from services.context_agent.prompt_writer import generate_rebuild_prompt
from services.context_agent.repo_reader import fetch_repo_data

logger = structlog.get_logger(__name__)

CACHE_TTL = timedelta(hours=24)
MODEL_VERSION = "gpt-4o-mini+gpt-4o"


def _is_cache_fresh(generated_at: datetime) -> bool:
    now = datetime.now(UTC)
    if generated_at.tzinfo is None:
        generated_at = generated_at.replace(tzinfo=UTC)
    return now - generated_at < CACHE_TTL


def _assemble_overview(abstraction: str, patterns: list[str]) -> str:
    overview = abstraction.rstrip(".") + "."
    if patterns:
        highlights = "; ".join(patterns[:3])
        overview += f" Key architectural patterns include {highlights}."
    return overview


def _assemble_markdown(
    repo_data: dict[str, Any],
    abstraction: str,
    patterns: list[str],
    rebuild_prompt: str,
) -> str:
    metadata = repo_data["metadata"]
    name = metadata["name"]
    language = metadata.get("language") or "unknown"
    topics = metadata.get("topics") or []
    topics_text = ", ".join(topics) if topics else "(none)"
    dep = repo_data.get("dependency_file")
    if dep:
        dep_excerpt = dep["content"][:800].strip()
        if len(dep["content"]) > 800:
            dep_excerpt += "\n..."
        tech_stack = f"```{dep['name']}\n{dep_excerpt}\n```"
    else:
        tech_stack = f"- Language: {language}\n- Topics: {topics_text}\n- Dependencies: (none found)"

    architecture = "\n".join(f"- {pattern}" for pattern in patterns) if patterns else "- (none identified)"

    overview = _assemble_overview(abstraction, patterns)

    return "\n\n".join(
        [
            f"# {name}",
            f"> {abstraction}",
            "## Overview",
            overview,
            "## Tech Stack",
            tech_stack,
            "## Architecture",
            architecture,
            "## Rebuild Prompt",
            rebuild_prompt,
        ]
    )


async def _get_fresh_cache(db: AsyncSession, repo_id: str) -> ContextCache | None:
    result = await db.execute(
        select(ContextCache)
        .where(ContextCache.repo_id == repo_id)
        .order_by(desc(ContextCache.generated_at))
        .limit(1)
    )
    cached = result.scalar_one_or_none()
    if cached is None or not _is_cache_fresh(cached.generated_at):
        return None
    return cached


async def generate_context(
    repo_id: str,
    db: AsyncSession,
    *,
    skip_cache: bool = False,
) -> AsyncGenerator[str, None]:
    """Run the context pipeline, yielding progress markers and final markdown."""
    pipeline_start = time.perf_counter()
    tokens_used = 0

    if not skip_cache:
        cached = await _get_fresh_cache(db, repo_id)
        if cached is not None:
            logger.info(
                "agent.cache_hit",
                repo_id=repo_id,
                cache_id=cached.id,
                duration_ms=int((time.perf_counter() - pipeline_start) * 1000),
            )
            yield "cache_hit"
            yield "tokens:0"
            yield cached.content_md
            return

    result = await db.execute(select(Repo).where(Repo.id == repo_id))
    repo = result.scalar_one_or_none()
    if repo is None:
        raise ValueError(f"Repo not found: {repo_id}")

    owner, name = repo.owner, repo.name

    step_start = time.perf_counter()
    yield "step:reading"
    repo_data = await fetch_repo_data(owner, name)
    logger.info("agent.step", step="reading", duration_ms=int((time.perf_counter() - step_start) * 1000))

    step_start = time.perf_counter()
    yield "step:abstraction"
    abstraction, step_tokens = await identify_core_abstraction(repo_data)
    tokens_used += step_tokens
    logger.info("agent.step", step="abstraction", duration_ms=int((time.perf_counter() - step_start) * 1000))

    step_start = time.perf_counter()
    yield "step:patterns"
    patterns, step_tokens = await extract_architecture_patterns(repo_data)
    tokens_used += step_tokens
    logger.info("agent.step", step="patterns", duration_ms=int((time.perf_counter() - step_start) * 1000))

    step_start = time.perf_counter()
    yield "step:rebuild_prompt"
    rebuild_prompt, step_tokens = await generate_rebuild_prompt(repo_data, abstraction, patterns)
    tokens_used += step_tokens
    logger.info(
        "agent.step", step="rebuild_prompt", duration_ms=int((time.perf_counter() - step_start) * 1000)
    )

    step_start = time.perf_counter()
    yield "step:assembling"
    content_md = _assemble_markdown(repo_data, abstraction, patterns, rebuild_prompt)
    logger.info("agent.step", step="assembling", duration_ms=int((time.perf_counter() - step_start) * 1000))

    cache_id = f"{repo_id}:{datetime.now(UTC).isoformat()}"
    db.add(
        ContextCache(
            id=cache_id,
            repo_id=repo_id,
            content_md=content_md,
            model_version=MODEL_VERSION,
        )
    )
    await db.commit()
    logger.info(
        "agent.complete",
        repo_id=repo_id,
        cache_id=cache_id,
        duration_ms=int((time.perf_counter() - pipeline_start) * 1000),
        tokens_used=tokens_used,
    )

    yield f"tokens:{tokens_used}"
    yield content_md
