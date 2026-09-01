"""Tests for config layer: secrets, constants, sources, and models."""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.config.constants import (
    ALL_CATEGORIES,
    BLOCKLIST_TERMS,
    CADENCE_SLOTS,
    CATEGORY_TO_POST_TYPE,
    CATEGORY_TO_PURPOSE,
    FRESHNESS_HOURS,
    MAX_HUMANIZED_LENGTH,
    MAX_JITTER_MINUTES,
    MAX_SEASONAL_POSTS_PER_WEEK,
    POSTING_SLOTS,
    QUEUE_PURGE_DAYS,
    QUEUE_STALE_HOURS,
    REGIONS,
    TAPERING_STAGES,
    TAPERING_THRESHOLDS,
)
from src.config.secrets import (
    BriefingSecrets,
    SeederSecrets,
    clear_briefing_cache,
    get_briefing_secrets,
)
from src.config.sources_config import get_sources_for_region
from src.models.queue_item import QueueItem, RawContentItem, TaperingMetrics


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


class TestConstants:
    def test_all_categories_is_list_of_strings(self):
        assert isinstance(ALL_CATEGORIES, list)
        assert all(isinstance(c, str) for c in ALL_CATEGORIES)
        assert len(ALL_CATEGORIES) == 10

    def test_tapering_thresholds_keys(self):
        assert isinstance(TAPERING_THRESHOLDS, dict)
        assert set(TAPERING_THRESHOLDS.keys()) == {"full", "reduced", "minimal", "dormant"}

    def test_tapering_stages_keys(self):
        assert isinstance(TAPERING_STAGES, dict)
        assert set(TAPERING_STAGES.keys()) == {"full", "reduced", "minimal", "dormant"}
        for stage in TAPERING_STAGES.values():
            assert "max_slots" in stage
            assert "allowed_categories" in stage

    def test_posting_slots_are_ints(self):
        assert isinstance(POSTING_SLOTS, dict)
        assert all(isinstance(v, int) for v in POSTING_SLOTS.values())

    def test_cadence_slots_keys(self):
        assert set(CADENCE_SLOTS.keys()) == {"full", "reduced", "minimal", "dormant"}

    def test_category_mappings_cover_all_categories(self):
        for cat in ALL_CATEGORIES:
            assert cat in CATEGORY_TO_POST_TYPE
            assert cat in CATEGORY_TO_PURPOSE

    def test_stale_windows_cover_every_category(self):
        """Every known category must have a stale window so the fetcher's
        hygiene pass never leaves rows in the queue indefinitely."""
        from src.config.constants import QUEUE_STALE_HOURS_BY_CATEGORY
        for cat in ALL_CATEGORIES:
            assert cat in QUEUE_STALE_HOURS_BY_CATEGORY, (
                f"category {cat!r} missing from QUEUE_STALE_HOURS_BY_CATEGORY"
            )

    def test_time_sensitive_categories_use_short_stale_window(self):
        """Regression guard: current-day / alert categories must not inherit
        the long enrichment window."""
        from src.config.constants import QUEUE_STALE_HOURS_BY_CATEGORY
        assert QUEUE_STALE_HOURS_BY_CATEGORY["history"] <= 24
        for cat in ("weather", "safety", "air_quality", "earthquake"):
            assert QUEUE_STALE_HOURS_BY_CATEGORY[cat] <= 48

    def test_enrichment_categories_have_long_stale_window(self):
        """Sports + community_resource need the long window to avoid starving."""
        from src.config.constants import QUEUE_STALE_HOURS_BY_CATEGORY
        for cat in ("sports", "community_resource"):
            assert QUEUE_STALE_HOURS_BY_CATEGORY[cat] >= 96

    def test_legacy_regions_have_required_keys(self):
        """Legacy REGIONS dict is still available for backward compat."""
        assert isinstance(REGIONS, dict)
        assert "clark_county" in REGIONS
        assert "portland_metro" in REGIONS
        for region in REGIONS.values():
            assert "lat" in region
            assert "lng" in region
            assert "radius_meters" in region
            assert "timezone" in region

    def test_scalar_constants_types(self):
        assert isinstance(MAX_HUMANIZED_LENGTH, int)
        assert isinstance(MAX_JITTER_MINUTES, int)
        assert isinstance(QUEUE_STALE_HOURS, int)
        assert isinstance(MAX_SEASONAL_POSTS_PER_WEEK, int)
        assert isinstance(BLOCKLIST_TERMS, list)
        assert isinstance(QUEUE_PURGE_DAYS, dict)
        assert isinstance(FRESHNESS_HOURS, dict)


# ---------------------------------------------------------------------------
# Sources config (legacy hardcoded)
# ---------------------------------------------------------------------------


class TestSourcesConfig:
    def test_clark_county_sources(self):
        sources = get_sources_for_region("clark_county")
        assert isinstance(sources, list)
        assert len(sources) > 0
        for src in sources:
            assert "source_id" in src
            assert "source_type" in src

    def test_portland_metro_sources(self):
        sources = get_sources_for_region("portland_metro")
        assert isinstance(sources, list)
        assert len(sources) > 0
        for src in sources:
            assert "source_id" in src
            assert "source_type" in src

    def test_unknown_region_returns_empty_list(self):
        sources = get_sources_for_region("narnia")
        assert sources == []

    def test_returns_copy_not_reference(self):
        a = get_sources_for_region("clark_county")
        b = get_sources_for_region("clark_county")
        assert a is not b


# ---------------------------------------------------------------------------
# QueueItem model
# ---------------------------------------------------------------------------


class TestQueueItem:
    def test_valid_queue_item(self):
        item = QueueItem(
            source="rss:columbian",
            raw_title="New park opens in Vancouver",
            region="clark_county",
            category="local_news",
            dedup_hash="abc123",
        )
        assert item.status == "queued"
        assert item.source == "rss:columbian"

    def test_rejects_invalid_status(self):
        with pytest.raises(ValidationError, match="Invalid status"):
            QueueItem(
                source="rss:columbian",
                raw_title="Title",
                region="clark_county",
                category="local_news",
                dedup_hash="abc123",
                status="bogus",
            )

    def test_rejects_empty_region(self):
        with pytest.raises(ValidationError, match="Region must not be empty"):
            QueueItem(
                source="rss:columbian",
                raw_title="Title",
                region="",
                category="local_news",
                dedup_hash="abc123",
            )

    def test_accepts_dynamic_region(self):
        """Dynamic regions (not in the old hardcoded list) are now accepted."""
        item = QueueItem(
            source="google_news:seattle_metro",
            raw_title="Seattle news",
            region="seattle_metro",
            category="local_news",
            dedup_hash="abc123",
        )
        assert item.region == "seattle_metro"

    def test_rejects_invalid_category(self):
        with pytest.raises(ValidationError, match="Invalid category"):
            QueueItem(
                source="rss:columbian",
                raw_title="Title",
                region="clark_county",
                category="astrology",
                dedup_hash="abc123",
            )

    def test_all_valid_statuses_accepted(self):
        from src.models.queue_item import VALID_STATUSES

        for status in VALID_STATUSES:
            item = QueueItem(
                source="test",
                raw_title="Title",
                region="clark_county",
                category="local_news",
                dedup_hash="hash",
                status=status,
            )
            assert item.status == status

    def test_optional_fields_default_none(self):
        item = QueueItem(
            source="test",
            raw_title="Title",
            region="clark_county",
            category="local_news",
            dedup_hash="hash",
        )
        assert item.id is None
        assert item.source_url is None
        assert item.raw_body is None
        assert item.humanized_text is None
        assert item.post_id is None
        assert item.parent_id is None
        assert item.failure_reason is None


# ---------------------------------------------------------------------------
# RawContentItem model
# ---------------------------------------------------------------------------


class TestRawContentItem:
    def test_minimal_fields(self):
        item = RawContentItem(
            title="Cherry blossoms blooming",
            category="seasonal",
            source_id="seasonal:pnw",
            region="portland_metro",
        )
        assert item.title == "Cherry blossoms blooming"
        assert item.body is None
        assert item.source_url is None

    def test_all_fields(self):
        item = RawContentItem(
            title="Title",
            body="Body text",
            source_url="https://example.com",
            category="local_news",
            published_at=datetime(2026, 4, 1),
            source_id="rss:test",
            region="clark_county",
        )
        assert item.body == "Body text"
        assert item.published_at is not None

    def test_accepts_dynamic_region(self):
        item = RawContentItem(
            title="Seattle event",
            category="event",
            source_id="google_news:seattle",
            region="seattle_metro",
        )
        assert item.region == "seattle_metro"


# ---------------------------------------------------------------------------
# TaperingMetrics model
# ---------------------------------------------------------------------------


class TestTaperingMetrics:
    def test_valid_metrics(self):
        m = TaperingMetrics(avg_daily_posts=2.5, active_posters=8, stage="reduced")
        assert m.avg_daily_posts == 2.5
        assert m.active_posters == 8
        assert m.stage == "reduced"

    def test_rejects_invalid_stage(self):
        with pytest.raises(ValidationError):
            TaperingMetrics(avg_daily_posts=1.0, active_posters=3, stage="turbo")


# ---------------------------------------------------------------------------
# SeederSecrets model
# ---------------------------------------------------------------------------


class TestSeederSecrets:
    def test_validates_all_required_fields(self):
        secrets = SeederSecrets(
            supabase_url="https://example.supabase.co",
            supabase_service_role_key="key123",
            pantopus_api_base_url="https://api.pantopus.com",
            curator_email="curator@pantopus.com",
            curator_password="password",
            openai_api_key="sk-xxx",
        )
        assert secrets.supabase_url == "https://example.supabase.co"

    def test_strips_whitespace_from_required_string_fields(self):
        secrets = SeederSecrets(
            supabase_url=" https://example.supabase.co ",
            supabase_service_role_key=" key123 ",
            pantopus_api_base_url=" https://api.pantopus.com ",
            curator_email=" curator@pantopus.com ",
            curator_password=" password ",
            openai_api_key=" sk-xxx ",
        )
        assert secrets.supabase_url == "https://example.supabase.co"
        assert secrets.supabase_service_role_key == "key123"
        assert secrets.pantopus_api_base_url == "https://api.pantopus.com"
        assert secrets.curator_email == "curator@pantopus.com"
        assert secrets.curator_password == "password"
        assert secrets.openai_api_key == "sk-xxx"

    def test_rejects_missing_fields(self):
        with pytest.raises(ValidationError):
            SeederSecrets(
                supabase_url="https://example.supabase.co",
                # missing other required fields
            )

    def test_rejects_empty_string_fields(self):
        with pytest.raises(ValidationError):
            SeederSecrets(
                supabase_url="",
                supabase_service_role_key="key123",
                pantopus_api_base_url="https://api.pantopus.com",
                curator_email="curator@pantopus.com",
                curator_password="password",
                openai_api_key="sk-xxx",
            )

    def test_rejects_invalid_supabase_url(self):
        with pytest.raises(ValidationError, match="supabase_url"):
            SeederSecrets(
                supabase_url="example.supabase.co",
                supabase_service_role_key="key123",
                pantopus_api_base_url="https://api.pantopus.com",
                curator_email="curator@pantopus.com",
                curator_password="password",
                openai_api_key="sk-xxx",
            )


class TestBriefingSecrets:
    def test_rejects_invalid_supabase_url(self):
        with pytest.raises(ValidationError, match="supabase_url"):
            BriefingSecrets(
                supabase_url="project.supabase.co",
                supabase_service_role_key="key123",
                pantopus_api_base_url="https://api.pantopus.com",
                internal_api_key="internal-key",
            )

    def test_get_briefing_secrets_reports_invalid_env_source(self, monkeypatch):
        monkeypatch.delenv("SECRET_NAME", raising=False)
        monkeypatch.setenv("SUPABASE_URL", "project.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
        monkeypatch.setenv("PANTOPUS_API_BASE_URL", "https://api.pantopus.com")
        monkeypatch.setenv("INTERNAL_API_KEY", "internal-key")
        clear_briefing_cache()

        with pytest.raises(RuntimeError, match="Invalid briefing secrets from environment variables"):
            get_briefing_secrets()

        clear_briefing_cache()
