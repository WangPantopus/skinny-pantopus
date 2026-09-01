"""Tests for pipeline: relevance filter and deduplication."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from src.models.queue_item import RawContentItem
from src.pipeline.dedup import compute_dedup_hash, is_duplicate
from src.pipeline.relevance_filter import filter_item


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _item(**overrides) -> RawContentItem:
    base = {
        "title": "New community garden opens in Vancouver",
        "body": "The city announced a new community garden project.",
        "source_url": "https://example.com/article/123",
        "category": "local_news",
        "source_id": "rss:columbian",
        "region": "clark_county",
        "published_at": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    base.update(overrides)
    return RawContentItem(**base)


# ===========================================================================
# Relevance Filter Tests
# ===========================================================================

class TestRelevanceFilterPass:
    def test_clean_item_passes(self):
        passed, reason = filter_item(_item())
        assert passed is True
        assert reason is None

    def test_clark_county_wa_rejects_other_state_clark_county(self):
        passed, reason = filter_item(_item(
            source_id="google_news:clark_county",
            title="Sheriff race heats up in Clark County, Kentucky",
        ))
        assert passed is False
        assert reason is not None and reason.startswith("geo:other_clark_county")

    def test_clark_county_wa_rejects_las_vegas_context_without_wa_anchor(self):
        passed, reason = filter_item(_item(
            source_id="google_news:clark_county",
            title="Clark County approves new Las Vegas arena funding plan",
        ))
        assert passed is False
        assert reason == "geo:other_clark_county:las_vegas"

    def test_clark_county_wa_rejects_vegas_even_with_stray_washington_word(self):
        # A stray "Washington" (e.g. "The Washington Post") must not unlock a Las Vegas story.
        passed, reason = filter_item(_item(
            source_id="google_news:clark_county",
            title="Clark County approves new Las Vegas arena funding plan",
            body="Related coverage from The Washington Post.",
        ))
        assert passed is False
        assert reason == "geo:other_clark_county:las_vegas"

    def test_clark_county_wa_keeps_wa_anchored_las_vegas_story(self):
        passed, reason = filter_item(_item(
            source_id="google_news:clark_county",
            title="Las Vegas firm expands office to Clark County, Washington",
        ))
        assert passed is True
        assert reason is None

    def test_clark_county_wa_rejects_wi_abbreviation(self):
        passed, reason = filter_item(_item(
            source_id="google_news:clark_county",
            title="Clark County, WI board approves highway repairs",
        ))
        assert passed is False
        assert reason is not None and reason.startswith("geo:other_clark_county")

    def test_clark_county_wa_rejects_in_abbreviation(self):
        passed, reason = filter_item(_item(
            source_id="google_news:clark_county",
            title="Clark County, IN officials announce new school plan",
        ))
        assert passed is False
        assert reason is not None and reason.startswith("geo:other_clark_county")

    def test_clark_county_wa_strong_non_wa_abbr_beats_wa_anchor(self):
        # Even when a WA anchor appears incidentally, an explicit "Clark County, WI"
        # is an authoritative jurisdictional label and must reject.
        passed, reason = filter_item(_item(
            source_id="google_news:clark_county",
            title="Clark County, WI board approves highway repairs affecting Vancouver, WA travelers",
        ))
        assert passed is False
        assert reason == "geo:other_clark_county:abbrev"

    def test_clark_county_wa_strong_non_wa_phrase_beats_wa_anchor(self):
        passed, reason = filter_item(_item(
            source_id="google_news:clark_county",
            title="Clark County, Wisconsin board approves highway repairs near Vancouver, WA",
        ))
        assert passed is False
        assert reason is not None and reason.startswith("geo:other_clark_county:clark_county")

    def test_clark_county_wa_rejects_ambiguous_clark_county_headline(self):
        # No state, no SW WA town, no trusted source → must be rejected.
        passed, reason = filter_item(_item(
            source_id="google_news:clark_county",
            title="Clark County council approves new zoning ordinance",
        ))
        assert passed is False
        assert reason == "geo:clark_county_wa_anchor_missing"

    def test_clark_county_wa_allows_town_anchor(self):
        passed, reason = filter_item(_item(
            source_id="google_news:clark_county",
            title="Clark County council approves new zoning ordinance",
            body="The item heads to Battle Ground next week.",
        ))
        assert passed is True
        assert reason is None

    def test_clark_county_wa_trusts_columbian_rss(self):
        # Columbian is WA-local — allowed even if text omits the state.
        passed, reason = filter_item(_item(
            source_id="rss:columbian",
            title="Clark County council approves new zoning ordinance",
        ))
        assert passed is True
        assert reason is None

    def test_clark_county_wa_ignores_english_word_in_mo(self):
        # Lower-case "in" / "mo" must not be misread as state abbreviations.
        passed, reason = filter_item(_item(
            source_id="google_news:clark_county",
            title="Clark County, in the Vancouver, WA area, sees growth",
        ))
        assert passed is True
        assert reason is None

    def test_portland_metro_not_subject_to_clark_county_geo_gate(self):
        passed, reason = filter_item(_item(
            region="portland_metro",
            source_id="google_news:clark_county",
            title="Column: What Clark County, Kentucky can teach Oregon about bridges",
        ))
        assert passed is True
        assert reason is None

    def test_item_with_no_published_at_passes(self):
        passed, reason = filter_item(_item(published_at=None))
        assert passed is True
        assert reason is None

    def test_normal_mixed_case_title_passes(self):
        passed, reason = filter_item(_item(title="Vancouver Parks and Rec Update"))
        assert passed is True


class TestBlocklist:
    def test_blocklist_term_in_title(self):
        passed, reason = filter_item(_item(title="Man arrested for robbery downtown"))
        assert passed is False
        assert reason is not None
        assert reason.startswith("blocklist:")

    def test_blocklist_term_in_body_not_title(self):
        passed, reason = filter_item(_item(
            title="Downtown incident report released",
            body="Police say the suspect was arrested after a brief chase.",
        ))
        assert passed is False
        assert "blocklist:" in reason

    def test_blocklist_case_insensitive(self):
        passed, reason = filter_item(_item(title="SHOOTING reported near park"))
        assert passed is False
        assert "blocklist:shooting" in reason

    def test_politics_blocklist(self):
        passed, reason = filter_item(_item(title="Democrat wins local election by large margin"))
        assert passed is False
        assert "blocklist:" in reason

    def test_paywall_blocklist(self):
        passed, reason = filter_item(_item(title="Big story — subscribe to read the full article"))
        assert passed is False
        assert "blocklist:" in reason

    def test_obituary_blocklist(self):
        passed, reason = filter_item(_item(title="Longtime resident John Smith passed away at 85"))
        assert passed is False
        assert "blocklist:" in reason

    def test_word_boundary_no_false_positive(self):
        """Blocklist uses word boundaries: 'arrested' shouldn't match inside 'arrestedly'."""
        passed, reason = filter_item(_item(
            title="Charleston restaurants shine this spring",
            body="Charleston is charming in April.",
        ))
        # 'charged' should not match inside 'Charleston' / 'charming'
        assert passed is True
        assert reason is None

    def test_sports_shooting_percentage_passes(self):
        """Sports coverage often mentions 'shooting' (percentage/guard) — must not be blocked."""
        passed, reason = filter_item(_item(
            category="sports",
            title="Trail Blazers improve shooting percentage in second half",
            body="The team's shooting guard led scoring with a career high.",
        ))
        assert passed is True
        assert reason is None

    def test_sports_campaign_passes(self):
        """'Campaign' is normal sports vocabulary ('championship campaign')."""
        passed, reason = filter_item(_item(
            category="sports",
            title="Timbers look back on a memorable campaign",
            body="The squad reflects on their championship campaign.",
        ))
        assert passed is True
        assert reason is None

    def test_sports_still_blocks_real_crime(self):
        """Crime terms unrelated to sports vocabulary still block sports items."""
        passed, reason = filter_item(_item(
            category="sports",
            title="Player indicted on federal tax charges",
            body="Authorities announced the indictment on Monday.",
        ))
        assert passed is False
        assert reason is not None and reason.startswith("blocklist:")

    def test_sports_blocks_non_allowlisted_crime(self):
        """A crime term not in the sports allowlist still blocks sports items."""
        # "homicide" is a crime term with no innocuous sports meaning.
        passed, reason = filter_item(_item(
            category="sports",
            title="Former player linked to homicide investigation",
            body="Team officials declined to comment on the ongoing case.",
        ))
        assert passed is False
        assert reason == "blocklist:homicide"

    def test_sports_robbed_idiom_passes(self):
        """'Robbed of victory' is a common sports idiom, not a crime report."""
        passed, reason = filter_item(_item(
            category="sports",
            title="Timbers robbed of victory by late penalty call",
            body="The squad felt robbed after a controversial stoppage-time call.",
        ))
        assert passed is True
        assert reason is None

    def test_non_sports_robbed_still_blocks(self):
        """'Robbed' remains a blocklist term for non-sports coverage."""
        passed, reason = filter_item(_item(
            category="local_news",
            title="Downtown store robbed overnight",
            body="Police are reviewing surveillance footage.",
        ))
        assert passed is False
        assert reason == "blocklist:robbed"


class TestPolicyAdvocacyFilter:
    def test_reproductive_policy_rally_rejected(self):
        passed, reason = filter_item(_item(
            title="Abortion rights rally planned outside county courthouse",
            body="Activists and opponents are expected to gather during the policy hearing.",
        ))
        assert passed is False
        assert reason == "policy:reproductive_policy"

    def test_reproductive_policy_update_rejected_without_advocacy_signal(self):
        passed, reason = filter_item(_item(
            title="County posts abortion clinic access update",
            body="Officials shared new information about the downtown facility schedule.",
        ))
        assert passed is False
        assert reason == "policy:reproductive_policy"

    def test_immigration_enforcement_protest_rejected(self):
        passed, reason = filter_item(_item(
            title="Protest against ICE deportations planned downtown",
            body="Advocates say the march will focus on federal immigration enforcement.",
        ))
        assert passed is False
        assert reason == "policy:immigration_enforcement"

    def test_border_security_update_rejected_without_advocacy_signal(self):
        passed, reason = filter_item(_item(
            title="Border security policy update draws local attention",
            body="Officials described the federal enforcement change during a briefing.",
        ))
        assert passed is False
        assert reason == "policy:immigration_enforcement"

    def test_lgbtq_policy_lawsuit_rejected(self):
        passed, reason = filter_item(_item(
            title="LGBTQ policy lawsuit draws supporters and critics",
            body="The court case challenges a new school board resolution.",
        ))
        assert passed is False
        assert reason == "policy:lgbtq_policy_advocacy"

    def test_neutral_pride_street_closure_can_pass(self):
        passed, reason = filter_item(_item(
            title="Pride festival street closures announced for Saturday",
            body="The city posted downtown bus detours and parking information for the event.",
        ))
        assert passed is True
        assert reason is None

    def test_neutral_gay_community_event_can_pass(self):
        passed, reason = filter_item(_item(
            title="Gay men's chorus announces park concert",
            body="The free neighborhood performance starts at 6 p.m. near Esther Short Park.",
        ))
        assert passed is True
        assert reason is None

    def test_neutral_immigration_service_update_can_pass(self):
        passed, reason = filter_item(_item(
            title="County office updates immigration document hours",
            body="Residents can use the new appointment window for translation and records help.",
        ))
        assert passed is True
        assert reason is None

    def test_ice_weather_context_can_pass(self):
        passed, reason = filter_item(_item(
            category="weather",
            title="Ice expected on Gorge roads Friday morning",
            body="Transportation crews warned drivers to slow down on bridges and shaded routes.",
        ))
        assert passed is True
        assert reason is None


class TestFreshness:
    def test_stale_local_news_rejected(self):
        old = datetime.now(timezone.utc) - timedelta(hours=100)
        passed, reason = filter_item(_item(published_at=old, category="local_news"))
        assert passed is False
        assert reason.startswith("stale:")

    def test_stale_event_rejected(self):
        old = datetime.now(timezone.utc) - timedelta(hours=100)
        passed, reason = filter_item(_item(published_at=old, category="event"))
        assert passed is False
        assert reason.startswith("stale:")

    def test_event_within_72h_passes(self):
        recent = datetime.now(timezone.utc) - timedelta(hours=50)
        passed, reason = filter_item(_item(published_at=recent, category="event"))
        assert passed is True

    def test_no_published_at_passes_freshness(self):
        passed, reason = filter_item(_item(published_at=None))
        assert passed is True


class TestContentQuality:
    def test_short_title_rejected(self):
        passed, reason = filter_item(_item(title="Hey"))
        assert passed is False
        assert reason == "quality:title_too_short"

    def test_all_caps_title_rejected(self):
        passed, reason = filter_item(_item(title="BREAKING NEWS FROM DOWNTOWN VANCOUVER"))
        assert passed is False
        assert reason == "quality:all_caps_title"

    def test_all_caps_non_alpha_passes(self):
        """Strings with no case distinction (e.g. all numbers) should pass."""
        passed, reason = filter_item(_item(title="2026-04-04 12:00:00"))
        assert passed is True

    def test_mixed_case_title_passes(self):
        passed, reason = filter_item(_item(title="Vancouver City Council Meets Tuesday"))
        assert passed is True

    def test_sports_betting_headline_rejected(self):
        passed, reason = filter_item(_item(
            category="sports",
            title="Trail Blazers best bets and player props for tonight",
            body="Latest odds, player props and betting preview.",
        ))
        assert passed is False
        assert reason == "quality:sports_low_signal"

    def test_asset_url_title_rejected(self):
        passed, reason = filter_item(_item(
            category="sports",
            title=(
                "https://statics.foxsports.com/mediacloud/fmc-zjr6xy7aom8u5of1/"
                "clip_processed.smptett - statics.foxsports.com"
            ),
            body="Automated media asset entry from the feed.",
        ))
        assert passed is False
        assert reason == "quality:asset_title"

    def test_static_asset_domain_title_rejected(self):
        passed, reason = filter_item(_item(
            category="sports",
            title="- statics.foxsports.com",
            body="Automated media asset entry from the feed.",
        ))
        assert passed is False
        assert reason == "quality:asset_title"

    def test_regular_sports_update_passes(self):
        passed, reason = filter_item(_item(
            category="sports",
            title="Portland Thorns announce matchday transit partnership",
            body="TriMet rides are included with digital tickets for the home opener.",
        ))
        assert passed is True
        assert reason is None


# ===========================================================================
# Dedup Hash Tests
# ===========================================================================

class TestComputeDedupHash:
    def test_same_inputs_same_hash(self):
        a = _item()
        b = _item()
        assert compute_dedup_hash(a) == compute_dedup_hash(b)

    def test_different_url_different_hash(self):
        a = _item(source_url="https://example.com/1")
        b = _item(source_url="https://example.com/2")
        assert compute_dedup_hash(a) != compute_dedup_hash(b)

    def test_same_url_different_date_different_hash(self):
        a = _item(published_at=datetime(2026, 4, 1, tzinfo=timezone.utc))
        b = _item(published_at=datetime(2026, 4, 2, tzinfo=timezone.utc))
        assert compute_dedup_hash(a) != compute_dedup_hash(b)

    def test_no_url_uses_title(self):
        a = _item(source_url=None, title="Unique title A")
        b = _item(source_url=None, title="Unique title B")
        assert compute_dedup_hash(a) != compute_dedup_hash(b)

    def test_no_url_same_title_same_hash(self):
        a = _item(source_url=None, title="Same title here")
        b = _item(source_url=None, title="Same title here")
        assert compute_dedup_hash(a) == compute_dedup_hash(b)

    def test_hash_is_hex_string(self):
        h = compute_dedup_hash(_item())
        assert isinstance(h, str)
        assert len(h) == 64  # SHA-256 hex digest


# ===========================================================================
# is_duplicate Tests
# ===========================================================================

class TestIsDuplicate:
    def _mock_client(self, data=None, error=False):
        client = MagicMock()
        table = client.table.return_value
        select = table.select.return_value
        eq = select.eq.return_value
        filtered = eq.filter.return_value
        limit = filtered.limit.return_value

        if error:
            limit.execute.side_effect = Exception("DB error")
        else:
            result = MagicMock()
            result.data = data or []
            limit.execute.return_value = result

        return client

    def test_returns_true_when_hash_exists(self):
        client = self._mock_client(data=[{"id": "some-uuid"}])
        assert is_duplicate("abc123", client) is True

    def test_returns_false_when_hash_not_found(self):
        client = self._mock_client(data=[])
        assert is_duplicate("abc123", client) is False

    def test_returns_false_on_error(self):
        client = self._mock_client(error=True)
        assert is_duplicate("abc123", client) is False
