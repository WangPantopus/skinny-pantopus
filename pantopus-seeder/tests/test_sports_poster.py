"""Tests for national sports poster candidate metadata and templates."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

import src.handlers.sports_poster as sports_poster
from src.config.region_registry import RegionConfig
from src.handlers.sports_poster import (
    _build_regional_featured_matchup_items,
    _build_templated_sports_items,
    _classify_thread_kind,
    _has_regional_featured_matchup_post,
    _prepare_queued_sports_item,
    _sports_candidate_rank,
)


def _nba_playoffs_event() -> dict:
    return {
        "event_key": "nba_playoffs_2026",
        "display_name": "NBA Playoffs",
        "short_label": "NBA Playoffs",
        "league": "nba",
        "country": "US",
        "starts_at": "2026-04-18T00:00:00+00:00",
        "ends_at": "2026-06-22T23:59:59+00:00",
        "priority": 10,
        "cadence": {},
    }


def _region(region: str = "portland_metro", display_name: str | None = None) -> RegionConfig:
    defaults = {
        "portland_metro": (45.5152, -122.6784, "Portland Metro"),
        "clark_county": (45.6387, -122.6615, "Clark County"),
    }
    lat, lng, default_display_name = defaults.get(region, (45.5152, -122.6784, region))
    return RegionConfig(
        region=region,
        lat=lat,
        lng=lng,
        radius_meters=25000,
        timezone="America/Los_Angeles",
        display_name=display_name or default_display_name,
        curator_user_id="curator-1",
    )


class _Result:
    def __init__(self, data: list[dict]):
        self.data = data


class _PostQuery:
    def __init__(self, rows: list[dict]):
        self.rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def gte(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return _Result(self.rows)


class _Supabase:
    def __init__(self, rows: list[dict]):
        self.rows = rows

    def table(self, name: str):
        assert name == "Post"
        return _PostQuery(self.rows)


def test_templates_include_blazers_game_day_items_during_active_window():
    now = datetime(2026, 4, 28, 19, 0, tzinfo=timezone.utc)

    items = _build_templated_sports_items(_nba_playoffs_event(), now=now)
    matchup_items = [
        item for item in items
        if (item.get("post_metadata") or {}).get("matchup_key")
        == "nba_playoffs_2026_blazers_spurs_game_5"
    ]

    assert len(matchup_items) == 2
    assert { _classify_thread_kind(item) for item in matchup_items } == {
        "game_thread",
        "watch_prompt",
    }
    assert all((item["post_metadata"]).get("team_tag") == "blazers" for item in matchup_items)
    assert any("6:30 PM PT" in (item.get("raw_body") or "") for item in matchup_items)


def test_nba_templates_stay_quiet_after_featured_window():
    now = datetime(2026, 4, 30, 19, 0, tzinfo=timezone.utc)

    items = _build_templated_sports_items(_nba_playoffs_event(), now=now)

    assert items == []


def test_queued_blazers_playoff_article_becomes_game_thread():
    prepared = _prepare_queued_sports_item(
        _nba_playoffs_event(),
        {
            "id": "queue-1",
            "source": "sports_national:nba_playoffs_2026:trail_blazers",
            "raw_title": "Blazers face elimination vs. Spurs in Game 5 tonight",
            "raw_body": "Portland Trail Blazers are down 3-1 in the NBA Playoffs.",
        },
    )

    meta = prepared["post_metadata"]
    assert meta["event_key"] == "nba_playoffs_2026"
    assert meta["league"] == "nba"
    assert meta["team_tag"] == "blazers"
    assert meta["opponent_tag"] == "spurs"
    assert meta["is_game_thread"] is True
    assert _classify_thread_kind(prepared) == "game_thread"


def test_blazers_game_candidates_rank_above_generic_templates():
    event = _nba_playoffs_event()
    blazers_item = _prepare_queued_sports_item(
        event,
        {
            "id": "queue-1",
            "source": "sports_national:nba_playoffs_2026:trail_blazers",
            "raw_title": "Trail Blazers-Spurs Game 5 is tonight",
            "raw_body": None,
        },
    )
    generic_event = {
        **event,
        "event_key": "nhl_playoffs_2026",
        "display_name": "NHL Playoffs",
        "league": "nhl",
    }
    generic_item = _build_templated_sports_items(
        generic_event,
        now=datetime(2026, 4, 30, 19, 0, tzinfo=timezone.utc),
    )[0]

    assert _sports_candidate_rank(blazers_item) > _sports_candidate_rank(generic_item)


def test_regional_featured_matchup_items_target_local_place_regions():
    now = datetime(2026, 4, 28, 19, 0, tzinfo=timezone.utc)

    items = _build_regional_featured_matchup_items(
        _nba_playoffs_event(),
        [_region(), _region("clark_county"), _region("not_targeted", "Other Region")],
        now=now,
    )

    assert len(items) == 1
    item = items[0]
    metadata = item["post_metadata"]
    assert item["region"]["region"] == "portland_metro+clark_county"
    assert item["region"]["lat"] == (45.5152 + 45.6387) / 2
    assert item["region"]["lng"] == (-122.6784 + -122.6615) / 2
    assert "Trail Blazers at Spurs Game 5 tips at 6:30 PM PT tonight" in item["content"]
    assert "Portland Metro and Clark County" in item["content"]
    assert metadata["local_region"] == "portland_metro+clark_county"
    assert metadata["local_target_regions"] == ["portland_metro", "clark_county"]
    assert metadata["team_tag"] == "blazers"
    assert metadata["is_game_thread"] is True


def test_regional_featured_matchup_items_fill_regions_for_existing_config():
    now = datetime(2026, 4, 28, 19, 0, tzinfo=timezone.utc)
    event = _nba_playoffs_event()
    event["cadence"] = {
        "featured_matchups": [
            {
                "matchup_key": "nba_playoffs_2026_blazers_spurs_game_5",
                "active_from": "2026-04-28T00:00:00+00:00",
                "active_until": "2026-04-29T08:00:00+00:00",
            },
        ],
    }

    items = _build_regional_featured_matchup_items(
        event,
        [_region()],
        now=now,
    )

    assert len(items) == 1
    metadata = items[0]["post_metadata"]
    assert metadata["matchup"] == "Trail Blazers at Spurs"
    assert metadata["local_region"] == "portland_metro"
    assert metadata["team_tag"] == "blazers"


def test_regional_items_stay_quiet_after_featured_window():
    now = datetime(2026, 4, 30, 19, 0, tzinfo=timezone.utc)

    items = _build_regional_featured_matchup_items(
        _nba_playoffs_event(),
        [_region(), _region("clark_county")],
        now=now,
    )

    assert items == []


def test_regional_featured_matchup_dedup_handles_manual_unscoped_post():
    now = datetime(2026, 4, 28, 19, 0, tzinfo=timezone.utc)
    metadata = {
        "event_key": "nba_playoffs_2026",
        "matchup_key": "nba_playoffs_2026_blazers_spurs_game_5",
        "team_tag": "blazers",
        "is_game_thread": True,
    }
    supabase = _Supabase([{"post_metadata": metadata}])

    assert _has_regional_featured_matchup_post(
        supabase,
        "nba_playoffs_2026",
        metadata,
        region="portland_metro",
        now=now,
    )
    assert _has_regional_featured_matchup_post(
        supabase,
        "nba_playoffs_2026",
        metadata,
        region="clark_county",
        now=now,
    )


def test_regional_featured_matchup_dedup_is_cross_region_for_same_matchup():
    now = datetime(2026, 4, 28, 19, 0, tzinfo=timezone.utc)
    existing = {
        "event_key": "nba_playoffs_2026",
        "matchup_key": "nba_playoffs_2026_blazers_spurs_game_5",
        "team_tag": "blazers",
        "is_game_thread": True,
        "local_region": "portland_metro",
    }
    metadata = {
        "event_key": "nba_playoffs_2026",
        "matchup_key": "nba_playoffs_2026_blazers_spurs_game_5",
        "team_tag": "blazers",
        "is_game_thread": True,
    }
    supabase = _Supabase([{"post_metadata": existing}])

    assert _has_regional_featured_matchup_post(
        supabase,
        "nba_playoffs_2026",
        metadata,
        region="portland_metro",
        now=now,
    )
    assert _has_regional_featured_matchup_post(
        supabase,
        "nba_playoffs_2026",
        metadata,
        region="clark_county",
        now=now,
    )


def test_regional_featured_matchup_posts_nearby(monkeypatch):
    now = datetime(2026, 4, 28, 19, 0, tzinfo=timezone.utc)
    calls: list[dict] = []

    monkeypatch.setattr(
        sports_poster,
        "_has_regional_featured_matchup_post",
        lambda *_args, **_kwargs: False,
    )
    monkeypatch.setattr(sports_poster, "_has_active_user_thread", lambda *_args, **_kwargs: False)
    monkeypatch.setattr(
        sports_poster,
        "authenticate_curator",
        lambda _supabase, _email, _password: "token-123",
    )

    def fake_post(**kwargs):
        calls.append(kwargs)
        return "post-1", None

    monkeypatch.setattr(sports_poster, "post_to_pantopus", fake_post)

    token, summary = sports_poster._post_regional_featured_matchups(
        supabase=object(),
        secrets=SimpleNamespace(
            curator_email="curator@example.com",
            curator_password="secret",
            pantopus_api_base_url="https://api.example.test",
        ),
        token=None,
        event_row=_nba_playoffs_event(),
        active_regions=[_region()],
        now=now,
    )

    assert token == "token-123"
    assert summary == {"sent": 1, "skipped": 0, "failed": 0}
    assert len(calls) == 1
    call = calls[0]
    assert call["audience"] == "nearby"
    assert call["topic"] == "sports"
    assert call["sports_scope"] == "regional"
    assert call["region_lat"] == 45.5152
    assert call["region_lng"] == -122.6784
    assert call["post_metadata"]["local_region"] == "portland_metro"
    assert call["post_metadata"]["matchup_key"] == "nba_playoffs_2026_blazers_spurs_game_5"
