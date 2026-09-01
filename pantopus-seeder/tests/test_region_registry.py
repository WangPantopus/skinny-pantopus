"""Tests for the dynamic region registry."""

from __future__ import annotations

from unittest.mock import MagicMock

from src.config.region_registry import (
    RegionConfig,
    SourceConfig,
    load_active_regions,
    load_sources_for_region,
)


def _mock_supabase(table_data=None, table_error=False):
    client = MagicMock()

    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain

    if table_error:
        chain.execute.side_effect = Exception("DB error")
    else:
        result = MagicMock()
        result.data = table_data if table_data is not None else []
        chain.execute.return_value = result

    client.table.return_value = chain
    return client


class TestLoadActiveRegions:
    def test_returns_regions_from_db(self):
        data = [
            {
                "region": "clark_county",
                "lat": 45.6387,
                "lng": -122.6615,
                "radius_meters": 25000,
                "timezone": "America/Los_Angeles",
                "display_name": "Clark County, WA",
                "curator_user_id": "curator-uuid",
            },
            {
                "region": "seattle_metro",
                "lat": 47.6062,
                "lng": -122.3321,
                "radius_meters": 30000,
                "timezone": "America/Los_Angeles",
                "display_name": "Seattle Metro",
                "curator_user_id": "curator-uuid",
            },
        ]
        sb = _mock_supabase(table_data=data)
        regions = load_active_regions(sb)

        assert len(regions) == 2
        assert isinstance(regions[0], RegionConfig)
        assert regions[0].region == "clark_county"
        assert regions[0].lat == 45.6387
        assert regions[1].region == "seattle_metro"
        assert regions[1].lat == 47.6062

    def test_returns_empty_on_error(self):
        sb = _mock_supabase(table_error=True)
        regions = load_active_regions(sb)
        assert regions == []

    def test_returns_empty_when_no_rows(self):
        sb = _mock_supabase(table_data=[])
        regions = load_active_regions(sb)
        assert regions == []

    def test_skips_malformed_rows(self):
        data = [
            {"region": "good", "lat": 45.0, "lng": -122.0, "curator_user_id": "uuid"},
            {"region": "bad"},  # missing lat/lng
        ]
        sb = _mock_supabase(table_data=data)
        regions = load_active_regions(sb)
        assert len(regions) == 1
        assert regions[0].region == "good"

    def test_skips_rows_with_invalid_coordinates(self):
        data = [
            {"region": "good", "lat": 45.0, "lng": -122.0, "curator_user_id": "uuid"},
            {"region": "null_island", "lat": 0.0, "lng": 0.0, "curator_user_id": "uuid"},
            {"region": "out_of_range", "lat": 200.0, "lng": -122.0, "curator_user_id": "uuid"},
        ]
        sb = _mock_supabase(table_data=data)

        regions = load_active_regions(sb)

        assert len(regions) == 1
        assert regions[0].region == "good"


class TestLoadSourcesForRegion:
    def test_returns_sources_from_db(self):
        data = [
            {
                "source_id": "rss:columbian",
                "source_type": "rss",
                "url": "https://www.columbian.com/feed/",
                "category": "local_news",
                "display_name": "The Columbian",
                "region": "clark_county",
            },
            {
                "source_id": "google_news:clark_county",
                "source_type": "google_news",
                "url": "Clark County WA news",
                "category": "local_news",
                "display_name": "Google News (Clark County, WA)",
                "region": "clark_county",
            },
        ]
        sb = _mock_supabase(table_data=data)
        sources = load_sources_for_region(sb, "clark_county")

        assert len(sources) == 2
        assert isinstance(sources[0], SourceConfig)
        assert sources[0].source_id == "rss:columbian"
        assert sources[1].source_type == "google_news"

    def test_returns_empty_on_error(self):
        sb = _mock_supabase(table_error=True)
        sources = load_sources_for_region(sb, "clark_county")
        assert sources == []

    def test_returns_empty_for_unknown_region(self):
        sb = _mock_supabase(table_data=[])
        sources = load_sources_for_region(sb, "narnia")
        assert sources == []
