"""Topic-level deduplication — reject retellings of already-posted stories.

The URL-based dedup in ``pipeline/dedup`` catches the same article fetched
twice.  It doesn't catch the same *story* showing up under a different URL a
day or two later, or the same event covered by a second outlet.

This module compares a candidate item's normalized title token set against
recently-posted items in the same region using Jaccard similarity.  Matches
above the threshold are treated as duplicates and silently skipped.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone

log = logging.getLogger("seeder.pipeline.topic_dedup")

# Lookback and similarity defaults — tuned to catch rewordings of the same
# story within a typical news cycle while letting genuine follow-ups through.
LOOKBACK_DAYS: int = 7
TOPIC_DUP_THRESHOLD: float = 0.5
# Short titles produce noisy Jaccard scores — require at least this many
# informative tokens on each side before comparing.
_MIN_TOKENS: int = 4
# Body is truncated before normalization so one long article doesn't drown
# out the signal from a shorter candidate.
_BODY_CHAR_LIMIT: int = 400

_TOKEN_RE = re.compile(r"[A-Za-z0-9']+")

# Common English words that carry no story-specific signal.  Kept small and
# local rather than pulling in a dependency; "new", "update", "today" are
# excluded because they appear in almost every headline.
_STOPWORDS: frozenset[str] = frozenset({
    "a", "an", "the", "of", "in", "on", "for", "to", "and", "or", "but",
    "is", "are", "was", "were", "be", "been", "being",
    "at", "by", "with", "from", "as", "that", "this", "these", "those",
    "its", "their", "his", "her", "he", "she", "it", "they", "we", "you",
    "i", "me", "my", "our", "your", "them", "us",
    "will", "would", "can", "could", "should", "may", "might", "must",
    "not", "no", "yes", "do", "does", "did", "has", "have", "had",
    "up", "down", "out", "over", "under", "into", "onto", "off",
    "how", "what", "when", "where", "who", "why", "which",
    "about", "after", "before", "again", "some", "any", "all",
    "more", "most", "less", "just", "also",
    "new", "update", "updates", "today", "yesterday", "tomorrow",
    "says", "say", "said",
})


def normalize_title(title: str | None, body: str | None = None) -> set[str]:
    """Tokenize title (+ optional body snippet) into a stopword-free set.

    Including a chunk of the body meaningfully improves Jaccard signal for
    short headlines — but the body is truncated so a 2000-word article can't
    overwhelm a one-line candidate.
    """
    text = title or ""
    if body:
        text = f"{text} {body[:_BODY_CHAR_LIMIT]}"
    if not text.strip():
        return set()
    tokens = _TOKEN_RE.findall(text.lower())
    return {t for t in tokens if len(t) > 2 and t not in _STOPWORDS}


def jaccard(a: set[str], b: set[str]) -> float:
    """Jaccard similarity between two token sets (0.0 if either is empty)."""
    if not a or not b:
        return 0.0
    union = len(a | b)
    return len(a & b) / union if union else 0.0


def load_recent_topics(
    supabase_client,
    region: str,
    *,
    days: int = LOOKBACK_DAYS,
) -> list[tuple[str, set[str]]]:
    """Return ``(id, token_set)`` tuples for non-rejected items in the window.

    Includes items in ``queued``, ``humanized``, and ``posted`` status — all
    the states where the story is either already in front of users or on its
    way there.  Returns ``[]`` on error so dedup fails open.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    try:
        result = (
            supabase_client.table("seeder_content_queue")
            .select("id, raw_title, raw_body")
            .eq("region", region)
            .in_("status", ["queued", "humanized", "posted"])
            .gte("updated_at", cutoff)
            .limit(500)
            .execute()
        )
    except Exception:
        log.warning("Failed to load recent topics for %s", region, exc_info=True)
        return []

    out: list[tuple[str, set[str]]] = []
    for row in result.data or []:
        tokens = normalize_title(
            row.get("raw_title") or "",
            row.get("raw_body"),
        )
        if len(tokens) >= _MIN_TOKENS:
            out.append((row["id"], tokens))
    return out


def find_duplicate_topic(
    candidate_title: str,
    recent_topics: list[tuple[str, set[str]]],
    *,
    candidate_body: str | None = None,
    threshold: float = TOPIC_DUP_THRESHOLD,
) -> tuple[str, float] | None:
    """Return ``(posted_id, score)`` for the best match above threshold, else ``None``."""
    cand = normalize_title(candidate_title, candidate_body)
    if len(cand) < _MIN_TOKENS:
        return None
    best: tuple[str, float] | None = None
    for posted_id, tokens in recent_topics:
        score = jaccard(cand, tokens)
        if score >= threshold and (best is None or score > best[1]):
            best = (posted_id, score)
    return best
