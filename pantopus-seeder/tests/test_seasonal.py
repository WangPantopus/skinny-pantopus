"""Tests for the seasonal content source."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest

from src.models.queue_item import RawContentItem
from src.sources.registry import get_sources
from src.sources.seasonal import (
    SEASONAL_CALENDAR,
    SeasonalSource,
    _tip_hash,
    get_active_seasons,
    is_tip_active,
)

PACIFIC = ZoneInfo("America/Los_Angeles")


def _make_config(**overrides) -> dict:
    base = {
        "source_id": "seasonal:pnw",
        "source_type": "seasonal",
        "url": None,
        "category": "seasonal",
        "display_name": "Pantopus Seasonal",
        "region": "clark_county",
    }
    base.update(overrides)
    return base


def _mock_now(month: int, day: int):
    """Return a fixed Pacific-time datetime for patching."""
    return datetime(2026, month, day, 10, 0, 0, tzinfo=PACIFIC)


# ---------------------------------------------------------------------------
# Season detection per date
# ---------------------------------------------------------------------------

class TestSeasonDetection:
    def test_january_15_is_winter_ice(self):
        seasons = get_active_seasons(1, 15)
        names = [s["name"] for s in seasons]
        assert "winter_ice" in names
        assert len(names) == 1

    def test_march_20_is_spring_cleanup(self):
        seasons = get_active_seasons(3, 20)
        names = [s["name"] for s in seasons]
        assert "spring_cleanup" in names
        assert len(names) == 1

    def test_july_20_is_summer_dry_and_smoke(self):
        seasons = get_active_seasons(7, 20)
        names = [s["name"] for s in seasons]
        assert "summer_dry" in names
        assert "smoke_season" in names
        assert len(names) == 2

    def test_october_15_is_fall_prep(self):
        seasons = get_active_seasons(10, 15)
        names = [s["name"] for s in seasons]
        assert "fall_prep" in names
        assert len(names) == 1

    def test_november_20_is_fall_prep_and_holiday(self):
        seasons = get_active_seasons(11, 20)
        names = [s["name"] for s in seasons]
        assert "fall_prep" in names
        assert "holiday_season" in names
        assert len(names) == 2

    def test_december_20_is_winter_ice_and_holiday(self):
        seasons = get_active_seasons(12, 20)
        names = [s["name"] for s in seasons]
        assert "winter_ice" in names
        assert "holiday_season" in names
        assert len(names) == 2

    def test_may_15_has_no_season(self):
        """May is the gap month — no active seasons."""
        seasons = get_active_seasons(5, 15)
        assert seasons == []


# ---------------------------------------------------------------------------
# SeasonalSource.fetch()
# ---------------------------------------------------------------------------

class TestSeasonalSourceFetch:
    @patch("src.sources.seasonal.datetime")
    def test_returns_items_for_active_season(self, mock_dt):
        mock_dt.now.return_value = _mock_now(1, 15)
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)

        src = SeasonalSource(_make_config())
        items = src.fetch()

        assert len(items) == 1
        assert isinstance(items[0], RawContentItem)
        assert items[0].source_id == "seasonal:pnw"
        assert items[0].region == "clark_county"
        assert items[0].category == "seasonal"
        assert items[0].source_url is None

    @patch("src.sources.seasonal.datetime")
    def test_returns_two_items_during_overlap(self, mock_dt):
        mock_dt.now.return_value = _mock_now(7, 20)
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)

        src = SeasonalSource(_make_config())
        items = src.fetch()

        assert len(items) == 2

    @patch("src.sources.seasonal.datetime")
    def test_returns_empty_in_may(self, mock_dt):
        mock_dt.now.return_value = _mock_now(5, 15)
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)

        src = SeasonalSource(_make_config())
        items = src.fetch()

        assert items == []

    @patch("src.sources.seasonal.datetime")
    def test_recently_used_hashes_avoids_tips(self, mock_dt):
        mock_dt.now.return_value = _mock_now(1, 15)
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)

        winter = next(s for s in SEASONAL_CALENDAR if s["name"] == "winter_ice")
        active_tips = [t for t in winter["tips"] if is_tip_active(t, 1, 15)]

        # Mark all but one tip as used
        used = [_tip_hash(t) for t in active_tips[:-1]]
        src = SeasonalSource(_make_config(), recently_used_tip_hashes=used)
        items = src.fetch()

        assert len(items) == 1
        # The returned tip should be the one NOT in the used set
        assert items[0].title == active_tips[-1]

    @patch("src.sources.seasonal.datetime")
    def test_falls_back_when_all_tips_used(self, mock_dt):
        mock_dt.now.return_value = _mock_now(1, 15)
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)

        winter = next(s for s in SEASONAL_CALENDAR if s["name"] == "winter_ice")
        all_hashes = [_tip_hash(t) for t in winter["tips"]]

        src = SeasonalSource(_make_config(), recently_used_tip_hashes=all_hashes)
        items = src.fetch()

        # Should still return something (random fallback)
        assert len(items) == 1
        assert items[0].title in winter["tips"]

    @patch("src.sources.seasonal.datetime")
    def test_does_not_publish_early_march_tip_in_late_april(self, mock_dt):
        mock_dt.now.return_value = _mock_now(4, 20)
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)

        spring = next(s for s in SEASONAL_CALENDAR if s["name"] == "spring_cleanup")
        stale_tip = next(t for t in spring["tips"] if "early March" in t)
        used = [
            _tip_hash(t)
            for t in spring["tips"]
            if t != stale_tip and is_tip_active(t, 4, 20)
        ]

        src = SeasonalSource(_make_config(), recently_used_tip_hashes=used)
        items = src.fetch()

        assert len(items) == 1
        assert "early March" not in items[0].title

    @patch("src.sources.seasonal.datetime")
    def test_can_publish_early_march_tip_during_early_march(self, mock_dt):
        mock_dt.now.return_value = _mock_now(3, 5)
        mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)

        spring = next(s for s in SEASONAL_CALENDAR if s["name"] == "spring_cleanup")
        stale_tip = next(t for t in spring["tips"] if "early March" in t)
        used = [_tip_hash(t) for t in spring["tips"] if t != stale_tip]

        src = SeasonalSource(_make_config(), recently_used_tip_hashes=used)
        items = src.fetch()

        assert len(items) == 1
        assert items[0].title == stale_tip


# ---------------------------------------------------------------------------
# Tip quality checks
# ---------------------------------------------------------------------------

class TestTipQuality:
    def test_all_tips_non_empty_and_under_300_chars(self):
        for season in SEASONAL_CALENDAR:
            for tip in season["tips"]:
                assert len(tip) > 0, f"Empty tip in {season['name']}"
                assert len(tip) <= 300, (
                    f"Tip too long ({len(tip)} chars) in {season['name']}: {tip[:50]}..."
                )

    def test_each_season_has_enough_tips(self):
        for season in SEASONAL_CALENDAR:
            assert len(season["tips"]) >= 3, (
                f"{season['name']} has only {len(season['tips'])} tips"
            )


# ---------------------------------------------------------------------------
# Calendar coverage
# ---------------------------------------------------------------------------

class TestCalendarCoverage:
    def test_every_month_except_may_has_a_season(self):
        """Every date except May maps to at least one season."""
        for month in range(1, 13):
            if month == 5:
                # May is the intentional gap
                assert get_active_seasons(5, 15) == []
                continue
            seasons = get_active_seasons(month, 15)
            assert len(seasons) >= 1, f"No season for month {month}"


# ---------------------------------------------------------------------------
# Registry integration
# ---------------------------------------------------------------------------

class TestRegistryIntegration:
    def test_registry_returns_seasonal_source(self):
        sources = get_sources("clark_county")
        seasonal = [s for s in sources if isinstance(s, SeasonalSource)]
        assert len(seasonal) == 1
        assert seasonal[0].source_id == "seasonal:pnw"

    def test_both_regions_have_seasonal_source(self):
        for region in ("clark_county", "portland_metro"):
            sources = get_sources(region)
            seasonal = [s for s in sources if isinstance(s, SeasonalSource)]
            assert len(seasonal) >= 1, f"No seasonal source for {region}"
