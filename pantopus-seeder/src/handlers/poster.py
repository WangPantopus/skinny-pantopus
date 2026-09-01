"""Lambda handler for the content poster — humanizes and posts queued items to the Pantopus API."""

from __future__ import annotations

import logging
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from src.config.constants import (
    ENRICHMENT_CATEGORIES,
    MAX_JITTER_MINUTES,
    POSTING_SLOTS,
)
from src.config.region_registry import RegionConfig, load_active_regions, load_sources_for_region
from src.config.secrets import get_secrets
from src.pipeline.humanizer import humanize
from src.pipeline.poster import authenticate_curator, post_to_pantopus
from src.tapering.density_checker import allowed_categories, check_density, should_post_in_slot

log = logging.getLogger("seeder.handlers.poster")

PACIFIC = ZoneInfo("America/Los_Angeles")

# Slot detection tolerance: current hour must be within ±1 of the slot hour
_SLOT_TOLERANCE = 1


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Poster Lambda entry point. Triggered 3x/day by EventBridge at cadence times."""
    try:
        return _run(event, context)
    except Exception:
        log.exception("Poster handler failed with unhandled exception")
        return {"error": "unhandled_exception", "regions_processed": 0}


def _run(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Core poster logic."""
    force = event.get("force", False)

    # Determine current slot
    now_pt = datetime.now(PACIFIC)
    slot_name = _detect_slot(now_pt)

    if slot_name is None:
        if force:
            slot_name = "morning"
            log.info("Force mode: using slot '%s' (actual hour %d PT)", slot_name, now_pt.hour)
        else:
            log.info("Current hour %d PT does not match any posting slot", now_pt.hour)
            return {"skipped": "no_matching_slot", "hour": now_pt.hour}

    # Weekend rules (skipped in force mode)
    if not force:
        weekday = now_pt.weekday()  # 0=Mon, 6=Sun
        if weekday == 6:  # Sunday
            log.info("No posts on Sunday")
            return {"skipped": "sunday"}
        if weekday == 5 and slot_name != "morning":  # Saturday, non-morning
            log.info("Saturday: only morning slot allowed")
            return {"skipped": "saturday_non_morning"}

    # Jitter (skipped in force mode)
    if not force:
        jitter_seconds = random.randint(0, MAX_JITTER_MINUTES * 60)
        log.info("Applying %d seconds of jitter", jitter_seconds)
        time.sleep(jitter_seconds)

    # Init
    try:
        secrets = get_secrets()
    except Exception:
        log.exception("Failed to load or validate seeder secrets")
        return {"error": "secrets_load_failed", "regions_processed": 0}

    try:
        from supabase import create_client

        supabase = create_client(secrets.supabase_url, secrets.supabase_service_role_key)
    except Exception:
        log.exception("Failed to initialize Supabase client")
        return {"error": "supabase_init_failed", "regions_processed": 0}

    # Load regions dynamically from the database
    regions = load_active_regions(supabase)
    if not regions:
        log.warning("No active regions found in seeder_config")
        return {"error": "no_active_regions", "regions_processed": 0}

    summary = {
        "regions_processed": 0,
        "items_posted": 0,
        "items_failed": 0,
        "items_skipped": 0,
        "tapering_stages": {},
    }

    for region_cfg in regions:
        try:
            result = _process_region(region_cfg, slot_name, supabase, secrets)
            summary["regions_processed"] += 1
            summary["tapering_stages"][region_cfg.region] = result["stage"]
            if result["outcome"] == "posted":
                summary["items_posted"] += 1
            elif result["outcome"] == "failed":
                summary["items_failed"] += 1
            else:
                summary["items_skipped"] += 1
        except Exception:
            log.exception("Failed processing region %s", region_cfg.region)
            summary["regions_processed"] += 1
            summary["items_failed"] += 1

    return summary


def _detect_slot(now_pt: datetime) -> str | None:
    """Match the current Pacific hour to a posting slot (±1h tolerance)."""
    for slot_name, slot_hour in POSTING_SLOTS.items():
        if abs(now_pt.hour - slot_hour) <= _SLOT_TOLERANCE:
            return slot_name
    return None


def _process_region(region_cfg: RegionConfig, slot_name: str, supabase, secrets) -> dict:
    """Process a single region: tapering check → select → humanize → post."""
    region = region_cfg.region

    # Tapering — pass the region config directly
    metrics = check_density(supabase, region, region_cfg=region_cfg)
    stage = metrics.stage
    log.info("Region %s: stage=%s (%.1f posts/day, %d posters)",
             region, stage, metrics.avg_daily_posts, metrics.active_posters)

    if not should_post_in_slot(stage, slot_name):
        log.info("Slot %s suppressed for %s at stage %s", slot_name, region, stage)
        return {"stage": stage, "outcome": "skipped"}

    cats = allowed_categories(stage)

    candidates = _select_candidates_for_slot(supabase, region, cats, slot_name)
    if not candidates:
        log.info("No queued items for %s", region)
        return {"stage": stage, "outcome": "skipped"}

    for item in candidates:
        # Look up source display name
        source_display_name = _get_source_display_name(item.get("source", ""), region, supabase)

        # Humanize
        humanized_text, humanize_error = humanize(
            raw_title=item["raw_title"],
            raw_body=item.get("raw_body"),
            source_url=item.get("source_url"),
            source_display_name=source_display_name,
            category=item["category"],
            region=region,
            openai_api_key=secrets.openai_api_key,
            region_display_name=region_cfg.display_name,
        )

        if humanize_error or not humanized_text:
            reason = humanize_error or "empty_humanized_text"
            if reason == "ai_quality_gate:skipped":
                log.info(
                    "AI quality gate skipped item %s (%s): %s",
                    item["id"],
                    item["category"],
                    item["raw_title"][:80],
                )
                _update_queue_item(supabase, item["id"], "skipped", failure_reason=reason)
                continue

            log.warning("Humanizer failed for item %s: %s", item["id"], reason)
            _update_queue_item(supabase, item["id"], "failed", failure_reason=reason)
            return {"stage": stage, "outcome": "failed"}

        _update_queue_item(supabase, item["id"], "humanized", humanized_text=humanized_text)

        # Authenticate
        token = authenticate_curator(supabase, secrets.curator_email, secrets.curator_password)
        if token is None:
            log.error("Curator auth failed for region %s — resetting item to queued for retry", region)
            _update_queue_item(supabase, item["id"], "queued")
            return {"stage": stage, "outcome": "failed"}

        # Post (include media if present in the queue item)
        item_media_urls = item.get("media_urls") or []
        item_media_types = item.get("media_types") or []
        is_sports_item = item.get("category") == "sports"
        sports_metadata = _build_local_sports_metadata(item) if is_sports_item else None

        post_id, post_error = post_to_pantopus(
            api_base_url=secrets.pantopus_api_base_url,
            access_token=token,
            content=humanized_text,
            category=item["category"],
            region_lat=region_cfg.lat,
            region_lng=region_cfg.lng,
            media_urls=item_media_urls if item_media_urls else None,
            media_types=item_media_types if item_media_types else None,
            topic="sports" if is_sports_item else None,
            sports_scope="regional" if is_sports_item else None,
            post_metadata=sports_metadata,
        )

        if post_error:
            log.warning("Post failed for item %s: %s", item["id"], post_error)
            _update_queue_item(supabase, item["id"], "failed", failure_reason=post_error)
            return {"stage": stage, "outcome": "failed"}

        _update_queue_item(supabase, item["id"], "posted", post_id=post_id)
        log.info("Posted item %s to %s (post_id=%s)", item["raw_title"][:60], region, post_id)
        return {"stage": stage, "outcome": "posted"}

    log.info("All queued items for %s were skipped by the AI quality gate", region)
    return {"stage": stage, "outcome": "skipped"}


def _select_items(supabase, region: str, categories: list[str]) -> list[dict]:
    """Return queued items for posting, ranked best-first.

    Priority:
    1. safety/weather items
    2. Expiring events (published within 3 days of now)
    3. Seasonal (if none posted in last 7 days)
    4. Other categories, freshest first

    Prefers items from a different source/category than the most recent post.
    """
    try:
        # Get last posted source/category for diversity.
        last_posted = _get_last_posted_item(supabase, region)
        last_source = last_posted.get("source") if last_posted else None
        last_category = last_posted.get("category") if last_posted else None

        # Query all queued items for this region in allowed categories
        result = (
            supabase.table("seeder_content_queue")
            .select("*")
            .eq("status", "queued")
            .eq("region", region)
            .filter("category", "in", f'({",".join(categories)})')
            .order("fetched_at", desc=True)
            .limit(50)
            .execute()
        )

        if not result.data:
            return []

        items = result.data

        # Check if seasonal is allowed (none posted in last 7 days)
        seasonal_allowed = _is_seasonal_allowed(supabase, region)

        # Score and sort items
        scored = []
        for item in items:
            if item["category"] == "seasonal" and not seasonal_allowed:
                continue
            score = _score_item(item, last_source, last_category)
            scored.append((score, item))

        if not scored:
            return []

        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [item for _, item in scored]

    except Exception:
        log.exception("Failed to select item for %s", region)
        return []


def _select_item(supabase, region: str, categories: list[str]) -> dict | None:
    """Select the single best queued item for posting."""
    items = _select_items(supabase, region, categories)
    return items[0] if items else None


def _select_candidates_for_slot(
    supabase,
    region: str,
    categories: list[str],
    slot_name: str,
) -> list[dict]:
    """Pick candidates for a slot, reserving the evening slot for enrichment.

    In the evening slot, if (a) enrichment categories (sports, community_resource)
    are allowed at the current tapering stage, (b) enrichment items are queued,
    and (c) no P1 safety/weather alert is waiting, restrict the candidate pool
    to enrichment. This prevents P3 items from starving behind the steady
    stream of P1/P2 news. If no enrichment is available, fall back to the full
    allowed-category set so the slot is not wasted.
    """
    if slot_name != "evening":
        return _select_items(supabase, region, categories)

    enrichment_cats = [c for c in categories if c in ENRICHMENT_CATEGORIES]
    if not enrichment_cats:
        return _select_items(supabase, region, categories)

    if _has_queued_p1_alert(supabase, region):
        return _select_items(supabase, region, categories)

    enrichment_candidates = _select_items(supabase, region, enrichment_cats)
    if enrichment_candidates:
        log.info(
            "Evening slot reserved for enrichment in %s (%d candidates)",
            region,
            len(enrichment_candidates),
        )
        return enrichment_candidates

    return _select_items(supabase, region, categories)


def _has_queued_p1_alert(supabase, region: str) -> bool:
    """Return True if any P1 (priority=1) item is queued for this region.

    Fails *closed* (returns True) on error. A transient failure in this lookup
    must not let enrichment steal a slot from a waiting safety/weather alert;
    the caller simply falls back to the full category set, where P1 items
    outrank enrichment in the scorer anyway.
    """
    try:
        result = (
            supabase.table("seeder_content_queue")
            .select("id")
            .eq("status", "queued")
            .eq("region", region)
            .eq("source_priority", 1)
            .limit(1)
            .execute()
        )
        return bool(result.data)
    except Exception:
        log.warning(
            "Failed to check for P1 alerts in %s; assuming alert present",
            region, exc_info=True,
        )
        return True


def _score_item(
    item: dict,
    last_source: str | None,
    last_category: str | None = None,
) -> int:
    """Score an item for selection priority. Higher = better.

    Source priority (1-4) is the primary ranking signal:
      P1 (critical):    safety, weather, earthquakes — always surface first
      P2 (core):        local news, events, seasonal — the bread and butter
      P3 (enrichment):  community, sports — adds variety once community exists
      P4 (filler):      history, reddit — fun extras, lowest priority
    """
    score = 0

    # Source priority: P1 gets +4000, P2 +3000, P3 +2000, P4 +1000
    source_priority = item.get("source_priority", 2)
    score += (5 - source_priority) * 1000

    cat = item.get("category", "")

    # Category bonuses within the same priority tier
    if cat in ("safety", "weather", "earthquake"):
        score += 500
    elif cat == "event":
        score += 300
    elif cat == "seasonal":
        score += 100

    # Game-day local sports should not disappear behind routine P2 news during
    # a playoff run, but it must still stay below P1 alerts/weather.
    if _is_priority_local_sports_item(item):
        score += 1400

    # Source diversity bonus
    if last_source and item.get("source") != last_source:
        score += 50

    # General category rotation bonus.
    if last_category and cat != last_category:
        score += 75

    # Enrichment content otherwise starves behind a steady stream of core news.
    if (
        last_category
        and cat in ("sports", "community_resource")
        and last_category not in ("sports", "community_resource")
    ):
        score += 1050

    return score


def _is_priority_local_sports_item(item: dict) -> bool:
    """Return True for local playoff/game-day sports items worth surfacing."""
    if item.get("category") != "sports":
        return False

    haystack = " ".join([
        str(item.get("source") or ""),
        str(item.get("raw_title") or ""),
        str(item.get("raw_body") or ""),
    ]).lower()

    team_tokens = (
        "trail_blazers",
        "trail blazers",
        "blazers",
        "timbers",
        "thorns",
        "mariners",
        "seahawks",
        "kraken",
        "sounders",
    )
    urgency_tokens = (
        "playoff",
        "postseason",
        "game 5",
        "game 6",
        "game 7",
        "tonight",
        "elimination",
        "finals",
        "championship",
        "cup final",
    )

    return any(token in haystack for token in team_tokens) and any(
        token in haystack for token in urgency_tokens
    )


def _is_seasonal_allowed(supabase, region: str) -> bool:
    """Check if a seasonal post is allowed (none posted in last 7 days)."""
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        result = (
            supabase.table("seeder_content_queue")
            .select("id")
            .eq("status", "posted")
            .eq("region", region)
            .eq("category", "seasonal")
            .gte("updated_at", cutoff)
            .limit(1)
            .execute()
        )
        return len(result.data) == 0
    except Exception:
        log.warning("Failed to check seasonal history for %s", region, exc_info=True)
        return True  # Fail open


def _get_last_posted_item(supabase, region: str) -> dict | None:
    """Get source/category of the most recently posted item for this region."""
    try:
        result = (
            supabase.table("seeder_content_queue")
            .select("source, category")
            .eq("status", "posted")
            .eq("region", region)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
    except Exception:
        log.warning("Failed to get last posted item for %s", region, exc_info=True)
    return None


def _get_source_display_name(source_id: str, region: str, supabase) -> str:
    """Look up the display_name for a source_id from seeder_sources table."""
    try:
        source_configs = load_sources_for_region(supabase, region)
        for src in source_configs:
            if src.source_id == source_id:
                return src.display_name
    except Exception:
        log.warning("Failed to look up display name for %s", source_id, exc_info=True)
    return source_id


def _build_local_sports_metadata(item: dict) -> dict:
    """Infer lightweight sports metadata for regional seeded sports posts."""
    haystack = " ".join([
        str(item.get("source") or ""),
        str(item.get("raw_title") or ""),
        str(item.get("raw_body") or ""),
    ]).lower()

    league = "other"
    if any(token in haystack for token in ("trail_blazers", "trail blazers", "blazers", "nba")):
        league = "nba"
    elif any(token in haystack for token in ("seahawks", "nfl")):
        league = "nfl"
    elif any(token in haystack for token in ("timbers", "mls")):
        league = "mls"
    elif any(token in haystack for token in ("thorns", "nwsl")):
        league = "nwsl"
    elif any(token in haystack for token in ("mariners", "mlb")):
        league = "mlb"
    elif any(token in haystack for token in ("winterhawks", "nhl", "hockey")):
        league = "nhl"
    elif any(token in haystack for token in ("college", "ducks", "beavers", "vikings")):
        league = "college"
    elif any(token in haystack for token in ("youth", "school", "high school", "little league")):
        league = "youth"

    team_tag = None
    for tag, tokens in (
        ("blazers", ("trail_blazers", "trail blazers", "blazers")),
        ("timbers", ("timbers",)),
        ("thorns", ("thorns",)),
        ("seahawks", ("seahawks",)),
        ("mariners", ("mariners",)),
        ("winterhawks", ("winterhawks",)),
        ("ducks", ("ducks",)),
        ("beavers", ("beavers",)),
    ):
        if any(token in haystack for token in tokens):
            team_tag = tag
            break

    metadata = {"league": league}
    if team_tag:
        metadata["team_tag"] = team_tag
    return metadata


def _update_queue_item(
    supabase,
    item_id: str,
    status: str,
    humanized_text: str | None = None,
    post_id: str | None = None,
    failure_reason: str | None = None,
) -> bool:
    """Update a queue item's status and related fields. Returns True on success."""
    update: dict[str, Any] = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if humanized_text is not None:
        update["humanized_text"] = humanized_text
    if post_id is not None:
        update["post_id"] = post_id
    if failure_reason is not None:
        update["failure_reason"] = failure_reason

    try:
        supabase.table("seeder_content_queue").update(update).eq("id", item_id).execute()
        return True
    except Exception:
        log.exception("Failed to update queue item %s to status=%s", item_id, status)
        return False
