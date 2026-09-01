"""Tests for the poster Lambda handler."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

import pytest

from src.config.region_registry import RegionConfig
from src.handlers.poster import (
    _detect_slot,
    _score_item,
    _select_candidates_for_slot,
    _select_item,
    handler,
)

PACIFIC = ZoneInfo("America/Los_Angeles")
_HANDLER = "src.handlers.poster"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pt(hour, weekday=0):
    """Create a Pacific datetime at the given hour on the given weekday (0=Mon)."""
    # 2026-04-06 is a Monday
    day = 6 + weekday
    return datetime(2026, 4, day, hour, 30, 0, tzinfo=PACIFIC)


def _mock_secrets():
    s = MagicMock()
    s.supabase_url = "https://test.supabase.co"
    s.supabase_service_role_key = "test-key"
    s.openai_api_key = "sk-test"
    s.curator_email = "curator@test.com"
    s.curator_password = "pass"
    s.pantopus_api_base_url = "https://api.pantopus.com"
    return s


def _mock_supabase():
    """Create a mock Supabase client with chainable table and auth methods."""
    client = MagicMock()

    def _chain():
        chain = MagicMock()
        chain.select.return_value = chain
        chain.insert.return_value = chain
        chain.update.return_value = chain
        chain.delete.return_value = chain
        chain.eq.return_value = chain
        chain.gte.return_value = chain
        chain.filter.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain
        result = MagicMock()
        result.data = []
        result.count = 0
        chain.execute.return_value = result
        return chain

    client.table.return_value = _chain()
    return client


def _make_queue_item(**overrides):
    base = {
        "id": "item-uuid-1",
        "source": "rss:columbian",
        "source_url": "https://example.com/1",
        "raw_title": "New park opens in Vancouver",
        "raw_body": "The city announced a new park.",
        "region": "clark_county",
        "category": "local_news",
        "status": "queued",
        "dedup_hash": "hash123",
        "fetched_at": "2026-04-04T10:00:00Z",
    }
    base.update(overrides)
    return base


def _make_region_config(region="test_region", **overrides):
    defaults = {
        "region": region,
        "lat": 45.0,
        "lng": -122.0,
        "radius_meters": 25000,
        "timezone": "America/Los_Angeles",
        "display_name": "Test Region",
        "curator_user_id": "curator-uuid",
    }
    defaults.update(overrides)
    return RegionConfig(**defaults)


_TWO_REGIONS = [
    _make_region_config("clark_county", lat=45.6387, lng=-122.6615, display_name="Clark County, WA"),
    _make_region_config("portland_metro", lat=45.5152, lng=-122.6784, display_name="Portland Metro"),
]


def _standard_patches(now_pt=None, regions=None):
    """Return dict of common patches for poster handler tests."""
    if now_pt is None:
        now_pt = _pt(7)  # Monday 7:30 AM

    return {
        "now": patch(f"{_HANDLER}.datetime", wraps=datetime,
                     **{"now.return_value": now_pt}),
        "sleep": patch(f"{_HANDLER}.time.sleep"),
        "random": patch(f"{_HANDLER}.random.randint", return_value=0),
        "secrets": patch(f"{_HANDLER}.get_secrets", return_value=_mock_secrets()),
        "create_client": patch("supabase.create_client"),
        "load_regions": patch(f"{_HANDLER}.load_active_regions",
                              return_value=regions if regions is not None else _TWO_REGIONS),
        "check_density": patch(f"{_HANDLER}.check_density"),
        "should_post": patch(f"{_HANDLER}.should_post_in_slot", return_value=True),
        "allowed_cats": patch(f"{_HANDLER}.allowed_categories",
                              return_value=["local_news", "event", "weather",
                                            "seasonal", "community_resource", "safety"]),
        "humanize": patch(f"{_HANDLER}.humanize"),
        "auth_curator": patch(f"{_HANDLER}.authenticate_curator", return_value="token-123"),
        "post_api": patch(f"{_HANDLER}.post_to_pantopus"),
    }


# ---------------------------------------------------------------------------
# Slot detection tests
# ---------------------------------------------------------------------------

class TestDetectSlot:
    def test_morning_hour(self):
        assert _detect_slot(_pt(7)) == "morning"

    def test_morning_plus_one(self):
        assert _detect_slot(_pt(8)) == "morning"

    def test_midday(self):
        assert _detect_slot(_pt(12)) == "midday"

    def test_evening(self):
        assert _detect_slot(_pt(17)) == "evening"

    def test_no_match(self):
        assert _detect_slot(_pt(15)) is None

    def test_no_match_early(self):
        assert _detect_slot(_pt(3)) is None


class TestSlotAndWeekendRules:
    def test_handler_exits_on_no_slot(self):
        patches = _standard_patches(_pt(15))
        with patches["now"], patches["sleep"], patches["random"]:
            result = handler({}, None)
        assert result.get("skipped") == "no_matching_slot"

    def test_handler_exits_on_sunday(self):
        patches = _standard_patches(_pt(7, weekday=6))  # Sunday
        with patches["now"], patches["sleep"], patches["random"]:
            result = handler({}, None)
        assert result.get("skipped") == "sunday"

    def test_handler_exits_saturday_noon(self):
        patches = _standard_patches(_pt(12, weekday=5))  # Saturday midday
        with patches["now"], patches["sleep"], patches["random"]:
            result = handler({}, None)
        assert result.get("skipped") == "saturday_non_morning"

    def test_handler_proceeds_saturday_morning(self):
        patches = _standard_patches(_pt(7, weekday=5))  # Saturday morning
        with (
            patches["now"],
            patches["sleep"],
            patches["random"],
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["check_density"] as mock_density,
            patches["should_post"],
            patches["allowed_cats"],
            patches["humanize"],
            patches["auth_curator"],
            patches["post_api"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_density.return_value = MagicMock(
                stage="full", avg_daily_posts=0, active_posters=0
            )

            result = handler({}, None)
            assert "skipped" not in result or result.get("skipped") not in (
                "sunday", "saturday_non_morning"
            )
            assert result.get("regions_processed", 0) > 0


# ---------------------------------------------------------------------------
# Tapering integration tests
# ---------------------------------------------------------------------------

class TestTaperingIntegration:
    def test_full_stage_all_slots_proceed(self):
        patches = _standard_patches(_pt(12))  # midday
        with (
            patches["now"],
            patches["sleep"],
            patches["random"],
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["check_density"] as mock_density,
            patch(f"{_HANDLER}.should_post_in_slot", return_value=True) as mock_should,
            patches["allowed_cats"],
            patches["humanize"],
            patches["auth_curator"],
            patches["post_api"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_density.return_value = MagicMock(
                stage="full", avg_daily_posts=0, active_posters=0
            )

            handler({}, None)
            # should_post_in_slot was called with "full" and "midday"
            calls = mock_should.call_args_list
            assert any(c.args == ("full", "midday") for c in calls)

    def test_reduced_stage_skips_midday(self):
        patches = _standard_patches(_pt(12))  # midday
        with (
            patches["now"],
            patches["sleep"],
            patches["random"],
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["check_density"] as mock_density,
            patch(f"{_HANDLER}.should_post_in_slot", return_value=False),
            patches["allowed_cats"],
            patches["humanize"],
            patches["auth_curator"],
            patches["post_api"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_density.return_value = MagicMock(
                stage="reduced", avg_daily_posts=3, active_posters=8
            )

            result = handler({}, None)
            assert result["items_skipped"] == 2  # Both regions skipped


# ---------------------------------------------------------------------------
# Item selection / scoring tests
# ---------------------------------------------------------------------------

class TestItemScoring:
    def test_safety_beats_news(self):
        safety = _make_queue_item(category="safety")
        news = _make_queue_item(category="local_news")
        assert _score_item(safety, None) > _score_item(news, None)

    def test_event_beats_news(self):
        event = _make_queue_item(category="event")
        news = _make_queue_item(category="local_news")
        assert _score_item(event, None) > _score_item(news, None)

    def test_seasonal_beats_news(self):
        seasonal = _make_queue_item(category="seasonal")
        news = _make_queue_item(category="local_news")
        assert _score_item(seasonal, None) > _score_item(news, None)

    def test_source_diversity_bonus(self):
        same_src = _make_queue_item(source="rss:columbian", category="local_news")
        diff_src = _make_queue_item(source="rss:tribune", category="local_news")
        assert _score_item(diff_src, "rss:columbian") > _score_item(same_src, "rss:columbian")

    def test_source_diversity_ignored_when_no_last(self):
        a = _make_queue_item(source="rss:columbian", category="local_news")
        b = _make_queue_item(source="rss:tribune", category="local_news")
        assert _score_item(a, None) == _score_item(b, None)

    def test_p1_beats_p2(self):
        """Priority 1 (critical) items always score higher than priority 2 (core)."""
        p1 = _make_queue_item(category="weather", source_priority=1)
        p2 = _make_queue_item(category="local_news", source_priority=2)
        assert _score_item(p1, None) > _score_item(p2, None)

    def test_p2_beats_p3(self):
        """Priority 2 (core) items score higher than priority 3 (enrichment)."""
        p2 = _make_queue_item(category="local_news", source_priority=2)
        p3 = _make_queue_item(category="sports", source_priority=3)
        assert _score_item(p2, None) > _score_item(p3, None)

    def test_playoff_blazers_sports_beats_routine_news_but_not_alerts(self):
        """Game-day local sports gets surfaced without outranking P1 alerts."""
        blazers = _make_queue_item(
            category="sports",
            source="google_news:trail_blazers",
            source_priority=3,
            raw_title="Trail Blazers face Spurs in NBA Playoffs Game 5 tonight",
        )
        news = _make_queue_item(category="local_news", source_priority=2)
        alert = _make_queue_item(category="weather", source_priority=1)

        assert _score_item(blazers, None) > _score_item(news, None)
        assert _score_item(alert, None) > _score_item(blazers, None)

    def test_p3_beats_p4(self):
        """Priority 3 (enrichment) items score higher than priority 4 (filler)."""
        p3 = _make_queue_item(category="sports", source_priority=3)
        p4 = _make_queue_item(category="history", source_priority=4)
        assert _score_item(p3, None) > _score_item(p4, None)

    def test_enrichment_bonus_breaks_core_news_monotony(self):
        """Sports/community can beat core news right after a core-news post."""
        sports = _make_queue_item(category="sports", source_priority=3)
        news = _make_queue_item(category="local_news", source_priority=2)
        assert _score_item(sports, None, "local_news") > _score_item(news, None, "local_news")

    def test_enrichment_bonus_does_not_repeat_after_enrichment(self):
        """Once enrichment just posted, core news reclaims the next slot."""
        sports = _make_queue_item(category="sports", source_priority=3)
        news = _make_queue_item(category="local_news", source_priority=2)
        assert _score_item(news, None, "sports") > _score_item(sports, None, "sports")

    def test_p1_safety_beats_p2_safety(self):
        """Even same category, P1 source beats P2 source."""
        p1_safety = _make_queue_item(category="safety", source_priority=1)
        p2_safety = _make_queue_item(category="safety", source_priority=2)
        assert _score_item(p1_safety, None) > _score_item(p2_safety, None)

    def test_default_priority_is_2(self):
        """Items without source_priority default to P2."""
        item = _make_queue_item(category="local_news")
        assert _score_item(item, None) == _score_item(
            _make_queue_item(category="local_news", source_priority=2), None
        )


class TestSelectItem:
    def test_returns_none_on_empty_queue(self):
        sb = _mock_supabase()
        result = _select_item(sb, "clark_county", ["local_news", "event"])
        assert result is None

    def test_returns_highest_scored_item(self):
        sb = _mock_supabase()
        news = _make_queue_item(category="local_news", id="news-1")
        safety = _make_queue_item(category="safety", id="safety-1")

        # Mock the queued items query
        table_chain = sb.table.return_value
        queued_result = MagicMock()
        queued_result.data = [news, safety]

        # First execute = last_posted_source query, second = queued items,
        # third = seasonal check
        table_chain.execute.side_effect = [
            MagicMock(data=[]),         # last posted source
            MagicMock(data=[news, safety]),  # queued items
            MagicMock(data=[]),         # seasonal check
        ]

        result = _select_item(sb, "clark_county", ["local_news", "safety"])
        assert result is not None
        assert result["id"] == "safety-1"

    def test_seasonal_skipped_if_recent(self):
        sb = _mock_supabase()
        seasonal = _make_queue_item(category="seasonal", id="seasonal-1")
        news = _make_queue_item(category="local_news", id="news-1")

        table_chain = sb.table.return_value
        table_chain.execute.side_effect = [
            MagicMock(data=[]),                  # last posted source
            MagicMock(data=[seasonal, news]),     # queued items
            MagicMock(data=[{"id": "old-seasonal"}]),  # seasonal posted recently
        ]

        result = _select_item(sb, "clark_county", ["local_news", "seasonal"])
        assert result is not None
        assert result["id"] == "news-1"


class TestEveningEnrichmentBias:
    """The evening slot should prefer P3 enrichment when no P1 alert is waiting."""

    _ALLOWED_CATS = [
        "local_news", "event", "weather", "seasonal",
        "community_resource", "safety", "sports",
    ]

    def test_non_evening_slot_uses_full_categories(self):
        with patch(f"{_HANDLER}._select_items") as mock_select, \
             patch(f"{_HANDLER}._has_queued_p1_alert") as mock_p1:
            mock_select.return_value = [_make_queue_item()]
            result = _select_candidates_for_slot(
                _mock_supabase(), "clark_county", self._ALLOWED_CATS, "morning"
            )
            assert result == [_make_queue_item()]
            mock_select.assert_called_once_with(
                mock_select.call_args.args[0], "clark_county", self._ALLOWED_CATS
            )
            mock_p1.assert_not_called()

    def test_evening_reserves_enrichment_when_no_p1_alert(self):
        sports = _make_queue_item(category="sports", id="sp-1", source_priority=3)
        with patch(f"{_HANDLER}._select_items") as mock_select, \
             patch(f"{_HANDLER}._has_queued_p1_alert", return_value=False):
            mock_select.return_value = [sports]
            result = _select_candidates_for_slot(
                _mock_supabase(), "clark_county", self._ALLOWED_CATS, "evening"
            )
            assert result == [sports]
            passed_cats = mock_select.call_args.args[2]
            assert set(passed_cats) == {"community_resource", "sports"}

    def test_evening_falls_back_when_p1_alert_queued(self):
        news = _make_queue_item(category="local_news", id="ln-1")
        with patch(f"{_HANDLER}._select_items") as mock_select, \
             patch(f"{_HANDLER}._has_queued_p1_alert", return_value=True):
            mock_select.return_value = [news]
            result = _select_candidates_for_slot(
                _mock_supabase(), "clark_county", self._ALLOWED_CATS, "evening"
            )
            assert result == [news]
            passed_cats = mock_select.call_args.args[2]
            assert passed_cats == self._ALLOWED_CATS

    def test_evening_falls_back_when_no_enrichment_queued(self):
        news = _make_queue_item(category="local_news", id="ln-1")

        def fake_select(sb, region, cats):
            if set(cats) & {"sports", "community_resource"} and set(cats) <= {
                "sports", "community_resource",
            }:
                return []  # no enrichment queued
            return [news]

        with patch(f"{_HANDLER}._select_items", side_effect=fake_select), \
             patch(f"{_HANDLER}._has_queued_p1_alert", return_value=False):
            result = _select_candidates_for_slot(
                _mock_supabase(), "clark_county", self._ALLOWED_CATS, "evening"
            )
            assert result == [news]

    def test_evening_stage_without_enrichment_uses_full_categories(self):
        """Stages like 'minimal' strip sports/community from allowed_categories."""
        minimal_cats = ["event", "weather", "seasonal", "safety"]
        news = _make_queue_item(category="event", id="ev-1")
        with patch(f"{_HANDLER}._select_items", return_value=[news]) as mock_select, \
             patch(f"{_HANDLER}._has_queued_p1_alert") as mock_p1:
            result = _select_candidates_for_slot(
                _mock_supabase(), "clark_county", minimal_cats, "evening"
            )
            assert result == [news]
            # No enrichment in minimal → we never consult P1 gate.
            mock_p1.assert_not_called()
            passed_cats = mock_select.call_args.args[2]
            assert passed_cats == minimal_cats

    def test_p1_lookup_failure_preserves_safety_priority(self):
        """If the P1 lookup raises, _has_queued_p1_alert returns True so the
        evening bias falls back and safety/weather keeps priority."""
        from src.handlers.poster import _has_queued_p1_alert

        sb = MagicMock()
        sb.table.side_effect = RuntimeError("boom")
        assert _has_queued_p1_alert(sb, "clark_county") is True

    def test_evening_falls_back_on_p1_lookup_failure(self):
        """End-to-end: P1 check failure must not reserve evening for enrichment."""
        news = _make_queue_item(category="local_news", id="ln-1")
        with patch(f"{_HANDLER}._select_items", return_value=[news]) as mock_select, \
             patch(f"{_HANDLER}._has_queued_p1_alert", return_value=True):
            result = _select_candidates_for_slot(
                _mock_supabase(), "clark_county", self._ALLOWED_CATS, "evening"
            )
            assert result == [news]
            # Full category set used, not narrowed to enrichment.
            passed_cats = mock_select.call_args.args[2]
            assert passed_cats == self._ALLOWED_CATS


# ---------------------------------------------------------------------------
# End-to-end flow tests
# ---------------------------------------------------------------------------

class TestEndToEndFlow:
    def test_successful_flow(self):
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(_pt(7), regions=one_region)
        with (
            patches["now"],
            patches["sleep"],
            patches["random"],
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["check_density"] as mock_density,
            patches["should_post"],
            patches["allowed_cats"],
            patches["humanize"] as mock_humanize,
            patches["auth_curator"],
            patches["post_api"] as mock_post,
            patch(f"{_HANDLER}._select_items", return_value=[_make_queue_item()]),
            patch(f"{_HANDLER}._get_source_display_name", return_value="The Columbian"),
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_density.return_value = MagicMock(
                stage="full", avg_daily_posts=0, active_posters=0
            )
            mock_humanize.return_value = ("A park opens Saturday. Source: The Columbian", None)
            mock_post.return_value = ("post-uuid", None)

            result = handler({}, None)

            assert result["items_posted"] == 1
            assert result["items_failed"] == 0
            # Queue item updated to 'posted'
            update_calls = sb.table.return_value.update.call_args_list
            assert any(
                c.args[0].get("status") == "posted"
                for c in update_calls
            )

    def test_humanizer_failure(self):
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(_pt(7), regions=one_region)
        with (
            patches["now"],
            patches["sleep"],
            patches["random"],
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["check_density"] as mock_density,
            patches["should_post"],
            patches["allowed_cats"],
            patches["humanize"] as mock_humanize,
            patches["auth_curator"],
            patches["post_api"],
            patch(f"{_HANDLER}._select_items", return_value=[_make_queue_item()]),
            patch(f"{_HANDLER}._get_source_display_name", return_value="Test"),
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_density.return_value = MagicMock(
                stage="full", avg_daily_posts=0, active_posters=0
            )
            mock_humanize.return_value = (None, "validation_failed:too_long")

            result = handler({}, None)

            assert result["items_failed"] == 1
            update_calls = sb.table.return_value.update.call_args_list
            assert any(
                c.args[0].get("status") == "failed"
                for c in update_calls
            )

    def test_ai_quality_gate_skips_first_candidate_and_posts_next(self):
        one_region = [_make_region_config("test_region")]
        first = _make_queue_item(id="item-1", raw_title="Thin national recap")
        second = _make_queue_item(id="item-2", raw_title="Useful local update")
        patches = _standard_patches(_pt(7), regions=one_region)
        with (
            patches["now"],
            patches["sleep"],
            patches["random"],
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["check_density"] as mock_density,
            patches["should_post"],
            patches["allowed_cats"],
            patches["humanize"] as mock_humanize,
            patches["auth_curator"],
            patches["post_api"] as mock_post,
            patch(f"{_HANDLER}._select_items", return_value=[first, second]),
            patch(f"{_HANDLER}._get_source_display_name", return_value="Test"),
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_density.return_value = MagicMock(
                stage="full", avg_daily_posts=0, active_posters=0
            )
            mock_humanize.side_effect = [
                (None, "ai_quality_gate:skipped"),
                ("Useful local update for neighbors.\nSource: Test", None),
            ]
            mock_post.return_value = ("post-uuid", None)

            result = handler({}, None)

            assert result["items_posted"] == 1
            assert result["items_failed"] == 0
            update_calls = sb.table.return_value.update.call_args_list
            statuses = [c.args[0].get("status") for c in update_calls]
            assert "skipped" in statuses
            assert "posted" in statuses

    def test_auth_failure_leaves_humanized(self):
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(_pt(7), regions=one_region)
        with (
            patches["now"],
            patches["sleep"],
            patches["random"],
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["check_density"] as mock_density,
            patches["should_post"],
            patches["allowed_cats"],
            patches["humanize"] as mock_humanize,
            patch(f"{_HANDLER}.authenticate_curator", return_value=None),
            patches["post_api"],
            patch(f"{_HANDLER}._select_items", return_value=[_make_queue_item()]),
            patch(f"{_HANDLER}._get_source_display_name", return_value="Test"),
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_density.return_value = MagicMock(
                stage="full", avg_daily_posts=0, active_posters=0
            )
            mock_humanize.return_value = ("Humanized text here.", None)

            result = handler({}, None)

            assert result["items_failed"] == 1
            # Item should be humanized then reset to queued for retry
            update_calls = sb.table.return_value.update.call_args_list
            statuses = [c.args[0].get("status") for c in update_calls]
            assert "humanized" in statuses
            assert "queued" in statuses
            assert "failed" not in statuses

    def test_post_api_failure(self):
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(_pt(7), regions=one_region)
        with (
            patches["now"],
            patches["sleep"],
            patches["random"],
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["check_density"] as mock_density,
            patches["should_post"],
            patches["allowed_cats"],
            patches["humanize"] as mock_humanize,
            patches["auth_curator"],
            patches["post_api"] as mock_post,
            patch(f"{_HANDLER}._select_items", return_value=[_make_queue_item()]),
            patch(f"{_HANDLER}._get_source_display_name", return_value="Test"),
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_density.return_value = MagicMock(
                stage="full", avg_daily_posts=0, active_posters=0
            )
            mock_humanize.return_value = ("Humanized text.", None)
            mock_post.return_value = (None, "api_server_error:500")

            result = handler({}, None)

            assert result["items_failed"] == 1
            update_calls = sb.table.return_value.update.call_args_list
            assert any(
                c.args[0].get("status") == "failed"
                for c in update_calls
            )

    def test_media_passed_to_post_api(self):
        """Media URLs from queue item are passed through to post_to_pantopus."""
        one_region = [_make_region_config("test_region")]
        item_with_media = _make_queue_item(
            media_urls=["https://example.com/hero.jpg"],
            media_types=["image"],
        )
        patches = _standard_patches(_pt(7), regions=one_region)
        with (
            patches["now"],
            patches["sleep"],
            patches["random"],
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["check_density"] as mock_density,
            patches["should_post"],
            patches["allowed_cats"],
            patches["humanize"] as mock_humanize,
            patches["auth_curator"],
            patches["post_api"] as mock_post,
            patch(f"{_HANDLER}._select_items", return_value=[item_with_media]),
            patch(f"{_HANDLER}._get_source_display_name", return_value="Test"),
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_density.return_value = MagicMock(
                stage="full", avg_daily_posts=0, active_posters=0
            )
            mock_humanize.return_value = ("Post with image.", None)
            mock_post.return_value = ("post-uuid", None)

            result = handler({}, None)

            assert result["items_posted"] == 1
            call_kwargs = mock_post.call_args
            assert call_kwargs.kwargs.get("media_urls") == ["https://example.com/hero.jpg"]
            assert call_kwargs.kwargs.get("media_types") == ["image"]

    def test_no_media_passes_none(self):
        """Queue item without media passes None to post_to_pantopus."""
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(_pt(7), regions=one_region)
        with (
            patches["now"],
            patches["sleep"],
            patches["random"],
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["check_density"] as mock_density,
            patches["should_post"],
            patches["allowed_cats"],
            patches["humanize"] as mock_humanize,
            patches["auth_curator"],
            patches["post_api"] as mock_post,
            patch(f"{_HANDLER}._select_items", return_value=[_make_queue_item()]),
            patch(f"{_HANDLER}._get_source_display_name", return_value="Test"),
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_density.return_value = MagicMock(
                stage="full", avg_daily_posts=0, active_posters=0
            )
            mock_humanize.return_value = ("Text only.", None)
            mock_post.return_value = ("post-uuid", None)

            handler({}, None)

            call_kwargs = mock_post.call_args
            assert call_kwargs.kwargs.get("media_urls") is None
            assert call_kwargs.kwargs.get("media_types") is None

    def test_multiple_regions_independent(self):
        patches = _standard_patches(_pt(7))
        with (
            patches["now"],
            patches["sleep"],
            patches["random"],
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["check_density"] as mock_density,
            patches["should_post"],
            patches["allowed_cats"],
            patches["humanize"] as mock_humanize,
            patches["auth_curator"],
            patches["post_api"] as mock_post,
            patch(f"{_HANDLER}._select_items", return_value=[_make_queue_item()]),
            patch(f"{_HANDLER}._get_source_display_name", return_value="Test"),
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_density.return_value = MagicMock(
                stage="full", avg_daily_posts=0, active_posters=0
            )
            mock_humanize.return_value = ("Text.", None)
            mock_post.return_value = ("post-id", None)

            result = handler({}, None)

            # Both regions should be processed (clark_county + portland_metro)
            assert result["regions_processed"] == 2
            assert result["items_posted"] == 2

    def test_uses_region_config_lat_lng_for_post(self):
        """The poster uses lat/lng from the RegionConfig, not hardcoded values."""
        seattle = [_make_region_config("seattle_metro", lat=47.6062, lng=-122.3321)]
        patches = _standard_patches(_pt(7), regions=seattle)
        with (
            patches["now"],
            patches["sleep"],
            patches["random"],
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["check_density"] as mock_density,
            patches["should_post"],
            patches["allowed_cats"],
            patches["humanize"] as mock_humanize,
            patches["auth_curator"],
            patches["post_api"] as mock_post,
            patch(f"{_HANDLER}._select_items", return_value=[_make_queue_item()]),
            patch(f"{_HANDLER}._get_source_display_name", return_value="Test"),
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_density.return_value = MagicMock(
                stage="full", avg_daily_posts=0, active_posters=0
            )
            mock_humanize.return_value = ("Seattle news post.", None)
            mock_post.return_value = ("post-uuid", None)

            handler({}, None)

            call_kwargs = mock_post.call_args
            assert call_kwargs.kwargs.get("region_lat") == 47.6062
            assert call_kwargs.kwargs.get("region_lng") == -122.3321
