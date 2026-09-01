"""Keyword/category-based relevance filtering for fetched content items."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from functools import lru_cache

from src.config.constants import BLOCKLIST_TERMS, FRESHNESS_HOURS
from src.models.queue_item import RawContentItem

log = logging.getLogger("seeder.pipeline.relevance_filter")

_LOW_SIGNAL_SPORTS_PATTERNS = (
    "best bets",
    "betting",
    "moneyline",
    "player props",
    "point spread",
    "spread pick",
    "fantasy",
    "game thread",
    "open thread",
    "live discussion",
)

_ASSET_TITLE_PATTERNS = (
    "statics.foxsports.com",
    "mediacloud/",
)

_URL_TITLE_RE = re.compile(r"^https?://", re.IGNORECASE)

_REPRODUCTIVE_POLICY_TERMS = (
    "abortion",
    "reproductive rights",
    "roe v. wade",
    "planned parenthood",
)

_IMMIGRATION_ENFORCEMENT_TERMS = (
    "border security",
    "border patrol",
    "deportation",
    "deportations",
    "immigration enforcement",
    "migrant detention",
)

_IMMIGRATION_POLICY_CONTEXT = (
    "immigration",
    "migrant",
    "migrants",
    "asylum",
    "border",
    "detention",
    "enforcement",
    "raid",
    "raids",
    "sanctuary",
)

_LGBTQ_POLICY_TERMS = (
    "lgbtq",
    "gay",
    "lesbian",
    "bisexual",
    "queer",
    "transgender",
    "gender-affirming",
    "drag queen",
    "pride flag",
)

_POLICY_ADVOCACY_SIGNALS = (
    "activist",
    "activists",
    "advocacy",
    "advocate",
    "advocates",
    "bill",
    "campaign",
    "court",
    "critics",
    "debate",
    "injunction",
    "lawsuit",
    "legislation",
    "lobby",
    "march",
    "opponents",
    "policy",
    "protest",
    "rally",
    "resolution",
    "rights",
    "sanctuary",
    "supporters",
)

# Sports coverage uses ordinary English that overlaps with crime/politics terms
# ("shooting percentage", "charged up", "championship campaign"). Skip these
# ambiguous blocklist terms when evaluating a sports item so legit coverage
# isn't silently dropped.
_SPORTS_BLOCKLIST_ALLOWLIST = frozenset({
    "shooting", "shootings",
    "charged", "charges",
    "campaign",
    "assault", "assaulted",
    "sentenced",
    "robbed",  # "robbed of victory" is a common sports idiom
})

# -----------------------------------------------------------------------------
# Clark County, WA geo gate
# -----------------------------------------------------------------------------
# Google News queries for "Clark County" can surface stories about Clark County
# in NV, KY, OH, IN, MO, WI, IL, KS, SD, AR, ID. The gate is POSITIVE: when an
# item in the clark_county region mentions "Clark County", it must have at least
# one unambiguous Southwest Washington anchor. Items with no Clark County
# mention at all are left alone (other filters apply normally).
#
# Trusted sources (Washington-local publishers / coordinate- or calendar-based
# sources) bypass the gate entirely.

_WA_LOCAL_SOURCE_IDS: frozenset[str] = frozenset({
    "rss:columbian",
    "rss:camas_washougal",
    "rss:clark_county_gov",
    "rss:city_vancouver",
    "rss:reddit_vancouverwa",
    "on_this_day:clark_county",
})

_WA_LOCAL_SOURCE_PREFIXES: tuple[str, ...] = (
    "seasonal:",
    "nws_alerts:",
    "usgs_earthquakes:",
    "air_quality:",
)

# Substring-match Washington anchors (lower-cased text). Each entry must be
# unambiguous enough that a false positive is very unlikely in practice.
_WA_CLARK_COUNTY_ANCHORS: tuple[str, ...] = (
    "clark county, wa",
    "clark county, washington",
    "clark county washington",
    "clark.wa.gov",
)

_WA_REGION_ANCHORS: tuple[str, ...] = (
    "vancouver, wa",
    "vancouver, washington",
    "vancouver washington",
    "southwest washington",
    "sw washington",
    "camas",
    "washougal",
    "battle ground",
    "ridgefield",
    "yacolt",
    "la center",
    "brush prairie",
    "hazel dell",
    "salmon creek",
    "the columbian",
    "columbian.com",
    "camaspostrecord",
    "cityofvancouver.us",
)

# Strong non-WA attributions: "Clark County, <state>" forms. These are
# authoritative jurisdictional labels and must override any WA anchor so that a
# story about Clark County, WI is not rescued by an incidental "Vancouver, WA"
# in the body.
_STRONG_NON_WA_CLARK_COUNTY_PHRASES: tuple[str, ...] = (
    "clark county, nevada",
    "clark county nevada",
    "clark county, kentucky",
    "clark county kentucky",
    "clark county, ohio",
    "clark county ohio",
    "clark county, indiana",
    "clark county indiana",
    "clark county, missouri",
    "clark county missouri",
    "clark county, wisconsin",
    "clark county wisconsin",
    "clark county, illinois",
    "clark county illinois",
    "clark county, kansas",
    "clark county kansas",
    "clark county, south dakota",
    "clark county south dakota",
    "clark county, arkansas",
    "clark county arkansas",
    "clark county, idaho",
    "clark county idaho",
)

# Contextual (weaker) non-WA cues: metros, county seats, and neighbor cities.
# These reject only when no WA anchor is present, so a Washington story that
# happens to mention a Las Vegas company is not overblocked.
_CONTEXTUAL_NON_WA_PHRASES: tuple[str, ...] = (
    "las vegas",
    "north las vegas",
    "southern nevada",
    "henderson, nv",
    "henderson, nevada",
    "winchester, ky",
    "winchester, kentucky",
    "springfield, oh",
    "springfield, ohio",
    "jeffersonville, in",
    "jeffersonville, indiana",
    "neillsville, wi",
    "neillsville, wisconsin",
)

# AP-style "Clark County, NV" / "Clark County, WI" — require the two-letter
# abbreviation to be UPPER-case in the original text so English words like
# "in" or "mo" do not match.
_CLARK_COUNTY_ABBR_RE = re.compile(
    r"Clark\s+County,\s*([A-Za-z]{2})\b",
    re.IGNORECASE,
)
_NON_WA_STATE_ABBRS: frozenset[str] = frozenset({
    "NV", "KY", "OH", "IN", "MO", "WI", "IL", "KS", "SD", "AR", "ID",
})


def _is_wa_trusted_source(source_id: str) -> bool:
    if source_id in _WA_LOCAL_SOURCE_IDS:
        return True
    return any(source_id.startswith(p) for p in _WA_LOCAL_SOURCE_PREFIXES)


def _has_non_wa_state_abbr(text_original: str) -> bool:
    """Detect `Clark County, XX` where XX is a non-WA state abbreviation in caps."""
    for match in _CLARK_COUNTY_ABBR_RE.finditer(text_original):
        abbr = match.group(1)
        if abbr == abbr.upper() and abbr.upper() in _NON_WA_STATE_ABBRS:
            return True
    return False


def _clark_county_geo_check(item: RawContentItem) -> str | None:
    """Enforce positive Washington anchors on Clark County region items.

    Order of precedence (strongest signal wins):
      1. Trusted WA-local sources bypass the gate.
      2. No "Clark County" mention → not gated.
      3. Strong non-WA attribution ("Clark County, <state>" / AP abbreviation) → reject.
      4. Strong WA attribution ("Clark County, WA/Washington" / clark.wa.gov) → allow.
      5. WA region anchor (SW Washington town, known WA publisher) → allow.
      6. Contextual non-WA cue (Las Vegas / Henderson / etc.) → reject.
      7. No anchor at all → reject as ambiguous.
    """
    if _is_wa_trusted_source(item.source_id):
        return None

    title_orig = item.title or ""
    body_orig = item.body or ""
    text_orig = f"{title_orig}\n{body_orig}"
    text_lower = text_orig.lower()

    if "clark county" not in text_lower:
        return None

    for phrase in _STRONG_NON_WA_CLARK_COUNTY_PHRASES:
        if phrase in text_lower:
            slug = phrase.replace(" ", "_").replace(",", "")
            return f"geo:other_clark_county:{slug}"
    if _has_non_wa_state_abbr(text_orig):
        return "geo:other_clark_county:abbrev"

    for anchor in _WA_CLARK_COUNTY_ANCHORS:
        if anchor in text_lower:
            return None
    for anchor in _WA_REGION_ANCHORS:
        if anchor in text_lower:
            return None

    for phrase in _CONTEXTUAL_NON_WA_PHRASES:
        if phrase in text_lower:
            slug = phrase.replace(" ", "_").replace(",", "")
            return f"geo:other_clark_county:{slug}"

    return "geo:clark_county_wa_anchor_missing"


@lru_cache(maxsize=None)
def _term_pattern(term: str) -> re.Pattern[str]:
    return re.compile(rf"(?<!\w){re.escape(term.lower())}(?!\w)", re.IGNORECASE)


def _has_term(text_lower: str, terms: tuple[str, ...]) -> bool:
    return any(_term_pattern(term).search(text_lower) for term in terms)


def _polarizing_policy_check(text_lower: str) -> str | None:
    """Reject issue-advocacy/policy-fight items without taking a side.

    Pulse seeding should favor practical local utility over national
    culture-war fights. Reproductive-policy and immigration-enforcement items
    are excluded broadly because they are usually national policy fights in
    local-news clothing. LGBTQ identity terms are excluded only when paired with
    advocacy, litigation, campaign, protest, or policy framing; neutral service
    updates and ordinary local events can still pass other relevance checks.
    """
    if _has_term(text_lower, _REPRODUCTIVE_POLICY_TERMS):
        return "policy:reproductive_policy"

    has_immigration_enforcement = _has_term(text_lower, _IMMIGRATION_ENFORCEMENT_TERMS)
    mentions_ice = _term_pattern("ice").search(text_lower) is not None
    has_ice_policy_context = mentions_ice and _has_term(text_lower, _IMMIGRATION_POLICY_CONTEXT)
    if has_immigration_enforcement or has_ice_policy_context:
        return "policy:immigration_enforcement"

    if _has_term(text_lower, _LGBTQ_POLICY_TERMS) and _has_term(text_lower, _POLICY_ADVOCACY_SIGNALS):
        return "policy:lgbtq_policy_advocacy"

    return None


@lru_cache(maxsize=None)
def _blocklist_pattern(term: str) -> re.Pattern[str]:
    """Compile a word-boundary regex for a blocklist term.

    Multi-word phrases are matched as a whole ("subscribe to read"); single
    words use \\b boundaries so "shooting" won't match "shooting percentage"
    being part of the term but WILL match the standalone word.
    """
    return re.compile(rf"(?<!\w){re.escape(term.lower())}(?!\w)", re.IGNORECASE)


def filter_item(item: RawContentItem) -> tuple[bool, str | None]:
    """Check if a content item passes relevance filtering.

    Returns (True, None) if the item passes all checks.
    Returns (False, reason_string) if the item fails any check.
    """
    # Pass 1 — Content blocklist (word-boundary match to avoid false positives
    # like "shooting percentage" for basketball coverage).
    title_text = item.title.lower()
    body_text = (item.body or "").lower()

    for term in BLOCKLIST_TERMS:
        # Skip ambiguous terms for sports coverage where they have innocuous
        # secondary meanings in sports writing.
        if item.category == "sports" and term.lower() in _SPORTS_BLOCKLIST_ALLOWLIST:
            continue
        pattern = _blocklist_pattern(term)
        if pattern.search(title_text) or pattern.search(body_text):
            log.debug("Rejected (blocklist:%s): %s", term, item.title)
            return False, f"blocklist:{term}"

    text_to_check = title_text
    if body_text:
        text_to_check += " " + body_text

    policy_reason = _polarizing_policy_check(text_to_check)
    if policy_reason is not None:
        log.debug("Rejected (%s): %s", policy_reason, item.title)
        return False, policy_reason

    # Pass 1b — Clark County, WA region: require a positive SW Washington anchor
    # whenever an item mentions "Clark County", so ambiguous or non-WA stories
    # (Clark County NV/KY/OH/IN/MO/WI/IL/KS/SD/AR/ID) never reach the queue.
    if item.region == "clark_county":
        wrong_geo = _clark_county_geo_check(item)
        if wrong_geo is not None:
            log.debug("Rejected (%s): %s", wrong_geo, item.title)
            return False, wrong_geo

    # Pass 2 — Freshness
    if item.published_at is not None:
        now = datetime.now(timezone.utc)
        pub = item.published_at if item.published_at.tzinfo else item.published_at.replace(tzinfo=timezone.utc)
        age_hours = (now - pub).total_seconds() / 3600
        limit = FRESHNESS_HOURS.get(item.category, FRESHNESS_HOURS["default"])
        if age_hours > limit:
            log.debug("Rejected (stale:%.0fh): %s", age_hours, item.title)
            return False, f"stale:{int(age_hours)}h"

    # Pass 3 — Minimum content quality
    if len(item.title) < 10:
        log.debug("Rejected (quality:title_too_short): %s", item.title)
        return False, "quality:title_too_short"

    if item.title == item.title.upper() and item.title != item.title.lower():
        log.debug("Rejected (quality:all_caps_title): %s", item.title)
        return False, "quality:all_caps_title"

    if item.body is not None:
        combined_len = len(item.title) + len(item.body)
        if combined_len < 20:
            log.debug("Rejected (quality:content_too_short): %s", item.title)
            return False, "quality:content_too_short"

    # Pass 4 — Reject generic/listing content
    title_lower = item.title.lower()
    generic_patterns = [
        "tv listings", "tv schedule", "scores are available",
        "standings, fixtures", "full highlights |",
    ]
    for pat in generic_patterns:
        if pat in title_lower:
            log.debug("Rejected (quality:generic_listing): %s", item.title)
            return False, "quality:generic_listing"

    if _URL_TITLE_RE.match(item.title.strip()) or any(
        pat in title_lower for pat in _ASSET_TITLE_PATTERNS
    ):
        log.debug("Rejected (quality:asset_title): %s", item.title)
        return False, "quality:asset_title"

    # Pass 5 — reject betting previews and thread-like sports content
    if item.category == "sports":
        for pat in _LOW_SIGNAL_SPORTS_PATTERNS:
            if pat in text_to_check:
                log.debug("Rejected (quality:sports_low_signal): %s", item.title)
                return False, "quality:sports_low_signal"

    return True, None
