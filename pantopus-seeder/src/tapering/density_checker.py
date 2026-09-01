"""Queries organic post volume and active poster count to determine tapering stage."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from src.config.constants import TAPERING_STAGES, TAPERING_THRESHOLDS
from src.models.queue_item import TaperingMetrics

if TYPE_CHECKING:
    from src.config.region_registry import RegionConfig

log = logging.getLogger("seeder.tapering.density_checker")

# Fallback thresholds if seeder_config query fails — matches migration defaults.
_DEFAULT_THRESHOLDS = TAPERING_THRESHOLDS


def check_density(
    supabase_client,
    region: str,
    *,
    region_cfg: RegionConfig | None = None,
) -> TaperingMetrics:
    """Query organic activity and return tapering metrics for a region.

    If region_cfg is provided, uses its lat/lng/radius directly.
    Otherwise falls back to loading from seeder_config in the DB.
    Falls back to stage='full' if the RPC call or config query fails.
    """
    # Get geographic parameters
    if region_cfg is not None:
        lat = region_cfg.lat
        lng = region_cfg.lng
        radius = region_cfg.radius_meters
    else:
        geo = _load_region_geo(supabase_client, region)
        if geo is None:
            log.warning("No geo config for region '%s', defaulting to full", region)
            return TaperingMetrics(avg_daily_posts=0, active_posters=0, stage="full")
        lat, lng, radius = geo

    # Fetch organic metrics via RPC
    try:
        result = supabase_client.rpc(
            "get_seeder_tapering_metrics",
            {
                "region_lat": lat,
                "region_lng": lng,
                "region_radius_meters": radius,
            },
        ).execute()

        data = result.data
        if isinstance(data, list) and len(data) > 0:
            data = data[0]

        avg_daily_posts = float(data.get("avg_daily_posts", 0))
        active_posters = int(data.get("active_posters", 0))
    except Exception:
        log.exception("RPC get_seeder_tapering_metrics failed for %s", region)
        return TaperingMetrics(avg_daily_posts=0, active_posters=0, stage="full")

    # Load per-region thresholds from seeder_config, fall back to defaults
    thresholds = _load_thresholds(supabase_client, region)

    stage = _determine_stage(avg_daily_posts, active_posters, thresholds)

    return TaperingMetrics(
        avg_daily_posts=avg_daily_posts,
        active_posters=active_posters,
        stage=stage,
    )


def _load_region_geo(supabase_client, region: str) -> tuple[float, float, int] | None:
    """Load lat/lng/radius from seeder_config for a region. Returns None if not found."""
    try:
        result = (
            supabase_client.table("seeder_config")
            .select("lat, lng, radius_meters")
            .eq("region", region)
            .limit(1)
            .execute()
        )
        if result.data:
            row = result.data[0]
            return (float(row["lat"]), float(row["lng"]), int(row.get("radius_meters", 25000)))
    except Exception:
        log.warning("Failed to load geo config for region %s", region, exc_info=True)
    return None


def _load_thresholds(supabase_client, region: str) -> dict:
    """Load tapering thresholds from seeder_config, fall back to defaults."""
    try:
        result = (
            supabase_client.table("seeder_config")
            .select("tapering_thresholds")
            .eq("region", region)
            .limit(1)
            .execute()
        )
        if result.data and result.data[0].get("tapering_thresholds"):
            return result.data[0]["tapering_thresholds"]
    except Exception:
        log.warning("Failed to load seeder_config for %s, using defaults", region, exc_info=True)

    return _DEFAULT_THRESHOLDS


def _determine_stage(avg_daily_posts: float, active_posters: int, thresholds: dict) -> str:
    """Check thresholds from most restrictive to least, return first match."""
    for stage in ("dormant", "minimal", "reduced"):
        t = thresholds.get(stage, {})
        posts_threshold = t.get("organic_posts_per_day", float("inf"))
        posters_threshold = t.get("active_posters_7d", float("inf"))

        if avg_daily_posts >= posts_threshold or active_posters >= posters_threshold:
            return stage

    return "full"


def should_post_in_slot(stage: str, slot_name: str) -> bool:
    """Return True if the given time slot is allowed for this tapering stage."""
    stage_cfg = TAPERING_STAGES.get(stage, TAPERING_STAGES["full"])
    skip = stage_cfg.get("skip_slots", [])
    return slot_name not in skip


def allowed_categories(stage: str) -> list[str]:
    """Return the list of allowed content categories for this tapering stage."""
    stage_cfg = TAPERING_STAGES.get(stage, TAPERING_STAGES["full"])
    return list(stage_cfg["allowed_categories"])
