"""Pydantic request/response models."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SeedRequest(BaseModel):
    limit: int | None = Field(default=None, ge=1, le=5000)


class SeedResponse(BaseModel):
    ingested: int


class LayoutRepoItem(BaseModel):
    id: str
    name: str
    owner: str
    stars: int
    language: str | None
    tile_x: int
    tile_y: int
    height: int
    trending_score: float
    description_short: str


class LayoutResponse(BaseModel):
    repos: list[LayoutRepoItem]


class RepoDetailResponse(BaseModel):
    id: str
    github_id: int
    owner: str
    name: str
    description: str
    stars: int
    forks: int
    language: str
    topics: list[str]
    last_commit_at: datetime | None
    tile_x: int | None
    tile_y: int | None
    height: int
    trending_score: float
    similar_repo_ids: list[str]


class TrendingScoresResponse(BaseModel):
    scores: dict[str, float]


class InteractionRequest(BaseModel):
    user_id: str
    repo_id: str
    action: Literal["view", "click", "hover", "dwell"]
    duration_ms: int = 0


class InteractionResponse(BaseModel):
    ok: bool


class PersonalizeScoreRequest(BaseModel):
    user_id: str


class PersonalizeScoresResponse(BaseModel):
    scores: dict[str, float]
