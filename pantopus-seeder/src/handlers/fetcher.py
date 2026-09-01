"""Lambda handler for the content fetcher — pulls from RSS, APIs, and seasonal engine into the queue."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from src.config.constants import (
    QUEUE_PURGE_DAYS,
    QUEUE_STALE_HOURS,
    QUEUE_STALE_HOURS_BY_CATEGORY,
)
from src.config.region_registry import load_active_regions, load_sources_for_region
from src.config.secrets import get_secrets
from src.pipeline.dedup import compute_dedup_hash, is_duplicate
from src.pipeline.relevance_filter import filter_item
from src.pipeline.topic_dedup import (
    find_duplicate_topic,
    load_recent_topics,
    normalize_title,
)
from src.sources.registry import get_sources_from_db

log = logging.getLogger("seeder.handlers.fetcher")


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Fetcher Lambda entry point. Triggered every 2 hours by EventBridge."""
    try:
        return _run(event, context)
    except Exception:
        log.exception("Fetcher handler failed with unhandled exception")
        return {"error": "unhandled_exception", "regions_processed": 0}


def _run(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Core fetcher logic, separated for testability."""
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

    grand_totals = {
        "regions_processed": 0,
        "total_queued": 0,
        "total_filtered": 0,
        "total_deduped": 0,
        "total_errors": 0,
    }

    for region_cfg in regions:
        # Load sources for this region from the database
        source_configs = load_sources_for_region(supabase, region_cfg.region)
        sources = get_sources_from_db(
            source_configs,
            region_lat=region_cfg.lat,
            region_lng=region_cfg.lng,
        )

        stats = _process_region(region_cfg.region, sources, supabase)
        grand_totals["regions_processed"] += 1
        grand_totals["total_queued"] += stats["queued"]
        grand_totals["total_filtered"] += stats["filtered"]
        grand_totals["total_deduped"] += stats["deduped"]
        grand_totals["total_errors"] += stats["errors"]

    _run_queue_hygiene(supabase)

    queue_depth = _get_queue_depth(supabase)
    grand_totals["queue_depth"] = queue_depth

    _publish_metric(queue_depth)

    return grand_totals


def _process_region(region: str, sources, supabase) -> dict[str, int]:
    """Fetch, filter, dedup, and enqueue content for one region."""
    stats = {"fetched": 0, "queued": 0, "filtered": 0, "deduped": 0, "errors": 0}

    # Load token sets of recent posted/queued items so we can reject retellings
    # of the same story even when the URL hash differs.  Loaded once per region
    # and extended in-memory as this pass queues new items.
    recent_topics = load_recent_topics(supabase, region)

    for source in sources:
        try:
            items = source.fetch()
        except Exception:
            log.exception("Source %s failed during fetch", source.source_id)
            stats["errors"] += 1
            continue

        fetch_error = getattr(source, "last_fetch_error", None)
        if isinstance(fetch_error, str) and fetch_error:
            log.warning("Source %s completed with fetch error: %s", source.source_id, fetch_error)
            stats["errors"] += 1

        for item in items:
            stats["fetched"] += 1

            try:
                dedup_hash = compute_dedup_hash(item)

                if is_duplicate(dedup_hash, supabase):
                    stats["deduped"] += 1
                    continue

                topic_match = find_duplicate_topic(
                    item.title, recent_topics, candidate_body=item.body
                )
                if topic_match is not None:
                    matched_id, score = topic_match
                    log.info(
                        "Topic dedup: skipping %r (matched %s, score=%.2f)",
                        item.title[:80],
                        matched_id,
                        score,
                    )
                    stats["deduped"] += 1
                    continue

                passed, reason = filter_item(item)

                row = {
                    "source": item.source_id,
                    "source_url": item.source_url,
                    "raw_title": item.title,
                    "raw_body": item.body,
                    "region": item.region,
                    "category": item.category,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                    "dedup_hash": dedup_hash,
                    "media_urls": item.media_urls,
                    "media_types": item.media_types,
                    "source_priority": source.priority,
                }

                if passed:
                    row["status"] = "queued"
                    stats["queued"] += 1
                else:
                    row["status"] = "filtered_out"
                    row["failure_reason"] = reason
                    stats["filtered"] += 1

                supabase.table("seeder_content_queue").insert(row).execute()

                # Track newly-queued items so later sources in the same pass
                # can't re-queue the same story under a different URL.  The
                # dedup_hash is a stable identifier for log breadcrumbs — we
                # don't need the row's UUID here.
                if passed:
                    tokens = normalize_title(item.title, item.body)
                    if tokens:
                        recent_topics.append((dedup_hash, tokens))

            except Exception:
                log.exception(
                    "Failed to process item '%s' from %s",
                    item.title[:60],
                    item.source_id,
                )
                stats["errors"] += 1

    log.info(
        "Region %s: fetched=%d queued=%d filtered=%d deduped=%d errors=%d",
        region,
        stats["fetched"],
        stats["queued"],
        stats["filtered"],
        stats["deduped"],
        stats["errors"],
    )
    return stats


def _run_queue_hygiene(supabase) -> None:
    """Purge old rows and mark stale queued items."""
    now = datetime.now(timezone.utc)

    for status, days in QUEUE_PURGE_DAYS.items():
        cutoff = (now - timedelta(days=days)).isoformat()
        try:
            result = (
                supabase.table("seeder_content_queue")
                .delete()
                .eq("status", status)
                .lt("created_at", cutoff)
                .execute()
            )
            count = len(result.data) if result.data else 0
            if count:
                log.info("Purged %d rows with status=%s older than %d days", count, status, days)
        except Exception:
            log.warning("Failed to purge status=%s rows", status, exc_info=True)

    # Mark stale queued items. Windows are per-category so time-sensitive
    # categories (weather, AQI, earthquake, history) are never kept past
    # their useful life while evergreen enrichment (sports, community_resource,
    # seasonal) can survive busy news cycles.
    #
    # Group categories that share a window so we emit one UPDATE per bucket.
    buckets: dict[int, list[str]] = {}
    for category, hours in QUEUE_STALE_HOURS_BY_CATEGORY.items():
        buckets.setdefault(hours, []).append(category)

    for hours in sorted(buckets):
        cats = sorted(buckets[hours])
        cutoff = (now - timedelta(hours=hours)).isoformat()
        cats_filter = f"({','.join(cats)})"
        try:
            result = (
                supabase.table("seeder_content_queue")
                .update({"status": "skipped", "failure_reason": "stale"})
                .eq("status", "queued")
                .lt("fetched_at", cutoff)
                .filter("category", "in", cats_filter)
                .execute()
            )
            count = len(result.data) if result.data else 0
            if count:
                log.info(
                    "Marked %d items as stale (>%dh, categories=%s)",
                    count, hours, ",".join(cats),
                )
        except Exception:
            log.warning(
                "Failed to mark stale items (categories=%s)", cats, exc_info=True
            )

    # Safety net: any row missing a category (very rare) is swept by the default
    # window so nothing can sit in the queue indefinitely.
    default_cutoff = (now - timedelta(hours=QUEUE_STALE_HOURS)).isoformat()
    try:
        result = (
            supabase.table("seeder_content_queue")
            .update({"status": "skipped", "failure_reason": "stale"})
            .eq("status", "queued")
            .lt("fetched_at", default_cutoff)
            .is_("category", "null")
            .execute()
        )
        count = len(result.data) if result.data else 0
        if count:
            log.info("Marked %d null-category items as stale", count)
    except Exception:
        log.warning("Failed to mark null-category items as stale", exc_info=True)


def _get_queue_depth(supabase) -> int:
    """Count rows with status='queued'."""
    try:
        result = (
            supabase.table("seeder_content_queue")
            .select("id", count="exact")
            .eq("status", "queued")
            .execute()
        )
        return result.count or 0
    except Exception:
        log.warning("Failed to get queue depth", exc_info=True)
        return 0


def _publish_metric(queue_depth: int) -> None:
    """Publish SeederQueueDepth to CloudWatch."""
    try:
        import boto3

        env = os.environ.get("ENVIRONMENT", "production")
        cw = boto3.client("cloudwatch")
        cw.put_metric_data(
            Namespace=f"Pantopus/Seeder/{env}",
            MetricData=[
                {
                    "MetricName": "SeederQueueDepth",
                    "Value": queue_depth,
                    "Unit": "Count",
                }
            ],
        )
    except Exception:
        log.warning("Failed to publish CloudWatch metric", exc_info=True)
