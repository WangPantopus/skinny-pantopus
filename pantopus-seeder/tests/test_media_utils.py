"""Tests for the media URL canonicalization helper."""

from __future__ import annotations

from src.utils.media import canonicalize_media_url


class TestCanonicalizeMediaUrl:
    def test_empty_returns_empty(self):
        assert canonicalize_media_url("") == ""
        assert canonicalize_media_url(None) == ""
        assert canonicalize_media_url("   ") == ""

    def test_strips_query_string(self):
        a = canonicalize_media_url("https://cdn.example.com/photo.jpg?w=640")
        b = canonicalize_media_url("https://cdn.example.com/photo.jpg?w=1200")
        assert a == b

    def test_strips_fragment(self):
        a = canonicalize_media_url("https://example.com/photo.jpg#hero")
        b = canonicalize_media_url("https://example.com/photo.jpg")
        assert a == b

    def test_strips_resize_suffix(self):
        """WordPress-style -WxH suffix before the extension is treated as size variant."""
        a = canonicalize_media_url("https://example.com/wp/photo-1200x800.jpg")
        b = canonicalize_media_url("https://example.com/wp/photo.jpg")
        assert a == b

    def test_strips_resize_suffix_with_query(self):
        a = canonicalize_media_url("https://example.com/pic-150x150.png?ssl=1")
        b = canonicalize_media_url("https://example.com/pic.png")
        assert a == b

    def test_case_insensitive_host(self):
        a = canonicalize_media_url("https://CDN.Example.com/p.jpg")
        b = canonicalize_media_url("https://cdn.example.com/p.jpg")
        assert a == b

    def test_different_images_stay_distinct(self):
        a = canonicalize_media_url("https://example.com/photo-a.jpg")
        b = canonicalize_media_url("https://example.com/photo-b.jpg")
        assert a != b

    def test_resize_suffix_requires_digits(self):
        """Dashes without digits must not be stripped (e.g. 'news-feed.jpg')."""
        original = "https://example.com/news-feed.jpg"
        assert "news-feed" in canonicalize_media_url(original)

    def test_whitespace_is_trimmed(self):
        a = canonicalize_media_url("  https://example.com/p.jpg  ")
        b = canonicalize_media_url("https://example.com/p.jpg")
        assert a == b
