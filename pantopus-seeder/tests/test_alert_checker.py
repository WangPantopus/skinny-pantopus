"""Tests for the real-time alert checker Lambda handler."""

from __future__ import annotations

import sys
import time
from datetime import datetime
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

import httpx
import pytest

# Stub supabase module
_supabase_mock = MagicMock()
sys.modules.setdefault("supabase", _supabase_mock)

from src.handlers.alert_checker import (
    handler,
    _already_notified,
    _check_weather_alerts,
    _fetch_weatherkit_alerts,
    _get_user_geohashes,
)
from src.handlers import alert_checker as alert_checker_module
from src.utils.supabase_errors import clear_missing_table_warnings

_HANDLER = "src.handlers.alert_checker"


def _mock_secrets():
    s = MagicMock()
    s.supabase_url = "https://test.supabase.co"
    s.supabase_service_role_key = "test-key"
    s.pantopus_api_base_url = "https://api.test.com"
    s.internal_api_key = "test-internal-key"
    s.weatherkit_key_id = ""
    s.weatherkit_team_id = ""
    s.weatherkit_service_id = ""
    s.weatherkit_private_key = ""
    return s


def _mock_weatherkit_secrets():
    s = _mock_secrets()
    s.weatherkit_key_id = "key-id"
    s.weatherkit_team_id = "team-id"
    s.weatherkit_service_id = "service-id"
    s.weatherkit_private_key = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----"
    return s


def _mock_supabase():
    client = MagicMock()
    def _chain():
        chain = MagicMock()
        chain.select.return_value = chain
        chain.insert.return_value = chain
        chain.update.return_value = chain
        chain.delete.return_value = chain
        chain.eq.return_value = chain
        chain.in_.return_value = chain
        chain.lt.return_value = chain
        chain.not_.return_value = chain
        chain.is_.return_value = chain
        result = MagicMock()
        result.data = []
        chain.execute.return_value = result
        return chain
    client.table.return_value = _chain()
    return client


class TestAlreadyNotified:
    def test_returns_false_when_not_found(self):
        sb = _mock_supabase()
        sb.table.return_value.execute.return_value = MagicMock(data=[])
        assert _already_notified(sb, "weather", "alert-1", "c20g8") is False

    def test_returns_true_when_found(self):
        sb = _mock_supabase()
        sb.table.return_value.execute.return_value = MagicMock(data=[{"id": "row-1"}])
        assert _already_notified(sb, "weather", "alert-1", "c20g8") is True

    def test_returns_false_on_error(self):
        sb = _mock_supabase()
        sb.table.side_effect = Exception("DB error")
        assert _already_notified(sb, "weather", "alert-1", "c20g8") is False

    def test_logs_clear_warning_on_missing_table(self, caplog):
        clear_missing_table_warnings()
        sb = _mock_supabase()
        sb.table.return_value.execute.side_effect = Exception({
            "code": "PGRST205",
            "message": "Could not find the table 'public.AlertNotificationHistory' in the schema cache",
        })

        with caplog.at_level("WARNING"):
            assert _already_notified(sb, "weather", "alert-1", "c20g8") is False

        assert any("Supabase table unavailable" in record.message for record in caplog.records)


class TestGetUserGeohashes:
    def test_groups_users_by_geohash(self):
        sb = _mock_supabase()
        sb.table.return_value.execute.return_value = MagicMock(data=[
            {"user_id": "u1", "home_id": "h1", "home": {"map_center_lat": 45.6387, "map_center_lng": -122.6615}},
            {"user_id": "u2", "home_id": "h2", "home": {"map_center_lat": 45.6390, "map_center_lng": -122.6610}},
            {"user_id": "u3", "home_id": "h3", "home": {"map_center_lat": 47.6062, "map_center_lng": -122.3321}},
        ])

        result = _get_user_geohashes(sb)

        # u1 and u2 are close enough for same geohash5, u3 is different
        assert len(result) >= 2
        # Verify all users are accounted for
        all_users = []
        for gh_data in result.values():
            all_users.extend(gh_data["user_ids"])
        assert sorted(all_users) == ["u1", "u2", "u3"]

    def test_skips_homes_without_coords(self):
        sb = _mock_supabase()
        sb.table.return_value.execute.return_value = MagicMock(data=[
            {"user_id": "u1", "home_id": "h1", "home": {"map_center_lat": None, "map_center_lng": None}},
        ])
        result = _get_user_geohashes(sb)
        assert len(result) == 0

    def test_skips_invalid_home_coords(self):
        sb = _mock_supabase()
        sb.table.return_value.execute.return_value = MagicMock(data=[
            {"user_id": "u1", "home_id": "h1", "home": {"map_center_lat": 0.0, "map_center_lng": 0.0}},
            {"user_id": "u2", "home_id": "h2", "home": {"map_center_lat": "nan", "map_center_lng": -122.6}},
            {"user_id": "u3", "home_id": "h3", "home": {"map_center_lat": 45.6387, "map_center_lng": -122.6615}},
        ])

        result = _get_user_geohashes(sb)

        all_users = []
        for gh_data in result.values():
            all_users.extend(gh_data["user_ids"])
        assert all_users == ["u3"]

    def test_returns_empty_on_error(self):
        sb = _mock_supabase()
        sb.table.side_effect = Exception("DB error")
        result = _get_user_geohashes(sb)
        assert result == {}


class TestEndToEnd:
    def test_returns_config_error_when_secrets_are_invalid(self):
        with patch(f"{_HANDLER}.get_briefing_secrets", side_effect=RuntimeError("bad secrets")):
            result = handler({}, None)

        assert result["error"] == "secrets_load_failed"

    def test_no_users_returns_zero(self):
        with (
            patch(f"{_HANDLER}.get_briefing_secrets", return_value=_mock_secrets()),
            patch("supabase.create_client", return_value=_mock_supabase()),
            patch(f"{_HANDLER}._get_user_geohashes", return_value={}),
            patch(f"{_HANDLER}._publish_metrics"),
        ):
            result = handler({}, None)
        assert result["geohashes_checked"] == 0

    def test_processes_geohashes_and_tracks_stats(self):
        secrets = _mock_secrets()
        sb = _mock_supabase()

        geohash_users = {
            "c20g8": {"lat": 45.6, "lng": -122.7, "user_ids": ["u1", "u2"]},
        }

        with (
            patch(f"{_HANDLER}.get_briefing_secrets", return_value=secrets),
            patch("supabase.create_client", return_value=sb),
            patch(f"{_HANDLER}._get_user_geohashes", return_value=geohash_users),
            patch(f"{_HANDLER}._check_weather_alerts", return_value=0) as mock_weather,
            patch(f"{_HANDLER}._check_aqi_alerts", return_value=0) as mock_aqi,
            patch(f"{_HANDLER}._cleanup_expired"),
            patch(f"{_HANDLER}._publish_metrics"),
        ):
            result = handler({}, None)

        assert result["geohashes_checked"] == 1
        mock_weather.assert_called_once()
        mock_aqi.assert_called_once()

    def test_publishes_metrics(self):
        geohash_users = {
            "c20g8": {"lat": 45.6, "lng": -122.7, "user_ids": ["u1"]},
        }

        with (
            patch(f"{_HANDLER}.get_briefing_secrets", return_value=_mock_secrets()),
            patch("supabase.create_client", return_value=_mock_supabase()),
            patch(f"{_HANDLER}._get_user_geohashes", return_value=geohash_users),
            patch(f"{_HANDLER}._check_weather_alerts", return_value=0),
            patch(f"{_HANDLER}._check_aqi_alerts", return_value=0),
            patch(f"{_HANDLER}._cleanup_expired"),
            patch(f"{_HANDLER}._publish_metrics") as mock_metrics,
        ):
            handler({}, None)

        mock_metrics.assert_called_once()
        stats = mock_metrics.call_args[0][0]
        assert "geohashes_checked" in stats
        assert "weather_alerts_found" in stats
        assert "aqi_alerts_found" in stats
        assert "latency_ms" in stats

    def test_handles_check_error_gracefully(self):
        geohash_users = {
            "c20g8": {"lat": 45.6, "lng": -122.7, "user_ids": ["u1"]},
        }

        with (
            patch(f"{_HANDLER}.get_briefing_secrets", return_value=_mock_secrets()),
            patch("supabase.create_client", return_value=_mock_supabase()),
            patch(f"{_HANDLER}._get_user_geohashes", return_value=geohash_users),
            patch(f"{_HANDLER}._check_weather_alerts", side_effect=Exception("NOAA down")),
            patch(f"{_HANDLER}._check_aqi_alerts", return_value=0),
            patch(f"{_HANDLER}._cleanup_expired"),
            patch(f"{_HANDLER}._publish_metrics"),
        ):
            result = handler({}, None)

        # Should not crash, just log the error
        assert result["geohashes_checked"] == 1


class TestWeatherKitFallback:
    def test_weatherkit_503_sets_backoff_and_returns_none(self):
        secrets = _mock_weatherkit_secrets()
        response = MagicMock(status_code=503)
        alert_checker_module._weatherkit_disabled_until = 0
        alert_checker_module._weatherkit_disabled_reason = None

        with (
            patch(f"{_HANDLER}._get_weatherkit_jwt", return_value="token"),
            patch(f"{_HANDLER}.httpx.get", return_value=response) as mock_get,
        ):
            result = _fetch_weatherkit_alerts(45.5773, -122.3255, secrets)

            assert result is None
            assert alert_checker_module._weatherkit_disabled_until > time.time()
            mock_get.assert_called_once()

        with (
            patch(f"{_HANDLER}._get_weatherkit_jwt", return_value="token"),
            patch(f"{_HANDLER}.httpx.get") as mock_get,
        ):
            result = _fetch_weatherkit_alerts(45.5878, -122.3671, secrets)

            assert result is None
            mock_get.assert_not_called()

        alert_checker_module._weatherkit_disabled_until = 0
        alert_checker_module._weatherkit_disabled_reason = None

    def test_weatherkit_timeout_logs_without_traceback(self, caplog):
        secrets = _mock_weatherkit_secrets()
        alert_checker_module._weatherkit_disabled_until = 0
        alert_checker_module._weatherkit_disabled_reason = None

        with (
            patch(f"{_HANDLER}._get_weatherkit_jwt", return_value="token"),
            patch(f"{_HANDLER}.httpx.get", side_effect=httpx.ReadTimeout("timeout")),
            caplog.at_level("WARNING"),
        ):
            result = _fetch_weatherkit_alerts(45.5878, -122.3671, secrets)

        assert result is None
        timeout_logs = [r for r in caplog.records if "WeatherKit timed out" in r.message]
        assert timeout_logs
        assert all(record.exc_info is None for record in timeout_logs)
        alert_checker_module._weatherkit_disabled_until = 0
        alert_checker_module._weatherkit_disabled_reason = None

    def test_weatherkit_fallback_is_not_push_error_when_noaa_succeeds(self):
        stats = {"push_errors": 0}

        with (
            patch(f"{_HANDLER}._weatherkit_available", return_value=True),
            patch(f"{_HANDLER}._weatherkit_backoff_active", return_value=False),
            patch(f"{_HANDLER}._fetch_weatherkit_alerts", return_value=None),
            patch(f"{_HANDLER}._fetch_noaa_alerts", return_value=[]),
        ):
            result = _check_weather_alerts(
                _mock_supabase(),
                _mock_weatherkit_secrets(),
                "c20g8",
                45.5773,
                -122.3255,
                ["u1"],
                stats,
            )

        assert result == 0
        assert stats["push_errors"] == 0
        assert stats["weatherkit_fallbacks"] == 1


class TestSendAlertPush:
    def test_calls_node_backend(self):
        secrets = _mock_secrets()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"sent": 2, "skipped": 0, "failed": 0}

        with patch(f"{_HANDLER}.httpx.post", return_value=mock_response) as mock_post:
            from src.handlers.alert_checker import _send_alert_push
            result = _send_alert_push(secrets, ["u1", "u2"], "Test Alert", "Test body", "weather", {"alertId": "a1"})

        assert result == 2
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        assert call_kwargs.kwargs["json"]["userIds"] == ["u1", "u2"]
        assert call_kwargs.kwargs["headers"]["x-internal-api-key"] == "test-internal-key"

    def test_returns_zero_on_error(self):
        secrets = _mock_secrets()

        with patch(f"{_HANDLER}.httpx.post", side_effect=Exception("network error")):
            from src.handlers.alert_checker import _send_alert_push
            result = _send_alert_push(secrets, ["u1"], "Test", "Body", "weather", {})

        assert result == 0
