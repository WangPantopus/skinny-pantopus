"""Generic job trigger Lambda handler.

Triggers backend cron jobs via POST /api/internal/jobs/{job_name}.
EventBridge passes {"job": "job-name"} as the event payload.

The backend endpoint acquires a distributed lock (job_locks table),
runs the job, and releases the lock — so even if EventBridge fires
twice, only one execution proceeds.
"""

import logging
import os
from typing import Any

import httpx

from ..config.secrets import get_briefing_secrets

log = logging.getLogger("seeder.handlers.job_trigger")
log.setLevel(logging.INFO)

SEND_TIMEOUT_S = 115  # Just under the 120s Lambda function timeout. Jobs that
# run longer still complete server-side under the job lock; only the metric is lost.


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Handler entry point. Triggered by EventBridge."""
    try:
        return _run(event, context)
    except Exception:
        log.exception("Job trigger handler failed")
        raise


def _run(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Core logic, separated for testability."""
    job_name = event.get("job")
    if not job_name:
        log.error("No job name in event payload")
        raise ValueError("missing job name in EventBridge payload")

    secrets = get_briefing_secrets()
    url = f"{secrets.pantopus_api_base_url}/api/internal/jobs/{job_name}"

    log.info("Triggering job: %s", job_name)

    try:
        response = httpx.post(
            url,
            json={
                "triggered_by": "lambda",
                "function_name": getattr(context, "function_name", "unknown"),
            },
            headers={
                "Content-Type": "application/json",
                "x-internal-key": secrets.internal_api_key,
            },
            timeout=SEND_TIMEOUT_S,
        )
    except httpx.HTTPError:
        _publish_metric(job_name, "Failed")
        raise

    result = _safe_response_json(response)
    status_code = response.status_code

    if status_code == 409:
        log.info("Job %s skipped (lock held): %s", job_name, result)
        _publish_metric(job_name, "Skipped")
        return {"status": "skipped", "job": job_name}

    if status_code >= 400:
        log.error("Job %s failed (%d): %s", job_name, status_code, result)
        _publish_metric(job_name, "Failed")
        raise RuntimeError(f"Job {job_name} failed with HTTP {status_code}: {result}")

    log.info("Job %s completed: %s", job_name, result)
    _publish_metric(job_name, "Completed")
    return {"status": "completed", "job": job_name}


def _safe_response_json(response: httpx.Response) -> dict[str, Any]:
    """Return a small structured payload for logging and errors."""
    try:
        return response.json()
    except ValueError:
        return {"body": response.text[:500]}


def _publish_metric(job_name: str, status: str) -> None:
    """Publish a CloudWatch metric for job execution status."""
    try:
        import boto3

        env = os.environ.get("ENVIRONMENT", "production")
        cw = boto3.client("cloudwatch")
        cw.put_metric_data(
            Namespace=f"Pantopus/Jobs/{env}",
            MetricData=[
                {
                    "MetricName": f"Job{status}",
                    "Value": 1,
                    "Unit": "Count",
                    "Dimensions": [
                        {"Name": "JobName", "Value": job_name},
                    ],
                },
            ],
        )
    except Exception:
        log.warning("Failed to publish metrics", exc_info=True)
