"""Lambda handler for no-bid gig poster nudge notifications.

Triggered every 6 hours by EventBridge.
Finds open gigs posted 24-48 hours ago with zero bids,
checks whether the poster has a verified home address,
and sends an encouraging push notification + in-app notification
via the Node backend.

Supports an optional one-time backfill for older gigs created before a
configured cutoff. Dedup uses AlertNotificationHistory so each gig is nudged
once.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from src.config.secrets import get_briefing_secrets, BriefingSecrets
from src.utils.supabase_errors import is_missing_table_error, log_missing_table_once

logging.basicConfig(level=logging.INFO, force=True)
log = logging.getLogger("seeder.handlers.no_bid_nudge")

SEND_TIMEOUT_S = 15
QUERY_BATCH_SIZE = 1000
MIN_AGE_HOURS = 24
MAX_AGE_HOURS = 48
BACKFILL_CUTOFF_ENV = "NO_BID_NUDGE_BACKFILL_BEFORE"


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """No-bid gig nudge Lambda entry point."""
    try:
        return _run(event, context)
    except Exception:
        log.exception("No-bid nudge handler failed")
        return {"error": "unhandled_exception"}


def _run(event: dict[str, Any], context: Any) -> dict[str, Any]:
    start_ms = time.monotonic_ns() // 1_000_000
    try:
        secrets = get_briefing_secrets()
    except Exception:
        log.exception("Failed to load or validate briefing secrets")
        return {"error": "secrets_load_failed"}

    try:
        from supabase import create_client
        supabase = create_client(secrets.supabase_url, secrets.supabase_service_role_key)
    except Exception:
        log.exception("Failed to initialize Supabase client")
        return {"error": "supabase_init_failed"}

    stats: dict[str, int] = {
        "gigs_checked": 0,
        "nudges_sent": 0,
        "skipped_has_bids": 0,
        "skipped_dedup": 0,
        "errors": 0,
    }

    try:
        gigs = _fetch_candidate_gigs(
            supabase,
            backfill_before_iso=_get_backfill_cutoff_iso(),
        )
    except Exception:
        log.exception("Failed to query Gig table")
        stats["errors"] += 1
        _publish_metrics(stats, start_ms)
        return {"error": "gig_query_failed", **stats}

    if not gigs:
        log.info("No candidate gigs found")
        _publish_metrics(stats, start_ms)
        return stats

    stats["gigs_checked"] = len(gigs)
    log.info("Found %d candidate gigs", len(gigs))

    # 2. Batch-check bids for all candidate gigs
    gig_ids = [g["id"] for g in gigs]
    gigs_with_bids = _get_gigs_with_bids(supabase, gig_ids)
    sent_dedup_keys = _get_sent_dedup_keys(
        supabase,
        [f"no_bid_nudge_{gig_id}" for gig_id in gig_ids],
    )

    # 3. Filter to no-bid gigs that haven't been nudged yet
    eligible_gigs: list[dict] = []
    for gig in gigs:
        if gig["id"] in gigs_with_bids:
            stats["skipped_has_bids"] += 1
            continue
        dedup_key = f"no_bid_nudge_{gig['id']}"
        if dedup_key in sent_dedup_keys:
            stats["skipped_dedup"] += 1
            continue
        eligible_gigs.append(gig)

    # 4. Group by poster — send ONE notification per poster listing all their no-bid gigs
    poster_gigs: dict[str, list[dict]] = {}
    for gig in eligible_gigs:
        pid = gig["user_id"]
        if pid not in poster_gigs:
            poster_gigs[pid] = []
        poster_gigs[pid].append(gig)

    for poster_id, user_gigs in poster_gigs.items():
        # Check if poster has a verified home address (once per poster, not per gig)
        has_home = _user_has_verified_home(supabase, poster_id)

        # Record dedup for all gigs before sending (prevents duplicates on retry)
        for gig in user_gigs:
            _record_sent(supabase, f"no_bid_nudge_{gig['id']}")

        # Build a single notification for this poster
        gig_titles = [g.get("title") or "your gig" for g in user_gigs]
        first_gig_id = user_gigs[0]["id"]

        result = _send_nudge(secrets, poster_id, first_gig_id, gig_titles, has_home)
        if result == "sent":
            stats["nudges_sent"] += 1
            log.info(
                "Nudge sent: poster=%s gigs=%d hasHome=%s",
                poster_id[:8], len(user_gigs), has_home,
            )
        else:
            stats["errors"] += 1
            log.warning("Nudge failed: poster=%s result=%s", poster_id[:8], result)

    _publish_metrics(stats, start_ms)

    elapsed_ms = time.monotonic_ns() // 1_000_000 - start_ms
    log.info(
        "No-bid nudge complete: checked=%d sent=%d bids=%d dedup=%d errors=%d latency=%dms",
        stats["gigs_checked"], stats["nudges_sent"],
        stats["skipped_has_bids"], stats["skipped_dedup"],
        stats["errors"], elapsed_ms,
    )
    return stats


# ── Helpers ──────────────────────────────────────────────────────


def _get_backfill_cutoff_iso() -> str | None:
    raw = (os.environ.get(BACKFILL_CUTOFF_ENV) or "").strip()
    if not raw:
        return None
    try:
        datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return raw
    except ValueError:
        log.warning(
            "Ignoring invalid %s value: %s",
            BACKFILL_CUTOFF_ENV,
            raw,
        )
        return None


def _fetch_candidate_gigs(
    supabase,
    *,
    backfill_before_iso: str | None,
    now: datetime | None = None,
) -> list[dict]:
    """Fetch rolling-window gigs plus an optional one-time backfill slice."""
    now = now or datetime.now(timezone.utc)
    rolling_min_cutoff = (now - timedelta(hours=MAX_AGE_HOURS)).isoformat()
    rolling_max_cutoff = (now - timedelta(hours=MIN_AGE_HOURS)).isoformat()

    gigs_by_id: dict[str, dict] = {}

    rolling_gigs = _fetch_open_gigs(
        supabase,
        created_at_gte=rolling_min_cutoff,
        created_at_lte=rolling_max_cutoff,
    )
    for gig in rolling_gigs:
        gigs_by_id[gig["id"]] = gig

    if backfill_before_iso:
        backfill_gigs = _fetch_open_gigs(
            supabase,
            created_at_lte=rolling_max_cutoff,
            created_at_lt=backfill_before_iso,
        )
        for gig in backfill_gigs:
            gigs_by_id.setdefault(gig["id"], gig)

    return list(gigs_by_id.values())


def _fetch_open_gigs(
    supabase,
    *,
    created_at_gte: str | None = None,
    created_at_lte: str | None = None,
    created_at_lt: str | None = None,
) -> list[dict]:
    """Fetch open gigs in batches with optional created_at filters."""
    gigs: list[dict] = []
    offset = 0

    while True:
        query = (
            supabase.table("Gig")
            .select("id, user_id, title")
            .eq("status", "open")
            .order("created_at", desc=False)
        )
        if created_at_gte:
            query = query.gte("created_at", created_at_gte)
        if created_at_lte:
            query = query.lte("created_at", created_at_lte)
        if created_at_lt:
            query = query.lt("created_at", created_at_lt)

        result = query.range(offset, offset + QUERY_BATCH_SIZE - 1).execute()
        batch = result.data or []
        gigs.extend(batch)
        if len(batch) < QUERY_BATCH_SIZE:
            break
        offset += QUERY_BATCH_SIZE

    return gigs


def _get_gigs_with_bids(supabase, gig_ids: list[str]) -> set[str]:
    """Return the set of gig IDs that have at least one bid."""
    if not gig_ids:
        return set()
    try:
        with_bids: set[str] = set()
        for chunk in _chunked(gig_ids, QUERY_BATCH_SIZE):
            result = (
                supabase.table("GigBid")
                .select("gig_id")
                .in_("gig_id", chunk)
                .execute()
            )
            with_bids.update(row["gig_id"] for row in (result.data or []))
        return with_bids
    except Exception:
        log.exception("Failed to query GigBid")
        return set()


def _user_has_verified_home(supabase, user_id: str) -> bool:
    """Check if user has at least one active, verified home occupancy."""
    try:
        result = (
            supabase.table("HomeOccupancy")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .eq("verification_status", "verified")
            .limit(1)
            .execute()
        )
        return (result.count or 0) > 0
    except Exception:
        log.warning("Failed to check HomeOccupancy for user=%s", user_id[:8], exc_info=True)
        return False


def _get_sent_dedup_keys(supabase, dedup_keys: list[str]) -> set[str]:
    """Return dedup keys that already exist in AlertNotificationHistory."""
    if not dedup_keys:
        return set()
    try:
        already_sent: set[str] = set()
        for chunk in _chunked(dedup_keys, QUERY_BATCH_SIZE):
            result = (
                supabase.table("AlertNotificationHistory")
                .select("alert_id")
                .eq("alert_type", "no_bid_nudge")
                .in_("alert_id", chunk)
                .execute()
            )
            already_sent.update(row["alert_id"] for row in (result.data or []))
        return already_sent
    except Exception as exc:
        if is_missing_table_error(exc, "AlertNotificationHistory"):
            log_missing_table_once(log, "AlertNotificationHistory", "no-bid nudge dedup", exc)
        return set()


def _record_sent(supabase, dedup_key: str) -> None:
    """Record that a nudge was sent for permanent dedup."""
    try:
        supabase.table("AlertNotificationHistory").insert({
            "alert_type": "no_bid_nudge",
            "alert_id": dedup_key,
            "geohash": "global",
            "headline": dedup_key,
            "users_notified": 1,
            "expires_at": None,
        }).execute()
    except Exception as exc:
        if is_missing_table_error(exc, "AlertNotificationHistory"):
            log_missing_table_once(log, "AlertNotificationHistory", "no-bid nudge dedup writes", exc)
        else:
            log.warning("Failed to record nudge dedup for %s", dedup_key, exc_info=True)


def _chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[idx:idx + size] for idx in range(0, len(items), size)]


def _send_nudge(
    secrets: BriefingSecrets,
    user_id: str,
    first_gig_id: str,
    gig_titles: list[str],
    has_home: bool,
) -> str:
    """Call Node backend to create notification + send push.

    Sends a single notification per poster. If they have multiple no-bid gigs,
    the title references the first gig and the count.
    """
    if len(gig_titles) == 1:
        display_title = gig_titles[0]
    else:
        display_title = f"{gig_titles[0]} and {len(gig_titles) - 1} other gig{'s' if len(gig_titles) > 2 else ''}"

    try:
        url = f"{secrets.pantopus_api_base_url}/api/internal/briefing/no-bid-nudge"
        resp = httpx.post(
            url,
            json={
                "userId": user_id,
                "gigId": first_gig_id,
                "gigTitle": display_title,
                "hasHome": has_home,
            },
            headers={
                "Content-Type": "application/json",
                "x-internal-api-key": secrets.internal_api_key,
            },
            timeout=SEND_TIMEOUT_S,
        )
        if resp.status_code == 200:
            return resp.json().get("status", "failed")
        log.warning("Backend returned %d for user=%s", resp.status_code, user_id[:8])
        return "failed"
    except Exception:
        log.warning("Nudge push failed for user=%s", user_id[:8], exc_info=True)
        return "failed"


def _publish_metrics(stats: dict, start_ms: int) -> None:
    elapsed_ms = time.monotonic_ns() // 1_000_000 - start_ms
    try:
        import boto3
        env = os.environ.get("ENVIRONMENT", "production")
        cw = boto3.client("cloudwatch")
        cw.put_metric_data(
            Namespace=f"Pantopus/NoBidNudge/{env}",
            MetricData=[
                {"MetricName": "GigsChecked", "Value": stats.get("gigs_checked", 0), "Unit": "Count"},
                {"MetricName": "NudgesSent", "Value": stats.get("nudges_sent", 0), "Unit": "Count"},
                {"MetricName": "NudgeErrors", "Value": stats.get("errors", 0), "Unit": "Count"},
                {"MetricName": "NudgeLatencyMs", "Value": elapsed_ms, "Unit": "Milliseconds"},
            ],
        )
    except Exception:
        log.warning("Failed to publish no-bid nudge metrics", exc_info=True)
