"""CLI: seed repos and warm layout cache."""

import asyncio
import sys

import structlog

structlog.configure(processors=[structlog.dev.ConsoleRenderer()])

from config import get_settings
from db.session import get_session_factory, init_db, test_connection
from services.github_ingestion import GitHubIngestionService
from services.layout import LayoutService

logger = structlog.get_logger(__name__)


async def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else get_settings().github_seed_limit
    if not await test_connection():
        logger.error("seed.aborted", reason="database unreachable")
        sys.exit(1)

    await init_db()
    factory = get_session_factory()
    async with factory() as session:
        ingestion = GitHubIngestionService(session)
        count = await ingestion.ingest_top_repos(limit=limit)
        await session.commit()
        logger.info("seed.ingested", count=count)

        layout = LayoutService(session)
        updated = await layout.compute_and_cache_layout()
        await session.commit()
        logger.info("seed.layout_cached", tiles=updated)


if __name__ == "__main__":
    asyncio.run(main())
