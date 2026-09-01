"""Load active regions and their sources from the database.

Replaces the hardcoded REGIONS dict and sources_config.py with DB-driven
lookups against seeder_config and seeder_sources tables.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from src.utils.coordinates import parse_valid_coordinates

log = logging.getLogger("seeder.config.region_registry")


@dataclass(frozen=True)
class RegionConfig:
    """A single region's configuration, loaded from seeder_config."""

    region: str
    lat: float
    lng: float
    radius_meters: int
    timezone: str
    display_name: str
    curator_user_id: str


@dataclass(frozen=True)
class SourceConfig:
    """A single content source definition, loaded from seeder_sources."""

    source_id: str
    source_type: str
    url: str | None
    category: str
    display_name: str
    region: str
    priority: int = 2  # 1=critical, 2=core, 3=enrichment, 4=filler


def load_active_regions(supabase_client) -> list[RegionConfig]:
    """Load all active regions from seeder_config.

    Returns an empty list on failure (never raises).
    """
    try:
        result = (
            supabase_client.table("seeder_config")
            .select("region, lat, lng, radius_meters, timezone, display_name, curator_user_id")
            .eq("active", True)
            .execute()
        )
        regions = []
        for row in result.data or []:
            try:
                parsed = parse_valid_coordinates(row.get("lat"), row.get("lng"))
                if parsed is None:
                    raise ValueError(
                        f"invalid coordinates lat={row.get('lat')!r} lng={row.get('lng')!r}"
                    )
                lat, lng = parsed
                regions.append(RegionConfig(
                    region=row["region"],
                    lat=lat,
                    lng=lng,
                    radius_meters=int(row.get("radius_meters", 25000)),
                    timezone=row.get("timezone", "America/Los_Angeles"),
                    display_name=row.get("display_name", row["region"]),
                    curator_user_id=row["curator_user_id"],
                ))
            except (KeyError, TypeError, ValueError) as exc:
                log.warning("Skipping malformed seeder_config row: %s", exc)
        return regions
    except Exception:
        log.exception("Failed to load active regions from seeder_config")
        return []


def load_sources_for_region(supabase_client, region: str) -> list[SourceConfig]:
    """Load active sources for a region from seeder_sources.

    Returns an empty list on failure (never raises).
    """
    try:
        result = (
            supabase_client.table("seeder_sources")
            .select("source_id, source_type, url, category, display_name, region, priority")
            .eq("region", region)
            .eq("active", True)
            .execute()
        )
        sources = []
        for row in result.data or []:
            try:
                sources.append(SourceConfig(
                    source_id=row["source_id"],
                    source_type=row["source_type"],
                    url=row.get("url"),
                    category=row["category"],
                    display_name=row.get("display_name", row["source_id"]),
                    region=row["region"],
                    priority=int(row.get("priority", 2)),
                ))
            except (KeyError, TypeError) as exc:
                log.warning("Skipping malformed seeder_sources row: %s", exc)
        return sources
    except Exception:
        log.exception("Failed to load sources for region %s", region)
        return []
