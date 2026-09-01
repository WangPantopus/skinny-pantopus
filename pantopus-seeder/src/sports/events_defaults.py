"""Default sports events for the national Sports lane.

Why this exists:
- The national sports lambdas are gated by the `active_sports_events` view.
- If `sports_events` is empty or missing the current event rows in an env
  (common after partial/missed migrations), the lane becomes a silent no-op.

These defaults mirror `scripts/seed_sports_events.py` and the SQL seed migration,
but live in-code so production can self-heal.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


DEFAULT_SPORTS_EVENTS: list[dict[str, Any]] = [
    {
        "event_key": "nba_playoffs_2026",
        "display_name": "NBA Playoffs",
        "short_label": "NBA Playoffs",
        "league": "nba",
        "country": "US",
        "starts_at": "2026-04-18T00:00:00+00:00",
        "ends_at": "2026-06-22T23:59:59+00:00",
        "priority": 10,
        "cadence": {
            "general_thread": 1,
            "game_thread": 2,
            "watch_prompt": 1,
            "featured_matchups": [
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
        },
    },
    {
        "event_key": "nhl_playoffs_2026",
        "display_name": "NHL Playoffs",
        "short_label": "NHL Playoffs",
        "league": "nhl",
        "country": "US",
        "starts_at": "2026-04-20T00:00:00+00:00",
        "ends_at": "2026-06-22T23:59:59+00:00",
        "priority": 20,
        "cadence": {"general_thread": 1, "game_thread": 2, "watch_prompt": 1},
    },
    {
        "event_key": "mlb_opening_2026",
        "display_name": "MLB Season",
        "short_label": "MLB",
        "league": "mlb",
        "country": "US",
        "starts_at": "2026-03-26T00:00:00+00:00",
        "ends_at": "2026-10-01T23:59:59+00:00",
        "priority": 50,
        "cadence": {"general_thread": 1, "game_thread": 1, "watch_prompt": 1},
    },
    {
        "event_key": "fifa_world_cup_2026",
        "display_name": "FIFA World Cup",
        "short_label": "World Cup",
        "league": "other",
        "country": "US",
        "starts_at": "2026-06-11T00:00:00+00:00",
        "ends_at": "2026-07-19T23:59:59+00:00",
        "priority": 5,
        "cadence": {"general_thread": 1, "game_thread": 2, "watch_prompt": 2},
    },
]


def ensure_default_sports_events(supabase) -> dict[str, Any]:
    """Ensure the sports_events registry contains the default rows.

    Returns a tiny summary dict for logs/metrics. This is safe to call on every
    invocation; it only upserts when rows are missing or the table doesn't exist.
    """
    summary: dict[str, Any] = {"attempted": False, "upserted": 0, "reason": None}

    # Quick existence check: only insert the missing event_keys (never overwrite
    # existing rows; prod may intentionally tweak windows/cadence).
    try:
        keys = [row["event_key"] for row in DEFAULT_SPORTS_EVENTS]
        # PostgREST `in` filter expects a parenthesized, comma-separated list.
        # Quote strings defensively to avoid parsing issues.
        quoted = ",".join(f'"{k}"' for k in keys)
        existing = (
            supabase.table("sports_events")
            .select("event_key")
            .filter("event_key", "in", f"({quoted})")
            .limit(len(keys))
            .execute()
        )
        existing_keys = {r.get("event_key") for r in (existing.data or [])}
        missing = [k for k in keys if k not in existing_keys]
        if not missing:
            summary["reason"] = "already_present"
            return summary
    except Exception:
        # If the existence check fails (e.g. table missing), try to upsert anyway.
        summary["reason"] = "existence_check_failed"

    summary["attempted"] = True
    try:
        rows = DEFAULT_SPORTS_EVENTS
        if summary["reason"] != "existence_check_failed":
            missing_set = set(missing)
            rows = [r for r in DEFAULT_SPORTS_EVENTS if r.get("event_key") in missing_set]
        supabase.table("sports_events").upsert(rows, on_conflict="event_key").execute()
        summary["upserted"] = len(rows)
        summary["reason"] = summary["reason"] or "upserted"
    except Exception as e:
        # Don't hard-fail the lambda; keep behavior as before.
        summary["reason"] = f"upsert_failed:{type(e).__name__}"

    summary["attempted_at"] = datetime.now(timezone.utc).isoformat()
    return summary
