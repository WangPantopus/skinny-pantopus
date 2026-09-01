"""Source registry — returns content sources for a given region.

Supports two modes:
  1. DB-driven: pass a list of SourceConfig objects (from region_registry)
  2. Legacy: pass a region name to look up from hardcoded sources_config
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from src.sources.air_quality import AirQualitySource
from src.sources.base import ContentSource
from src.sources.google_news import GoogleNewsSource
from src.sources.nws_alerts import NwsAlertsSource
from src.sources.on_this_day import OnThisDaySource
from src.sources.rss import RssSource
from src.sources.seasonal import SeasonalSource
from src.sources.usgs_earthquakes import UsgsEarthquakeSource

if TYPE_CHECKING:
    from src.config.region_registry import SourceConfig

log = logging.getLogger("seeder.sources.registry")

_SOURCE_TYPE_MAP: dict[str, type[ContentSource]] = {
    "rss": RssSource,
    "seasonal": SeasonalSource,
    "google_news": GoogleNewsSource,
    "nws_alerts": NwsAlertsSource,
    "air_quality": AirQualitySource,
    "usgs_earthquakes": UsgsEarthquakeSource,
    "on_this_day": OnThisDaySource,
}


def get_sources_from_db(
    source_configs: list[SourceConfig],
    region_lat: float | None = None,
    region_lng: float | None = None,
) -> list[ContentSource]:
    """Instantiate ContentSource objects from DB-loaded SourceConfig list.

    region_lat/region_lng are passed as fallback coordinates for sources
    that need a location (e.g. nws_alerts, usgs_earthquakes) when the
    source's own url field is missing or invalid.
    """
    sources: list[ContentSource] = []

    for sc in source_configs:
        cls = _SOURCE_TYPE_MAP.get(sc.source_type)
        if cls is None:
            log.warning("Unknown source_type '%s', skipping %s", sc.source_type, sc.source_id)
            continue

        config = {
            "source_id": sc.source_id,
            "source_type": sc.source_type,
            "url": sc.url,
            "category": sc.category,
            "display_name": sc.display_name,
            "region": sc.region,
            "priority": sc.priority,
            "region_lat": region_lat,
            "region_lng": region_lng,
        }
        try:
            sources.append(cls(config))
        except Exception:
            log.warning("Failed to instantiate source %s", sc.source_id, exc_info=True)

    return sources


def get_sources(region: str) -> list[ContentSource]:
    """Legacy: return sources from hardcoded sources_config.py.

    Kept for backward compatibility and tests. New code should use
    get_sources_from_db() with SourceConfig objects from region_registry.
    """
    from src.config.sources_config import get_sources_for_region

    configs = get_sources_for_region(region)
    sources: list[ContentSource] = []

    for config in configs:
        source_type = config.get("source_type", "")
        cls = _SOURCE_TYPE_MAP.get(source_type)
        if cls is None:
            log.warning("Unknown source_type '%s', skipping %s", source_type, config.get("source_id"))
            continue

        config_with_region = {**config, "region": region}
        sources.append(cls(config_with_region))

    return sources
