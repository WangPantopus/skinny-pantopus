"""Pydantic models for seeder data structures."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, field_validator

# Valid values for the status column in seeder_content_queue
VALID_STATUSES = ("queued", "filtered_out", "humanized", "posted", "skipped", "failed")
VALID_CATEGORIES = (
    "local_news", "event", "weather", "seasonal", "community_resource", "safety",
    "air_quality", "earthquake", "history", "sports",
)


class QueueItem(BaseModel):
    """Represents a row in the seeder_content_queue table."""

    id: UUID | None = None
    source: str
    source_url: str | None = None
    raw_title: str
    raw_body: str | None = None
    region: str
    category: str
    fetched_at: datetime | None = None
    status: str = "queued"
    humanized_text: str | None = None
    post_id: UUID | None = None
    scheduled_for: datetime | None = None
    dedup_hash: str
    parent_id: UUID | None = None
    failure_reason: str | None = None
    media_urls: list[str] = []
    media_types: list[str] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(
                f"Invalid status '{v}'. Must be one of: {', '.join(VALID_STATUSES)}"
            )
        return v

    @field_validator("region")
    @classmethod
    def validate_region(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Region must not be empty")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            raise ValueError(
                f"Invalid category '{v}'. Must be one of: {', '.join(VALID_CATEGORIES)}"
            )
        return v


class RawContentItem(BaseModel):
    """An item coming out of a content source before queue insertion."""

    title: str
    body: str | None = None
    source_url: str | None = None
    category: str
    published_at: datetime | None = None
    source_id: str
    region: str
    media_urls: list[str] = []
    media_types: list[str] = []


class TaperingMetrics(BaseModel):
    """Organic activity metrics returned by the tapering RPC function."""

    avg_daily_posts: float
    active_posters: int
    stage: Literal["full", "reduced", "minimal", "dormant"]
