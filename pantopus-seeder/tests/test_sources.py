"""Tests for source layer: base class, RSS source, and registry."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from time import struct_time
from unittest.mock import MagicMock, patch

import httpx
import pytest

from src.models.queue_item import RawContentItem
from src.sources.base import ContentSource
from src.sources.registry import get_sources
from src.sources.rss import RssSource


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_rss_config(**overrides) -> dict:
    base = {
        "source_id": "rss:test_feed",
        "source_type": "rss",
        "url": "https://example.com/feed.xml",
        "category": "local_news",
        "display_name": "Test Feed",
        "region": "clark_county",
    }
    base.update(overrides)
    return base


def _dt_to_time_struct(dt: datetime) -> struct_time:
    return dt.timetuple()


def _make_entry(title="Test article", summary="Body text", link="https://example.com/1",
                published_dt: datetime | None = None):
    entry = {"title": title, "summary": summary, "link": link}
    if published_dt is not None:
        entry["published_parsed"] = _dt_to_time_struct(published_dt)
    return entry


def _make_feed(entries: list[dict], bozo: bool = False, bozo_exception=None):
    feed = MagicMock()
    feed.entries = entries
    feed.bozo = bozo
    feed.bozo_exception = bozo_exception
    return feed


def _make_response(body: str = "<rss>...</rss>", *, status_code: int = 200, content_type: str = "application/rss+xml"):
    response = MagicMock()
    response.text = body
    response.content = body.encode("utf-8")
    response.status_code = status_code
    response.headers = {"content-type": content_type}
    response.raise_for_status.return_value = None
    return response


# ---------------------------------------------------------------------------
# ContentSource._make_item
# ---------------------------------------------------------------------------

class TestContentSourceMakeItem:
    def test_make_item_fills_source_fields(self):
        """_make_item pre-fills source_id, region, and category."""

        class DummySource(ContentSource):
            def fetch(self):
                return []

        src = DummySource(_make_rss_config())
        item = src._make_item(title="Hello", body="World", source_url="https://x.com")

        assert isinstance(item, RawContentItem)
        assert item.source_id == "rss:test_feed"
        assert item.region == "clark_county"
        assert item.category == "local_news"
        assert item.title == "Hello"
        assert item.body == "World"


# ---------------------------------------------------------------------------
# RssSource
# ---------------------------------------------------------------------------

class TestRssSource:
    @patch("src.sources.rss.httpx.get")
    @patch("src.sources.rss.feedparser.parse")
    def test_sets_user_agent_header(self, mock_parse, mock_get):
        """RSS fetches send the Pantopus user agent."""
        mock_get.return_value = _make_response()
        mock_parse.return_value = _make_feed([])

        src = RssSource(_make_rss_config())
        src.fetch()

        assert mock_get.call_args.kwargs["headers"]["User-Agent"] == "Pantopus-Seeder/1.0"

    @patch("src.sources.rss.httpx.get")
    @patch("src.sources.rss.feedparser.parse")
    def test_well_formed_feed(self, mock_parse, mock_get):
        """Returns correct RawContentItem list from well-formed feed."""
        now = datetime.now(timezone.utc)
        entries = [
            _make_entry(title="Article 1", published_dt=now - timedelta(hours=1)),
            _make_entry(title="Article 2", summary="Body 2", link="https://example.com/2",
                        published_dt=now - timedelta(hours=2)),
        ]
        mock_get.return_value = _make_response()
        mock_parse.return_value = _make_feed(entries)

        src = RssSource(_make_rss_config())
        items = src.fetch()

        assert len(items) == 2
        assert all(isinstance(i, RawContentItem) for i in items)
        assert items[0].title == "Article 1"
        assert items[1].title == "Article 2"
        assert items[0].source_id == "rss:test_feed"
        assert items[0].region == "clark_county"
        mock_parse.assert_called_once_with(b"<rss>...</rss>")

    @patch("src.sources.rss.httpx.get")
    @patch("src.sources.rss.feedparser.parse")
    def test_empty_feed(self, mock_parse, mock_get):
        """Returns empty list from feed with no entries."""
        mock_get.return_value = _make_response("<rss></rss>")
        mock_parse.return_value = _make_feed([])

        src = RssSource(_make_rss_config())
        assert src.fetch() == []

    @patch("src.sources.rss.httpx.get")
    @patch("src.sources.rss.feedparser.parse")
    def test_bozo_feed_no_entries(self, mock_parse, mock_get):
        """Returns empty list from unreachable/bozo feed with no entries."""
        mock_get.return_value = _make_response("")
        mock_parse.return_value = _make_feed([], bozo=True, bozo_exception=Exception("bad xml"))

        src = RssSource(_make_rss_config())
        assert src.fetch() == []

    @patch("src.sources.rss.httpx.get")
    @patch("src.sources.rss.feedparser.parse")
    def test_skips_stale_entries(self, mock_parse, mock_get):
        """Skips entries older than freshness threshold."""
        now = datetime.now(timezone.utc)
        entries = [
            _make_entry(title="Fresh", published_dt=now - timedelta(hours=1)),
            _make_entry(title="Stale", published_dt=now - timedelta(hours=100)),
        ]
        mock_get.return_value = _make_response()
        mock_parse.return_value = _make_feed(entries)

        src = RssSource(_make_rss_config())
        items = src.fetch()

        assert len(items) == 1
        assert items[0].title == "Fresh"

    @patch("src.sources.rss.httpx.get")
    @patch("src.sources.rss.feedparser.parse")
    def test_skips_entries_no_title(self, mock_parse, mock_get):
        """Skips entries with no title."""
        now = datetime.now(timezone.utc)
        entries = [
            _make_entry(title="", published_dt=now),
            _make_entry(title="   ", published_dt=now),
            _make_entry(title="Valid", published_dt=now),
        ]
        mock_get.return_value = _make_response()
        mock_parse.return_value = _make_feed(entries)

        src = RssSource(_make_rss_config())
        items = src.fetch()

        assert len(items) == 1
        assert items[0].title == "Valid"

    @patch("src.sources.rss.httpx.get")
    @patch("src.sources.rss.feedparser.parse")
    def test_caps_at_20_items(self, mock_parse, mock_get):
        """Caps at 20 items maximum."""
        now = datetime.now(timezone.utc)
        entries = [
            _make_entry(title=f"Article {i}", published_dt=now - timedelta(minutes=i))
            for i in range(30)
        ]
        mock_get.return_value = _make_response()
        mock_parse.return_value = _make_feed(entries)

        src = RssSource(_make_rss_config())
        items = src.fetch()

        assert len(items) == 20

    @patch("src.sources.rss.httpx.get")
    def test_network_error_returns_empty(self, mock_get):
        """Returns empty list on network error."""
        mock_get.side_effect = Exception("Connection refused")

        src = RssSource(_make_rss_config())
        assert src.fetch() == []
        assert src.last_fetch_error == "fetch_error:Exception"

    @patch("src.sources.rss.httpx.get")
    def test_reddit_403_sets_specific_fetch_error(self, mock_get):
        """Reddit feed blocks are tagged clearly for fetcher metrics."""
        response = _make_response(status_code=403, content_type="text/html")
        response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Blocked",
            request=httpx.Request("GET", "https://www.reddit.com/r/test/.rss"),
            response=httpx.Response(403),
        )
        mock_get.return_value = response

        src = RssSource(_make_rss_config(url="https://www.reddit.com/r/test/.rss"))
        assert src.fetch() == []
        assert src.last_fetch_error == "http_403:reddit_blocked"

    @patch("src.sources.rss.httpx.get")
    @patch("src.sources.rss.feedparser.parse")
    def test_entry_no_link(self, mock_parse, mock_get):
        """Includes entries with no link (source_url=None)."""
        now = datetime.now(timezone.utc)
        entries = [_make_entry(title="No link", link=None, published_dt=now)]
        # feedparser entry with no link field
        entries[0].pop("link", None)
        mock_get.return_value = _make_response()
        mock_parse.return_value = _make_feed(entries)

        src = RssSource(_make_rss_config())
        items = src.fetch()

        assert len(items) == 1
        assert items[0].source_url is None

    @patch("src.sources.rss.httpx.get")
    @patch("src.sources.rss.feedparser.parse")
    def test_event_category_uses_72h_freshness(self, mock_parse, mock_get):
        """Event category uses 72h freshness window."""
        now = datetime.now(timezone.utc)
        entries = [
            _make_entry(title="Recent event", published_dt=now - timedelta(hours=50)),
            _make_entry(title="Old event", published_dt=now - timedelta(hours=100)),
        ]
        mock_get.return_value = _make_response()
        mock_parse.return_value = _make_feed(entries)

        src = RssSource(_make_rss_config(category="event"))
        items = src.fetch()

        assert len(items) == 1
        assert items[0].title == "Recent event"


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    def test_returns_rss_sources_for_region(self):
        """get_sources returns RssSource instances for known region."""
        sources = get_sources("clark_county")
        assert len(sources) > 0
        rss_sources = [s for s in sources if isinstance(s, RssSource)]
        assert len(rss_sources) > 0

    def test_returns_empty_for_unknown_region(self):
        """get_sources returns empty list for unknown region."""
        assert get_sources("narnia") == []

    def test_sources_have_region_set(self):
        """Each source returned by get_sources has its region set."""
        sources = get_sources("portland_metro")
        for s in sources:
            assert s.region == "portland_metro"

    def test_both_regions_return_sources(self):
        """Both configured regions return sources."""
        for region in ("clark_county", "portland_metro"):
            sources = get_sources(region)
            assert len(sources) > 0, f"No sources for {region}"


# ---------------------------------------------------------------------------
# RSS Media Extraction
# ---------------------------------------------------------------------------

class TestRssMediaExtraction:
    """Tests for RssSource._extract_media."""

    def test_media_content_image(self):
        """Extracts image from media:content with MIME type."""
        entry = {
            "media_content": [
                {"url": "https://example.com/photo.jpg", "type": "image/jpeg", "medium": "image"},
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert urls == ["https://example.com/photo.jpg"]
        assert types == ["image"]

    def test_media_content_video(self):
        """Extracts video from media:content."""
        entry = {
            "media_content": [
                {"url": "https://example.com/clip.mp4", "type": "video/mp4", "medium": "video"},
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert urls == ["https://example.com/clip.mp4"]
        assert types == ["video"]

    def test_media_thumbnail(self):
        """Extracts image from media:thumbnail."""
        entry = {
            "media_thumbnail": [
                {"url": "https://example.com/thumb.jpg"},
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert urls == ["https://example.com/thumb.jpg"]
        assert types == ["image"]

    def test_enclosure_image(self):
        """Extracts image from RSS enclosures."""
        entry = {
            "enclosures": [
                {"href": "https://example.com/photo.png", "type": "image/png"},
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert urls == ["https://example.com/photo.png"]
        assert types == ["image"]

    def test_enclosure_url_fallback(self):
        """Falls back to 'url' key when 'href' is missing in enclosure."""
        entry = {
            "enclosures": [
                {"url": "https://example.com/pic.jpg", "type": "image/jpeg"},
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert urls == ["https://example.com/pic.jpg"]
        assert types == ["image"]

    def test_deduplicates_urls(self):
        """Same URL from multiple sources is only included once."""
        entry = {
            "media_content": [
                {"url": "https://example.com/photo.jpg", "type": "image/jpeg"},
            ],
            "media_thumbnail": [
                {"url": "https://example.com/photo.jpg"},
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert len(urls) == 1

    def test_deduplicates_size_variants(self):
        """Different size/query variants of the same image dedupe via canonical URL."""
        entry = {
            "media_content": [
                {"url": "https://example.com/photo.jpg?w=640", "type": "image/jpeg"},
                {"url": "https://example.com/photo.jpg?w=1200", "type": "image/jpeg"},
                {"url": "https://example.com/photo-150x150.jpg", "type": "image/jpeg"},
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert len(urls) == 1
        assert len(types) == 1

    def test_caps_at_four(self):
        """Caps media at _MAX_MEDIA_PER_ITEM (4)."""
        entry = {
            "media_content": [
                {"url": f"https://example.com/img{i}.jpg", "type": "image/jpeg"}
                for i in range(10)
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert len(urls) == 4
        assert len(types) == 4

    def test_type_detection_from_url_extension(self):
        """Falls back to URL extension when no MIME or medium hint."""
        entry = {
            "media_content": [
                {"url": "https://example.com/photo.webp"},
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert urls == ["https://example.com/photo.webp"]
        assert types == ["image"]

    def test_type_detection_video_extension(self):
        """Detects video type from URL extension."""
        entry = {
            "media_content": [
                {"url": "https://example.com/clip.mp4"},
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert urls == ["https://example.com/clip.mp4"]
        assert types == ["video"]

    def test_unknown_type_skipped(self):
        """Skips media when type cannot be determined."""
        entry = {
            "media_content": [
                {"url": "https://example.com/file.pdf", "type": "application/pdf"},
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert urls == []
        assert types == []

    def test_empty_entry_returns_empty(self):
        """No media fields returns empty lists."""
        entry = {"title": "Just text"}
        urls, types = RssSource._extract_media(entry)
        assert urls == []
        assert types == []

    def test_blank_url_skipped(self):
        """Blank or whitespace-only URLs are skipped."""
        entry = {
            "media_content": [
                {"url": "", "type": "image/jpeg"},
                {"url": "   ", "type": "image/jpeg"},
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert urls == []

    def test_priority_order(self):
        """media_content is processed before thumbnail and enclosures."""
        entry = {
            "media_content": [
                {"url": "https://example.com/mc.jpg", "type": "image/jpeg"},
            ],
            "media_thumbnail": [
                {"url": "https://example.com/thumb.jpg"},
            ],
            "enclosures": [
                {"href": "https://example.com/enc.jpg", "type": "image/jpeg"},
            ],
        }
        urls, types = RssSource._extract_media(entry)
        assert urls[0] == "https://example.com/mc.jpg"
        assert len(urls) == 3

    @patch("src.sources.rss.httpx.get")
    @patch("src.sources.rss.feedparser.parse")
    def test_fetch_passes_media_to_items(self, mock_parse, mock_get):
        """fetch() includes extracted media in RawContentItem."""
        now = datetime.now(timezone.utc)
        entry = _make_entry(title="Article with image", published_dt=now)
        entry["media_thumbnail"] = [{"url": "https://example.com/hero.jpg"}]

        mock_get.return_value = MagicMock(text="<rss>...</rss>")
        mock_parse.return_value = _make_feed([entry])

        src = RssSource(_make_rss_config())
        items = src.fetch()

        assert len(items) == 1
        assert items[0].media_urls == ["https://example.com/hero.jpg"]
        assert items[0].media_types == ["image"]

    @patch("src.sources.rss.httpx.get")
    @patch("src.sources.rss.feedparser.parse")
    def test_fetch_no_media_returns_empty_lists(self, mock_parse, mock_get):
        """fetch() returns empty media lists when entry has no media."""
        now = datetime.now(timezone.utc)
        entry = _make_entry(title="Text only", published_dt=now)

        mock_get.return_value = MagicMock(text="<rss>...</rss>")
        mock_parse.return_value = _make_feed([entry])

        src = RssSource(_make_rss_config())
        items = src.fetch()

        assert len(items) == 1
        assert items[0].media_urls == []
        assert items[0].media_types == []
