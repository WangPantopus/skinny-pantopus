"""Lambda handler for the national Sports fetcher.

Reads active events from ``active_sports_events`` and runs event-scoped sports
sources, writing rows into ``seeder_content_queue`` with
``scope='national'`` so the national sports poster Lambda can pick them up.

This is the producer half of the national Sports lane. The consumer
(``handlers/sports_poster.py``) already supports templated fallback when no
queue rows exist, so this fetcher just upgrades the content from "synthetic
prompts" to "news-linked conversation starters" whenever the configured sports
sources have something fresh.

Invocation schedule: every 3 hours. Cheap no-op when no events are active.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from src.config.secrets import get_secrets
from src.pipeline.dedup import compute_dedup_hash, is_duplicate
from src.pipeline.relevance_filter import filter_item
from src.sources.base import ContentSource
from src.sources.google_news import GoogleNewsSource
from src.sources.rss import RssSource
from src.sports.events_defaults import ensure_default_sports_events

log = logging.getLogger("seeder.handlers.sports_national_fetcher")

# Region slug used on queue rows written by this fetcher. Not an entry in
# seeder_config — it's just a column tag. The sports_poster handler filters
# by scope='national' + category='sports', not by region.
_NATIONAL_REGION_SLUG = "national"

# Maximum items per source per event per invocation. The poster is capped at
# 1 general / 2 game / 1 watch per day per event anyway, so fetching more
# than a handful just fills the queue with items that expire unposted.
_MAX_ITEMS_PER_EVENT = 6

# Per-league ESPN league-level RSS feed. Covers every team in the league, so
# a Trail Blazers story during NBA Playoffs gets picked up here naturally.
# Verified reachable 2026-04-22. Team-specific ESPN feeds have been
# deprecated and league official sites (NBA.com, MLB.com, NHL.com, MLS.com,
# NFL.com) returned 4xx/5xx or timeouts during source verification, so direct
# RSS remains ESPN-first. Official/publisher sites are pulled through scoped
# Google News queries below.
_ESPN_LEAGUE_FEEDS: dict[str, str] = {
    "nba":     "https://www.espn.com/espn/rss/nba/news",
    "nfl":     "https://www.espn.com/espn/rss/nfl/news",
    "mlb":     "https://www.espn.com/espn/rss/mlb/news",
    "nhl":     "https://www.espn.com/espn/rss/nhl/news",
    "mls":     "https://www.espn.com/espn/rss/soccer/news",
    "nwsl":    "https://www.espn.com/espn/rss/soccer/news",
    "college": "https://www.espn.com/espn/rss/ncb/news",
}

# Templated query builders per league. Keep these conservative — they fire
# during the event's active window, so generic "NBA Playoffs" is specific
# enough without adding team names. Users who want team-specific content get
# it through the regional sports sources already.
_LEAGUE_QUERIES: dict[str, str] = {
    # Avoid overfitting to "tonight" — daytime recaps/previews often omit it.
    "nba":     '"NBA Playoffs" OR "NBA Finals" OR "Portland Trail Blazers" -odds -betting -fantasy -DraftKings -FanDuel -props',
    "nhl":     '"NHL Playoffs" OR "Stanley Cup" tonight -odds -betting -fantasy -DraftKings -FanDuel',
    "mlb":     '"MLB" playoffs OR "World Series" tonight -odds -betting -fantasy -DraftKings -FanDuel',
    "nfl":     '"NFL Playoffs" OR "Super Bowl" -odds -betting -fantasy -DraftKings -FanDuel -props',
    "mls":     '"MLS" playoffs OR "MLS Cup" -odds -betting -fantasy -DraftKings -FanDuel',
    "nwsl":    '"NWSL" playoffs -odds -betting -fantasy',
    "college": '"March Madness" OR "NCAA Tournament" -odds -betting -fantasy -DraftKings -FanDuel -props',
    "other":   "",  # filled in per-event using display_name
}

_LEAGUE_TEAM_SPOTLIGHT_QUERIES: dict[str, list[tuple[str, str, str]]] = {
    # Portland is a launch/primary local market, so Blazers playoff games need
    # explicit coverage instead of depending on broad national NBA queries.
    "nba": [
        (
            "trail_blazers",
            "Trail Blazers Playoff News",
            '"Portland Trail Blazers" ("NBA Playoffs" OR playoffs OR Spurs OR "Game 5" OR elimination) -odds -betting -fantasy -DraftKings -FanDuel -props',
        ),
    ],
}

_OFFICIAL_SITE_QUERIES: dict[str, list[tuple[str, str, str]]] = {
    "nba": [
        (
            "nba_official",
            "NBA.com",
            'site:nba.com "NBA Playoffs" OR "NBA Finals" OR "Portland Trail Blazers" -odds -betting -fantasy -DraftKings -FanDuel -props',
        ),
    ],
    "mlb": [
        (
            "mlb_official",
            "MLB.com",
            'site:mlb.com MLB playoffs OR "World Series" -odds -betting -fantasy -DraftKings -FanDuel -props',
        ),
    ],
    "nfl": [
        (
            "nfl_official",
            "NFL.com",
            'site:nfl.com "NFL Playoffs" OR "Super Bowl" -odds -betting -fantasy -DraftKings -FanDuel -props',
        ),
    ],
    "nhl": [
        (
            "nhl_official",
            "NHL.com",
            'site:nhl.com "NHL Playoffs" OR "Stanley Cup" -odds -betting -fantasy -DraftKings -FanDuel',
        ),
    ],
    "mls": [
        (
            "mls_official",
            "MLSsoccer.com",
            'site:mlssoccer.com "MLS Cup" OR "MLS Playoffs" -odds -betting -fantasy -DraftKings -FanDuel',
        ),
    ],
    "nwsl": [
        (
            "nwsl_official",
            "NWSLsoccer.com",
            'site:nwslsoccer.com NWSL playoffs -odds -betting -fantasy -DraftKings -FanDuel',
        ),
    ],
}

_PUBLISHER_SITE_QUERIES: list[tuple[str, str, str]] = [
    (
        "bleacher_report",
        "Bleacher Report",
        'site:bleacherreport.com "{display_name}" sports -odds -betting -fantasy -DraftKings -FanDuel -props',
    ),
    (
        "fox_sports",
        "FOX Sports",
        'site:foxsports.com "{display_name}" sports -odds -betting -fantasy -DraftKings -FanDuel -props',
    ),
]

_GLOBAL_EVENT_SITE_QUERIES: list[tuple[str, str, str, tuple[str, ...]]] = [
    (
        "fifa",
        "FIFA.com",
        'site:fifa.com "{display_name}" OR "FIFA World Cup" OR "World Cup" -odds -betting -fantasy',
        ("world cup", "fifa"),
    ),
    (
        "olympics",
        "Olympics.com",
        'site:olympics.com "{display_name}" OR Olympics OR "Team USA" -odds -betting -fantasy',
        ("olympic",),
    ),
]


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Sports national fetcher entry point."""
    try:
        return _run(event, context)
    except Exception:
        log.exception("Sports national fetcher failed with unhandled exception")
        return {"error": "unhandled_exception", "events_processed": 0}


def _run(_event: dict[str, Any], _context: Any) -> dict[str, Any]:
    try:
        secrets = get_secrets()
    except Exception:
        log.exception("Failed to load seeder secrets")
        return {"error": "secrets_load_failed", "events_processed": 0}

    try:
        from supabase import create_client
        supabase = create_client(secrets.supabase_url, secrets.supabase_service_role_key)
    except Exception:
        log.exception("Failed to initialize Supabase client")
        return {"error": "supabase_init_failed", "events_processed": 0}

    # Self-heal: if sports_events isn't populated in this env, the lane becomes a
    # silent no-op. Upsert known defaults so NBA Playoffs activates.
    try:
        seed_summary = ensure_default_sports_events(supabase)
        if seed_summary.get("attempted"):
            log.info("sports_events defaults upsert attempted: %s", seed_summary)
    except Exception:
        log.warning("sports_events default upsert crashed (continuing)", exc_info=True)

    active_events = _load_active_events(supabase)
    if not active_events:
        log.info("No active sports events — national fetcher has nothing to do")
        return {"events_processed": 0, "queued": 0}

    summary: dict[str, Any] = {
        "events_processed": 0,
        "queued": 0,
        "deduped": 0,
        "filtered": 0,
        "errors": 0,
        "per_event": {},
    }

    for event_row in active_events:
        event_key = event_row["event_key"]
        sources = _build_sources_for_event(event_row)
        if not sources:
            log.info("No sources configured for event %s — skipping", event_key)
            continue

        per_event = {"queued": 0, "deduped": 0, "filtered": 0}

        for source in sources:
            try:
                items = source.fetch()
            except Exception:
                log.exception(
                    "Source %s fetch failed for event %s",
                    source.source_id, event_key,
                )
                summary["errors"] += 1
                continue

            fetch_error = getattr(source, "last_fetch_error", None)
            if isinstance(fetch_error, str) and fetch_error:
                log.warning(
                    "Source %s reported fetch error for event %s: %s",
                    source.source_id, event_key, fetch_error,
                )
                summary["errors"] += 1

            for item in items[:_MAX_ITEMS_PER_EVENT]:
                try:
                    dedup_hash = compute_dedup_hash(item)
                    if is_duplicate(dedup_hash, supabase):
                        per_event["deduped"] += 1
                        summary["deduped"] += 1
                        continue

                    passed, reason = filter_item(item)

                    row = {
                        "source": item.source_id,
                        "source_url": item.source_url,
                        "raw_title": item.title,
                        "raw_body": item.body,
                        # region is NOT NULL; tag national rows with a stable
                        # slug rather than tying them to a regional
                        # seeder_config row.
                        "region": _NATIONAL_REGION_SLUG,
                        "category": "sports",
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                        "dedup_hash": dedup_hash,
                        "media_urls": item.media_urls,
                        "media_types": item.media_types,
                        "source_priority": 3,
                        "scope": "national",
                        "event_key": event_key,
                    }

                    if passed:
                        row["status"] = "queued"
                        per_event["queued"] += 1
                        summary["queued"] += 1
                    else:
                        row["status"] = "filtered_out"
                        row["failure_reason"] = reason
                        per_event["filtered"] += 1
                        summary["filtered"] += 1

                    supabase.table("seeder_content_queue").insert(row).execute()

                except Exception:
                    log.exception(
                        "Failed to enqueue item '%s' for event %s",
                        item.title[:60], event_key,
                    )
                    summary["errors"] += 1

        summary["per_event"][event_key] = per_event
        summary["events_processed"] += 1

        log.info(
            "Event %s (league=%s): queued=%d deduped=%d filtered=%d",
            event_key, event_row.get("league"),
            per_event["queued"], per_event["deduped"], per_event["filtered"],
        )

    return summary


def _load_active_events(supabase) -> list[dict]:
    """Return rows from the active_sports_events view."""
    try:
        result = (
            supabase.table("active_sports_events")
            .select("event_key, display_name, short_label, league, country, starts_at, ends_at, priority")
            .execute()
        )
        return list(result.data or [])
    except Exception:
        log.exception("Failed to load active sports events")
        return []


def _build_sources_for_event(event_row: dict) -> list[ContentSource]:
    """Build the list of content sources to pull for one active event.

    Each source's ``source_id`` encodes the ``event_key`` so the sports
    poster's ``_load_queued_sports_items`` fallback (which matches
    ``event_key in source``) correctly bundles these rows with the right
    event. Returns an empty list if nothing usable could be built.
    """
    event_key = event_row["event_key"]
    league = (event_row.get("league") or "other").lower()
    display_name = event_row.get("display_name") or event_key.replace("_", " ").title()

    sources: list[ContentSource] = []

    # 1) Google News query — freshest, catches same-day storylines.
    gn_query = _LEAGUE_QUERIES.get(league, "") or ""
    if not gn_query:
        gn_query = f'"{display_name}" -odds -betting -fantasy -DraftKings -FanDuel'
    try:
        sources.append(GoogleNewsSource({
            "source_id": f"sports_national:{event_key}:google_news",
            "source_type": "google_news",
            "url": gn_query,
            "category": "sports",
            "display_name": f"{display_name} — Google News",
            "region": _NATIONAL_REGION_SLUG,
            "priority": 3,
        }))
    except Exception:
        log.exception("Failed to build GoogleNewsSource for event %s", event_key)

    for suffix, label, query in _LEAGUE_TEAM_SPOTLIGHT_QUERIES.get(league, []):
        _append_google_news_source(
            sources,
            event_key=event_key,
            source_suffix=suffix,
            query=query,
            display_name=f"{display_name} — {label}",
        )

    # 2) Official league/publisher sources through Google News. Direct RSS on
    #    the league sites has been unreliable, but site-scoped Google News
    #    gives us official/source-owned material without custom scrapers.
    for suffix, label, query in _OFFICIAL_SITE_QUERIES.get(league, []):
        _append_google_news_source(
            sources,
            event_key=event_key,
            source_suffix=suffix,
            query=query,
            display_name=f"{display_name} — {label}",
        )

    for suffix, label, query_template in _PUBLISHER_SITE_QUERIES:
        _append_google_news_source(
            sources,
            event_key=event_key,
            source_suffix=suffix,
            query=query_template.format(display_name=display_name),
            display_name=f"{display_name} — {label}",
        )

    event_text = f"{event_key} {display_name} {league}".lower()
    for suffix, label, query_template, trigger_terms in _GLOBAL_EVENT_SITE_QUERIES:
        if any(term in event_text for term in trigger_terms):
            _append_google_news_source(
                sources,
                event_key=event_key,
                source_suffix=suffix,
                query=query_template.format(display_name=display_name),
                display_name=f"{display_name} — {label}",
            )

    # 3) ESPN league feed — stable national brand, covers every team in the
    #    league. Each league maps to exactly one feed; deduped against prior
    #    runs by compute_dedup_hash so we don't spam the queue.
    espn_url = _ESPN_LEAGUE_FEEDS.get(league)
    if espn_url:
        try:
            sources.append(RssSource({
                "source_id": f"sports_national:{event_key}:espn",
                "source_type": "rss",
                "url": espn_url,
                "category": "sports",
                "display_name": f"{display_name} — ESPN",
                "region": _NATIONAL_REGION_SLUG,
                "priority": 3,
            }))
        except Exception:
            log.exception("Failed to build ESPN RssSource for event %s", event_key)

    return sources


def _append_google_news_source(
    sources: list[ContentSource],
    *,
    event_key: str,
    source_suffix: str,
    query: str,
    display_name: str,
) -> None:
    try:
        sources.append(GoogleNewsSource({
            "source_id": f"sports_national:{event_key}:{source_suffix}",
            "source_type": "google_news",
            "url": query,
            "category": "sports",
            "display_name": display_name,
            "region": _NATIONAL_REGION_SLUG,
            "priority": 3,
        }))
    except Exception:
        log.exception(
            "Failed to build GoogleNewsSource %s for event %s",
            source_suffix, event_key,
        )
