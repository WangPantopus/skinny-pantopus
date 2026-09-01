"""Lambda handler for the national Sports seeder lane.

Posts conversation-starter threads to the national Sports topic (audience
'national', distribution_targets ['country:US']) during major events such
as NBA Playoffs, Super Bowl, World Cup. Gated by the active-events
registry, cap-limited per event, dedup-aware against organic user threads,
and freshness-stamped so stale game threads fall off the feed.

Featured local matchups may also seed regional sports posts (audience
'nearby') so teams such as the Trail Blazers appear in the normal Place feed,
not only the national Sports tab. Run 3x/day on an EventBridge schedule offset
from the regular seeder poster.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from src.config.region_registry import RegionConfig, load_active_regions
from src.config.secrets import get_secrets
from src.pipeline.humanizer import humanize
from src.pipeline.poster import authenticate_curator, post_to_pantopus
from src.sports.events_defaults import ensure_default_sports_events

log = logging.getLogger("seeder.handlers.sports_poster")

# Defaults used when a sports_events row does not explicitly set cadence caps.
_DEFAULT_CADENCE: dict[str, int] = {
    "general_thread": 1,
    "game_thread": 2,
    "watch_prompt": 1,
}

# How long a seeded national sports post stays "fresh" by default. Game
# threads override this with a shorter window (tip-off + 6h, falling back to
# 6h from now if a schedule isn't provided).
_DEFAULT_FRESH_HOURS = 12
_GAME_THREAD_FRESH_HOURS = 6
_WATCH_PROMPT_FRESH_HOURS = 24

# Organic user threads on the same event within this window count as an
# active conversation; we skip seeding a duplicate.
_DEDUP_WINDOW_HOURS = 12

# Temporary featured matchups are a safety valve for game-day seeding. They keep
# the poster useful even when the fetcher has only generic playoff headlines in
# the queue. Future matchups can be supplied from sports_events.cadence as
# {"featured_matchups": [...]} without changing code.
_DEFAULT_FEATURED_MATCHUPS_BY_EVENT: dict[str, list[dict[str, Any]]] = {
    "nba_playoffs_2026": [
        {
            "matchup_key": "nba_playoffs_2026_blazers_spurs_game_5",
            "team_tag": "blazers",
            "team_name": "Portland Trail Blazers",
            "opponent_tag": "spurs",
            "opponent_name": "San Antonio Spurs",
            "matchup": "Trail Blazers at Spurs",
            "game_label": "Game 5",
            "round": "first round",
            "tip_off_at": "2026-04-29T01:30:00+00:00",
            "local_tip_time": "6:30 PM PT",
            "broadcast": "ESPN",
            "stakes": "Portland is facing elimination",
            "active_from": "2026-04-28T00:00:00+00:00",
            "active_until": "2026-04-29T08:00:00+00:00",
            "local_target_regions": ["portland_metro", "clark_county"],
        },
    ],
}


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Sports national poster entry point."""
    try:
        return _run(event, context)
    except Exception:
        log.exception("Sports poster handler failed with unhandled exception")
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
        log.info("No active sports events — nothing to seed nationally")
        return {"events_processed": 0, "skipped_reason": "no_active_events"}

    summary: dict[str, Any] = {
        "events_processed": len(active_events),
        "posts_sent": 0,
        "posts_skipped_cap": 0,
        "posts_skipped_dedup": 0,
        "posts_failed": 0,
        "regional_posts_sent": 0,
        "regional_posts_skipped": 0,
        "regional_posts_failed": 0,
        "per_event": {},
    }

    token: str | None = None
    active_regions = load_active_regions(supabase)

    for event_row in active_events:
        event_key = event_row["event_key"]
        cadence = _merge_cadence(event_row.get("cadence"))
        log.info("Processing active event %s (cadence=%s)", event_key, cadence)

        event_summary: dict[str, Any] = {
            "sent": 0,
            "skipped_cap": 0,
            "skipped_dedup": 0,
            "failed": 0,
            "regional_sent": 0,
            "regional_skipped": 0,
            "regional_failed": 0,
        }
        summary["per_event"][event_key] = event_summary

        token, regional_summary = _post_regional_featured_matchups(
            supabase=supabase,
            secrets=secrets,
            token=token,
            event_row=event_row,
            active_regions=active_regions,
        )
        event_summary["regional_sent"] += regional_summary["sent"]
        event_summary["regional_skipped"] += regional_summary["skipped"]
        event_summary["regional_failed"] += regional_summary["failed"]
        summary["regional_posts_sent"] += regional_summary["sent"]
        summary["regional_posts_skipped"] += regional_summary["skipped"]
        summary["regional_posts_failed"] += regional_summary["failed"]

        # Pull queued national-scope sports items for this event, then append
        # capped template/game-day starters. Previously, any queued news row
        # suppressed the fallback entirely; because queued rows have no
        # post_metadata column, every fetched article was treated as a
        # general_thread and could block game/watch posts for the day.
        queued_candidates = [
            _prepare_queued_sports_item(event_row, item)
            for item in _load_queued_sports_items(supabase, event_key)
        ]
        if not queued_candidates:
            log.info("No queued national sports items for %s — using templated starters", event_key)

        candidates = queued_candidates + _build_templated_sports_items(event_row)
        candidates = sorted(candidates, key=_sports_candidate_rank, reverse=True)

        # Count today's seeded posts grouped by thread type.
        counts_today = _count_today_posts_by_kind(supabase, event_key)

        for item in candidates:
            kind = _classify_thread_kind(item)
            cap = int(cadence.get(kind, 0))
            posted_today = int(counts_today.get(kind, 0))
            if cap and posted_today >= cap:
                log.info("Skipping %s — cap reached for event %s (%d/%d)",
                         kind, event_key, posted_today, cap)
                _update_queue_item_if_needed(
                    supabase, item, "skipped", failure_reason=f"cap_reached:{kind}"
                )
                event_summary["skipped_cap"] += 1
                summary["posts_skipped_cap"] += 1
                continue

            if _has_active_user_thread(supabase, event_key, item.get("post_metadata", {})):
                log.info("Skipping %s — active user thread exists for event %s", _item_label(item), event_key)
                _update_queue_item_if_needed(
                    supabase, item, "skipped", failure_reason="organic_thread_exists"
                )
                event_summary["skipped_dedup"] += 1
                summary["posts_skipped_dedup"] += 1
                continue

            humanized_text, humanize_error = humanize(
                raw_title=item["raw_title"],
                raw_body=item.get("raw_body"),
                source_url=item.get("source_url"),
                source_display_name=item.get("source") or "curator",
                category="sports",
                region="national",
                openai_api_key=secrets.openai_api_key,
                region_display_name="",
                scope="national",
            )
            if humanize_error or not humanized_text:
                reason = humanize_error or "empty_humanized_text"
                if reason == "ai_quality_gate:skipped":
                    _update_queue_item_if_needed(supabase, item, "skipped", failure_reason=reason)
                else:
                    _update_queue_item_if_needed(supabase, item, "failed", failure_reason=reason)
                    event_summary["failed"] += 1
                    summary["posts_failed"] += 1
                continue

            _update_queue_item_if_needed(supabase, item, "humanized", humanized_text=humanized_text)

            if token is None:
                token = authenticate_curator(supabase, secrets.curator_email, secrets.curator_password)
            if token is None:
                log.error("Curator auth failed — resetting item %s to queued", _item_label(item))
                _update_queue_item_if_needed(supabase, item, "queued")
                event_summary["failed"] += 1
                summary["posts_failed"] += 1
                break

            post_metadata = _build_post_metadata(event_row, item, kind)

            post_id, post_error = post_to_pantopus(
                api_base_url=secrets.pantopus_api_base_url,
                access_token=token,
                content=humanized_text,
                category="sports",
                region_lat=None,
                region_lng=None,
                audience="national",
                topic="sports",
                sports_scope="national",
                post_metadata=post_metadata,
            )

            if post_error:
                log.warning("National sports post failed for item %s: %s", _item_label(item), post_error)
                _update_queue_item_if_needed(supabase, item, "failed", failure_reason=post_error)
                event_summary["failed"] += 1
                summary["posts_failed"] += 1
                continue

            _update_queue_item_if_needed(supabase, item, "posted", post_id=post_id)
            log.info("Posted national sports thread %s for %s (kind=%s)", post_id, event_key, kind)
            event_summary["sent"] += 1
            summary["posts_sent"] += 1
            counts_today[kind] = posted_today + 1

    return summary


def _load_active_events(supabase) -> list[dict]:
    """Return rows from the active_sports_events view, ordered by priority."""
    try:
        result = (
            supabase.table("active_sports_events")
            .select("event_key, display_name, short_label, league, country, starts_at, ends_at, priority, cadence")
            .execute()
        )
        return list(result.data or [])
    except Exception:
        log.exception("Failed to load active sports events")
        return []


def _load_queued_sports_items(supabase, event_key: str) -> list[dict]:
    """Load national-scope sports items queued for this event.

    Ordering: freshest first. Prefer the dedicated event_key queue column;
    fall back to source string matching for older queued rows.
    """
    try:
        event_result = (
            supabase.table("seeder_content_queue")
            .select("*")
            .eq("scope", "national")
            .eq("category", "sports")
            .eq("status", "queued")
            .eq("event_key", event_key)
            .order("fetched_at", desc=True)
            .limit(50)
            .execute()
        )
        rows = list(event_result.data or [])
        if rows:
            return rows

        fallback_result = (
            supabase.table("seeder_content_queue")
            .select("*")
            .eq("scope", "national")
            .eq("category", "sports")
            .eq("status", "queued")
            .order("fetched_at", desc=True)
            .limit(50)
            .execute()
        )
        rows = list(fallback_result.data or [])
    except Exception:
        log.exception("Failed to load queued sports items")
        return []

    # Backward compatibility for rows queued before event_key existed.
    matching = []
    for r in rows:
        src = str(r.get("source") or "")
        if event_key in src:
            matching.append(r)

    return matching


def _build_templated_sports_items(
    event_row: dict,
    *,
    now: datetime | None = None,
) -> list[dict]:
    """Create in-memory national conversation starters when no queue row exists."""
    event_key = event_row["event_key"]
    display_name = event_row.get("display_name") or event_key.replace("_", " ").title()
    league = event_row.get("league") or "other"
    source = f"sports_template:{event_key}"

    base_meta = {
        "event_key": event_key,
        "league": league,
    }

    featured_items = _build_featured_matchup_items(event_row, now=now)

    # NBA should be news/game driven. If the fetcher has no current item and no
    # explicit matchup is active, stay quiet instead of inventing playoff chatter.
    if league == "nba":
        return featured_items

    items = [
        *featured_items,
        {
            "_synthetic": True,
            "synthetic_id": f"{source}:general_thread",
            "source": source,
            "source_url": None,
            "raw_title": f"{display_name} discussion thread",
            "raw_body": (
                f"{display_name} is active right now. Write a short national "
                "Sports-lane conversation starter that invites people to talk "
                "about who they are watching or rooting for."
            ),
            "post_metadata": {**base_meta},
        },
    ]

    # If no specific matchup is active, keep the generic game/watch fallback.
    if not featured_items:
        items.extend([
            {
                "_synthetic": True,
                "synthetic_id": f"{source}:game_thread",
                "source": source,
                "source_url": None,
                "raw_title": f"{display_name} game thread",
                "raw_body": (
                    f"{display_name} has games in the active window. Write a short "
                    "game-thread prompt for people watching tonight."
                ),
                "post_metadata": {**base_meta, "is_game_thread": True},
            },
            {
                "_synthetic": True,
                "synthetic_id": f"{source}:watch_prompt",
                "source": source,
                "source_url": None,
                "raw_title": f"Where to watch {display_name}",
                "raw_body": (
                    f"{display_name} is active. Write a short prompt asking where "
                    "people are watching or gathering locally."
                ),
                "post_metadata": {**base_meta, "is_watch_prompt": True},
            },
        ])

    return items


def _prepare_queued_sports_item(event_row: dict, item: dict) -> dict:
    """Attach inferred metadata to queue rows before cadence/dedup checks."""
    prepared = dict(item)
    metadata = dict(prepared.get("post_metadata") or {})
    metadata.setdefault("event_key", event_row["event_key"])
    metadata.setdefault("league", event_row.get("league"))

    inferred = _infer_sports_metadata(event_row, prepared)
    for key, value in inferred.items():
        if value is not None and metadata.get(key) in (None, ""):
            metadata[key] = value

    prepared["post_metadata"] = metadata
    return prepared


def _infer_sports_metadata(event_row: dict, item: dict) -> dict:
    """Infer thread kind/team tags from fetched article text."""
    league = (event_row.get("league") or "").lower()
    haystack = " ".join([
        str(item.get("source") or ""),
        str(item.get("raw_title") or ""),
        str(item.get("raw_body") or ""),
        str(item.get("source_url") or ""),
    ]).lower()

    metadata: dict[str, Any] = {}

    if league == "nba":
        if any(token in haystack for token in ("trail_blazers", "trail blazers", "blazers")):
            metadata["team_tag"] = "blazers"
            metadata["team_name"] = "Portland Trail Blazers"
        if any(token in haystack for token in ("san antonio spurs", "spurs")):
            metadata["opponent_tag"] = "spurs"
            metadata["opponent_name"] = "San Antonio Spurs"

        watch_tokens = ("how to watch", "where to watch", "watch party", "broadcast", "stream")
        game_tokens = (
            "game 5",
            "game 6",
            "game 7",
            "tonight",
            "tip-off",
            "tipoff",
            "elimination",
            "first round",
            "nba playoffs",
            "playoff series",
        )

        if any(token in haystack for token in watch_tokens):
            metadata["is_watch_prompt"] = True
        elif metadata.get("team_tag") == "blazers" and any(token in haystack for token in game_tokens):
            metadata["is_game_thread"] = True
        elif "nba playoffs" in haystack and any(token in haystack for token in ("game 5", "game 6", "game 7", "tonight")):
            metadata["is_game_thread"] = True

    return metadata


def _sports_candidate_rank(item: dict) -> int:
    """Prefer specific game-day candidates without discarding news rows."""
    metadata = item.get("post_metadata") or {}
    score = 0
    if metadata.get("team_tag") == "blazers":
        score += 100
    if metadata.get("is_game_thread"):
        score += 40
    if metadata.get("is_watch_prompt"):
        score += 30
    if metadata.get("matchup_key"):
        score += 20
    if not item.get("_synthetic"):
        score += 5
    return score


def _build_featured_matchup_items(
    event_row: dict,
    *,
    now: datetime | None = None,
) -> list[dict]:
    """Build game/watch starters for active featured matchups."""
    event_key = event_row["event_key"]
    league = event_row.get("league") or "other"
    display_name = event_row.get("display_name") or event_key.replace("_", " ").title()
    source = f"sports_template:{event_key}"
    active_matchups = _featured_matchups_for_event(
        event_row,
        now=now or datetime.now(timezone.utc),
    )
    items: list[dict] = []

    for matchup in active_matchups:
        matchup_key = str(matchup.get("matchup_key") or matchup.get("matchup") or "featured")
        matchup_name = matchup.get("matchup") or "Featured matchup"
        game_label = matchup.get("game_label") or "Game"
        tip_off_at = matchup.get("tip_off_at")
        local_tip_time = matchup.get("local_tip_time")
        broadcast = matchup.get("broadcast")
        stakes = matchup.get("stakes")

        metadata = {
            "event_key": event_key,
            "league": league,
            "matchup_key": matchup_key,
            "matchup": matchup_name,
            "game_label": game_label,
            "team_tag": matchup.get("team_tag"),
            "team_name": matchup.get("team_name"),
            "opponent_tag": matchup.get("opponent_tag"),
            "opponent_name": matchup.get("opponent_name"),
            "tip_off_at": tip_off_at,
            "broadcast": broadcast,
        }

        detail_bits = [f"{game_label}: {matchup_name}"]
        if local_tip_time:
            detail_bits.append(f"at {local_tip_time}")
        if broadcast:
            detail_bits.append(f"on {broadcast}")
        if stakes:
            detail_bits.append(stakes)
        details = ". ".join(detail_bits)

        items.append({
            "_synthetic": True,
            "synthetic_id": f"{source}:featured:{matchup_key}:game_thread",
            "source": source,
            "source_url": None,
            "raw_title": f"{display_name}: {matchup_name} {game_label}",
            "raw_body": (
                f"{details}. Write a short game-thread prompt for people "
                "watching this NBA playoff game tonight."
            ),
            "post_metadata": {**metadata, "is_game_thread": True},
        })

        items.append({
            "_synthetic": True,
            "synthetic_id": f"{source}:featured:{matchup_key}:watch_prompt",
            "source": source,
            "source_url": None,
            "raw_title": f"Where to watch {matchup_name} {game_label}",
            "raw_body": (
                f"{details}. Write a short prompt asking where people are "
                "watching or gathering for this playoff game."
            ),
            "post_metadata": {**metadata, "is_watch_prompt": True},
        })

    return items


def _build_regional_featured_matchup_items(
    event_row: dict,
    active_regions: list[RegionConfig],
    *,
    now: datetime | None = None,
) -> list[dict]:
    """Build deterministic regional posts for featured or fallback local teams."""
    event_key = event_row["event_key"]
    league = event_row.get("league") or "other"
    source = f"sports_template:{event_key}"
    current = now or datetime.now(timezone.utc)
    active_matchups = _featured_matchups_for_event(
        event_row,
        now=current,
    )
    regions_by_key = {r.region: r for r in active_regions}
    items: list[dict] = []

    for matchup in active_matchups:
        target = _resolve_regional_post_target(matchup, regions_by_key)
        if target is None:
            continue

        matchup_key = str(matchup.get("matchup_key") or matchup.get("matchup") or "featured")
        matchup_name = matchup.get("matchup") or "Featured matchup"
        game_label = matchup.get("game_label") or "Game"
        metadata = {
            "event_key": event_key,
            "league": league,
            "matchup_key": matchup_key,
            "matchup": matchup_name,
            "game_label": game_label,
            "team_tag": matchup.get("team_tag"),
            "team_name": matchup.get("team_name"),
            "opponent_tag": matchup.get("opponent_tag"),
            "opponent_name": matchup.get("opponent_name"),
            "tip_off_at": matchup.get("tip_off_at"),
            "broadcast": matchup.get("broadcast"),
            "is_game_thread": True,
            "local_region": target["region"],
            "local_region_display_name": target["display_name"],
            "local_target_regions": target["region_keys"],
        }

        items.append({
            "_synthetic": True,
            "synthetic_id": f"{source}:regional:{target['region']}:{matchup_key}:game_thread",
            "source": source,
            "region": target,
            "content": _build_regional_matchup_content(matchup, target["display_name"]),
            "post_metadata": {k: v for k, v in metadata.items() if v is not None},
        })

    return items


def _resolve_regional_post_target(
    item: dict,
    regions_by_key: dict[str, RegionConfig],
) -> dict[str, Any] | None:
    target_region_keys = item.get("local_target_regions")
    if not isinstance(target_region_keys, list):
        return None

    target_regions: list[RegionConfig] = []
    missing_regions: list[str] = []
    for region_key in target_region_keys:
        region = regions_by_key.get(str(region_key))
        if region is None:
            missing_regions.append(str(region_key))
            continue
        target_regions.append(region)

    if missing_regions:
        log.info(
            "Skipping missing regional sports targets %s for %s",
            ",".join(missing_regions),
            item.get("matchup_key") or item.get("fallback_key") or item.get("team_tag") or "unknown",
        )
    if not target_regions:
        return None

    region_keys = [r.region for r in target_regions]
    return {
        "region": "+".join(region_keys),
        "region_keys": region_keys,
        "display_name": _format_region_display_names([r.display_name for r in target_regions]),
        "lat": sum(r.lat for r in target_regions) / len(target_regions),
        "lng": sum(r.lng for r in target_regions) / len(target_regions),
    }


def _format_region_display_names(names: list[str]) -> str:
    clean = [name for name in names if name]
    if not clean:
        return "the area"
    if len(clean) == 1:
        return clean[0]
    if len(clean) == 2:
        return f"{clean[0]} and {clean[1]}"
    return f"{', '.join(clean[:-1])}, and {clean[-1]}"


def _build_regional_matchup_content(matchup: dict, region_display_name: str) -> str:
    matchup_name = matchup.get("matchup") or "Featured matchup"
    game_label = matchup.get("game_label") or "Game"
    local_tip_time = matchup.get("local_tip_time")
    stakes = matchup.get("stakes")

    lead = f"{matchup_name} {game_label}"
    if local_tip_time:
        lead = f"{lead} tips at {local_tip_time} tonight"
    else:
        lead = f"{lead} is tonight"

    if stakes:
        stakes_text = str(stakes)
        lead = f"{lead}, and {stakes_text[:1].lower()}{stakes_text[1:]}"

    return f"{lead}.\n\nWhere are people watching around {region_display_name}?"


def _post_regional_featured_matchups(
    *,
    supabase,
    secrets,
    token: str | None,
    event_row: dict,
    active_regions: list[RegionConfig],
    now: datetime | None = None,
) -> tuple[str | None, dict[str, int]]:
    """Post local featured matchups into Place feeds, independent of national caps."""
    result = {"sent": 0, "skipped": 0, "failed": 0}
    items = _build_regional_featured_matchup_items(
        event_row,
        active_regions,
        now=now,
    )
    if not items:
        return token, result

    event_key = event_row["event_key"]
    for item in items:
        metadata = item.get("post_metadata") or {}
        region = item["region"]

        if _has_regional_featured_matchup_post(
            supabase,
            event_key,
            metadata,
            region=region["region"],
            now=now,
        ):
            log.info(
                "Skipping regional featured matchup %s for %s — already posted today",
                metadata.get("matchup_key"),
                region["region"],
            )
            result["skipped"] += 1
            continue

        if _has_active_user_thread(supabase, event_key, metadata):
            log.info(
                "Skipping regional featured matchup %s for %s — active user thread exists",
                metadata.get("matchup_key"),
                region["region"],
            )
            result["skipped"] += 1
            continue

        if token is None:
            token = authenticate_curator(supabase, secrets.curator_email, secrets.curator_password)
        if token is None:
            log.error("Curator auth failed — cannot post regional sports matchup")
            result["failed"] += 1
            break

        post_metadata = _build_post_metadata(event_row, item, "game_thread")
        post_id, post_error = post_to_pantopus(
            api_base_url=secrets.pantopus_api_base_url,
            access_token=token,
            content=item["content"],
            category="sports",
            region_lat=region["lat"],
            region_lng=region["lng"],
            audience="nearby",
            topic="sports",
            sports_scope="regional",
            post_metadata=post_metadata,
        )

        if post_error:
            log.warning(
                "Regional sports post failed for %s in %s: %s",
                metadata.get("matchup_key"),
                region["region"],
                post_error,
            )
            result["failed"] += 1
            continue

        log.info(
            "Posted regional sports thread %s for %s in %s",
            post_id,
            event_key,
            region["region"],
        )
        result["sent"] += 1

    return token, result


def _featured_matchups_for_event(event_row: dict, *, now: datetime) -> list[dict]:
    """Return configured/default matchups whose active window includes now."""
    configured: list[dict] = []
    cadence = event_row.get("cadence")
    if isinstance(cadence, dict) and isinstance(cadence.get("featured_matchups"), list):
        configured = [m for m in cadence["featured_matchups"] if isinstance(m, dict)]

    defaults = _DEFAULT_FEATURED_MATCHUPS_BY_EVENT.get(event_row["event_key"], [])
    default_by_key = {
        str(matchup.get("matchup_key") or matchup.get("matchup") or matchup): matchup
        for matchup in defaults
    }

    matchups: list[dict] = []
    seen: set[str] = set()
    for matchup in configured:
        key = str(matchup.get("matchup_key") or matchup.get("matchup") or matchup)
        if key in seen:
            continue
        seen.add(key)
        matchup = {**default_by_key.get(key, {}), **matchup}
        if _is_matchup_active(matchup, now):
            matchups.append(matchup)

    for matchup in defaults:
        key = str(matchup.get("matchup_key") or matchup.get("matchup") or matchup)
        if key in seen:
            continue
        seen.add(key)
        if _is_matchup_active(matchup, now):
            matchups.append(matchup)

    return matchups


def _is_matchup_active(matchup: dict, now: datetime) -> bool:
    starts_at = _parse_datetime(matchup.get("active_from"))
    ends_at = _parse_datetime(matchup.get("active_until"))
    tip_off_at = _parse_datetime(matchup.get("tip_off_at"))

    if starts_at is None and tip_off_at is not None:
        starts_at = tip_off_at - timedelta(hours=18)
    if ends_at is None and tip_off_at is not None:
        ends_at = tip_off_at + timedelta(hours=_GAME_THREAD_FRESH_HOURS)

    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    if starts_at and now < starts_at:
        return False
    if ends_at and now > ends_at:
        return False
    return True


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _item_label(item: dict) -> str:
    return str(item.get("id") or item.get("synthetic_id") or item.get("source") or "unknown")


def _update_queue_item_if_needed(
    supabase,
    item: dict,
    status: str,
    humanized_text: str | None = None,
    post_id: str | None = None,
    failure_reason: str | None = None,
) -> None:
    """Update persisted queue rows; synthetic fallback items are in-memory only."""
    if item.get("_synthetic"):
        return
    item_id = item.get("id")
    if not item_id:
        return
    _update_queue_item(
        supabase,
        item_id,
        status,
        humanized_text=humanized_text,
        post_id=post_id,
        failure_reason=failure_reason,
    )


def _count_today_posts_by_kind(supabase, event_key: str) -> dict[str, int]:
    """Count today's national curator posts for this event, grouped by thread kind."""
    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    try:
        result = (
            supabase.table("Post")
            .select("id, post_metadata, audience, topic, origin, created_at")
            .eq("topic", "sports")
            .eq("audience", "national")
            .eq("origin", "curator")
            .gte("created_at", start_of_day.isoformat())
            .limit(500)
            .execute()
        )
        posts = list(result.data or [])
    except Exception:
        log.warning("Failed to count today's national sports posts", exc_info=True)
        return {}

    counts: dict[str, int] = {}
    for p in posts:
        metadata = p.get("post_metadata") or {}
        if metadata.get("event_key") != event_key:
            continue
        kind = _classify_thread_kind({"post_metadata": metadata})
        counts[kind] = counts.get(kind, 0) + 1
    return counts


def _has_active_user_thread(supabase, event_key: str, item_metadata: dict) -> bool:
    """Skip seeding if there's a recent user-authored thread on the same event.

    Using origin='user' rather than trusting metadata.is_seeded keeps this
    authoritative — the origin column is server-derived.
    """
    window = (datetime.now(timezone.utc) - timedelta(hours=_DEDUP_WINDOW_HOURS)).isoformat()
    try:
        result = (
            supabase.table("Post")
            .select("id, comment_count, post_metadata")
            .eq("topic", "sports")
            .eq("origin", "user")
            .gte("created_at", window)
            .limit(100)
            .execute()
        )
        rows = list(result.data or [])
    except Exception:
        log.warning("Dedup lookup failed — proceeding (fail open)", exc_info=True)
        return False

    item_team = (item_metadata or {}).get("team_tag")
    for r in rows:
        meta = r.get("post_metadata") or {}
        if meta.get("event_key") != event_key:
            continue
        # Need some engagement to count — otherwise a drive-by user thread
        # shouldn't block seeded conversation starters.
        if int(r.get("comment_count") or 0) < 1:
            continue
        # If the queue item has a specific team_tag, require a match.
        if item_team and meta.get("team_tag") != item_team:
            continue
        return True
    return False


def _has_regional_featured_matchup_post(
    supabase,
    event_key: str,
    item_metadata: dict,
    *,
    region: str | None = None,
    now: datetime | None = None,
) -> bool:
    """Return true if today's regional curator post already covers this matchup."""
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    start_of_day = current.replace(hour=0, minute=0, second=0, microsecond=0)

    try:
        result = (
            supabase.table("Post")
            .select("id, post_metadata, sports_scope, origin, topic, created_at")
            .eq("topic", "sports")
            .eq("origin", "curator")
            .eq("sports_scope", "regional")
            .gte("created_at", start_of_day.isoformat())
            .limit(200)
            .execute()
        )
        posts = list(result.data or [])
    except Exception:
        log.warning("Failed to check regional sports duplicate posts", exc_info=True)
        return False

    matchup_key = item_metadata.get("matchup_key")
    team_tag = item_metadata.get("team_tag")
    for post in posts:
        metadata = post.get("post_metadata") or {}
        if metadata.get("event_key") != event_key:
            continue

        if matchup_key and metadata.get("matchup_key") == matchup_key:
            return True
        if team_tag and metadata.get("team_tag") == team_tag and metadata.get("is_game_thread"):
            return True

    return False


def _classify_thread_kind(item: dict) -> str:
    """Infer the cadence bucket for a queue item or post."""
    meta = item.get("post_metadata") or {}
    if meta.get("is_watch_prompt"):
        return "watch_prompt"
    if meta.get("is_game_thread"):
        return "game_thread"
    return "general_thread"


def _merge_cadence(cadence: dict | None) -> dict:
    """Merge per-event cadence jsonb with sensible defaults."""
    merged = dict(_DEFAULT_CADENCE)
    if isinstance(cadence, dict):
        for k, v in cadence.items():
            try:
                merged[k] = int(v)
            except (TypeError, ValueError):
                continue
    return merged


def _build_post_metadata(event_row: dict, item: dict, kind: str) -> dict:
    """Build the post_metadata jsonb payload for the backend."""
    src_meta = dict(item.get("post_metadata") or {})
    src_meta.setdefault("event_key", event_row["event_key"])
    src_meta.setdefault("league", event_row.get("league"))
    if kind == "game_thread":
        src_meta["is_game_thread"] = True
    elif kind == "watch_prompt":
        src_meta["is_watch_prompt"] = True

    if "fresh_until" not in src_meta:
        src_meta["fresh_until"] = _compute_fresh_until(kind, src_meta).isoformat()

    # Drop None values so PostgREST doesn't store nulls for unknown league.
    return {k: v for k, v in src_meta.items() if v is not None}


def _compute_fresh_until(kind: str, meta: dict) -> datetime:
    """Derive a freshness deadline for a seeded sports post."""
    now = datetime.now(timezone.utc)
    tip_off_raw = meta.get("tip_off_at") or meta.get("starts_at")
    tip_off: datetime | None = None
    if tip_off_raw:
        try:
            tip_off = datetime.fromisoformat(str(tip_off_raw).replace("Z", "+00:00"))
        except ValueError:
            tip_off = None

    if kind == "game_thread":
        base = tip_off if (tip_off and tip_off > now) else now
        return base + timedelta(hours=_GAME_THREAD_FRESH_HOURS)
    if kind == "watch_prompt":
        return now + timedelta(hours=_WATCH_PROMPT_FRESH_HOURS)
    return now + timedelta(hours=_DEFAULT_FRESH_HOURS)


def _update_queue_item(
    supabase,
    item_id: str,
    status: str,
    humanized_text: str | None = None,
    post_id: str | None = None,
    failure_reason: str | None = None,
) -> None:
    update: dict[str, Any] = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if humanized_text is not None:
        update["humanized_text"] = humanized_text
    if post_id is not None:
        update["post_id"] = post_id
    if failure_reason is not None:
        update["failure_reason"] = failure_reason

    try:
        supabase.table("seeder_content_queue").update(update).eq("id", item_id).execute()
    except Exception:
        log.exception("Failed to update queue item %s to status=%s", item_id, status)
