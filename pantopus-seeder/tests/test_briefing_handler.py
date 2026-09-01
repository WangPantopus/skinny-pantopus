"""Tests for the briefing scheduler Lambda handler."""

from __future__ import annotations

import sys
from datetime import datetime
from unittest.mock import MagicMock, patch, call
from zoneinfo import ZoneInfo

import pytest

# Stub the supabase module before any handler imports
_supabase_mock = MagicMock()
sys.modules.setdefault("supabase", _supabase_mock)

from src.handlers.briefing import (
    handler,
    _find_eligible_users,
    _is_within_window,
    _is_in_quiet_hours,
    _process_user,
)

_HANDLER = "src.handlers.briefing"
PACIFIC = ZoneInfo("America/Los_Angeles")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_briefing_secrets():
    s = MagicMock()
    s.supabase_url = "https://test.supabase.co"
    s.supabase_service_role_key = "test-key"
    s.pantopus_api_base_url = "https://api.test.com"
    s.internal_api_key = "test-internal-key"
    return s


def _mock_supabase():
    """Create a mock Supabase client with chainable table methods."""
    client = MagicMock()

    def _chain():
        chain = MagicMock()
        chain.select.return_value = chain
        chain.insert.return_value = chain
        chain.update.return_value = chain
        chain.delete.return_value = chain
        chain.eq.return_value = chain
        chain.in_.return_value = chain
        chain.gte.return_value = chain
        chain.lt.return_value = chain
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


def _make_prefs_row(
    user_id="user-1",
    time_local="07:30",
    tz="America/Los_Angeles",
    quiet_start=None,
    quiet_end=None,
    daily_enabled=True,
    evening_enabled=True,
    evening_time="18:00",
):
    return {
        "user_id": user_id,
        "daily_briefing_enabled": daily_enabled,
        "daily_briefing_time_local": time_local,
        "evening_briefing_enabled": evening_enabled,
        "evening_briefing_time_local": evening_time,
        "daily_briefing_timezone": tz,
        "quiet_hours_start_local": quiet_start,
        "quiet_hours_end_local": quiet_end,
    }


# ---------------------------------------------------------------------------
# Test: Time window helper
# ---------------------------------------------------------------------------

class TestTimeWindow:
    def test_exact_match(self):
        assert _is_within_window("07:30", "07:30", 15) is True

    def test_within_window(self):
        assert _is_within_window("07:20", "07:30", 15) is True
        assert _is_within_window("07:44", "07:30", 15) is True

    def test_outside_window(self):
        assert _is_within_window("07:00", "07:30", 15) is False
        assert _is_within_window("08:00", "07:30", 15) is False

    def test_midnight_wrap(self):
        assert _is_within_window("23:55", "00:05", 15) is True
        assert _is_within_window("00:10", "00:05", 15) is True


# ---------------------------------------------------------------------------
# Test: Quiet hours helper
# ---------------------------------------------------------------------------

class TestQuietHours:
    def test_in_range(self):
        assert _is_in_quiet_hours("23:00", "22:00", "07:00") is True

    def test_out_of_range(self):
        assert _is_in_quiet_hours("08:00", "22:00", "07:00") is False

    def test_overnight_before_midnight(self):
        assert _is_in_quiet_hours("22:30", "22:00", "07:00") is True

    def test_overnight_after_midnight(self):
        assert _is_in_quiet_hours("03:00", "22:00", "07:00") is True

    def test_same_day_range(self):
        assert _is_in_quiet_hours("14:00", "13:00", "16:00") is True
        assert _is_in_quiet_hours("12:00", "13:00", "16:00") is False


# ---------------------------------------------------------------------------
# 1. Only processes users whose local time is within briefing window
# ---------------------------------------------------------------------------

class TestEligibleUserFiltering:
    def test_only_users_in_window(self):
        sb = _mock_supabase()

        # Two users: one at 07:30 (in window), one at 12:00 (out of window)
        prefs_result = MagicMock()
        prefs_result.data = [
            _make_prefs_row("user-in", "07:30"),
            _make_prefs_row("user-out", "12:00"),
        ]

        delivery_result = MagicMock()
        delivery_result.data = []

        call_count = [0]
        def table_side_effect(table_name):
            chain = _mock_supabase().table.return_value
            if table_name == "UserNotificationPreferences":
                chain.execute.return_value = prefs_result
            else:
                chain.execute.return_value = delivery_result
            return chain

        sb.table.side_effect = table_side_effect

        now_pacific = datetime(2026, 4, 6, 7, 28, 0, tzinfo=PACIFIC)
        with patch(f"{_HANDLER}.datetime") as mock_dt:
            mock_dt.now.return_value = now_pacific
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            eligible = _find_eligible_users(sb)

        user_ids = [u["user_id"] for u in eligible]
        assert "user-in" in user_ids
        assert "user-out" not in user_ids


# ---------------------------------------------------------------------------
# 2. Skips users with existing delivery for today (idempotency)
# ---------------------------------------------------------------------------

    def test_skips_already_delivered(self):
        sb = _mock_supabase()

        prefs_result = MagicMock()
        prefs_result.data = [_make_prefs_row("user-done", "07:30")]

        delivery_result = MagicMock()
        delivery_result.data = [{"user_id": "user-done", "briefing_kind": "morning", "status": "sent"}]

        call_idx = [0]
        def table_side_effect(table_name):
            chain = _mock_supabase().table.return_value
            if table_name == "UserNotificationPreferences":
                chain.execute.return_value = prefs_result
            else:
                chain.execute.return_value = delivery_result
            return chain

        sb.table.side_effect = table_side_effect

        now_pacific = datetime(2026, 4, 6, 7, 30, 0, tzinfo=PACIFIC)
        with patch(f"{_HANDLER}.datetime") as mock_dt:
            mock_dt.now.return_value = now_pacific
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            eligible = _find_eligible_users(sb)

        assert len(eligible) == 0


# ---------------------------------------------------------------------------
# 3. Skips users in quiet hours
# ---------------------------------------------------------------------------

    def test_skips_quiet_hours(self):
        sb = _mock_supabase()

        prefs_result = MagicMock()
        prefs_result.data = [_make_prefs_row("user-quiet", "07:30", quiet_start="07:00", quiet_end="08:00")]

        delivery_result = MagicMock()
        delivery_result.data = []

        def table_side_effect(table_name):
            chain = _mock_supabase().table.return_value
            if table_name == "UserNotificationPreferences":
                chain.execute.return_value = prefs_result
            else:
                chain.execute.return_value = delivery_result
            return chain

        sb.table.side_effect = table_side_effect

        now_pacific = datetime(2026, 4, 6, 7, 30, 0, tzinfo=PACIFIC)
        with patch(f"{_HANDLER}.datetime") as mock_dt:
            mock_dt.now.return_value = now_pacific
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            eligible = _find_eligible_users(sb)

        assert len(eligible) == 0


# ---------------------------------------------------------------------------
# 4. Calls Node backend with correct URL, headers, and body
# ---------------------------------------------------------------------------

class TestProcessUser:
    def test_correct_http_call(self):
        secrets = _mock_briefing_secrets()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "sent"}

        with patch(f"{_HANDLER}.httpx.post", return_value=mock_response) as mock_post:
            result = _process_user("user-123", secrets)

        mock_post.assert_called_once_with(
            "https://api.test.com/api/internal/briefing/send",
            json={"userId": "user-123", "briefingKind": "morning"},
            headers={
                "Content-Type": "application/json",
                "x-internal-api-key": "test-internal-key",
            },
            timeout=30,
        )
        assert result["outcome"] == "sent"

    def test_correct_http_call_for_evening(self):
        secrets = _mock_briefing_secrets()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "sent"}

        with patch(f"{_HANDLER}.httpx.post", return_value=mock_response) as mock_post:
            result = _process_user("user-123", secrets, briefing_kind="evening")

        mock_post.assert_called_once_with(
            "https://api.test.com/api/internal/briefing/send",
            json={"userId": "user-123", "briefingKind": "evening"},
            headers={
                "Content-Type": "application/json",
                "x-internal-api-key": "test-internal-key",
            },
            timeout=30,
        )
        assert result["outcome"] == "sent"


# ---------------------------------------------------------------------------
# 5. Handles 200 response with status='sent'
# ---------------------------------------------------------------------------

    def test_status_sent(self):
        secrets = _mock_briefing_secrets()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "sent"}

        with patch(f"{_HANDLER}.httpx.post", return_value=mock_response):
            result = _process_user("user-1", secrets)

        assert result["outcome"] == "sent"


# ---------------------------------------------------------------------------
# 6. Handles 200 response with status='skipped'
# ---------------------------------------------------------------------------

    def test_status_skipped(self):
        secrets = _mock_briefing_secrets()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "skipped", "skip_reason": "low_signal_day"}

        with patch(f"{_HANDLER}.httpx.post", return_value=mock_response):
            result = _process_user("user-2", secrets)

        assert result["outcome"] == "skipped"
        assert result["reason"] == "low_signal_day"


# ---------------------------------------------------------------------------
# 7. Handles error/timeout gracefully
# ---------------------------------------------------------------------------

    def test_timeout(self):
        import httpx
        secrets = _mock_briefing_secrets()

        with patch(f"{_HANDLER}.httpx.post", side_effect=httpx.TimeoutException("timed out")):
            result = _process_user("user-3", secrets)

        assert result["outcome"] == "failed"
        assert result["error"] == "timeout"

    def test_http_error(self):
        secrets = _mock_briefing_secrets()
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch(f"{_HANDLER}.httpx.post", return_value=mock_response):
            result = _process_user("user-4", secrets)

        assert result["outcome"] == "failed"
        assert "500" in result["error"]


# ---------------------------------------------------------------------------
# 8. Records stats correctly
# ---------------------------------------------------------------------------

class TestEndToEnd:
    def test_stats_tracking(self):
        secrets = _mock_briefing_secrets()
        sb = _mock_supabase()

        prefs_result = MagicMock()
        prefs_result.data = [
            _make_prefs_row("sent-user", "07:30"),
            _make_prefs_row("skip-user", "07:30"),
            _make_prefs_row("fail-user", "07:30"),
        ]
        delivery_result = MagicMock()
        delivery_result.data = []

        def table_side_effect(table_name):
            chain = _mock_supabase().table.return_value
            if table_name == "UserNotificationPreferences":
                chain.execute.return_value = prefs_result
            else:
                chain.execute.return_value = delivery_result
            return chain

        sb.table.side_effect = table_side_effect

        responses = {
            "sent-user": {"status": "sent"},
            "skip-user": {"status": "skipped", "skip_reason": "no_push_token"},
            "fail-user": {"status": "failed", "error": "compose_error"},
        }

        def mock_post_side_effect(url, json, headers, timeout):
            uid = json["userId"]
            resp = MagicMock()
            resp.status_code = 200
            resp.json.return_value = responses[uid]
            return resp

        now_pacific = datetime(2026, 4, 6, 7, 30, 0, tzinfo=PACIFIC)

        with (
            patch(f"{_HANDLER}.get_briefing_secrets", return_value=secrets),
            patch("supabase.create_client", return_value=sb),
            patch(f"{_HANDLER}._find_eligible_users", return_value=[
                {"user_id": "sent-user", "timezone": "America/Los_Angeles", "briefing_kind": "morning"},
                {"user_id": "skip-user", "timezone": "America/Los_Angeles", "briefing_kind": "morning"},
                {"user_id": "fail-user", "timezone": "America/Los_Angeles", "briefing_kind": "morning"},
            ]),
            patch(f"{_HANDLER}.httpx.post", side_effect=mock_post_side_effect),
            patch(f"{_HANDLER}._publish_metrics") as mock_metrics,
        ):
            result = handler({}, None)

        assert result["sent"] == 1
        assert result["skipped"] == 1
        assert result["failed"] == 1
        assert result["eligible"] == 3
        mock_metrics.assert_called_once()


# ---------------------------------------------------------------------------
# 9. Respects batch size limit of 100
# ---------------------------------------------------------------------------

    def test_batch_size_cap(self):
        secrets = _mock_briefing_secrets()
        sb = _mock_supabase()

        # 150 users
        prefs_result = MagicMock()
        prefs_result.data = [_make_prefs_row(f"user-{i}", "07:30") for i in range(150)]
        delivery_result = MagicMock()
        delivery_result.data = []

        def table_side_effect(table_name):
            chain = _mock_supabase().table.return_value
            if table_name == "UserNotificationPreferences":
                chain.execute.return_value = prefs_result
            else:
                chain.execute.return_value = delivery_result
            return chain

        sb.table.side_effect = table_side_effect

        now_pacific = datetime(2026, 4, 6, 7, 30, 0, tzinfo=PACIFIC)

        process_count = [0]

        def mock_process(uid, sec, briefing_kind="morning"):
            process_count[0] += 1
            return {"outcome": "sent"}

        with (
            patch(f"{_HANDLER}.get_briefing_secrets", return_value=secrets),
            patch("supabase.create_client", return_value=sb),
            patch(f"{_HANDLER}.datetime") as mock_dt,
            patch(f"{_HANDLER}._process_user", side_effect=mock_process),
            patch(f"{_HANDLER}._publish_metrics"),
        ):
            mock_dt.now.return_value = now_pacific
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = handler({}, None)

        # Should process max 100, not 150
        assert process_count[0] <= 100
        assert result["eligible"] <= 100


# ---------------------------------------------------------------------------
# 10. Publishes CloudWatch metrics
# ---------------------------------------------------------------------------

    def test_publishes_metrics(self):
        secrets = _mock_briefing_secrets()

        with (
            patch(f"{_HANDLER}.get_briefing_secrets", return_value=secrets),
            patch("supabase.create_client", return_value=_mock_supabase()),
            patch(f"{_HANDLER}._find_eligible_users", return_value=[]),
            patch(f"{_HANDLER}._publish_metrics") as mock_metrics,
        ):
            handler({}, None)

        mock_metrics.assert_called_once()
        stats = mock_metrics.call_args[0][0]
        assert "eligible" in stats
        assert "sent" in stats
        assert "skipped" in stats
        assert "failed" in stats
        assert "latency_ms" in stats

    def test_evening_slot_can_be_eligible_when_morning_is_disabled(self):
        sb = _mock_supabase()

        prefs_result = MagicMock()
        prefs_result.data = [
            _make_prefs_row(
                "user-evening",
                time_local="07:30",
                daily_enabled=False,
                evening_enabled=True,
                evening_time="18:00",
            ),
        ]
        delivery_result = MagicMock()
        delivery_result.data = []

        def table_side_effect(table_name):
            chain = _mock_supabase().table.return_value
            if table_name == "UserNotificationPreferences":
                chain.execute.return_value = prefs_result
            else:
                chain.execute.return_value = delivery_result
            return chain

        sb.table.side_effect = table_side_effect

        now_pacific = datetime(2026, 4, 6, 18, 2, 0, tzinfo=PACIFIC)
        with patch(f"{_HANDLER}.datetime") as mock_dt:
            mock_dt.now.return_value = now_pacific
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            eligible = _find_eligible_users(sb)

        assert eligible == [{
            "user_id": "user-evening",
            "timezone": "America/Los_Angeles",
            "briefing_kind": "evening",
        }]
