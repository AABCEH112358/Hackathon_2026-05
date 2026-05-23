"""Trending score inference endpoint."""

from __future__ import annotations

import math
import pickle
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import numpy as np
import structlog
import torch
from fastapi import APIRouter, Depends, HTTPException
from sklearn.preprocessing import StandardScaler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Repo, StarHistory
from db.session import get_db
from ml.trending_model import TrendingModel, raw_to_model_features
from schemas import TrendingScoresResponse

logger = structlog.get_logger(__name__)
router = APIRouter()

CHECKPOINT_DIR = Path(__file__).resolve().parent.parent / "ml" / "checkpoints"
MODEL_PATH = CHECKPOINT_DIR / "trending.pt"
SCALER_PATH = CHECKPOINT_DIR / "scaler.pkl"

_model = TrendingModel()
_scaler: StandardScaler | None = None


def _load_artifacts() -> None:
    global _scaler
    if not MODEL_PATH.is_file() or not SCALER_PATH.is_file():
        logger.warning(
            "trending.checkpoints_missing",
            model_path=str(MODEL_PATH),
            scaler_path=str(SCALER_PATH),
            hint="Run: python -m ml.train_trending",
        )
        return

    _model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu", weights_only=True))
    _model.eval()
    with SCALER_PATH.open("rb") as fh:
        _scaler = pickle.load(fh)
    logger.info("trending.model_loaded", path=str(MODEL_PATH))


_load_artifacts()


def _stars_at_or_before(history: list[tuple[date, int]], target: date) -> int | None:
    candidates = [(d, stars) for d, stars in history if d <= target]
    if not candidates:
        return None
    return max(candidates, key=lambda item: item[0])[1]


def _repo_features(
    repo: Repo,
    history: list[tuple[date, int]],
    *,
    today: date,
) -> list[float]:
    current_stars = float(repo.stars)
    stars_7d = _stars_at_or_before(history, today - timedelta(days=7))
    stars_30d = _stars_at_or_before(history, today - timedelta(days=30))
    growth_7d = current_stars - stars_7d if stars_7d is not None else 0.0
    growth_30d = current_stars - stars_30d if stars_30d is not None else 0.0

    fork_ratio = repo.forks / current_stars if current_stars > 0 else 0.0
    heuristic = math.sqrt(max(repo.stars, 0)) / 10.0

    if repo.last_commit_at is not None:
        age_days = max((datetime.now(UTC) - repo.last_commit_at).days, 1)
    else:
        age_days = 365

    return raw_to_model_features(
        current_stars=current_stars,
        growth_7d=growth_7d,
        growth_30d=growth_30d,
        fork_ratio=fork_ratio,
        commits_7d=heuristic,
        issues_7d=heuristic,
        age_days=float(age_days),
    )


@router.get("/scores", response_model=TrendingScoresResponse)
async def get_trending_scores(db: AsyncSession = Depends(get_db)) -> TrendingScoresResponse:
    """Score every repo in the database with the trending MLP."""
    if _scaler is None:
        raise HTTPException(
            status_code=503,
            detail="Trending model not trained. Run: python -m ml.train_trending",
        )

    repo_result = await db.execute(select(Repo))
    repos = repo_result.scalars().all()
    if not repos:
        return TrendingScoresResponse(scores={})

    repo_ids = [repo.id for repo in repos]
    history_cutoff = date.today() - timedelta(days=31)
    history_result = await db.execute(
        select(StarHistory.repo_id, StarHistory.date, StarHistory.stars).where(
            StarHistory.repo_id.in_(repo_ids),
            StarHistory.date >= history_cutoff,
        )
    )

    history_by_repo: dict[str, list[tuple[date, int]]] = {repo_id: [] for repo_id in repo_ids}
    for repo_id, hist_date, stars in history_result.all():
        history_by_repo[repo_id].append((hist_date, stars))

    today = date.today()
    feature_rows = [_repo_features(repo, history_by_repo[repo.id], today=today) for repo in repos]
    x_scaled = _scaler.transform(np.array(feature_rows, dtype=np.float32))

    with torch.no_grad():
        probs = _model(torch.from_numpy(x_scaled.astype(np.float32))).squeeze(1).tolist()

    scores = {repo.id: round(float(prob), 4) for repo, prob in zip(repos, probs, strict=True)}
    logger.info("trending.scores_served", count=len(scores))
    return TrendingScoresResponse(scores=scores)
