"""Tests for the tapering density checker."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from src.config.constants import ALL_CATEGORIES
from src.config.region_registry import RegionConfig
from src.models.queue_item import TaperingMetrics
from src.tapering.density_checker import (
    allowed_categories,
    check_density,
    should_post_in_slot,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_region_config(region="clark_county", **overrides):
    defaults = {
        "region": region,
        "lat": 45.6387,
        "lng": -122.6615,
        "radius_meters": 25000,
        "timezone": "America/Los_Angeles",
        "display_name": "Clark County, WA",
        "curator_user_id": "curator-uuid",
    }
    defaults.update(overrides)
    return RegionConfig(**defaults)


def _mock_supabase(rpc_data=None, config_data=None, rpc_error=False, config_error=False,
                   geo_data=None, geo_error=False):
    client = MagicMock()

    # RPC mock
    rpc_chain = MagicMock()
    if rpc_error:
        rpc_chain.execute.side_effect = Exception("RPC failed")
    else:
        result = MagicMock()
        result.data = rpc_data if rpc_data is not None else [{"avg_daily_posts": 0, "active_posters": 0}]
        rpc_chain.execute.return_value = result
    client.rpc.return_value = rpc_chain

    # Table mock — handles both seeder_config queries (geo + thresholds)
    table_chain = MagicMock()
    table_chain.select.return_value = table_chain
    table_chain.eq.return_value = table_chain
    table_chain.limit.return_value = table_chain

    if config_error:
        table_chain.execute.side_effect = Exception("Config query failed")
    else:
        config_result = MagicMock()
        config_result.data = config_data if config_data is not None else []
        table_chain.execute.return_value = config_result

    client.table.return_value = table_chain

    return client


# ---------------------------------------------------------------------------
# Stage determination
# ---------------------------------------------------------------------------

class TestCheckDensity:
    def test_zero_activity_returns_full(self):
        sb = _mock_supabase(rpc_data=[{"avg_daily_posts": 0, "active_posters": 0}])
        region_cfg = _make_region_config()
        metrics = check_density(sb, "clark_county", region_cfg=region_cfg)
        assert metrics.stage == "full"
        assert metrics.avg_daily_posts == 0
        assert metrics.active_posters == 0

    def test_moderate_activity_returns_reduced(self):
        sb = _mock_supabase(rpc_data=[{"avg_daily_posts": 3, "active_posters": 8}])
        region_cfg = _make_region_config()
        metrics = check_density(sb, "clark_county", region_cfg=region_cfg)
        assert metrics.stage == "reduced"

    def test_posts_cross_minimal_even_if_posters_low(self):
        sb = _mock_supabase(rpc_data=[{"avg_daily_posts": 6, "active_posters": 3}])
        region_cfg = _make_region_config()
        metrics = check_density(sb, "clark_county", region_cfg=region_cfg)
        assert metrics.stage == "minimal"

    def test_high_activity_returns_dormant(self):
        sb = _mock_supabase(rpc_data=[{"avg_daily_posts": 12, "active_posters": 25}])
        region_cfg = _make_region_config()
        metrics = check_density(sb, "clark_county", region_cfg=region_cfg)
        assert metrics.stage == "dormant"

    def test_posters_alone_can_trigger_stage(self):
        """active_posters >= 20 triggers dormant even if posts are low."""
        sb = _mock_supabase(rpc_data=[{"avg_daily_posts": 1, "active_posters": 20}])
        region_cfg = _make_region_config()
        metrics = check_density(sb, "clark_county", region_cfg=region_cfg)
        assert metrics.stage == "dormant"

    def test_rpc_failure_falls_back_to_full(self):
        sb = _mock_supabase(rpc_error=True)
        region_cfg = _make_region_config()
        metrics = check_density(sb, "clark_county", region_cfg=region_cfg)
        assert metrics.stage == "full"
        assert metrics.avg_daily_posts == 0

    def test_config_failure_uses_default_thresholds(self):
        sb = _mock_supabase(
            rpc_data=[{"avg_daily_posts": 3, "active_posters": 12}],
            config_error=True,
        )
        region_cfg = _make_region_config()
        metrics = check_density(sb, "clark_county", region_cfg=region_cfg)
        assert metrics.stage == "reduced"

    def test_no_region_cfg_loads_from_db(self):
        """Without region_cfg, loads geo from seeder_config table."""
        sb = _mock_supabase(
            rpc_data=[{"avg_daily_posts": 0, "active_posters": 0}],
            config_data=[{"lat": 45.6, "lng": -122.6, "radius_meters": 25000}],
        )
        metrics = check_density(sb, "clark_county")
        assert metrics.stage == "full"
        # Should have called RPC
        sb.rpc.assert_called_once()

    def test_no_geo_config_returns_full(self):
        """Without region_cfg and no DB row, returns full stage."""
        sb = _mock_supabase(config_data=[])
        metrics = check_density(sb, "narnia")
        assert metrics.stage == "full"

    def test_custom_thresholds_from_config(self):
        """If seeder_config has custom thresholds, they override defaults."""
        custom = {
            "reduced": {"organic_posts_per_day": 100, "active_posters_7d": 100},
            "minimal": {"organic_posts_per_day": 200, "active_posters_7d": 200},
            "dormant": {"organic_posts_per_day": 300, "active_posters_7d": 300},
        }
        sb = _mock_supabase(
            rpc_data=[{"avg_daily_posts": 50, "active_posters": 50}],
            config_data=[{"tapering_thresholds": custom}],
        )
        region_cfg = _make_region_config()
        # With defaults, 50 posts would be dormant. With custom, it's full.
        metrics = check_density(sb, "clark_county", region_cfg=region_cfg)
        assert metrics.stage == "full"

    def test_dynamic_region_with_config(self):
        """A dynamically added region works with region_cfg provided."""
        sb = _mock_supabase(rpc_data=[{"avg_daily_posts": 2, "active_posters": 7}])
        seattle_cfg = _make_region_config("seattle_metro", lat=47.6062, lng=-122.3321)
        metrics = check_density(sb, "seattle_metro", region_cfg=seattle_cfg)
        assert metrics.stage == "reduced"
        # Verify the RPC was called with Seattle coordinates
        rpc_call = sb.rpc.call_args
        assert rpc_call[0][1]["region_lat"] == 47.6062
        assert rpc_call[0][1]["region_lng"] == -122.3321


# ---------------------------------------------------------------------------
# should_post_in_slot
# ---------------------------------------------------------------------------

class TestShouldPostInSlot:
    def test_full_allows_all_slots(self):
        assert should_post_in_slot("full", "morning") is True
        assert should_post_in_slot("full", "midday") is True
        assert should_post_in_slot("full", "evening") is True

    def test_reduced_skips_midday(self):
        assert should_post_in_slot("reduced", "morning") is True
        assert should_post_in_slot("reduced", "midday") is False
        assert should_post_in_slot("reduced", "evening") is True

    def test_minimal_skips_midday_and_evening(self):
        assert should_post_in_slot("minimal", "morning") is True
        assert should_post_in_slot("minimal", "midday") is False
        assert should_post_in_slot("minimal", "evening") is False

    def test_dormant_skips_all_slots(self):
        assert should_post_in_slot("dormant", "morning") is False
        assert should_post_in_slot("dormant", "midday") is False
        assert should_post_in_slot("dormant", "evening") is False


# ---------------------------------------------------------------------------
# allowed_categories
# ---------------------------------------------------------------------------

class TestAllowedCategories:
    def test_full_allows_all(self):
        cats = allowed_categories("full")
        assert set(cats) == set(ALL_CATEGORIES)

    def test_reduced_allows_all(self):
        cats = allowed_categories("reduced")
        assert set(cats) == set(ALL_CATEGORIES)

    def test_minimal_restricted(self):
        cats = allowed_categories("minimal")
        assert "event" in cats
        assert "weather" in cats
        assert "seasonal" in cats
        assert "safety" in cats
        assert "local_news" not in cats
        assert "community_resource" not in cats

    def test_dormant_most_restricted(self):
        cats = allowed_categories("dormant")
        assert set(cats) == {"weather", "safety", "earthquake"}
