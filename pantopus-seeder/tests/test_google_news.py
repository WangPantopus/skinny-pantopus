"""Tests for the Google News source's image extraction + dedup."""

from __future__ import annotations

from src.sources.google_news import GoogleNewsSource


class TestGoogleNewsImageExtraction:
    def test_no_html_returns_empty(self):
        urls, types = GoogleNewsSource._extract_image_from_html(None)
        assert urls == []
        assert types == []

    def test_single_image(self):
        html = '<div><img src="https://cdn.example.com/a.jpg" /></div>'
        urls, types = GoogleNewsSource._extract_image_from_html(html)
        assert urls == ["https://cdn.example.com/a.jpg"]
        assert types == ["image"]

    def test_multiple_unique_images(self):
        html = (
            '<img src="https://cdn.example.com/a.jpg" />'
            '<img src="https://cdn.example.com/b.jpg" />'
            '<img src="https://cdn.example.com/c.jpg" />'
        )
        urls, types = GoogleNewsSource._extract_image_from_html(html)
        assert urls == [
            "https://cdn.example.com/a.jpg",
            "https://cdn.example.com/b.jpg",
            "https://cdn.example.com/c.jpg",
        ]
        assert types == ["image"] * 3

    def test_skips_data_uris(self):
        html = (
            '<img src="data:image/png;base64,AAAA" />'
            '<img src="https://cdn.example.com/a.jpg" />'
        )
        urls, types = GoogleNewsSource._extract_image_from_html(html)
        assert urls == ["https://cdn.example.com/a.jpg"]

    def test_deduplicates_size_variants(self):
        """Same image at different sizes/query strings is only kept once."""
        html = (
            '<img src="https://cdn.example.com/hero.jpg?w=200" />'
            '<img src="https://cdn.example.com/hero.jpg?w=800" />'
            '<img src="https://cdn.example.com/hero-1200x800.jpg" />'
        )
        urls, types = GoogleNewsSource._extract_image_from_html(html)
        assert len(urls) == 1

    def test_caps_at_max_media(self):
        html = "".join(
            f'<img src="https://cdn.example.com/img{i}.jpg" />' for i in range(10)
        )
        urls, types = GoogleNewsSource._extract_image_from_html(html)
        assert len(urls) == 4
        assert len(types) == 4
