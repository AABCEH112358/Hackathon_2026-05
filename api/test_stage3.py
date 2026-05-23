"""Stage 3 test — full pipeline with real DB (cache check, stream, cache write).

What this tests:
  - Connects to Neon Postgres and finds a real repo
  - Runs the full generate_context() generator (same code the SSE endpoint calls)
  - Streams every progress event and the final markdown to the terminal
  - On a SECOND run it should instantly return "cache_hit" (no OpenAI calls)

Deliverables (what success looks like):
  ✅ step:reading    → GitHub fetch works
  ✅ step:abstraction → OpenAI gpt-4o-mini call 1 works
  ✅ step:patterns   → OpenAI gpt-4o-mini call 2 works
  ✅ step:rebuild_prompt → OpenAI gpt-4o call works
  ✅ step:assembling → markdown assembled
  ✅ content (markdown) → printed to terminal
  ✅ DB row written to context_cache table
  ✅ Second run → instant cache_hit (no AI calls)
"""

import asyncio
import os
import sys

# Make sure the api/ directory is on the path
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select

from db.session import get_session_factory
from db.models import Repo, ContextCache
from services.context_agent.agent import generate_context


def make_db():
    """Return a new async session context manager."""
    return get_session_factory()()


async def pick_repo() -> Repo | None:
    """Pick the first repo from the DB to use for testing."""
    async with make_db() as db:
        result = await db.execute(select(Repo).limit(5))
        repos = result.scalars().all()
        if not repos:
            return None
        print("Available repos in DB:")
        for i, r in enumerate(repos):
            print(f"  [{i}] {r.owner}/{r.name}  (id: {r.id})")
        print()
        return repos[0]


async def run_pipeline(repo_id: str, label: str):
    print("=" * 55)
    print(f"{label}")
    print("=" * 55)
    async with make_db() as db:
        chunk_count = 0
        async for chunk in generate_context(repo_id, db):
            chunk_count += 1
            if chunk == "cache_hit":
                print("⚡ CACHE HIT — skipping all AI calls")
            elif chunk.startswith("step:"):
                print(f"⏳ {chunk}")
            else:
                preview = chunk[:500] + "\n..." if len(chunk) > 500 else chunk
                print(f"\n✅ MARKDOWN RECEIVED ({len(chunk)} chars):\n")
                print(preview)
        print(f"\n✅ Done — {chunk_count} event(s) received")
    print()


async def check_cache(repo_id: str):
    async with make_db() as db:
        result = await db.execute(
            select(ContextCache)
            .where(ContextCache.repo_id == repo_id)
            .order_by(ContextCache.generated_at.desc())
            .limit(1)
        )
        cached = result.scalar_one_or_none()
        if cached:
            print("✅ DB cache row confirmed:")
            print(f"   id:            {cached.id}")
            print(f"   generated_at:  {cached.generated_at}")
            print(f"   model_version: {cached.model_version}")
            print(f"   content_md:    {len(cached.content_md)} chars")
        else:
            print("❌ No cache row found in DB")
    print()


async def test():
    # --- FIND A REPO ---
    repo = await pick_repo()

    if repo is None:
        print("❌ No repos found in the database.")
        print("   Run the seed script first: .venv/bin/python -m scripts.seed")
        return

    repo_id = repo.id
    print(f"Using repo: {repo.owner}/{repo.name} (id: {repo_id})\n")

    # --- RUN 1: full pipeline ---
    await run_pipeline(repo_id, "RUN 1 — Full pipeline (AI calls, DB write)")

    # --- CHECK DB ---
    print("Checking DB for cached result...")
    await check_cache(repo_id)

    # --- RUN 2: should be instant cache hit ---
    await run_pipeline(repo_id, "RUN 2 — Should be instant cache hit")


asyncio.run(test())
