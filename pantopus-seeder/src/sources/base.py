"""Abstract base class for all content sources."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import datetime

from src.models.queue_item import RawContentItem
from src.utils.coordinates import parse_valid_coordinates


_log = logging.getLogger("seeder.sources.base")


def resolve_coordinates(config: dict, source_label: str) -> tuple[str, str]:
    """Parse lat/lng from a source config, falling back to region coordinates.

    Coordinate-based sources (nws_alerts, usgs_earthquakes) store their
    location in the ``url`` field as ``"lat,lng"``.  If that value is
    missing, unparseable, or null-island (0,0), this falls back to
    ``region_lat`` / ``region_lng`` which come from seeder_config.

    Raises ValueError only if neither source provides valid coordinates.
    """
    # Try url field first
    coords = (config.get("url") or "").split(",")
    if len(coords) >= 2:
        parsed = parse_valid_coordinates(coords[0].strip(), coords[1].strip())
        if parsed is not None:
            return coords[0].strip(), coords[1].strip()

    # Fall back to region coordinates
    region_lat = config.get("region_lat")
    region_lng = config.get("region_lng")
    if parse_valid_coordinates(region_lat, region_lng) is not None:
        _log.warning(
            "%s %s: url coordinates missing/invalid (url=%r), "
            "falling back to region coords (%s, %s)",
            source_label,
            config.get("source_id", "?"),
            config.get("url"),
            region_lat,
            region_lng,
        )
        return str(region_lat), str(region_lng)

    raise ValueError(
        f"{source_label} {config.get('source_id', '?')}: no valid coordinates — "
        f"url={config.get('url')!r}, region_lat={region_lat}, region_lng={region_lng}"
    )


class ContentSource(ABC):
    """Base class that all content sources must implement."""

    def __init__(self, config: dict) -> None:
        self.source_id: str = config["source_id"]
        self.region: str = config.get("region", "")
        self.category: str = config["category"]
        self.display_name: str = config.get("display_name", self.source_id)
        self.priority: int = int(config.get("priority", 2))
        self.log = logging.getLogger(f"seeder.sources.{self.source_id}")
        self.last_fetch_error: str | None = None

    @abstractmethod
    def fetch(self) -> list[RawContentItem]:
        """Fetch content items from this source."""

    def _clear_fetch_error(self) -> None:
        """Reset per-fetch error state before a new fetch attempt."""
        self.last_fetch_error = None

    def _set_fetch_error(self, reason: str) -> None:
        """Store a short machine-readable reason for the last fetch failure."""
        self.last_fetch_error = reason

    def _make_item(
        self,
        title: str,
        body: str | None = None,
        source_url: str | None = None,
        published_at: datetime | None = None,
        media_urls: list[str] | None = None,
        media_types: list[str] | None = None,
    ) -> RawContentItem:
        """Construct a RawContentItem with source fields pre-filled."""
        return RawContentItem(
            title=title,
            body=body,
            source_url=source_url,
            category=self.category,
            published_at=published_at,
            source_id=self.source_id,
            region=self.region,
            media_urls=media_urls or [],
            media_types=media_types or [],
        )
