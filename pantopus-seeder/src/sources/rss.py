"""Generic RSS feed source, configured per feed URL and category mapping."""

from __future__ import annotations

import calendar
from datetime import datetime, timezone

import feedparser
import httpx

from src.config.constants import FRESHNESS_HOURS
from src.sources.base import ContentSource, RawContentItem
from src.utils.media import canonicalize_media_url

_FETCH_TIMEOUT = 15  # seconds
_MAX_ITEMS = 20
_MAX_MEDIA_PER_ITEM = 4
_USER_AGENT = "Pantopus-Seeder/1.0"
_REQUEST_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# MIME prefixes that map to Pantopus media types
_IMAGE_MIMES = ("image/jpeg", "image/png", "image/gif", "image/webp", "image/avif")
_VIDEO_MIMES = ("video/mp4", "video/webm", "video/quicktime")


class RssSource(ContentSource):
    """Fetches and parses an RSS/Atom feed into RawContentItems."""

    def __init__(self, config: dict) -> None:
        super().__init__(config)
        self.feed_url: str = config["url"]

    def fetch(self) -> list[RawContentItem]:
        """Parse the RSS feed and return content items."""
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
            if exc.response.status_code == 403 and "reddit.com" in self.feed_url:
                self._set_fetch_error("http_403:reddit_blocked")
            else:
                self._set_fetch_error(f"http_{exc.response.status_code}")
            self.log.warning("Failed to fetch feed %s", self.feed_url, exc_info=True)
            return []
        except Exception as exc:
            self._set_fetch_error(f"fetch_error:{exc.__class__.__name__}")
            self.log.warning("Failed to fetch feed %s", self.feed_url, exc_info=True)
            return []

        if feed.bozo and not feed.entries:
            content_type = response.headers.get("content-type", "")
            preview = response.text[:120].replace("\n", " ").strip()
            self._set_fetch_error("bozo_feed:no_entries")
            self.log.warning(
                "Bozo feed with no entries: %s (%s) status=%s content_type=%s preview=%r",
                self.feed_url,
                feed.bozo_exception,
                response.status_code,
                content_type,
                preview,
            )
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

            published_at = self._parse_date(entry)

            if published_at is not None:
                age_hours = (now - published_at).total_seconds() / 3600
                if age_hours > freshness_limit:
                    continue

            body = entry.get("summary") or entry.get("description")
            source_url = entry.get("link") or None

            media_urls, media_types = self._extract_media(entry)

            items.append((published_at, self._make_item(
                title=title,
                body=body,
                source_url=source_url,
                published_at=published_at,
                media_urls=media_urls,
                media_types=media_types,
            )))

        # Sort by date (most recent first); items without dates go to the end
        items.sort(key=lambda pair: pair[0] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

        return [item for _, item in items[:_MAX_ITEMS]]

    @staticmethod
    def _extract_media(entry: dict) -> tuple[list[str], list[str]]:
        """Extract image/video URLs from a feedparser entry.

        Checks media_content, media_thumbnail, and enclosures.
        Returns (urls, types) parallel lists, capped at _MAX_MEDIA_PER_ITEM.
        """
        seen_canonicals: set[str] = set()
        urls: list[str] = []
        types: list[str] = []

        def _add(url: str, mime: str | None, medium: str | None) -> None:
            if len(urls) >= _MAX_MEDIA_PER_ITEM:
                return
            url = (url or "").strip()
            if not url:
                return
            canonical = canonicalize_media_url(url)
            if canonical in seen_canonicals:
                return
            # Determine type from medium hint or MIME
            media_type = None
            if medium in ("image", "video"):
                media_type = medium
            elif mime:
                mime_lower = mime.lower()
                if mime_lower.startswith("image/"):
                    media_type = "image"
                elif mime_lower.startswith("video/"):
                    media_type = "video"
            # If we still can't tell, guess from URL extension
            if media_type is None:
                url_lower = url.lower().split("?")[0]
                if any(url_lower.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp")):
                    media_type = "image"
                elif any(url_lower.endswith(ext) for ext in (".mp4", ".webm", ".mov")):
                    media_type = "video"
            if media_type is None:
                return
            seen_canonicals.add(canonical)
            urls.append(url)
            types.append(media_type)

        # 1. media:content (Media RSS namespace)
        for mc in entry.get("media_content", []):
            _add(mc.get("url"), mc.get("type"), mc.get("medium"))

        # 2. media:thumbnail (often the article hero image)
        for mt in entry.get("media_thumbnail", []):
            _add(mt.get("url"), "image/jpeg", "image")

        # 3. enclosures (standard RSS attachments)
        for enc in entry.get("enclosures", []):
            _add(enc.get("href") or enc.get("url"), enc.get("type"), None)

        return urls, types

    @staticmethod
    def _parse_date(entry: dict) -> datetime | None:
        """Extract a timezone-aware datetime from a feedparser entry."""
        for field in ("published_parsed", "updated_parsed"):
            parsed = entry.get(field)
            if parsed:
                try:
                    return datetime.fromtimestamp(calendar.timegm(parsed), tz=timezone.utc)
                except (TypeError, ValueError, OverflowError):
                    continue
        return None
