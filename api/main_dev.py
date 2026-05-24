"""Minimal FastAPI app for context-agent / stage-4 testing (no embeddings layout stack)."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from db.session import init_db, test_connection
from routes import context as context_route

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await test_connection()
    try:
        await init_db()
    except Exception:
        pass
    yield


settings = get_settings()
app = FastAPI(title="GitHub Atlas API (context dev)", lifespan=lifespan)
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(context_route.router, prefix="/api/context", tags=["context"])
