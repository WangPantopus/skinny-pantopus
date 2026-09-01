"""Tests for the fetcher Lambda handler."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from src.config.region_registry import RegionConfig, SourceConfig
from src.models.queue_item import RawContentItem


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_item(title="New park opens in Vancouver", **overrides) -> RawContentItem:
    base = {
        "title": title,
        "body": "The city announced a new community garden project.",
        "source_url": "https://example.com/article/1",
        "category": "local_news",
        "source_id": "rss:columbian",
        "region": "clark_county",
        "published_at": datetime.now(timezone.utc),
    }
    base.update(overrides)
    return RawContentItem(**base)


def _mock_supabase():
    """Create a mock Supabase client with chainable table methods."""
    client = MagicMock()

    def _chain():
        chain = MagicMock()
        chain.insert.return_value = chain
        chain.delete.return_value = chain
        chain.update.return_value = chain
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.lt.return_value = chain
        chain.filter.return_value = chain
        chain.is_.return_value = chain
        chain.limit.return_value = chain

        result = MagicMock()
        result.data = []
        result.count = 0
        chain.execute.return_value = result
        return chain

    client.table.return_value = _chain()
    return client


def _mock_source(source_id="rss:test", items=None, should_raise=False):
    source = MagicMock()
    source.source_id = source_id
    source.last_fetch_error = None
    if should_raise:
        source.fetch.side_effect = Exception("Source failed")
    else:
        source.fetch.return_value = items or []
    return source


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


# Two default region configs matching the original REGIONS
_TWO_REGIONS = [
    _make_region_config("clark_county", lat=45.6387, lng=-122.6615, display_name="Clark County, WA"),
    _make_region_config("portland_metro", lat=45.5152, lng=-122.6784, display_name="Portland Metro"),
]


# ---------------------------------------------------------------------------
# Patching helpers
# ---------------------------------------------------------------------------

_HANDLER = "src.handlers.fetcher"


def _standard_patches(regions=None):
    """Return a dict of common patches for fetcher tests."""
    return {
        "secrets": patch(f"{_HANDLER}.get_secrets", return_value=MagicMock(
            supabase_url="https://test.supabase.co",
            supabase_service_role_key="test-key",
        )),
        "create_client": patch("supabase.create_client"),
        "load_regions": patch(f"{_HANDLER}.load_active_regions",
                              return_value=regions if regions is not None else _TWO_REGIONS),
        "load_sources": patch(f"{_HANDLER}.load_sources_for_region", return_value=[]),
        "get_sources_from_db": patch(f"{_HANDLER}.get_sources_from_db"),
        "filter_item": patch(f"{_HANDLER}.filter_item"),
        "compute_hash": patch(f"{_HANDLER}.compute_dedup_hash", return_value="hash123"),
        "is_dup": patch(f"{_HANDLER}.is_duplicate", return_value=False),
        "publish": patch(f"{_HANDLER}._publish_metric"),
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestFetcherHandler:
    def test_processes_multiple_regions(self):
        patches = _standard_patches()
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["load_sources"],
            patches["get_sources_from_db"] as mock_get_src,
            patches["filter_item"] as mock_filter,
            patches["compute_hash"],
            patches["is_dup"],
            patches["publish"],
        ):
            mock_create.return_value = _mock_supabase()
            mock_get_src.return_value = []
            mock_filter.return_value = (True, None)

            from src.handlers.fetcher import handler

            result = handler({}, None)

            assert result["regions_processed"] == 2  # clark_county + portland_metro
            assert mock_get_src.call_count == 2

    def test_continues_when_source_fails(self):
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(regions=one_region)
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["load_sources"],
            patches["get_sources_from_db"] as mock_get_src,
            patches["filter_item"] as mock_filter,
            patches["compute_hash"],
            patches["is_dup"],
            patches["publish"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            good_item = _make_item("Good article about parks and recreation")
            failing_source = _mock_source("rss:bad", should_raise=True)
            good_source = _mock_source("rss:good", items=[good_item])
            mock_get_src.return_value = [failing_source, good_source]
            mock_filter.return_value = (True, None)

            from src.handlers.fetcher import handler

            result = handler({}, None)

            assert result["total_errors"] >= 1  # Error from failing source
            assert result["total_queued"] >= 1  # Good source processed

    def test_counts_reported_fetch_errors(self):
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(regions=one_region)
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["load_sources"],
            patches["get_sources_from_db"] as mock_get_src,
            patches["filter_item"] as mock_filter,
            patches["compute_hash"],
            patches["is_dup"],
            patches["publish"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            item = _make_item("Fresh article after a feed hiccup")
            source = _mock_source("rss:warning", items=[item])
            source.last_fetch_error = "http_403:reddit_blocked"
            mock_get_src.return_value = [source]
            mock_filter.return_value = (True, None)

            from src.handlers.fetcher import handler

            result = handler({}, None)

            assert result["total_errors"] == 1
            assert result["total_queued"] == 1

    def test_inserts_queued_items(self):
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(regions=one_region)
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["load_sources"],
            patches["get_sources_from_db"] as mock_get_src,
            patches["filter_item"] as mock_filter,
            patches["compute_hash"],
            patches["is_dup"],
            patches["publish"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            item = _make_item("Community garden opens next week in downtown")
            mock_get_src.return_value = [_mock_source(items=[item])]
            mock_filter.return_value = (True, None)

            from src.handlers.fetcher import handler

            result = handler({}, None)

            assert result["total_queued"] == 1
            # Verify insert was called with status='queued'
            insert_call = sb.table.return_value.insert
            assert insert_call.called
            inserted_row = insert_call.call_args[0][0]
            assert inserted_row["status"] == "queued"
            assert inserted_row["raw_title"] == "Community garden opens next week in downtown"

    def test_inserts_filtered_items_with_reason(self):
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(regions=one_region)
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["load_sources"],
            patches["get_sources_from_db"] as mock_get_src,
            patches["filter_item"] as mock_filter,
            patches["compute_hash"],
            patches["is_dup"],
            patches["publish"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            item = _make_item("Man arrested downtown for robbery last night")
            mock_get_src.return_value = [_mock_source(items=[item])]
            mock_filter.return_value = (False, "blocklist:arrested")

            from src.handlers.fetcher import handler

            result = handler({}, None)

            assert result["total_filtered"] == 1
            insert_call = sb.table.return_value.insert
            inserted_row = insert_call.call_args[0][0]
            assert inserted_row["status"] == "filtered_out"
            assert inserted_row["failure_reason"] == "blocklist:arrested"

    def test_skips_duplicate_items(self):
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(regions=one_region)
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["load_sources"],
            patches["get_sources_from_db"] as mock_get_src,
            patches["filter_item"] as mock_filter,
            patches["compute_hash"],
            patch(f"{_HANDLER}.is_duplicate", return_value=True),
            patches["publish"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            item = _make_item("Duplicate article already in queue")
            mock_get_src.return_value = [_mock_source(items=[item])]
            mock_filter.return_value = (True, None)

            from src.handlers.fetcher import handler

            result = handler({}, None)

            assert result["total_deduped"] == 1
            assert result["total_queued"] == 0
            # insert should not have been called for the item
            assert not sb.table.return_value.insert.called

    def test_runs_queue_hygiene(self):
        patches = _standard_patches()
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["load_sources"],
            patches["get_sources_from_db"] as mock_get_src,
            patches["filter_item"],
            patches["compute_hash"],
            patches["is_dup"],
            patches["publish"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb
            mock_get_src.return_value = []

            from src.handlers.fetcher import handler

            handler({}, None)

            # Hygiene calls: 3 deletes (purge by status) + 5 stale updates:
            # four per-category buckets (24h / 48h / 72h / 168h) + null-category.
            table_mock = sb.table.return_value
            assert table_mock.delete.called
            assert table_mock.update.called
            stale_calls = [
                c for c in table_mock.update.call_args_list
                if c.args and c.args[0].get("failure_reason") == "stale"
            ]
            assert len(stale_calls) == 5

    def test_returns_correct_summary(self):
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(regions=one_region)
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["load_sources"],
            patches["get_sources_from_db"] as mock_get_src,
            patches["filter_item"] as mock_filter,
            patches["compute_hash"],
            patches["is_dup"],
            patches["publish"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            items = [
                _make_item(
                    "Article one about the local community garden",
                    body="Volunteers broke ground on a neighborhood plot.",
                ),
                _make_item(
                    "Article two about weekend farmers market",
                    body="Vendors will gather downtown Saturday morning.",
                ),
            ]
            mock_get_src.return_value = [_mock_source(items=items)]
            mock_filter.return_value = (True, None)

            from src.handlers.fetcher import handler

            result = handler({}, None)

            assert "regions_processed" in result
            assert "total_queued" in result
            assert "total_filtered" in result
            assert "total_deduped" in result
            assert "total_errors" in result
            assert "queue_depth" in result
            assert result["regions_processed"] == 1
            assert result["total_queued"] == 2

    def test_inserts_media_fields(self):
        """Media URLs and types from source items are included in queue insert."""
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(regions=one_region)
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["load_sources"],
            patches["get_sources_from_db"] as mock_get_src,
            patches["filter_item"] as mock_filter,
            patches["compute_hash"],
            patches["is_dup"],
            patches["publish"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            item = _make_item(
                "Article with photo from the local park",
                media_urls=["https://example.com/hero.jpg"],
                media_types=["image"],
            )
            mock_get_src.return_value = [_mock_source(items=[item])]
            mock_filter.return_value = (True, None)

            from src.handlers.fetcher import handler

            handler({}, None)

            insert_call = sb.table.return_value.insert
            inserted_row = insert_call.call_args[0][0]
            assert inserted_row["media_urls"] == ["https://example.com/hero.jpg"]
            assert inserted_row["media_types"] == ["image"]

    def test_inserts_empty_media_when_none(self):
        """Items without media get empty lists in queue insert."""
        one_region = [_make_region_config("test_region")]
        patches = _standard_patches(regions=one_region)
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["load_sources"],
            patches["get_sources_from_db"] as mock_get_src,
            patches["filter_item"] as mock_filter,
            patches["compute_hash"],
            patches["is_dup"],
            patches["publish"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            item = _make_item("Text only article about community events")
            mock_get_src.return_value = [_mock_source(items=[item])]
            mock_filter.return_value = (True, None)

            from src.handlers.fetcher import handler

            handler({}, None)

            insert_call = sb.table.return_value.insert
            inserted_row = insert_call.call_args[0][0]
            assert inserted_row["media_urls"] == []
            assert inserted_row["media_types"] == []

    def test_handles_supabase_init_failure(self):
        with (
            patch(f"{_HANDLER}.get_secrets", return_value=MagicMock(
                supabase_url="https://bad.supabase.co",
                supabase_service_role_key="bad-key",
            )),
            patch("supabase.create_client", side_effect=Exception("Auth failed")),
        ):
            from src.handlers.fetcher import handler

            result = handler({}, None)

            assert result["error"] == "supabase_init_failed"
            assert result["regions_processed"] == 0

    def test_handles_no_active_regions(self):
        """Returns error when no active regions found."""
        patches = _standard_patches(regions=[])
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["publish"],
        ):
            mock_create.return_value = _mock_supabase()

            from src.handlers.fetcher import handler

            result = handler({}, None)

            assert result["error"] == "no_active_regions"

    def test_dynamic_region_processed(self):
        """A dynamically added region is processed like any other."""
        seattle = [_make_region_config("seattle_metro", lat=47.6062, lng=-122.3321,
                                       display_name="Seattle Metro")]
        patches = _standard_patches(regions=seattle)
        with (
            patches["secrets"],
            patches["create_client"] as mock_create,
            patches["load_regions"],
            patches["load_sources"],
            patches["get_sources_from_db"] as mock_get_src,
            patches["filter_item"] as mock_filter,
            patches["compute_hash"],
            patches["is_dup"],
            patches["publish"],
        ):
            sb = _mock_supabase()
            mock_create.return_value = sb

            item = _make_item("Seattle news article", region="seattle_metro")
            mock_get_src.return_value = [_mock_source(items=[item])]
            mock_filter.return_value = (True, None)

            from src.handlers.fetcher import handler

            result = handler({}, None)

            assert result["regions_processed"] == 1
            assert result["total_queued"] == 1
