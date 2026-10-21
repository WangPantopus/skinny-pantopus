"""Daily housekeeping for briefing delivery history and expired context cache.

Only the minute scheduler sends or retries briefings, inside each recipient's
local delivery window. Housekeeping must never send yesterday's evening brief
or a morning brief at the time this once-daily job happens to run.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from src.config.secrets import get_briefing_secrets

# Configure logging for Lambda (root logger must be set to INFO)
logging.basicConfig(level=logging.INFO, force=True)
# httpx logs every request URL at INFO, and Supabase filters carry full user
# ids; keep them out of CloudWatch.
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("seeder.handlers.briefing_cleanup")

DELIVERY_RETENTION_DAYS = 30


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Briefing cleanup Lambda entry point. Triggered daily by EventBridge."""
    try:
        result = _run(event, context)
    except Exception:
        log.exception("Briefing cleanup handler failed with unhandled exception")
        raise
    log.info("Run summary: %s", result)
    if result.get("error"):
        # Fail the invocation so the Lambda Errors metric and its alarm see it.
        raise RuntimeError(f"Briefing cleanup run failed: {result}")
    return result


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

    stats = {
        "deliveries_purged": deliveries_purged,
        "cache_purged": cache_purged,
        "stale_composing_reset": stale_reset,
    }

    log.info(
        "Briefing cleanup complete: deliveries_purged=%d cache_purged=%d stale_reset=%d",
        deliveries_purged,
        cache_purged,
        stale_reset,
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
