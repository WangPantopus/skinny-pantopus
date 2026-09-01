"""Google News RSS source — universal fallback that works for any city/region.

Constructs a Google News RSS search URL from a region display name and fetches
local news headlines. This enables automatic content sourcing for dynamically
added regions without requiring hand-curated RSS feed lists.

Feed URL format:
    https://news.google.com/rss/search?q={query}+when:2d&hl=en-US&gl=US&ceid=US:en
"""

from __future__ import annotations

import calendar
import re
from datetime import datetime, timezone
from urllib.parse import quote_plus

import feedparser
import httpx

from src.config.constants import FRESHNESS_HOURS
from src.sources.base import ContentSource, RawContentItem
from src.utils.media import canonicalize_media_url

_FETCH_TIMEOUT = 15  # seconds
_MAX_ITEMS = 15
_MAX_MEDIA_PER_ITEM = 4
_REQUEST_HEADERS = {
    "User-Agent": "Pantopus-Seeder/1.0",
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Google News wraps the real source URL in a redirect; titles often end with
# " - Source Name".  We strip the suffix to avoid duplicate attribution.
_SOURCE_SUFFIX_RE = re.compile(r"\s*[-–—]\s*[A-Z][\w\s&'.]+$")


class GoogleNewsSource(ContentSource):
    """Fetches local headlines from Google News RSS for a given search query."""

    def __init__(self, config: dict) -> None:
        super().__init__(config)
        self.query: str = config.get("url") or config.get("query", "")
        if not self.query:
            raise ValueError("GoogleNewsSource requires a 'url' (query string) in config")

    @property
    def feed_url(self) -> str:
        q = quote_plus(self.query)
        return (
            f"https://news.google.com/rss/search?"
            f"q={q}+when:2d&hl=en-US&gl=US&ceid=US:en"
        )

    def fetch(self) -> list[RawContentItem]:
        self._clear_fetch_error()
        try:
            response = httpx.get(
                self.feed_url,
                timeout=_FETCH_TIMEOUT,
                follow_redirects=True,
                headers=_REQUEST_HEADERS,
            )
            response.raise_for_status()
            feed = feedparser.parse(response.content)
        except httpx.HTTPStatusError as exc:
            self._set_fetch_error(f"http_{exc.response.status_code}")
            self.log.warning("Failed to fetch Google News feed for '%s'", self.query, exc_info=True)
            return []
        except Exception as exc:
            self._set_fetch_error(f"fetch_error:{exc.__class__.__name__}")
            self.log.warning("Failed to fetch Google News feed for '%s'", self.query, exc_info=True)
            return []

        if not feed.entries:
            return []

        freshness_limit = FRESHNESS_HOURS.get(self.category, FRESHNESS_HOURS["default"])
        now = datetime.now(timezone.utc)

        items: list[tuple[datetime | None, RawContentItem]] = []

        for entry in feed.entries:
            title = (entry.get("title") or "").strip()
            if not title:
                continue

            # Strip trailing " - Source Name" that Google News appends
            title = _SOURCE_SUFFIX_RE.sub("", title).strip()
            if not title:
                continue

            published_at = self._parse_date(entry)

            if published_at is not None:
                age_hours = (now - published_at).total_seconds() / 3600
                if age_hours > freshness_limit:
                    continue

            source_url = entry.get("link") or None
            body = entry.get("summary") or entry.get("description")

            # Extract image from Google News description HTML
            media_urls, media_types = self._extract_image_from_html(body)

            items.append((published_at, self._make_item(
                title=title,
                body=body,
                source_url=source_url,
                published_at=published_at,
                media_urls=media_urls,
                media_types=media_types,
            )))

        items.sort(key=lambda pair: pair[0] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        return [item for _, item in items[:_MAX_ITEMS]]

    @staticmethod
    def _extract_image_from_html(html: str | None) -> tuple[list[str], list[str]]:
        """Extract image URLs from Google News description HTML.

        Google News aggregates several related articles into the description
        and usually provides one thumbnail per article.  We collect up to
        _MAX_MEDIA_PER_ITEM unique images, deduping by canonical URL so size
        variants of the same thumbnail don't double up.
        """
        if not html:
            return [], []
        urls: list[str] = []
        types: list[str] = []
        seen_canonicals: set[str] = set()
        for match in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\']', html):
            url = match.group(1).strip()
            if not url or url.startswith("data:"):
                continue
            canonical = canonicalize_media_url(url)
            if canonical in seen_canonicals:
                continue
            seen_canonicals.add(canonical)
            urls.append(url)
            types.append("image")
            if len(urls) >= _MAX_MEDIA_PER_ITEM:
                break
        return urls, types

    @staticmethod
    def _parse_date(entry: dict) -> datetime | None:
        for field in ("published_parsed", "updated_parsed"):
            parsed = entry.get(field)
            if parsed:
                try:
                    return datetime.fromtimestamp(calendar.timegm(parsed), tz=timezone.utc)
                except (TypeError, ValueError, OverflowError):
                    continue
        return None
