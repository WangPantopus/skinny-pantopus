"""Lambda handler for home bill/task/calendar reminder push notifications.

Triggered twice daily by EventBridge Scheduler (07:00 and 18:00 Pacific).
Queries HomeBill, HomeTask, and HomeCalendarEvent for items due soon,
then sends push notifications to household members via the Node backend.
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
# httpx logs every request URL at INFO, and Supabase filters carry full user
# ids; keep them out of CloudWatch.
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("seeder.handlers.home_reminders")

PACIFIC = ZoneInfo("America/Los_Angeles")

SEND_TIMEOUT_S = 15


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Home reminders Lambda entry point."""
    try:
        result = _run(event, context)
    except Exception:
        log.exception("Home reminders handler failed")
        raise
    if result.get("error") or result.get("errors"):
        # Fail the invocation so the Lambda Errors metric and its alarm see it.
        raise RuntimeError(f"Home reminders run failed: {result}")
    return result


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

    stats = {"bills_notified": 0, "tasks_notified": 0, "calendar_notified": 0, "errors": 0}

    _process_bills_due(supabase, secrets, stats)
    # Use the scheduled time, so a delayed morning invocation remains morning.
    # Only the 07:00 Pacific run sends due-day task reminders (template.yaml
    # passes its scheduled time), in daylight and standard time alike.
    try:
        scheduled_at = datetime.fromisoformat(event["time"].replace("Z", "+00:00")) if event.get("time") else datetime.now(timezone.utc)
        morning_run = scheduled_at.astimezone(PACIFIC).hour == 7
    except (ValueError, TypeError):
        morning_run = False
    if morning_run:
        _process_tasks_due(supabase, secrets, stats)
    _process_calendar_events(supabase, secrets, stats)

    elapsed_ms = time.monotonic_ns() // 1_000_000 - start_ms
    stats["latency_ms"] = elapsed_ms

    _publish_metrics(stats)

    log.info(
        "Home reminders complete: bills=%d tasks=%d calendar=%d errors=%d latency=%dms",
        stats["bills_notified"], stats["tasks_notified"],
        stats["calendar_notified"], stats["errors"], elapsed_ms,
    )
    return stats


# ── Bills due today/tomorrow ────────────────────────────────────


def _process_bills_due(supabase, secrets: BriefingSecrets, stats: dict) -> None:
    """Find unpaid bills due today or tomorrow, notify household members."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    tomorrow_end = (now + timedelta(days=2)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    try:
        result = (
            supabase.table("HomeBill")
            .select("id, home_id, bill_type, provider_name, amount, due_date, status")
            .neq("status", "paid")
            .gte("due_date", today_start)
            .lte("due_date", tomorrow_end)
            .execute()
        )
        bills = result.data or []
    except Exception:
        log.exception("Failed to query HomeBill")
        stats["errors"] += 1
        return

    if not bills:
        return

    # Group bills by home_id
    home_bills: dict[str, list] = {}
    for bill in bills:
        hid = bill["home_id"]
        if hid not in home_bills:
            home_bills[hid] = []
        home_bills[hid].append(bill)

    # Get household members for each home
    home_ids = list(home_bills.keys())
    members = _get_home_members(supabase, home_ids)

    # Build dedup key for today
    today_str = now.strftime("%Y-%m-%d")

    for home_id, home_bill_list in home_bills.items():
        user_ids = members.get(home_id, [])
        if not user_ids:
            continue

        for bill in home_bill_list:
            dedup_key = f"bill_{bill['id']}_{today_str}"
            if _already_sent(supabase, dedup_key):
                continue

            provider = bill.get("provider_name") or bill.get("bill_type") or "Bill"
            amount = bill.get("amount")
            amount_str = f"${float(amount):.0f} " if amount else ""
            due_date = bill.get("due_date", "")
            is_today = due_date[:10] == today_str if due_date else False

            title = f"Bill due {'today' if is_today else 'tomorrow'}"
            body = f"Your {amount_str}{provider} bill is due {'today' if is_today else 'tomorrow'}."

            sent = 0
            for uid in user_ids:
                result = _send_reminder(secrets, uid, title, body, "bill_due", {
                    "entityId": bill["id"],
                    "route": f"/homes/{home_id}",
                })
                if result == "sent":
                    sent += 1

            _record_sent(supabase, dedup_key, sent)
            stats["bills_notified"] += sent


# ── Tasks due today ─────────────────────────────────────────────


def _process_tasks_due(supabase, secrets: BriefingSecrets, stats: dict) -> None:
    """Find incomplete tasks due on each authorized recipient's local day."""
    now = datetime.now(timezone.utc)
    # A UTC candidate window covers today's dates across recipient timezones;
    # exact local-day selection happens after the per-recipient access check.
    window_start = (now - timedelta(days=1)).isoformat()
    window_end = (now + timedelta(days=1)).isoformat()

    try:
        result = (
            supabase.table("HomeTask")
            .select("id, home_id, title, due_at, assigned_to, status, created_by, visibility")
            .filter("status", "not.in", '("done","canceled")')
            .gte("due_at", window_start)
            .lt("due_at", window_end)
            .execute()
        )
        tasks = result.data or []
    except Exception:
        log.exception("Failed to query HomeTask")
        stats["errors"] += 1
        return

    if not tasks:
        return

    # Collect home_ids for tasks without assigned_to
    home_ids_needed = list(set(
        t["home_id"] for t in tasks if not t.get("assigned_to")
    ))
    members = _get_home_members(supabase, home_ids_needed) if home_ids_needed else {}

    for task in tasks:
        if task.get("status") not in {"open", "in_progress"}:
            continue
        # The creator may still be in a private setup. The existing record
        # projection validates that exception, rather than granting access
        # merely because an old task remembers a creator or assignee.
        targets = [task["assigned_to"]] if task.get("assigned_to") else [task.get("created_by"), *members.get(task["home_id"], [])]
        targets = list(dict.fromkeys(uid for uid in targets if uid))
        if not targets:
            continue
        try:
            preferences = supabase.table("UserNotificationPreferences").select("user_id, daily_briefing_timezone").in_("user_id", targets).execute().data or []
            timezones = {row["user_id"]: row.get("daily_briefing_timezone") for row in preferences}
        except Exception:
            log.warning("Task reminder timezone lookup failed", exc_info=True)
            stats["errors"] += 1
            continue
        for uid in targets:
            try:
                if uid != task.get("created_by"):
                    eligible = supabase.rpc("home_record_recipient", {
                        "p_home_id": task["home_id"], "p_user_id": uid,
                        "p_kind": "task", "p_visibility": task.get("visibility"),
                    }).execute().data
                    if eligible is not True:
                        continue
                # Reuse the actual task read contract, including source-mail
                # access, private setup, current permissions and finished state.
                projection = supabase.rpc("get_home_records", {
                    "p_home_id": task["home_id"], "p_actor_id": uid, "p_kind": "task",
                    "p_record_id": task["id"], "p_start_after": None,
                    "p_start_before": None, "p_mail_only": False,
                }).execute().data
                rows = projection.get("records", []) if isinstance(projection, dict) and projection.get("ok") is True else []
                if len(rows) != 1:
                    continue
                current = rows[0]
                if current.get("id") != task["id"] or current.get("home_id") != task["home_id"] or current.get("status") not in {"open", "in_progress"} or current.get("assigned_to") != task.get("assigned_to"):
                    continue
                try:
                    local_tz = ZoneInfo(timezones.get(uid) or "America/Los_Angeles")
                except (ValueError, KeyError):
                    local_tz = ZoneInfo("America/Los_Angeles")
                due = datetime.fromisoformat(current["due_at"].replace("Z", "+00:00"))
                if due.tzinfo is None or due.astimezone(local_tz).date() != now.astimezone(local_tz).date():
                    continue
                local_date = now.astimezone(local_tz).strftime("%Y-%m-%d")
                dedup_key = f"task_{task['id']}_{uid}_{local_date}"
                if _already_sent(supabase, dedup_key, fail_closed=True):
                    continue
            except Exception:
                log.warning("Task reminder access/date check failed", exc_info=True)
                stats["errors"] += 1
                continue
            reminder_data = {
                "entityId": task["id"],
                "taskId": task["id"], "homeId": task["home_id"],
                "link": f"/app/homes/{task['home_id']}/tasks/{task['id']}",
                "route": f"/app/homes/{task['home_id']}/tasks/{task['id']}",
            }
            # Assignees can complete without editing. Advertise only actions
            # explicitly allowed by this recipient's current task projection.
            capabilities = current.get("capabilities")
            if isinstance(capabilities, dict) and capabilities.get("can_complete") is True:
                if capabilities.get("can_edit") is True:
                    reminder_data["category"] = "TASK_REMINDER"
                elif capabilities.get("can_edit") is False:
                    reminder_data["category"] = "TASK_REMINDER_DONE_ONLY"
            result = _send_reminder(secrets, uid, "Task due today", f'"{current.get("title") or "Home task"}" is due today.', "task_due", reminder_data)
            if result == "sent":
                _record_sent(supabase, dedup_key, 1)
                stats["tasks_notified"] += 1


# ── Calendar events starting soon ───────────────────────────────


def _process_calendar_events(supabase, secrets: BriefingSecrets, stats: dict) -> None:
    """Find calendar events starting in the next 2 hours, notify household."""
    now = datetime.now(timezone.utc)
    two_hours = (now + timedelta(hours=2)).isoformat()

    try:
        result = (
            supabase.table("HomeCalendarEvent")
            .select("id, home_id, title, start_at, event_type")
            .gte("start_at", now.isoformat())
            .lte("start_at", two_hours)
            .execute()
        )
        events = result.data or []
    except Exception:
        log.exception("Failed to query HomeCalendarEvent")
        stats["errors"] += 1
        return

    if not events:
        return

    home_ids = list(set(e["home_id"] for e in events))
    members = _get_home_members(supabase, home_ids)
    today_str = now.strftime("%Y-%m-%d")

    for event in events:
        dedup_key = f"calendar_{event['id']}_{today_str}"
        if _already_sent(supabase, dedup_key):
            continue

        event_title = event.get("title") or "Home event"
        start_at = event.get("start_at", "")
        # Calculate minutes until start
        try:
            start_dt = datetime.fromisoformat(start_at.replace("Z", "+00:00"))
            mins = max(0, int((start_dt - now).total_seconds() / 60))
            time_str = f"in {mins} minutes" if mins < 60 else f"in about {mins // 60} hour{'s' if mins >= 120 else ''}"
        except Exception:
            time_str = "soon"

        title = "Upcoming event"
        body = f'"{event_title}" starts {time_str}.'

        targets = members.get(event["home_id"], [])
        sent = 0
        for uid in targets:
            result = _send_reminder(secrets, uid, title, body, "calendar", {
                "entityId": event["id"],
                "route": f"/homes/{event['home_id']}",
            })
            if result == "sent":
                sent += 1

        _record_sent(supabase, dedup_key, sent)
        stats["calendar_notified"] += sent


# ── Shared helpers ──────────────────────────────────────────────


def _get_home_members(supabase, home_ids: list[str]) -> dict[str, list[str]]:
    """Get active household members for a list of home IDs."""
    if not home_ids:
        return {}
    try:
        result = (
            supabase.table("HomeOccupancy")
            .select("home_id, user_id")
            .in_("home_id", home_ids)
            .eq("is_active", True)
            .execute()
        )
        members: dict[str, list[str]] = {}
        for row in result.data or []:
            hid = row["home_id"]
            if hid not in members:
                members[hid] = []
            members[hid].append(row["user_id"])
        return members
    except Exception:
        log.exception("Failed to query HomeOccupancy for members")
        return {}


def _already_sent(supabase, dedup_key: str, *, fail_closed: bool = False) -> bool:
    """Check if a reminder was already sent today (using AlertNotificationHistory)."""
    try:
        result = (
            supabase.table("AlertNotificationHistory")
            .select("id")
            .eq("alert_type", "reminder")
            .eq("alert_id", dedup_key)
            .execute()
        )
        return bool(result.data)
    except Exception as exc:
        if is_missing_table_error(exc, "AlertNotificationHistory"):
            log_missing_table_once(log, "AlertNotificationHistory", "home reminder dedup", exc)
        return fail_closed


def _record_sent(supabase, dedup_key: str, users_notified: int) -> None:
    """Record that a reminder was sent."""
    try:
        supabase.table("AlertNotificationHistory").insert({
            "alert_type": "reminder",
            "alert_id": dedup_key,
            "geohash": "global",
            "headline": dedup_key,
            "users_notified": users_notified,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        }).execute()
    except Exception as exc:
        if is_missing_table_error(exc, "AlertNotificationHistory"):
            log_missing_table_once(log, "AlertNotificationHistory", "home reminder dedup writes", exc)
        else:
            log.warning("Failed to record reminder dedup", exc_info=True)


def _send_reminder(secrets: BriefingSecrets, user_id: str, title: str, body: str, reminder_type: str, data: dict) -> str:
    """Call Node backend to send a reminder push."""
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
        log.warning("Reminder push failed for user=%s", user_id[:8], exc_info=True)
        return "failed"


def _publish_metrics(stats: dict) -> None:
    if not os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return  # Local runs never write to CloudWatch.
    try:
        import boto3
        env = os.environ.get("ENVIRONMENT", "production")
        cw = boto3.client("cloudwatch")
        cw.put_metric_data(
            Namespace=f"Pantopus/Reminders/{env}",
            MetricData=[
                {"MetricName": "BillsNotified", "Value": stats.get("bills_notified", 0), "Unit": "Count"},
                {"MetricName": "TasksNotified", "Value": stats.get("tasks_notified", 0), "Unit": "Count"},
                {"MetricName": "CalendarNotified", "Value": stats.get("calendar_notified", 0), "Unit": "Count"},
                {"MetricName": "ReminderErrors", "Value": stats.get("errors", 0), "Unit": "Count"},
                {"MetricName": "ReminderLatencyMs", "Value": stats.get("latency_ms", 0), "Unit": "Milliseconds"},
            ],
        )
    except Exception:
        log.warning("Failed to publish reminder metrics", exc_info=True)
