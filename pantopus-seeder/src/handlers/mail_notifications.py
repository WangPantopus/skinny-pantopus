"""Lambda handler for mail notification push delivery.

Replaces the existing Node cron jobs that only log MailEvent rows:
- mailDayNotification (daily summary) → now sends actual push
- mailInterruptNotification (urgent items) → now sends actual push

Triggered every 5 minutes by EventBridge. Handles both:
1. Urgent/interrupt notifications (time-sensitive, certified, package delivery)
2. Daily mail summary (once per day per user, morning window)
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from src.config.secrets import get_briefing_secrets, BriefingSecrets
from src.utils.supabase_errors import is_missing_table_error, log_missing_table_once

logging.basicConfig(level=logging.INFO, force=True)
log = logging.getLogger("seeder.handlers.mail_notifications")

SEND_TIMEOUT_S = 15
PACIFIC = ZoneInfo("America/Los_Angeles")


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Mail notifications Lambda entry point."""
    try:
        return _run(event, context)
    except Exception:
        log.exception("Mail notifications handler failed")
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

    stats = {"urgent_sent": 0, "summary_sent": 0, "skipped": 0, "errors": 0}

    # 1. Always process urgent/interrupt items (runs every 5 min)
    _process_urgent_mail(supabase, secrets, stats)

    # 2. Process daily summary only during morning window (7-9 AM Pacific)
    now_pt = datetime.now(PACIFIC)
    if 7 <= now_pt.hour < 9:
        _process_daily_summary(supabase, secrets, stats)

    elapsed_ms = time.monotonic_ns() // 1_000_000 - start_ms
    stats["latency_ms"] = elapsed_ms

    _publish_metrics(stats)

    log.info(
        "Mail notifications complete: urgent=%d summary=%d skipped=%d errors=%d latency=%dms",
        stats["urgent_sent"], stats["summary_sent"],
        stats["skipped"], stats["errors"], elapsed_ms,
    )
    return stats


# ── Urgent mail (time-sensitive, overdue, certified, package delivery) ──


def _process_urgent_mail(supabase, secrets: BriefingSecrets, stats: dict) -> None:
    """Find recent urgent mail items and send push notifications."""
    five_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()

    # 1. Time-sensitive / overdue items
    try:
        result = (
            supabase.table("Mail")
            .select("id, recipient_user_id, sender_display, urgency")
            .in_("urgency", ["time_sensitive", "overdue"])
            .gte("created_at", five_min_ago)
            .execute()
        )
        urgent_items = result.data or []
    except Exception:
        log.exception("Failed to query urgent mail")
        stats["errors"] += 1
        urgent_items = []

    for item in urgent_items:
        uid = item.get("recipient_user_id")
        if not uid:
            continue

        dedup_key = f"mail_urgent_{item['id']}"
        if _already_sent(supabase, dedup_key):
            continue

        sender = item.get("sender_display") or "Unknown sender"
        urgency = item.get("urgency", "urgent")
        title = "Urgent mail" if urgency == "time_sensitive" else "Overdue mail"
        body = f"You have {urgency.replace('_', ' ')} mail from {sender}."

        result = _send_reminder(secrets, uid, title, body, "mail_urgent", {
            "entityId": item["id"],
            "route": "/mailbox",
        })
        if result == "sent":
            stats["urgent_sent"] += 1
            _record_sent(supabase, dedup_key, 1)
        elif result == "skipped":
            stats["skipped"] += 1

    # 2. Certified mail (ack required)
    try:
        result = (
            supabase.table("Mail")
            .select("id, recipient_user_id, sender_display")
            .eq("ack_required", True)
            .eq("ack_status", "pending")
            .gte("created_at", five_min_ago)
            .execute()
        )
        certified = result.data or []
    except Exception:
        log.exception("Failed to query certified mail")
        stats["errors"] += 1
        certified = []

    for item in certified:
        uid = item.get("recipient_user_id")
        if not uid:
            continue

        dedup_key = f"mail_certified_{item['id']}"
        if _already_sent(supabase, dedup_key):
            continue

        sender = item.get("sender_display") or "Unknown sender"
        title = "Certified mail requires acknowledgment"
        body = f"You have certified mail from {sender} that requires your acknowledgment."

        result = _send_reminder(secrets, uid, title, body, "mail_urgent", {
            "entityId": item["id"],
            "route": "/mailbox",
        })
        if result == "sent":
            stats["urgent_sent"] += 1
            _record_sent(supabase, dedup_key, 1)


# ── Daily mail summary ──────────────────────────────────────────


def _process_daily_summary(supabase, secrets: BriefingSecrets, stats: dict) -> None:
    """Send a daily mailbox summary push to users with active mail."""
    today_str = datetime.now(PACIFIC).strftime("%Y-%m-%d")

    # Find users with unarchived, delivered/opened mail
    try:
        result = (
            supabase.table("Mail")
            .select("recipient_user_id")
            .in_("lifecycle", ["delivered", "opened"])
            .eq("archived", False)
            .execute()
        )
        rows = result.data or []
    except Exception:
        log.exception("Failed to query mail for daily summary")
        stats["errors"] += 1
        return

    # Deduplicate user IDs
    user_ids = list(set(r["recipient_user_id"] for r in rows if r.get("recipient_user_id")))
    if not user_ids:
        return

    for uid in user_ids:
        dedup_key = f"mail_summary_{uid}_{today_str}"
        if _already_sent(supabase, dedup_key):
            continue

        # Build per-user summary
        try:
            mail_result = (
                supabase.table("Mail")
                .select("category, mail_object_type, urgency")
                .eq("recipient_user_id", uid)
                .in_("lifecycle", ["delivered", "opened"])
                .eq("archived", False)
                .execute()
            )
            mail_items = mail_result.data or []
        except Exception:
            stats["errors"] += 1
            continue

        if not mail_items:
            continue

        bills = sum(1 for m in mail_items if m.get("category") == "bill")
        packages = sum(1 for m in mail_items if m.get("mail_object_type") == "package")
        urgent = sum(1 for m in mail_items if m.get("urgency") not in (None, "none"))
        total = len(mail_items)

        parts = []
        if bills > 0:
            parts.append(f"{bills} bill{'s' if bills > 1 else ''}")
        if packages > 0:
            parts.append(f"{packages} package{'s' if packages > 1 else ''}")
        if urgent > 0:
            parts.append(f"{urgent} urgent")

        if not parts:
            parts.append(f"{total} item{'s' if total > 1 else ''}")

        title = "Your mailbox summary"
        body = f"You have mail: {', '.join(parts)}."

        result = _send_reminder(secrets, uid, title, body, "mail_summary", {
            "route": "/mailbox",
        })
        if result == "sent":
            stats["summary_sent"] += 1
            _record_sent(supabase, dedup_key, 1)
        elif result == "skipped":
            stats["skipped"] += 1


# ── Shared helpers (same pattern as home_reminders.py) ──────────


def _already_sent(supabase, dedup_key: str) -> bool:
    try:
        result = (
            supabase.table("AlertNotificationHistory")
            .select("id")
            .eq("alert_type", "mail")
            .eq("alert_id", dedup_key)
            .execute()
        )
        return bool(result.data)
    except Exception as exc:
        if is_missing_table_error(exc, "AlertNotificationHistory"):
            log_missing_table_once(log, "AlertNotificationHistory", "mail dedup", exc)
        return False


def _record_sent(supabase, dedup_key: str, users_notified: int) -> None:
    try:
        supabase.table("AlertNotificationHistory").insert({
            "alert_type": "mail",
            "alert_id": dedup_key,
            "geohash": "global",
            "headline": dedup_key,
            "users_notified": users_notified,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        }).execute()
    except Exception as exc:
        if is_missing_table_error(exc, "AlertNotificationHistory"):
            log_missing_table_once(log, "AlertNotificationHistory", "mail dedup writes", exc)
        else:
            log.warning("Failed to record mail notification dedup", exc_info=True)


def _send_reminder(secrets: BriefingSecrets, user_id: str, title: str, body: str, reminder_type: str, data: dict) -> str:
    try:
        url = f"{secrets.pantopus_api_base_url}/api/internal/briefing/reminder-push"
        resp = httpx.post(
            url,
            json={
                "userId": user_id,
                "title": title,
                "body": body,
                "reminderType": reminder_type,
                "data": data,
            },
            headers={
                "Content-Type": "application/json",
                "x-internal-api-key": secrets.internal_api_key,
            },
            timeout=SEND_TIMEOUT_S,
        )
        if resp.status_code == 200:
            return resp.json().get("status", "failed")
        return "failed"
    except Exception:
        log.warning("Mail push failed for user=%s", user_id[:8], exc_info=True)
        return "failed"


def _publish_metrics(stats: dict) -> None:
    try:
        import boto3
        env = os.environ.get("ENVIRONMENT", "production")
        cw = boto3.client("cloudwatch")
        cw.put_metric_data(
            Namespace=f"Pantopus/MailNotifications/{env}",
            MetricData=[
                {"MetricName": "UrgentMailSent", "Value": stats.get("urgent_sent", 0), "Unit": "Count"},
                {"MetricName": "SummarySent", "Value": stats.get("summary_sent", 0), "Unit": "Count"},
                {"MetricName": "MailNotifSkipped", "Value": stats.get("skipped", 0), "Unit": "Count"},
                {"MetricName": "MailNotifErrors", "Value": stats.get("errors", 0), "Unit": "Count"},
                {"MetricName": "MailNotifLatencyMs", "Value": stats.get("latency_ms", 0), "Unit": "Milliseconds"},
            ],
        )
    except Exception:
        log.warning("Failed to publish mail notification metrics", exc_info=True)
