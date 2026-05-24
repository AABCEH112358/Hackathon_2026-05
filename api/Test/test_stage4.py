"""Stage 4 test — HTTP SSE endpoint (end-to-end over real HTTP).

What this tests:
  - Hits the real FastAPI endpoint: GET /api/context/generate?repo_id=...
  - Parses named SSE events (progress, chunk, complete, error)
  - Validates progress, chunk content, and complete event

Prerequisites:
  Terminal 1 — API server must be running:
    cd api && source .venv/bin/activate
  uvicorn main_dev:app --reload --port 8000

  Terminal 2 — run this test:
    python test_stage4.py
    python test_stage4.py --repo-id huggingface/transformers
    python test_stage4.py --expect-cache-hit
    python test_stage4.py --regenerate
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

import httpx
from sqlalchemy import select

from config import get_settings
from db.models import Repo
from db.session import get_session_factory, test_connection

DEFAULT_BASE_URL = "http://localhost:8000"
PROGRESS_MESSAGES = (
    "Reading repo structure...",
    "Identifying core abstraction...",
    "Identifying patterns...",
    "Generating rebuild prompt...",
    "Assembling final context...",
)


def make_db():
    return get_session_factory()()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Test context agent SSE endpoint (stage 4)")
    parser.add_argument("--repo-id", type=str, default=None)
    parser.add_argument("--repo-index", type=int, default=0)
    parser.add_argument("--base-url", type=str, default=DEFAULT_BASE_URL)
    parser.add_argument(
        "--expect-cache-hit",
        action="store_true",
        help="Fail if complete.cached is not true",
    )
    parser.add_argument(
        "--regenerate",
        action="store_true",
        help="Pass regenerate=true to bypass cache",
    )
    parser.add_argument("--skip-server-check", action="store_true")
    return parser.parse_args()


async def pick_repo_id(explicit: str | None, index: int) -> str | None:
    if explicit:
        return explicit
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
        return repos[index].id


async def check_server(base_url: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{base_url}/docs")
            return response.status_code == 200
    except httpx.ConnectError:
        return False


def parse_sse_block(raw: str) -> tuple[str | None, dict | None]:
    event_name: str | None = None
    data: dict | None = None
    for line in raw.splitlines():
        if line.startswith("event:"):
            event_name = line[len("event:") :].strip()
        elif line.startswith("data:"):
            data = json.loads(line[len("data:") :].strip())
    return event_name, data


async def stream_sse(
    base_url: str,
    repo_id: str,
    *,
    expect_cache_hit: bool,
    regenerate: bool,
) -> bool:
    url = f"{base_url}/api/context/generate"
    params: dict[str, str | bool] = {"repo_id": repo_id}
    if regenerate:
        params["regenerate"] = True

    print("=" * 55)
    print(f"GET {url}?repo_id={repo_id}" + ("&regenerate=true" if regenerate else ""))
    print("=" * 55)

    progress_events: list[dict] = []
    chunk_content: str | None = None
    complete_event: dict | None = None
    error_events: list[dict] = []
    start = time.perf_counter()
    first_event_time: float | None = None

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("GET", url, params=params) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    print(f"❌ HTTP {response.status_code} — expected 200")
                    if body:
                        print(body.decode(errors="replace")[:500])
                    return False
                print(f"✅ HTTP {response.status_code}")

                ct = response.headers.get("content-type", "")
                if "text/event-stream" not in ct:
                    print(f"❌ Content-Type: {ct} — expected text/event-stream")
                    return False
                print(f"✅ Content-Type: {ct}\n")

                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    while "\n\n" in buffer:
                        raw, buffer = buffer.split("\n\n", 1)
                        event_name, data = parse_sse_block(raw)
                        if event_name is None or data is None:
                            continue

                        if first_event_time is None:
                            first_event_time = time.perf_counter() - start

                        elapsed = time.perf_counter() - start
                        if event_name == "progress":
                            progress_events.append(data)
                            print(
                                f"⏳ progress  — [{data.get('step')}] {data.get('message', '')}  "
                                f"({elapsed * 1000:.0f}ms)"
                            )
                        elif event_name == "chunk":
                            chunk_content = data.get("content", "")
                            print(f"\n✅ chunk     — {len(chunk_content)} chars  ({elapsed * 1000:.0f}ms)")
                            preview = chunk_content[:400] + "\n..." if len(chunk_content) > 400 else chunk_content
                            print(preview)
                        elif event_name == "complete":
                            complete_event = data
                            print(
                                f"\n✅ complete  — cached={data.get('cached')}, "
                                f"tokens_used={data.get('tokens_used')}  ({elapsed * 1000:.0f}ms)"
                            )
                        elif event_name == "error":
                            error_events.append(data)
                            print(f"\n❌ error     — {data.get('message')}")

    except httpx.ConnectError:
        print(f"❌ Could not connect to {base_url}")
        print("   cd api && uvicorn main_dev:app --reload --port 8000")
        return False
    except Exception as exc:
        print(f"❌ Unexpected error: {exc}")
        return False

    total_ms = (time.perf_counter() - start) * 1000

    print()
    print("=" * 55)
    print("VALIDATION")
    print("=" * 55)

    if error_events:
        for e in error_events:
            print(f"❌ Error event received: {e.get('message')}")
        return False

    if complete_event is None:
        print("❌ No complete event received")
        return False

    if chunk_content is None or len(chunk_content) == 0:
        print("❌ No chunk content received")
        return False

    if expect_cache_hit and not complete_event.get("cached"):
        print("❌ Expected cached=true in complete event")
        return False

    if regenerate and complete_event.get("cached"):
        print("❌ regenerate=true but complete.cached was true")
        return False

    print(f"✅ Progress events:    {len(progress_events)}")
    print(f"✅ Markdown length:    {len(chunk_content)} chars")
    print(f"✅ Cached:             {complete_event.get('cached')}")
    print(f"✅ Tokens used:        {complete_event.get('tokens_used')}")
    if first_event_time is not None:
        print(f"✅ Time to 1st event:  {first_event_time * 1000:.0f}ms")
    print(f"✅ Total duration:     {total_ms:.0f}ms")

    if complete_event.get("cached") and total_ms > 5000:
        print("⚠️  cached=true but slow — check DB latency or cold start")

    if not complete_event.get("cached") and len(progress_events) < len(PROGRESS_MESSAGES):
        print(f"⚠️  Expected ~{len(PROGRESS_MESSAGES)} progress events, got {len(progress_events)}")

    return True


async def main() -> int:
    args = parse_args()
    settings = get_settings()

    if not settings.database_url:
        print("❌ DATABASE_URL not set in .env")
        return 1
    if not await test_connection():
        print("❌ Database connection failed")
        return 1

    if not args.skip_server_check:
        print(f"Checking server at {args.base_url} ...")
        if not await check_server(args.base_url):
            print(f"❌ Server not reachable at {args.base_url}")
            return 1
        print("✅ Server is up\n")

    repo_id = await pick_repo_id(args.repo_id, args.repo_index)
    if not repo_id:
        print("❌ No repos in DB. Seed first: python -m scripts.seed")
        return 1

    print(f"Testing repo_id: {repo_id}\n")

    ok = await stream_sse(
        args.base_url,
        repo_id,
        expect_cache_hit=args.expect_cache_hit and not args.regenerate,
        regenerate=args.regenerate,
    )

    print()
    print("🎉 Stage 4 test passed" if ok else "❌ Stage 4 test FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
