"""Tests for the no-bid nudge Lambda handler."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch

# Stub the supabase module before any handler imports
_supabase_mock = MagicMock()
sys.modules.setdefault("supabase", _supabase_mock)
sys.modules.setdefault("httpx", MagicMock())

from src.handlers.no_bid_nudge import (
    BACKFILL_CUTOFF_ENV,
    QUERY_BATCH_SIZE,
    _fetch_candidate_gigs,
    _fetch_open_gigs,
    _get_backfill_cutoff_iso,
    _record_sent,
    _user_has_verified_home,
)


def test_user_has_verified_home_requires_verified_active_occupancy():
    supabase = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.limit.return_value = chain
    chain.execute.return_value = SimpleNamespace(count=1)
    supabase.table.return_value = chain

    assert _user_has_verified_home(supabase, "user-1") is True
    supabase.table.assert_called_once_with("HomeOccupancy")
    assert chain.eq.call_args_list == [
        call("user_id", "user-1"),
        call("is_active", True),
        call("verification_status", "verified"),
    ]


def test_user_has_verified_home_returns_false_on_query_error():
    supabase = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.limit.return_value = chain
    chain.execute.side_effect = RuntimeError("boom")
    supabase.table.return_value = chain

    assert _user_has_verified_home(supabase, "user-1") is False


def test_fetch_open_gigs_paginates_all_open_rows():
    supabase = MagicMock()
    first_chain = MagicMock()
    first_chain.select.return_value = first_chain
    first_chain.eq.return_value = first_chain
    first_chain.order.return_value = first_chain
    first_chain.range.return_value = first_chain
    first_chain.execute.return_value = SimpleNamespace(
        data=[{"id": "gig-1", "user_id": "user-1", "title": "First"}] * QUERY_BATCH_SIZE
    )

    second_chain = MagicMock()
    second_chain.select.return_value = second_chain
    second_chain.eq.return_value = second_chain
    second_chain.order.return_value = second_chain
    second_chain.range.return_value = second_chain
    second_chain.execute.return_value = SimpleNamespace(
        data=[{"id": "gig-last", "user_id": "user-2", "title": "Last"}]
    )

    supabase.table.side_effect = [first_chain, second_chain]

    gigs = _fetch_open_gigs(supabase)

    assert len(gigs) == QUERY_BATCH_SIZE + 1
    assert first_chain.eq.call_args_list == [call("status", "open")]
    assert second_chain.eq.call_args_list == [call("status", "open")]
    first_chain.range.assert_called_once_with(0, QUERY_BATCH_SIZE - 1)
    second_chain.range.assert_called_once_with(QUERY_BATCH_SIZE, (2 * QUERY_BATCH_SIZE) - 1)


def test_fetch_candidate_gigs_merges_rolling_window_and_backfill_without_duplicates():
    rolling = [
        {"id": "gig-rolling", "user_id": "user-1", "title": "Rolling"},
        {"id": "gig-shared", "user_id": "user-2", "title": "Shared"},
    ]
    backfill = [
        {"id": "gig-shared", "user_id": "user-2", "title": "Shared"},
        {"id": "gig-old", "user_id": "user-3", "title": "Old"},
    ]

    with patch(
        "src.handlers.no_bid_nudge._fetch_open_gigs",
        side_effect=[rolling, backfill],
    ) as mock_fetch:
        gigs = _fetch_candidate_gigs(
            MagicMock(),
            backfill_before_iso="2026-04-10T00:00:00+00:00",
            now=datetime(2026, 4, 13, 12, 0, tzinfo=timezone.utc),
        )

    assert {gig["id"] for gig in gigs} == {"gig-rolling", "gig-shared", "gig-old"}
    assert mock_fetch.call_count == 2


def test_get_backfill_cutoff_iso_ignores_invalid_value(monkeypatch):
    monkeypatch.setenv(BACKFILL_CUTOFF_ENV, "not-a-date")
    assert _get_backfill_cutoff_iso() is None


def test_record_sent_writes_non_expiring_dedup_marker():
    supabase = MagicMock()
    chain = MagicMock()
    chain.insert.return_value = chain
    supabase.table.return_value = chain

    _record_sent(supabase, "no_bid_nudge_gig-1")

    chain.insert.assert_called_once_with({
        "alert_type": "no_bid_nudge",
        "alert_id": "no_bid_nudge_gig-1",
        "geohash": "global",
        "headline": "no_bid_nudge_gig-1",
        "users_notified": 1,
        "expires_at": None,
    })
