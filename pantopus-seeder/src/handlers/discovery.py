"""Lambda handler for region discovery — detects user clusters and provisions new regions.

Runs daily. Queries UserViewingLocation for active user positions, clusters
uncovered users, reverse-geocodes dense clusters, and provisions new
seeder_config + seeder_sources rows automatically.
"""

from __future__ import annotations

import logging
from typing import Any

from src.config.region_registry import load_active_regions
from src.config.secrets import get_secrets
from src.discovery.cluster import (
    DEFAULT_USER_THRESHOLD,
    CandidateRegion,
    UserPoint,
    find_candidates,
)
from src.discovery.geocode import reverse_geocode
from src.discovery.timezone import timezone_from_coords
from src.utils.coordinates import parse_valid_coordinates

log = logging.getLogger("seeder.handlers.discovery")

# Maximum new regions to create per invocation (safety limit)
_MAX_NEW_REGIONS_PER_RUN = 3


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Discovery Lambda entry point. Triggered daily by EventBridge."""
    try:
        return _run(event, context)
    except Exception:
        log.exception("Discovery handler failed with unhandled exception")
        return {"error": "unhandled_exception", "regions_discovered": 0}


def _run(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Core discovery logic."""
    try:
        secrets = get_secrets()
    except Exception:
        log.exception("Failed to load or validate seeder secrets")
        return {"error": "secrets_load_failed", "regions_discovered": 0}

    try:
        from supabase import create_client

        supabase = create_client(secrets.supabase_url, secrets.supabase_service_role_key)
    except Exception:
        log.exception("Failed to initialize Supabase client")
        return {"error": "supabase_init_failed", "regions_discovered": 0}

    # Load existing regions
    existing_regions_cfg = load_active_regions(supabase)
    existing_regions = [
        (r.lat, r.lng, r.radius_meters) for r in existing_regions_cfg
    ]
    existing_region_ids = {r.region for r in existing_regions_cfg}

    log.info("Loaded %d existing regions: %s", len(existing_regions), existing_region_ids)

    # Load user locations
    user_points = _load_user_locations(supabase)
    if not user_points:
        log.info("No user locations found")
        return {"regions_discovered": 0, "total_users": 0, "uncovered_users": 0}

    # Override threshold from event if provided (for testing)
    threshold = event.get("threshold", DEFAULT_USER_THRESHOLD)

    # Find candidate clusters
    candidates = find_candidates(user_points, existing_regions, threshold=threshold)

    if not candidates:
        log.info("No new region candidates found (threshold=%d)", threshold)
        return {
            "regions_discovered": 0,
            "total_users": len(user_points),
            "candidates_found": 0,
        }

    # Cap at safety limit
    candidates = candidates[:_MAX_NEW_REGIONS_PER_RUN]
    log.info("Found %d candidate region(s)", len(candidates))

    # Find curator user ID (reuse existing curator)
    curator_user_id = _find_curator_user_id(supabase)
    if not curator_user_id:
        log.error("No curator user found — cannot provision regions")
        return {"error": "no_curator_user", "candidates_found": len(candidates)}

    # Provision each candidate
    regions_created = []
    for candidate in candidates:
        result = _provision_region(
            supabase, candidate, curator_user_id, existing_region_ids
        )
        if result:
            regions_created.append(result)
            # Add to existing set to prevent duplicates within this run
            existing_region_ids.add(result["region_id"])
            existing_regions.append((candidate.lat, candidate.lng, candidate.radius_meters))

    log.info("Provisioned %d new region(s): %s",
             len(regions_created),
             [r["region_id"] for r in regions_created])

    return {
        "regions_discovered": len(regions_created),
        "total_users": len(user_points),
        "candidates_found": len(candidates),
        "regions_created": regions_created,
    }


def _load_user_locations(supabase) -> list[UserPoint]:
    """Load user viewing locations from the UserViewingLocation table."""
    try:
        result = (
            supabase.table("UserViewingLocation")
            .select("user_id, latitude, longitude")
            .execute()
        )

        points = []
        for row in result.data or []:
            lat = row.get("latitude")
            lng = row.get("longitude")
            uid = row.get("user_id")
            if lat is not None and lng is not None and uid:
                parsed = parse_valid_coordinates(lat, lng)
                if parsed is None:
                    continue  # skip null-island (unset locations)
                lat_f, lng_f = parsed
                points.append(UserPoint(user_id=str(uid), lat=lat_f, lng=lng_f))

        log.info("Loaded %d user viewing locations", len(points))
        return points
    except Exception:
        log.exception("Failed to load user viewing locations")
        return []


def _find_curator_user_id(supabase) -> str | None:
    """Find the existing curator user ID."""
    try:
        result = (
            supabase.table("User")
            .select("id")
            .eq("account_type", "curator")
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]["id"]
    except Exception:
        log.exception("Failed to find curator user")
    return None


def _provision_region(
    supabase,
    candidate: CandidateRegion,
    curator_user_id: str,
    existing_region_ids: set[str],
) -> dict | None:
    """Reverse-geocode and provision a new region from a candidate cluster.

    Returns a dict with region details, or None on failure.
    """
    # Reverse geocode to get a name
    geo = reverse_geocode(candidate.lat, candidate.lng)
    region_id = geo["region_id"]
    display_name = geo["display_name"]
    query = geo["query"]

    # Ensure unique region_id (append number if collision)
    base_id = region_id
    counter = 2
    while region_id in existing_region_ids:
        region_id = f"{base_id}_{counter}"
        counter += 1

    timezone = timezone_from_coords(candidate.lat, candidate.lng)
    coord_str = f"{candidate.lat},{candidate.lng}"

    log.info(
        "Provisioning region '%s' (%s) at (%.4f, %.4f) tz=%s with %d users",
        region_id, display_name, candidate.lat, candidate.lng, timezone, candidate.user_count,
    )

    # Create seeder_config row
    active_source_ids = [
        f"nws_alerts:{region_id}",
        f"usgs_earthquakes:{region_id}",
        f"google_news:{region_id}",
        f"seasonal:{region_id}",
    ]
    try:
        supabase.table("seeder_config").upsert({
            "region": region_id,
            "curator_user_id": curator_user_id,
            "active": True,
            "active_sources": active_source_ids,
            "lat": candidate.lat,
            "lng": candidate.lng,
            "radius_meters": candidate.radius_meters,
            "timezone": timezone,
            "display_name": display_name,
            "provisioned_by": "discovery",
        }, on_conflict="region").execute()
    except Exception:
        log.exception("Failed to create seeder_config for %s", region_id)
        return None

    # Create P1 + P2 sources (active by default)
    sources = [
        # P1: Critical — safety/weather
        {
            "source_id": f"nws_alerts:{region_id}",
            "source_type": "nws_alerts",
            "url": coord_str,
            "category": "weather",
            "display_name": "NWS Weather Alerts",
            "region": region_id,
            "active": True,
            "priority": 1,
        },
        {
            "source_id": f"usgs_earthquakes:{region_id}",
            "source_type": "usgs_earthquakes",
            "url": coord_str,
            "category": "earthquake",
            "display_name": "USGS Earthquakes",
            "region": region_id,
            "active": True,
            "priority": 1,
        },
        # P2: Core — local news + seasonal
        {
            "source_id": f"google_news:{region_id}",
            "source_type": "google_news",
            "url": query,
            "category": "local_news",
            "display_name": f"Google News ({display_name})",
            "region": region_id,
            "active": True,
            "priority": 2,
        },
        {
            "source_id": f"seasonal:{region_id}",
            "source_type": "seasonal",
            "url": None,
            "category": "seasonal",
            "display_name": "Pantopus Seasonal",
            "region": region_id,
            "active": True,
            "priority": 2,
        },
    ]

    for src in sources:
        try:
            supabase.table("seeder_sources").upsert(
                src, on_conflict="source_id,region"
            ).execute()
        except Exception:
            log.warning("Failed to create source %s for %s", src["source_id"], region_id, exc_info=True)

    return {
        "region_id": region_id,
        "display_name": display_name,
        "lat": candidate.lat,
        "lng": candidate.lng,
        "user_count": candidate.user_count,
        "google_news_query": query,
        "timezone": timezone,
    }
