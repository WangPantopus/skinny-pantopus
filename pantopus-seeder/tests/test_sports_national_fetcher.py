"""Tests for the national sports fetcher source builder."""

from __future__ import annotations

from src.handlers.sports_national_fetcher import _build_sources_for_event
from src.sources.google_news import GoogleNewsSource
from src.sources.rss import RssSource


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
    }


def test_nba_playoffs_builds_official_publisher_and_espn_sources():
    sources = _build_sources_for_event(_nba_playoffs_event())

    by_id = {source.source_id: source for source in sources}

    expected_ids = {
        "sports_national:nba_playoffs_2026:google_news",
        "sports_national:nba_playoffs_2026:trail_blazers",
        "sports_national:nba_playoffs_2026:nba_official",
        "sports_national:nba_playoffs_2026:bleacher_report",
        "sports_national:nba_playoffs_2026:fox_sports",
        "sports_national:nba_playoffs_2026:espn",
    }
    assert expected_ids.issubset(by_id.keys())

    assert isinstance(by_id["sports_national:nba_playoffs_2026:nba_official"], GoogleNewsSource)
    assert "site:nba.com" in by_id["sports_national:nba_playoffs_2026:nba_official"].query
    assert "NBA Playoffs" in by_id["sports_national:nba_playoffs_2026:nba_official"].query
    assert "Portland Trail Blazers" in by_id["sports_national:nba_playoffs_2026:nba_official"].query

    assert isinstance(by_id["sports_national:nba_playoffs_2026:trail_blazers"], GoogleNewsSource)
    assert "Portland Trail Blazers" in by_id["sports_national:nba_playoffs_2026:trail_blazers"].query
    assert "NBA Playoffs" in by_id["sports_national:nba_playoffs_2026:trail_blazers"].query

    assert isinstance(by_id["sports_national:nba_playoffs_2026:bleacher_report"], GoogleNewsSource)
    assert "site:bleacherreport.com" in by_id["sports_national:nba_playoffs_2026:bleacher_report"].query

    assert isinstance(by_id["sports_national:nba_playoffs_2026:fox_sports"], GoogleNewsSource)
    assert "site:foxsports.com" in by_id["sports_national:nba_playoffs_2026:fox_sports"].query

    assert isinstance(by_id["sports_national:nba_playoffs_2026:espn"], RssSource)
    assert by_id["sports_national:nba_playoffs_2026:espn"].feed_url == (
        "https://www.espn.com/espn/rss/nba/news"
    )
