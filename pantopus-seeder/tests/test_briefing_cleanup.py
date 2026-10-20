"""Tests for briefing cleanup housekeeping (delivery belongs to the scheduler)."""

from __future__ import annotations

from unittest.mock import MagicMock

from src.handlers.briefing_cleanup import (
    _purge_expired_context_cache,
    _purge_old_deliveries,
)


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
