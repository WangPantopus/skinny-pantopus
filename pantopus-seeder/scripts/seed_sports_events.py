#!/usr/bin/env python3
"""Seed or refresh the `sports_events` registry with major US events.

Usage:
    python scripts/seed_sports_events.py                  # use SUPABASE_URL / KEY from env
    python scripts/seed_sports_events.py --dry-run        # print the rows we'd upsert

Idempotent — upserts by event_key. Cadence values follow the plan's daily caps
(1 general thread + 2 game threads + 1 watch prompt during major events).

Extend DEFAULT_EVENTS to add new events as their schedule is announced.
Upcoming event_keys are fine — the active_sports_events view filters by the
current time window so posts only flow while the event is live.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

_DEFAULT_CADENCE = {
    "general_thread": 1,
    "game_thread": 2,
    "watch_prompt": 1,
}


# Dates are intentionally conservative US-wide windows. Adjust priority to
# choose which event gets promoted as the primary chip label when multiple
# events are live simultaneously (lower = primary).
DEFAULT_EVENTS: list[dict] = [
    {
        "event_key": "nba_playoffs_2026",
        "display_name": "NBA Playoffs",
        "short_label": "NBA Playoffs",
        "league": "nba",
        "country": "US",
        "starts_at": "2026-04-18T00:00:00+00:00",
        "ends_at":   "2026-06-22T23:59:59+00:00",
        "priority": 10,
        "cadence": {
            **_DEFAULT_CADENCE,
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
        "ends_at":   "2026-06-22T23:59:59+00:00",
        "priority": 20,
        "cadence": _DEFAULT_CADENCE,
    },
    {
        "event_key": "mlb_opening_2026",
        "display_name": "MLB Season",
        "short_label": "MLB",
        "league": "mlb",
        "country": "US",
        "starts_at": "2026-03-26T00:00:00+00:00",
        "ends_at":   "2026-10-01T23:59:59+00:00",
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
        "ends_at":   "2026-07-19T23:59:59+00:00",
        "priority": 5,
        "cadence": {"general_thread": 1, "game_thread": 2, "watch_prompt": 2},
    },
]


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(f"error: missing required env var {name}", file=sys.stderr)
        sys.exit(2)
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="print what would be upserted")
    args = parser.parse_args()

    rows = list(DEFAULT_EVENTS)
    for r in rows:
        r.setdefault("country", "US")
        r.setdefault("priority", 100)
        r.setdefault("cadence", _DEFAULT_CADENCE)

    if args.dry_run:
        for r in rows:
            print(r)
        print(f"would upsert {len(rows)} rows at {datetime.now(timezone.utc).isoformat()}")
        return

    try:
        from supabase import create_client
    except ImportError:
        print("error: install the 'supabase' package first", file=sys.stderr)
        sys.exit(2)

    url = _require_env("SUPABASE_URL")
    key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
    client = create_client(url, key)

    client.table("sports_events").upsert(rows, on_conflict="event_key").execute()
    print(f"Upserted {len(rows)} sports_events rows.")


if __name__ == "__main__":
    main()
