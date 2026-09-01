"""Tests for the curator account setup script."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from scripts.setup_curator_account import DEFAULT_REGIONS, setup_curator, add_region


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SCRIPT = "scripts.setup_curator_account"

_ENV_VARS = {
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "test-service-key",
    "CURATOR_EMAIL": "curator@pantopus.com",
    "CURATOR_PASSWORD": "secret-password",
}


def _mock_supabase():
    """Create a mock Supabase client with chainable table methods."""
    client = MagicMock()

    chains = {}

    def _table(name):
        if name not in chains:
            chain = MagicMock()
            chain.insert.return_value = chain
            chain.upsert.return_value = chain
            chain.update.return_value = chain
            chain.select.return_value = chain
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


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestSetupCurator:
    @patch.dict("os.environ", _ENV_VARS)
    @patch(f"{_SCRIPT}.create_client")
    def test_creates_auth_user_and_updates_row(self, mock_create):
        sb = _mock_supabase()
        mock_create.return_value = sb

        auth_user = MagicMock()
        auth_user.user.id = "curator-uuid-123"
        sb.auth.admin.create_user.return_value = auth_user

        setup_curator(display_name="Pantopus Local", dry_run=False)

        # Verify auth user was created
        sb.auth.admin.create_user.assert_called_once()
        create_args = sb.auth.admin.create_user.call_args[0][0]
        assert create_args["email"] == "curator@pantopus.com"
        assert create_args["email_confirm"] is True

        # Verify User table was upserted
        user_chain = sb._chains["User"]
        assert user_chain.upsert.called
        upsert_data = user_chain.upsert.call_args[0][0]
        assert upsert_data["account_type"] == "curator"
        assert upsert_data["name"] == "Pantopus Local"

    @patch.dict("os.environ", _ENV_VARS)
    @patch(f"{_SCRIPT}.create_client")
    def test_handles_existing_auth_user(self, mock_create):
        sb = _mock_supabase()
        mock_create.return_value = sb

        # Auth creation fails with "already exists"
        sb.auth.admin.create_user.side_effect = Exception("User already registered")

        # list_users returns the existing user
        existing_user = MagicMock()
        existing_user.email = "curator@pantopus.com"
        existing_user.id = "existing-uuid-456"
        sb.auth.admin.list_users.return_value = [existing_user]

        setup_curator(display_name="Pantopus Local", dry_run=False)

        # Should still upsert user row and create config
        user_chain = sb._chains["User"]
        assert user_chain.upsert.called

        config_chain = sb._chains["seeder_config"]
        assert config_chain.upsert.called

    @patch.dict("os.environ", _ENV_VARS)
    @patch(f"{_SCRIPT}.create_client")
    def test_creates_seeder_config_for_all_regions(self, mock_create):
        sb = _mock_supabase()
        mock_create.return_value = sb

        auth_user = MagicMock()
        auth_user.user.id = "curator-uuid-789"
        sb.auth.admin.create_user.return_value = auth_user

        setup_curator(display_name="Pantopus Local", dry_run=False)

        # seeder_config upserted for each region
        config_chain = sb._chains["seeder_config"]
        upsert_calls = config_chain.upsert.call_args_list
        assert len(upsert_calls) == len(DEFAULT_REGIONS)

        regions_configured = set()
        for c in upsert_calls:
            row = c[0][0]
            regions_configured.add(row["region"])
            assert row["curator_user_id"] == "curator-uuid-789"
            assert row["active"] is True
            # active_sources should be a native list (not json.dumps string) for JSONB
            assert isinstance(row["active_sources"], list)
            assert len(row["active_sources"]) > 0
            # Geo columns should be present
            assert "lat" in row
            assert "lng" in row
            assert "radius_meters" in row

        assert "clark_county" in regions_configured
        assert "portland_metro" in regions_configured

    @patch.dict("os.environ", _ENV_VARS)
    @patch(f"{_SCRIPT}.create_client")
    def test_seeds_seeder_sources(self, mock_create):
        """Setup seeds seeder_sources table for each region."""
        sb = _mock_supabase()
        mock_create.return_value = sb

        auth_user = MagicMock()
        auth_user.user.id = "curator-uuid-src"
        sb.auth.admin.create_user.return_value = auth_user

        setup_curator(display_name="Pantopus Local", dry_run=False)

        # seeder_sources should have been upserted
        sources_chain = sb._chains["seeder_sources"]
        assert sources_chain.upsert.called
        upsert_calls = sources_chain.upsert.call_args_list
        # At least some sources seeded
        assert len(upsert_calls) > 0

    @patch.dict("os.environ", _ENV_VARS)
    @patch(f"{_SCRIPT}.create_client")
    def test_config_includes_geo_columns(self, mock_create):
        """seeder_config rows include lat, lng, radius_meters, timezone, display_name."""
        sb = _mock_supabase()
        mock_create.return_value = sb

        auth_user = MagicMock()
        auth_user.user.id = "curator-uuid-geo"
        sb.auth.admin.create_user.return_value = auth_user

        setup_curator(display_name="Pantopus Local", dry_run=False)

        config_chain = sb._chains["seeder_config"]
        for c in config_chain.upsert.call_args_list:
            row = c[0][0]
            assert isinstance(row["lat"], float)
            assert isinstance(row["lng"], float)
            assert isinstance(row["radius_meters"], int)
            assert isinstance(row["timezone"], str)
            assert isinstance(row["display_name"], str)

    @patch.dict("os.environ", _ENV_VARS)
    def test_dry_run_makes_no_changes(self):
        """Dry run should not create a Supabase client at all."""
        with patch(f"{_SCRIPT}.create_client") as mock_create:
            setup_curator(display_name="Test Name", dry_run=True)
            mock_create.assert_not_called()

    @patch.dict("os.environ", {}, clear=True)
    def test_missing_env_var_exits(self):
        with pytest.raises(SystemExit):
            setup_curator(display_name="Test", dry_run=False)

    @patch.dict("os.environ", _ENV_VARS)
    @patch(f"{_SCRIPT}.create_client")
    def test_custom_display_name(self, mock_create):
        sb = _mock_supabase()
        mock_create.return_value = sb

        auth_user = MagicMock()
        auth_user.user.id = "uuid-custom"
        sb.auth.admin.create_user.return_value = auth_user

        setup_curator(display_name="Vancouver Local", dry_run=False)

        user_chain = sb._chains["User"]
        upsert_data = user_chain.upsert.call_args[0][0]
        assert upsert_data["name"] == "Vancouver Local"

    @patch.dict("os.environ", _ENV_VARS)
    @patch(f"{_SCRIPT}.create_client")
    def test_upsert_uses_on_conflict(self, mock_create):
        """seeder_config should use upsert with on_conflict='region'."""
        sb = _mock_supabase()
        mock_create.return_value = sb

        auth_user = MagicMock()
        auth_user.user.id = "uuid-conflict"
        sb.auth.admin.create_user.return_value = auth_user

        setup_curator(display_name="Pantopus Local", dry_run=False)

        config_chain = sb._chains["seeder_config"]
        for c in config_chain.upsert.call_args_list:
            assert c.kwargs.get("on_conflict") == "region" or c[1].get("on_conflict") == "region"

    @patch.dict("os.environ", _ENV_VARS)
    @patch(f"{_SCRIPT}.create_client")
    def test_handles_409_status_code_attribute(self, mock_create):
        """Duplicate detection should work via exception status attribute."""
        sb = _mock_supabase()
        mock_create.return_value = sb

        exc = Exception("Something")
        exc.status = 409
        sb.auth.admin.create_user.side_effect = exc

        existing_user = MagicMock()
        existing_user.email = "curator@pantopus.com"
        existing_user.id = "existing-uuid-409"
        sb.auth.admin.list_users.return_value = [existing_user]

        setup_curator(display_name="Pantopus Local", dry_run=False)

        user_chain = sb._chains["User"]
        assert user_chain.upsert.called


class TestAddRegion:
    @patch.dict("os.environ", _ENV_VARS)
    @patch(f"{_SCRIPT}.create_client")
    def test_add_region_creates_config_and_sources(self, mock_create):
        """add_region creates a seeder_config row and default sources."""
        sb = _mock_supabase()
        mock_create.return_value = sb

        # Mock finding existing curator
        user_chain = sb._chains.get("User") or MagicMock()
        user_result = MagicMock()
        user_result.data = [{"id": "curator-uuid-existing"}]
        user_chain.select.return_value = user_chain
        user_chain.eq.return_value = user_chain
        user_chain.limit.return_value = user_chain
        user_chain.execute.return_value = user_result
        sb._chains["User"] = user_chain

        add_region(
            region="seattle_metro",
            lat=47.6062,
            lng=-122.3321,
            display_name="Seattle Metro",
            dry_run=False,
        )

        # seeder_config should be upserted with geo columns
        config_chain = sb._chains["seeder_config"]
        assert config_chain.upsert.called
        config_row = config_chain.upsert.call_args[0][0]
        assert config_row["region"] == "seattle_metro"
        assert config_row["lat"] == 47.6062
        assert config_row["lng"] == -122.3321
        assert config_row["display_name"] == "Seattle Metro"

        # seeder_sources should have google_news and seasonal
        sources_chain = sb._chains["seeder_sources"]
        assert sources_chain.upsert.called
        source_ids = [c[0][0]["source_id"] for c in sources_chain.upsert.call_args_list]
        assert "google_news:seattle_metro" in source_ids
        assert "seasonal:seattle_metro" in source_ids

    @patch.dict("os.environ", _ENV_VARS)
    def test_add_region_dry_run(self):
        """Dry run should not create a Supabase client."""
        with patch(f"{_SCRIPT}.create_client") as mock_create:
            add_region(
                region="seattle_metro",
                lat=47.6062,
                lng=-122.3321,
                display_name="Seattle Metro",
                dry_run=True,
            )
            mock_create.assert_not_called()
