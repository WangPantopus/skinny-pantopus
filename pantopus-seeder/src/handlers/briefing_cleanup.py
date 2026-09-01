"""Lambda handler for briefing cleanup — purges old delivery logs, expired context cache, and retries today's failures."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from src.config.secrets import get_briefing_secrets, BriefingSecrets

log = logging.getLogger("seeder.handlers.briefing_cleanup")

DELIVERY_RETENTION_DAYS = 30
RETRY_MARKER = "[RETRY]"


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Briefing cleanup Lambda entry point. Triggered daily by EventBridge."""
    try:
        return _run(event, context)
    except Exception:
        log.exception("Briefing cleanup handler failed with unhandled exception")
        return {"error": "unhandled_exception"}


def _run(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Core cleanup logic."""
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

    deliveries_purged = _purge_old_deliveries(supabase)
    cache_purged = _purge_expired_context_cache(supabase)
    stale_reset = _reset_stale_composing(supabase)
    retries_attempted, retries_succeeded = _retry_failed_deliveries(supabase, secrets)

    stats = {
        "deliveries_purged": deliveries_purged,
        "cache_purged": cache_purged,
        "stale_composing_reset": stale_reset,
        "retries_attempted": retries_attempted,
        "retries_succeeded": retries_succeeded,
    }

    log.info(
        "Briefing cleanup complete: deliveries_purged=%d cache_purged=%d retries=%d/%d",
        deliveries_purged,
        cache_purged,
        retries_succeeded,
        retries_attempted,
    )

    return stats


def _purge_old_deliveries(supabase) -> int:
    """Delete DailyBriefingDelivery rows older than retention period."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=DELIVERY_RETENTION_DAYS)).isoformat()
    try:
        result = (
            supabase.table("DailyBriefingDelivery")
            .delete(count="exact", returning="minimal")
            .lt("created_at", cutoff)
            .execute()
        )
        count = result.count or 0
        if count:
            log.info("Purged %d delivery rows older than %d days", count, DELIVERY_RETENTION_DAYS)
        return count
    except Exception:
        log.warning("Failed to purge old delivery rows", exc_info=True)
        return 0


def _purge_expired_context_cache(supabase) -> int:
    """Delete ContextCache rows where expires_at has passed."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        result = (
            supabase.table("ContextCache")
            .delete(count="exact", returning="minimal")
            .lt("expires_at", now)
            .execute()
        )
        count = result.count or 0
        if count:
            log.info("Purged %d expired context cache entries", count)
        return count
    except Exception:
        log.warning("Failed to purge expired context cache", exc_info=True)
        return 0


def _reset_stale_composing(supabase) -> int:
    """Reset delivery rows stuck in 'composing' status for more than 15 minutes.

    This handles cases where the scheduler or Node backend crashed mid-send,
    leaving a row in 'composing' that blocks future retries.
    """
    stale_cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    try:
        result = (
            supabase.table("DailyBriefingDelivery")
            .update({"status": "failed", "error_message": "stale_composing_reset"})
            .eq("status", "composing")
            .lt("created_at", stale_cutoff)
            .execute()
        )
        count = len(result.data) if result.data else 0
        if count:
            log.info("Reset %d stale composing delivery rows to failed", count)
        return count
    except Exception:
        log.warning("Failed to reset stale composing rows", exc_info=True)
        return 0


def _retry_date_candidates(now: datetime | None = None) -> list[str]:
    """Return the local-date keys that can plausibly be "today" across timezones."""
    reference = now or datetime.now(timezone.utc)
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=timezone.utc)
    return sorted({
        (reference + timedelta(days=offset)).strftime("%Y-%m-%d")
        for offset in (-1, 0, 1)
    })


def _retry_failed_deliveries(supabase, secrets: BriefingSecrets) -> tuple[int, int]:
    """Retry recent failed deliveries that haven't been retried yet.

    A delivery is eligible for retry if:
    - status = 'failed'
    - briefing_date_local is today for some user timezone
    - error_message does NOT start with the retry marker

    On retry, the error_message is prefixed with RETRY_MARKER so it won't
    be retried again.
    """
    import httpx

    retry_dates = _retry_date_candidates()

    try:
        result = (
            supabase.table("DailyBriefingDelivery")
            .select("id, user_id, briefing_kind, error_message")
            .eq("status", "failed")
            .in_("briefing_date_local", retry_dates)
            .execute()
        )
        failed_rows = result.data or []
    except Exception:
        log.warning("Failed to query failed deliveries for retry", exc_info=True)
        return 0, 0

    # Filter out already-retried rows
    retriable = [
        r for r in failed_rows
        if not (r.get("error_message") or "").startswith(RETRY_MARKER)
    ]

    if not retriable:
        return 0, 0

    attempted = 0
    succeeded = 0

    for row in retriable:
        attempted += 1
        user_id = row["user_id"]
        delivery_id = row["id"]
        briefing_kind = row.get("briefing_kind") or "morning"

        try:
            # Call the Node backend
            url = f"{secrets.pantopus_api_base_url}/api/internal/briefing/send"
            response = httpx.post(
                url,
                json={"userId": user_id, "briefingKind": briefing_kind},
                headers={
                    "Content-Type": "application/json",
                    "x-internal-api-key": secrets.internal_api_key,
                },
                timeout=30,
            )

            data = response.json() if response.status_code == 200 else {}
            status = data.get("status", "failed")

            if status == "sent":
                succeeded += 1
                log.info("Retry succeeded for user=%s", user_id[:8])
            elif status == "skipped":
                log.info("Retry skipped for user=%s: %s", user_id[:8], data.get("skip_reason"))
            else:
                supabase.table("DailyBriefingDelivery").update(
                    {"status": "failed",
                     "error_message": f"{RETRY_MARKER} {data.get('error', 'retry_failed')}"}
                ).eq("id", delivery_id).execute()
                log.warning("Retry failed for user=%s: %s", user_id[:8], data.get("error"))

        except Exception:
            log.exception("Retry error for user=%s", user_id[:8])
            try:
                supabase.table("DailyBriefingDelivery").update(
                    {"status": "failed", "error_message": f"{RETRY_MARKER} retry_exception"}
                ).eq("id", delivery_id).execute()
            except Exception:
                pass

    return attempted, succeeded
