"""Lambda handler for the Mail tab's morning notice.

Triggered every 5 minutes by EventBridge (behind MailEnabled). Each run asks the backend to send "Your mail is here"
to the people whose own morning it is and whose morning round brought them mail they can read
(POST /api/internal/briefing/mail-morning). The backend applies the mailbox's own rules: which pieces have been
delivered, who may read a Home's mail (only after the address is proven), one notice per person per local day, the
person's mail_summary_enabled setting and quiet hours.

Special deliveries (certified, time-sensitive, overdue, due today) are announced once by the backend when they land,
so this handler no longer pushes urgent mail itself.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx

from src.config.secrets import get_briefing_secrets, BriefingSecrets

logging.basicConfig(level=logging.INFO, force=True)
# httpx logs every request URL at INFO, and Supabase filters carry full user
# ids; keep them out of CloudWatch.
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("seeder.handlers.mail_notifications")

SEND_TIMEOUT_S = 15


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Mail notifications Lambda entry point."""
    try:
        result = _run(event, context)
    except Exception:
        log.exception("Mail notifications handler failed")
        raise
    if result.get("error") or result.get("errors"):
        # Fail the invocation so the Lambda Errors metric and its alarm see it.
        raise RuntimeError(f"Mail notifications run failed: {result}")
    return result


def _run(event: dict[str, Any], context: Any) -> dict[str, Any]:
    start_ms = time.monotonic_ns() // 1_000_000
    try:
        secrets = get_briefing_secrets()
    except Exception:
        log.exception("Failed to load or validate briefing secrets")
        return {"error": "secrets_load_failed"}

    stats = {"summary_sent": 0, "skipped": 0, "errors": 0}

    _send_morning_notices(secrets, stats)

    elapsed_ms = time.monotonic_ns() // 1_000_000 - start_ms
    stats["latency_ms"] = elapsed_ms

    _publish_metrics(stats)

    log.info(
        "Mail notifications complete: summary=%d skipped=%d errors=%d latency=%dms",
        stats["summary_sent"], stats["skipped"], stats["errors"], elapsed_ms,
    )
    return stats


# ── Morning notice ───────────────────────────────────────────────


def _send_morning_notices(secrets: BriefingSecrets, stats: dict) -> None:
    """Ask the backend to send this run's morning notices; it answers counts only."""
    try:
        resp = httpx.post(
            f"{secrets.pantopus_api_base_url}/api/internal/briefing/mail-morning",
            json={},
            headers={"Content-Type": "application/json", "x-internal-api-key": secrets.internal_api_key},
            timeout=SEND_TIMEOUT_S * 4,
        )
    except Exception:
        log.exception("Mail morning notices request failed")
        stats["errors"] += 1
        return
    if resp.status_code != 200:
        log.error("Mail morning notices failed: status=%d", resp.status_code)
        stats["errors"] += 1
        return
    body = resp.json()
    if body.get("status") == "skipped":
        log.info("Mail morning notices skipped: %s", body.get("reason"))
        return
    stats["summary_sent"] += int(body.get("sent") or 0)
    stats["skipped"] += int(body.get("skipped") or 0)
    # One person's push failing is retried by the next run; it isn't a failed invocation.
    stats["push_failed"] = int(body.get("failed") or 0)


def _publish_metrics(stats: dict) -> None:
    if not os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return  # Local runs never write to CloudWatch.
    try:
        import boto3
        env = os.environ.get("ENVIRONMENT", "production")
        cw = boto3.client("cloudwatch")
        cw.put_metric_data(
            Namespace=f"Pantopus/MailNotifications/{env}",
            MetricData=[
                {"MetricName": "SummarySent", "Value": stats.get("summary_sent", 0), "Unit": "Count"},
                {"MetricName": "MailNotifSkipped", "Value": stats.get("skipped", 0), "Unit": "Count"},
                {"MetricName": "MailNotifErrors", "Value": stats.get("errors", 0), "Unit": "Count"},
                {"MetricName": "MailNotifLatencyMs", "Value": stats.get("latency_ms", 0), "Unit": "Milliseconds"},
            ],
        )
    except Exception:
        log.warning("Failed to publish mail notification metrics", exc_info=True)
