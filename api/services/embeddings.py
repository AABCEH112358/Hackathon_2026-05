"""Sentence-transformers embedding service."""

import asyncio
from functools import lru_cache

import structlog
from sentence_transformers import SentenceTransformer

from config import get_settings

logger = structlog.get_logger(__name__)


@lru_cache(maxsize=1)
def _load_model(model_name: str) -> SentenceTransformer:
    logger.info("embeddings.loading_model", model=model_name)
    return SentenceTransformer(model_name)


class EmbeddingService:
    """Wraps all-MiniLM-L6-v2 (384-dim) for repo text."""

    def __init__(self) -> None:
        settings = get_settings()
        self._model_name = settings.embedding_model
        self._dim = settings.embedding_dim

    @property
    def dimension(self) -> int:
        return self._dim

    def _encode_sync(self, texts: list[str]) -> list[list[float]]:
        model = _load_model(self._model_name)
        vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return [v.tolist() for v in vectors]

    async def encode_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._encode_sync, texts)

    async def encode_one(self, text: str) -> list[float]:
        results = await self.encode_batch([text])
        return results[0]

    @staticmethod
    def repo_text(description: str | None, topics: list[str]) -> str:
        parts: list[str] = []
        if description:
            parts.append(description.strip())
        if topics:
            parts.append(" ".join(topics))
        return " ".join(parts) if parts else "no description"


def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()
