"""Tests for the region discovery Lambda handler."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from src.config.region_registry import RegionConfig
from src.discovery.cluster import CandidateRegion, UserPoint

_HANDLER = "src.handlers.discovery"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_supabase():
    client = MagicMock()

    chains = {}

    def _table(name):
        if name not in chains:
            chain = MagicMock()
            chain.select.return_value = chain
            chain.insert.return_value = chain
            chain.upsert.return_value = chain
            chain.update.return_value = chain
            chain.eq.return_value = chain
            chain.limit.return_value = chain

            result = MagicMock()
            result.data = []
            chain.execute.return_value = result
            chains[name] = chain
        return chains[name]

    client.table.side_effect = _table
    client._chains = chains
    return client


def _make_region_config(region="portland_metro", lat=45.5152, lng=-122.6784):
    return RegionConfig(
        region=region, lat=lat, lng=lng, radius_meters=25000,
        timezone="America/Los_Angeles", display_name="Portland Metro",
        curator_user_id="curator-uuid",
    )


def _seattle_user_rows(n=10):
    """Simulate UserViewingLocation rows for users in Seattle."""
    import random
    random.seed(42)
    return [
        {"user_id": f"user-{i}",
         "latitude": 47.6062 + random.uniform(-0.05, 0.05),
         "longitude": -122.3321 + random.uniform(-0.05, 0.05)}
        for i in range(n)
    ]


def _standard_patches(existing_regions=None, user_rows=None, curator_id="curator-uuid"):
    """Common patches for discovery handler tests."""
    if existing_regions is None:
        existing_regions = [_make_region_config()]

    return {
        "secrets": patch(f"{_HANDLER}.get_secrets", return_value=MagicMock(
            supabase_url="https://test.supabase.co",
            supabase_service_role_key="test-key",
        )),
        "create_client": patch("supabase.create_client"),
        "load_regions": patch(f"{_HANDLER}.load_active_regions",
                              return_value=existing_regions),
        "geocode": patch(f"{_HANDLER}.reverse_geocode", return_value={
            "region_id": "seattle_wa",
            "display_name": "Seattle, WA",
            "city": "Seattle",
            "state": "WA",
            "query": "Seattle WA local news",
        }),
        "timezone": patch(f"{_HANDLER}.timezone_from_coords",
                          return_value="America/Los_Angeles"),
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestDiscoveryHandler:
    def test_load_user_locations_skips_invalid_coordinates(self):
        sb = _mock_supabase()
        user_chain = sb._chains.get("UserViewingLocation") or MagicMock()
        user_result = MagicMock()
        user_result.data = [
            {"user_id": "good", "latitude": 45.6, "longitude": -122.6},
            {"user_id": "null_island", "latitude": 0.0, "longitude": 0.0},
            {"user_id": "nan_lat", "latitude": "nan", "longitude": -122.6},
            {"user_id": "bad_range", "latitude": 123.0, "longitude": -122.6},
        ]
        user_chain.select.return_value = user_chain
        user_chain.execute.return_value = user_result
        sb._chains["UserViewingLocation"] = user_chain

        from src.handlers.discovery import _load_user_locations

        points = _load_user_locations(sb)

        assert len(points) == 1
        assert points[0].user_id == "good"

    def test_no_users_returns_zero(self):
        patches = _standard_patches()
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            from src.handlers.discovery import handler

            result = handler({}, None)

            assert result["regions_discovered"] == 0

    def test_discovers_new_region(self):
        patches = _standard_patches()
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["geocode"],
            patches["timezone"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            # Mock UserViewingLocation to return Seattle users
            user_chain = sb._chains.get("UserViewingLocation") or MagicMock()
            user_result = MagicMock()
            user_result.data = _seattle_user_rows(10)
            user_chain.select.return_value = user_chain
            user_chain.execute.return_value = user_result
            sb._chains["UserViewingLocation"] = user_chain

            # Mock finding curator
            curator_chain = sb._chains.get("User") or MagicMock()
            curator_result = MagicMock()
            curator_result.data = [{"id": "curator-uuid"}]
            curator_chain.select.return_value = curator_chain
            curator_chain.eq.return_value = curator_chain
            curator_chain.limit.return_value = curator_chain
            curator_chain.execute.return_value = curator_result
            sb._chains["User"] = curator_chain

            from src.handlers.discovery import handler

            result = handler({}, None)

            assert result["regions_discovered"] >= 1
            assert result["total_users"] == 10
            # seeder_config should have been upserted
            config_chain = sb._chains["seeder_config"]
            assert config_chain.upsert.called

    def test_users_in_existing_region_not_counted(self):
        """Users covered by Portland don't trigger a new region."""
        patches = _standard_patches()
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            # Users inside Portland
            portland_users = [
                {"user_id": f"pdx-{i}", "latitude": 45.5152 + i * 0.001, "longitude": -122.6784}
                for i in range(10)
            ]
            user_chain = sb._chains.get("UserViewingLocation") or MagicMock()
            user_result = MagicMock()
            user_result.data = portland_users
            user_chain.select.return_value = user_chain
            user_chain.execute.return_value = user_result
            sb._chains["UserViewingLocation"] = user_chain

            from src.handlers.discovery import handler

            result = handler({}, None)

            assert result["regions_discovered"] == 0

    def test_threshold_from_event(self):
        """Event payload can override the user threshold."""
        patches = _standard_patches(existing_regions=[])
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["geocode"],
            patches["timezone"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            # Only 3 Seattle users
            user_chain = sb._chains.get("UserViewingLocation") or MagicMock()
            user_result = MagicMock()
            user_result.data = _seattle_user_rows(3)
            user_chain.select.return_value = user_chain
            user_chain.execute.return_value = user_result
            sb._chains["UserViewingLocation"] = user_chain

            curator_chain = sb._chains.get("User") or MagicMock()
            curator_result = MagicMock()
            curator_result.data = [{"id": "curator-uuid"}]
            curator_chain.select.return_value = curator_chain
            curator_chain.eq.return_value = curator_chain
            curator_chain.limit.return_value = curator_chain
            curator_chain.execute.return_value = curator_result
            sb._chains["User"] = curator_chain

            from src.handlers.discovery import handler

            # Default threshold=5 → no discovery
            result = handler({}, None)
            assert result["regions_discovered"] == 0

            # Lower threshold=2 → should discover
            result = handler({"threshold": 2}, None)
            assert result["regions_discovered"] >= 1

    def test_no_curator_returns_error(self):
        """If no curator user exists, returns an error."""
        patches = _standard_patches(existing_regions=[])
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            user_chain = sb._chains.get("UserViewingLocation") or MagicMock()
            user_result = MagicMock()
            user_result.data = _seattle_user_rows(10)
            user_chain.select.return_value = user_chain
            user_chain.execute.return_value = user_result
            sb._chains["UserViewingLocation"] = user_chain

            # No curator found
            curator_chain = sb._chains.get("User") or MagicMock()
            curator_result = MagicMock()
            curator_result.data = []
            curator_chain.select.return_value = curator_chain
            curator_chain.eq.return_value = curator_chain
            curator_chain.limit.return_value = curator_chain
            curator_chain.execute.return_value = curator_result
            sb._chains["User"] = curator_chain

            from src.handlers.discovery import handler

            result = handler({}, None)

            assert result["error"] == "no_curator_user"

    def test_creates_p1_and_p2_sources(self):
        """New regions get P1 (NWS, USGS) + P2 (Google News, seasonal) sources."""
        patches = _standard_patches(existing_regions=[])
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["geocode"],
            patches["timezone"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            user_chain = sb._chains.get("UserViewingLocation") or MagicMock()
            user_result = MagicMock()
            user_result.data = _seattle_user_rows(10)
            user_chain.select.return_value = user_chain
            user_chain.execute.return_value = user_result
            sb._chains["UserViewingLocation"] = user_chain

            curator_chain = sb._chains.get("User") or MagicMock()
            curator_result = MagicMock()
            curator_result.data = [{"id": "curator-uuid"}]
            curator_chain.select.return_value = curator_chain
            curator_chain.eq.return_value = curator_chain
            curator_chain.limit.return_value = curator_chain
            curator_chain.execute.return_value = curator_result
            sb._chains["User"] = curator_chain

            from src.handlers.discovery import handler

            result = handler({}, None)

            assert result["regions_discovered"] >= 1
            # seeder_sources should have been called
            sources_chain = sb._chains["seeder_sources"]
            assert sources_chain.upsert.called
            source_ids = [
                c[0][0]["source_id"]
                for c in sources_chain.upsert.call_args_list
            ]
            # P1 sources
            assert any("nws_alerts:" in s for s in source_ids)
            assert any("usgs_earthquakes:" in s for s in source_ids)
            # P2 sources
            assert any("google_news:" in s for s in source_ids)
            assert any("seasonal:" in s for s in source_ids)

    def test_supabase_init_failure(self):
        with (
            patch(f"{_HANDLER}.get_secrets", return_value=MagicMock(
                supabase_url="https://bad.supabase.co",
                supabase_service_role_key="bad-key",
            )),
            patch("supabase.create_client", side_effect=Exception("Auth failed")),
        ):
            from src.handlers.discovery import handler

            result = handler({}, None)

            assert result["error"] == "supabase_init_failed"
