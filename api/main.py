"""Repo Pilot FastAPI application."""

import structlog
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from db.session import init_db, test_connection
from routes import repos
from routes.interactions import router as interactions_router
from routes.personalize import router as personalize_router
from routes.trending import router as trending_router

import logging

_log_level = getattr(logging, get_settings().log_level.upper(), logging.INFO)
logging.basicConfig(level=_log_level)
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
)

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logger.info("app.starting", log_level=settings.log_level)
    await test_connection()
    try:
        await init_db()
    except Exception as exc:
        logger.warning("app.init_db_skipped", error=str(exc))
    yield
    logger.info("app.shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Repo Pilot API",
        description="Isometric GitHub repo map — ingestion, layout, ML scoring",
        version="0.1.0",
        lifespan=lifespan,
    )

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(repos.router, prefix="/api/repos", tags=["repos"])
    app.include_router(trending_router, prefix="/api/trending")
    app.include_router(interactions_router, prefix="/api/interactions")
    app.include_router(personalize_router, prefix="/api/personalize")
    return app


app = create_app()
