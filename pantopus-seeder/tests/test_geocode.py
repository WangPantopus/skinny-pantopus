"""Tests for the reverse geocoding module."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from src.discovery.geocode import (
    _fallback_name,
    _slugify,
    _state_abbreviation,
    reverse_geocode,
)


class TestSlugify:
    def test_simple(self):
        assert _slugify("seattle_wa") == "seattle_wa"

    def test_spaces_and_special(self):
        assert _slugify("San Francisco, CA") == "san_francisco_ca"

    def test_collapses_underscores(self):
        assert _slugify("a___b") == "a_b"


class TestStateAbbreviation:
    def test_full_name(self):
        assert _state_abbreviation("Washington") == "WA"
        assert _state_abbreviation("Oregon") == "OR"

    def test_already_abbreviated(self):
        assert _state_abbreviation("WA") == "WA"

    def test_empty(self):
        assert _state_abbreviation("") == ""

    def test_unknown(self):
        assert _state_abbreviation("Narnia") == "NA"


class TestFallbackName:
    def test_positive_coords(self):
        result = _fallback_name(47.6, -122.3)
        assert "region_" in result["region_id"]
        assert "47.60" in result["display_name"]
        assert result["city"] == ""

    def test_negative_lat(self):
        result = _fallback_name(-33.9, 151.2)
        assert "s" in result["region_id"]


class TestReverseGeocode:
    @patch("src.discovery.geocode.httpx.get")
    def test_successful_geocode(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "address": {
                "city": "Seattle",
                "state": "Washington",
                "country_code": "us",
            }
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = reverse_geocode(47.6062, -122.3321)

        assert result["region_id"] == "seattle_wa"
        assert result["display_name"] == "Seattle, WA"
        assert result["city"] == "Seattle"
        assert result["state"] == "WA"
        assert "Seattle" in result["query"]

    @patch("src.discovery.geocode.httpx.get")
    def test_uses_town_when_no_city(self, mock_get):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "address": {
                "town": "Bend",
                "state": "Oregon",
            }
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = reverse_geocode(44.0582, -121.3153)

        assert result["city"] == "Bend"
        assert result["region_id"] == "bend_or"

    @patch("src.discovery.geocode.httpx.get")
    def test_falls_back_on_network_error(self, mock_get):
        mock_get.side_effect = Exception("Network error")

        result = reverse_geocode(47.6062, -122.3321)

        assert "region_" in result["region_id"]
        assert result["city"] == ""

    @patch("src.discovery.geocode.httpx.get")
    def test_falls_back_on_no_city(self, mock_get):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "address": {"country_code": "us"}
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = reverse_geocode(47.0, -122.0)

        assert "region_" in result["region_id"]
