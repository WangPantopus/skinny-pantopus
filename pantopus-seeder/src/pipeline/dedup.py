"""Hash-based deduplication against the seeder content queue."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

from src.models.queue_item import RawContentItem

log = logging.getLogger("seeder.pipeline.dedup")


def compute_dedup_hash(item: RawContentItem) -> str:
    """Compute a SHA-256 dedup hash from source_id + identifier + date.

    Uses source_url as the identifier when available, falls back to title.
    Date is the date portion (YYYY-MM-DD) of published_at, or today's UTC date.
    """
    identifier = item.source_url or item.title

    if item.published_at is not None:
        pub = item.published_at if item.published_at.tzinfo else item.published_at.replace(tzinfo=timezone.utc)
        date_str = pub.strftime("%Y-%m-%d")
    else:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    raw = f"{item.source_id}|{identifier}|{date_str}"
    return hashlib.sha256(raw.encode()).hexdigest()


def is_duplicate(dedup_hash: str, supabase_client) -> bool:
    """Check if this hash already exists in the queue with an active status.

    Returns True if a match is found, False otherwise.
    On query errors, logs a warning and returns False (let the item through).
    """
    try:
        result = (
            supabase_client.table("seeder_content_queue")
            .select("id")
            .eq("dedup_hash", dedup_hash)
            .filter("status", "not.in", '("filtered_out","skipped")')
            .limit(1)
            .execute()
        )
        return len(result.data) > 0
    except Exception:
        log.warning("Dedup check failed for hash %s", dedup_hash, exc_info=True)
        return False
