"""Stage 3 test — full pipeline with real DB (cache check, stream, cache write).

What this tests:
  - Connects to Neon Postgres and finds a real repo
  - Runs the full generate_context() generator (same code the SSE endpoint calls)
  - Streams every progress event and the final markdown to the terminal
  - On a SECOND run it should instantly return "cache_hit" (no OpenAI calls)

Usage:
  cd api && source .venv/bin/activate
  python test_stage3.py
  python test_stage3.py --repo-index 2
  python test_stage3.py --ensure-schema   # create missing tables (context_cache)

Requires in .env:
  DATABASE_URL, OPENAI_API_KEY
  GITHUB_TOKEN (recommended — avoids GitHub rate limits)
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import delete, select, text

from config import get_settings
from db.models import ContextCache, Repo
from db.session import get_engine, get_session_factory, init_db, test_connection
from services.context_agent.agent import generate_context

EXPECTED_STEPS = (
    "step:reading",
    "step:abstraction",
    "step:patterns",
    "step:rebuild_prompt",
    "step:assembling",
)


def make_db():
    return get_session_factory()()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Test context agent stage 3 pipeline")
    parser.add_argument(
        "--repo-index",
        type=int,
        default=0,
        help="Which repo to use from the first 5 in the DB (default: 0)",
    )
    parser.add_argument(
        "--ensure-schema",
        action="store_true",
        help="Run init_db() before tests (creates context_cache if missing)",
    )
    parser.add_argument(
        "--skip-run2",
        action="store_true",
        help="Skip the cache-hit verification run",
    )
    parser.add_argument(
        "--clear-cache",
        action="store_true",
        help="Delete context_cache rows for the chosen repo before RUN 1",
    )
    return parser.parse_args()


async def ensure_prerequisites(*, ensure_schema: bool) -> list[str]:
    """Return list of fatal errors; empty means OK."""
    errors: list[str] = []
    settings = get_settings()

    if not settings.database_url:
        errors.append("DATABASE_URL is not set in .env")
    if not settings.openai_api_key:
        errors.append("OPENAI_API_KEY is not set in .env")
    if not settings.github_token:
        print("⚠️  GITHUB_TOKEN not set — GitHub API may rate-limit during step:reading")

    if not await test_connection():
        errors.append("Database connection failed — check DATABASE_URL")
        return errors

    if ensure_schema:
        print("Ensuring ORM tables exist (init_db)...")
        await init_db()

    async with get_engine().connect() as conn:
        result = await conn.execute(
            text(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = 'context_cache')"
            )
        )
        if not result.scalar():
            errors.append(
                "Table context_cache does not exist. Re-run with --ensure-schema, or apply "
                "api/db/schema.sql on Neon."
            )

    return errors


async def pick_repo(index: int) -> Repo | None:
    async with make_db() as db:
        result = await db.execute(select(Repo).limit(5))
        repos = list(result.scalars().all())
        if not repos:
            return None
        print("Available repos in DB:")
        for i, r in enumerate(repos):
            print(f"  [{i}] {r.owner}/{r.name}  (id: {r.id})")
        print()
        if index < 0 or index >= len(repos):
            print(f"❌ --repo-index {index} out of range (0–{len(repos) - 1})")
            return None
        return repos[index]


async def run_pipeline(repo_id: str, label: str) -> bool:
    print("=" * 55)
    print(label)
    print("=" * 55)

    steps_seen: list[str] = []
    markdown: str | None = None
    cache_hit = False

    try:
        async with make_db() as db:
            async for chunk in generate_context(repo_id, db):
                if chunk == "cache_hit":
                    cache_hit = True
                    print("⚡ CACHE HIT — skipping all AI calls")
                elif chunk.startswith("tokens:"):
                    pass
                elif chunk.startswith("step:"):
                    steps_seen.append(chunk)
                    print(f"⏳ {chunk}")
                else:
                    markdown = chunk
                    preview = chunk[:500] + "\n..." if len(chunk) > 500 else chunk
                    print(f"\n✅ MARKDOWN RECEIVED ({len(chunk)} chars):\n")
                    print(preview)
    except Exception as exc:
        print(f"\n❌ Pipeline failed: {exc}")
        return False

    if cache_hit:
        ok = markdown is not None and len(markdown) > 0
        print(f"\n{'✅' if ok else '❌'} Cache run — markdown {'received' if ok else 'missing'}")
        return ok

    missing_steps = [s for s in EXPECTED_STEPS if s not in steps_seen]
    if missing_steps:
        print(f"\n❌ Missing steps: {', '.join(missing_steps)}")
        return False
    if not markdown:
        print("\n❌ No markdown content received")
        return False

    print(f"\n✅ Done — {len(steps_seen) + 1} event(s) received")
    print()
    return True


async def check_cache(repo_id: str) -> bool:
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
            return True
        print("❌ No cache row found in DB")
        return False


async def main() -> int:
    args = parse_args()

    errors = await ensure_prerequisites(ensure_schema=args.ensure_schema)
    if errors:
        for err in errors:
            print(f"❌ {err}")
        return 1

    repo = await pick_repo(args.repo_index)
    if repo is None:
        print("❌ No repos found in the database.")
        print("   Run the seed script first: python -m scripts.seed")
        return 1

    repo_id = repo.id
    print(f"Using repo: {repo.owner}/{repo.name} (id: {repo_id})\n")

    if args.clear_cache:
        async with make_db() as db:
            result = await db.execute(delete(ContextCache).where(ContextCache.repo_id == repo_id))
            await db.commit()
            print(f"Cleared {result.rowcount} cache row(s) for {repo_id}\n")

    if not await run_pipeline(repo_id, "RUN 1 — Full pipeline (AI calls, DB write)"):
        return 1

    print("Checking DB for cached result...")
    if not await check_cache(repo_id):
        return 1
    print()

    if args.skip_run2:
        print("Skipping RUN 2 (--skip-run2)")
        return 0

    if not await run_pipeline(repo_id, "RUN 2 — Should be instant cache hit"):
        return 1

    print("🎉 Stage 3 test passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
