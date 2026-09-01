"""Tests for briefing cleanup purge and retry behavior."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from src.handlers.briefing_cleanup import (
    _purge_expired_context_cache,
    _purge_old_deliveries,
    _retry_date_candidates,
    _retry_failed_deliveries,
)


def _mock_secrets():
    secrets = MagicMock()
    secrets.pantopus_api_base_url = "https://api.test.com"
    secrets.internal_api_key = "test-internal-key"
    return secrets


class TestRetryDateCandidates:
    def test_includes_previous_current_and_next_utc_dates(self):
        now = datetime(2026, 4, 8, 6, 0, 0, tzinfo=timezone.utc)
        assert _retry_date_candidates(now) == ["2026-04-07", "2026-04-08", "2026-04-09"]


class TestPurgeHelpers:
    def test_purge_old_deliveries_uses_minimal_returning_and_exact_count(self):
        chain = MagicMock()
        chain.delete.return_value = chain
        chain.lt.return_value = chain
        chain.execute.return_value = MagicMock(count=42, data=[])

        supabase = MagicMock()
        supabase.table.return_value = chain

        assert _purge_old_deliveries(supabase) == 42
        supabase.table.assert_called_once_with("DailyBriefingDelivery")
        chain.delete.assert_called_once_with(count="exact", returning="minimal")
        chain.lt.assert_called_once()

    def test_purge_expired_context_cache_uses_minimal_returning_and_exact_count(self):
        chain = MagicMock()
        chain.delete.return_value = chain
        chain.lt.return_value = chain
        chain.execute.return_value = MagicMock(count=17, data=[])

        supabase = MagicMock()
        supabase.table.return_value = chain

        assert _purge_expired_context_cache(supabase) == 17
        supabase.table.assert_called_once_with("ContextCache")
        chain.delete.assert_called_once_with(count="exact", returning="minimal")
        chain.lt.assert_called_once()


class TestRetryFailedDeliveries:
    def test_retries_rows_from_any_candidate_local_date(self):
        secrets = _mock_secrets()
        failed_row = {
            "id": "delivery-1",
            "user_id": "user-1",
            "briefing_kind": "evening",
            "error_message": "compose_failed",
        }

        select_chain = MagicMock()
        select_chain.select.return_value = select_chain
        select_chain.eq.return_value = select_chain
        select_chain.in_.return_value = select_chain
        select_chain.execute.return_value = MagicMock(data=[failed_row])

        supabase = MagicMock()
        supabase.table.return_value = select_chain

        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {"status": "sent"}

        with patch("httpx.post", return_value=response) as mock_post:
            attempted, succeeded = _retry_failed_deliveries(supabase, secrets)

        assert attempted == 1
        assert succeeded == 1
        select_chain.in_.assert_called_once()
        assert select_chain.in_.call_args[0][0] == "briefing_date_local"
        assert select_chain.in_.call_args[0][1] == _retry_date_candidates()
        mock_post.assert_called_once_with(
            "https://api.test.com/api/internal/briefing/send",
            json={"userId": "user-1", "briefingKind": "evening"},
            headers={
                "Content-Type": "application/json",
                "x-internal-api-key": "test-internal-key",
            },
            timeout=30,
        )
