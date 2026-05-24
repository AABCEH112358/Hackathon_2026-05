"""Personalization scoring endpoint."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import structlog
import torch
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Repo
from db.session import get_db
from ml.personalization_model import PersonalizationModel
from schemas import PersonalizeScoreRequest, PersonalizeScoresResponse

logger = structlog.get_logger(__name__)
router = APIRouter()

CHECKPOINT_DIR = Path(__file__).resolve().parent.parent / "ml" / "checkpoints"
MODEL_PATH = CHECKPOINT_DIR / "personalize.pt"
USER_INDEX_PATH = CHECKPOINT_DIR / "user_index.json"

_model: PersonalizationModel | None = None
_user_index: dict[str, int] | None = None


def _load_artifacts() -> None:
    global _model, _user_index
    if not MODEL_PATH.is_file() or not USER_INDEX_PATH.is_file():
        logger.warning(
            "personalize.checkpoints_missing",
            model_path=str(MODEL_PATH),
            user_index_path=str(USER_INDEX_PATH),
            hint="Run: python -m ml.train_personalize",
        )
        return

    with USER_INDEX_PATH.open(encoding="utf-8") as fh:
        _user_index = json.load(fh)

    _model = PersonalizationModel(num_users=len(_user_index))
    _model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu", weights_only=True))
    _model.eval()
    logger.info(
        "personalize.model_loaded",
        path=str(MODEL_PATH),
        users=len(_user_index),
    )


_load_artifacts()


@router.post("/score", response_model=PersonalizeScoresResponse)
async def score_personalization(
    body: PersonalizeScoreRequest,
    db: AsyncSession = Depends(get_db),
) -> PersonalizeScoresResponse:
    """Return personalization scores for every repo for the given user."""
    repo_result = await db.execute(
        select(Repo.id, Repo.embedding).where(Repo.embedding.is_not(None))
    )
    rows = repo_result.all()
    if not rows:
        return PersonalizeScoresResponse(scores={})

    if _model is None or _user_index is None:
        raise HTTPException(
            status_code=503,
            detail="Personalization model not trained. Run: python -m ml.train_personalize",
        )

    repo_ids = [repo_id for repo_id, _ in rows]
    if body.user_id not in _user_index:
        scores = {repo_id: 0.0 for repo_id in repo_ids}
        logger.info(
            "personalize.cold_start",
            user_id=body.user_id,
            count=len(scores),
        )
        return PersonalizeScoresResponse(scores=scores)

    user_idx = _user_index[body.user_id]
    embeddings = np.array(
        [np.asarray(embedding, dtype=np.float32) for _, embedding in rows],
        dtype=np.float32,
    )
    user_tensor = torch.full((len(rows),), user_idx, dtype=torch.long)
    repo_tensor = torch.from_numpy(embeddings)

    with torch.no_grad():
        raw_scores = _model.score(user_tensor, repo_tensor).tolist()

    scores = {
        repo_id: round(float(score), 4)
        for repo_id, score in zip(repo_ids, raw_scores, strict=True)
    }
    logger.info(
        "personalize.scores_served",
        user_id=body.user_id,
        count=len(scores),
    )
    return PersonalizeScoresResponse(scores=scores)
