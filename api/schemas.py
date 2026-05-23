"""Pydantic request/response models."""

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
