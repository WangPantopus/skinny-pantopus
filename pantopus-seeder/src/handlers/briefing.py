"""Lambda handler for the daily briefing scheduler.

Triggered every 15 minutes by EventBridge.  Finds users whose morning or
evening briefing time falls within the current window, then calls the Node
backend to compose and send each briefing.
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from src.config.secrets import get_briefing_secrets, BriefingSecrets

# Configure logging for Lambda (root logger must be set to INFO)
logging.basicConfig(level=logging.INFO, force=True)
log = logging.getLogger("seeder.handlers.briefing")
log.setLevel(logging.INFO)

# Maximum users per invocation (safety cap)
MAX_USERS_PER_RUN = 100

# ±15 minute window around the user's preferred briefing time
WINDOW_MINUTES = 15

# HTTP timeout for calling the Node backend (seconds)
SEND_TIMEOUT_S = 30


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Briefing scheduler Lambda entry point. Triggered every 15 min by EventBridge."""
    try:
        return _run(event, context)
    except Exception:
        log.exception("Briefing handler failed with unhandled exception")
        return {"error": "unhandled_exception", "users_processed": 0}


def _run(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Core briefing scheduler logic."""
    start_ms = time.monotonic_ns() // 1_000_000
    try:
        secrets = get_briefing_secrets()
    except Exception:
        log.exception("Failed to load or validate briefing secrets")
        return {"error": "secrets_load_failed", "users_processed": 0}

    try:
        from supabase import create_client

        supabase = create_client(secrets.supabase_url, secrets.supabase_service_role_key)
    except Exception:
        log.exception("Failed to initialize Supabase client")
        return {"error": "supabase_init_failed", "users_processed": 0}

    # Find eligible users
    eligible = _find_eligible_users(supabase)
    log.info("Briefing scheduler: %d eligible users found", len(eligible))

    if len(eligible) > MAX_USERS_PER_RUN:
        log.warning(
            "Briefing scheduler: %d eligible exceeds cap of %d, processing first %d",
            len(eligible),
            MAX_USERS_PER_RUN,
            MAX_USERS_PER_RUN,
        )
        eligible = eligible[:MAX_USERS_PER_RUN]

    stats = {"eligible": len(eligible), "sent": 0, "skipped": 0, "failed": 0}

    for user in eligible:
        try:
            result = _process_user(
                user["user_id"],
                secrets,
                briefing_kind=user.get("briefing_kind", "morning"),
            )
            outcome = result.get("outcome", "failed")
            if outcome == "sent":
                stats["sent"] += 1
            elif outcome == "skipped":
                stats["skipped"] += 1
            else:
                stats["failed"] += 1
            log.info(
                "Briefing user=%s outcome=%s reason=%s",
                user["user_id"][:8],
                outcome,
                result.get("reason") or result.get("error") or "",
            )
        except Exception:
            log.exception("Briefing failed for user=%s", user["user_id"][:8])
            stats["failed"] += 1

    elapsed_ms = time.monotonic_ns() // 1_000_000 - start_ms
    stats["latency_ms"] = elapsed_ms

    _publish_metrics(stats)

    log.info(
        "Briefing scheduler complete: eligible=%d sent=%d skipped=%d failed=%d latency=%dms",
        stats["eligible"],
        stats["sent"],
        stats["skipped"],
        stats["failed"],
        elapsed_ms,
    )

    return stats


# ── Find eligible users ──────────────────────────────────────────


def _find_eligible_users(supabase) -> list[dict[str, Any]]:
    """Find users whose morning/evening briefing window is now and not yet processed today."""

    # 1. Fetch preference rows
    try:
        result = (
            supabase.table("UserNotificationPreferences")
            .select(
                "user_id, daily_briefing_enabled, daily_briefing_time_local, "
                "evening_briefing_enabled, evening_briefing_time_local, daily_briefing_timezone, "
                "quiet_hours_start_local, quiet_hours_end_local"
            )
            .execute()
        )
        prefs_rows = result.data or []
        print(f"[BRIEFING] Query returned {len(prefs_rows)} preference rows")
    except Exception as exc:
        print(f"[BRIEFING] ERROR querying UserNotificationPreferences: {exc}")
        log.exception("Failed to query UserNotificationPreferences")
        return []

    log.info("Briefing: found %d preference rows", len(prefs_rows))
    if not prefs_rows:
        return []

    # 2. Batch idempotency check — get all deliveries for today (across timezones)
    user_ids = [r["user_id"] for r in prefs_rows]
    today_dates = set()
    user_tz_map: dict[str, tuple[str, str]] = {}  # user_id → (local_date, local_time_hhmm)

    for row in prefs_rows:
        tz_str = row.get("daily_briefing_timezone") or "America/Los_Angeles"
        try:
            tz = ZoneInfo(tz_str)
        except Exception:
            tz = ZoneInfo("America/Los_Angeles")

        now_local = datetime.now(tz)
        local_date = now_local.strftime("%Y-%m-%d")
        local_time = now_local.strftime("%H:%M")
        today_dates.add(local_date)
        user_tz_map[row["user_id"]] = (local_date, local_time)

        morning_time = row.get("daily_briefing_time_local") or "07:30"
        evening_time = row.get("evening_briefing_time_local") or "18:00"
        print(
            f"[BRIEFING] user={row['user_id'][:8]}: morning={morning_time!r} evening={evening_time!r} "
            f"local_time={local_time} tz={tz_str}"
        )

    # Query deliveries for all relevant dates in one batch
    already_processed: set[tuple[str, str]] = set()
    try:
        for date_str in today_dates:
            result = (
                supabase.table("DailyBriefingDelivery")
                .select("user_id, briefing_kind, status")
                .in_("user_id", user_ids)
                .eq("briefing_date_local", date_str)
                .in_("status", ["sent", "skipped", "failed"])
                .execute()
            )
            for row in result.data or []:
                already_processed.add((row["user_id"], row.get("briefing_kind") or "morning"))
    except Exception:
        log.exception("Failed to batch-check DailyBriefingDelivery")
        return []

    # 3. Filter by time window, quiet hours, and idempotency
    eligible: list[dict[str, Any]] = []

    for row in prefs_rows:
        uid = row["user_id"]

        local_date, local_time = user_tz_map.get(uid, ("", ""))
        if not local_date:
            continue

        # Quiet hours check
        quiet_start = row.get("quiet_hours_start_local")
        quiet_end = row.get("quiet_hours_end_local")
        if quiet_start and quiet_end and _is_in_quiet_hours(local_time, quiet_start, quiet_end):
            continue

        slots: list[tuple[str, Any]] = []
        if row.get("daily_briefing_enabled") is True:
            slots.append(("morning", row.get("daily_briefing_time_local") or "07:30"))
        if row.get("evening_briefing_enabled") is not False:
            slots.append(("evening", row.get("evening_briefing_time_local") or "18:00"))

        for briefing_kind, briefing_time in slots:
            if (uid, briefing_kind) in already_processed:
                continue

            if not _is_within_window(local_time, str(briefing_time), WINDOW_MINUTES):
                continue

            eligible.append({
                "user_id": uid,
                "timezone": row.get("daily_briefing_timezone"),
                "briefing_kind": briefing_kind,
            })

    return eligible


def _to_minutes(val) -> int | None:
    """Convert a time value (str like '07:00' or '07:00:00', or datetime.time) to minutes since midnight."""
    try:
        from datetime import time as dt_time

        if isinstance(val, dt_time):
            return val.hour * 60 + val.minute
        s = str(val).strip()
        parts = s.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError, TypeError):
        return None


def _is_within_window(current_hhmm, target_hhmm, window_min: int) -> bool:
    """Check if current time is within ±window_min of target time.

    Accepts str ('07:00', '07:00:00'), or datetime.time objects.
    """
    cur_mins = _to_minutes(current_hhmm)
    tgt_mins = _to_minutes(target_hhmm)
    if cur_mins is None or tgt_mins is None:
        print(f"[BRIEFING] _is_within_window parse failed: current={current_hhmm!r} target={target_hhmm!r}")
        return False
    diff = abs(cur_mins - tgt_mins)
    if diff > 720:
        diff = 1440 - diff
    return diff <= window_min


def _is_in_quiet_hours(current_hhmm, start_hhmm, end_hhmm) -> bool:
    """Check if current time falls within quiet hours (handles overnight ranges)."""
    cur = _to_minutes(current_hhmm)
    start = _to_minutes(start_hhmm)
    end = _to_minutes(end_hhmm)
    if cur is None or start is None or end is None:
        return False
    if start > end:
        return cur >= start or cur < end
    return start <= cur < end


# ── Process single user ──────────────────────────────────────────


def _process_user(user_id: str, secrets: BriefingSecrets, briefing_kind: str = "morning") -> dict[str, str]:
    """Call the Node backend to compose and send the briefing for one user."""
    url = f"{secrets.pantopus_api_base_url}/api/internal/briefing/send"

    try:
        response = httpx.post(
            url,
            json={"userId": user_id, "briefingKind": briefing_kind},
            headers={
                "Content-Type": "application/json",
                "x-internal-api-key": secrets.internal_api_key,
            },
            timeout=SEND_TIMEOUT_S,
        )

        if response.status_code != 200:
            log.warning(
                "Briefing API returned %d for user=%s: %s",
                response.status_code,
                user_id[:8],
                response.text[:200],
            )
            return {"outcome": "failed", "error": f"http_{response.status_code}"}

        data = response.json()
        status = data.get("status", "failed")

        if status == "sent":
            return {"outcome": "sent"}
        elif status == "skipped":
            return {"outcome": "skipped", "reason": data.get("skip_reason", "unknown")}
        else:
            return {"outcome": "failed", "error": data.get("error", "unknown")}

    except httpx.TimeoutException:
        log.warning("Briefing API timeout for user=%s", user_id[:8])
        return {"outcome": "failed", "error": "timeout"}
    except Exception as exc:
        log.exception("Briefing API call failed for user=%s", user_id[:8])
        return {"outcome": "failed", "error": str(exc)}


# ── CloudWatch metrics ───────────────────────────────────────────


def _publish_metrics(stats: dict[str, int]) -> None:
    """Publish briefing metrics to CloudWatch."""
    try:
        import boto3

        env = os.environ.get("ENVIRONMENT", "production")
        cw = boto3.client("cloudwatch")
        cw.put_metric_data(
            Namespace=f"Pantopus/Briefing/{env}",
            MetricData=[
                {"MetricName": "BriefingEligibleUsers", "Value": stats.get("eligible", 0), "Unit": "Count"},
                {"MetricName": "BriefingSent", "Value": stats.get("sent", 0), "Unit": "Count"},
                {"MetricName": "BriefingSkipped", "Value": stats.get("skipped", 0), "Unit": "Count"},
                {"MetricName": "BriefingFailed", "Value": stats.get("failed", 0), "Unit": "Count"},
                {"MetricName": "BriefingLatencyMs", "Value": stats.get("latency_ms", 0), "Unit": "Milliseconds"},
            ],
        )
    except Exception:
        log.warning("Failed to publish CloudWatch briefing metrics", exc_info=True)
