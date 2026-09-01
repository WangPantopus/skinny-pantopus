"""Tests for the new content source types: NWS, Air Quality, USGS Earthquakes, On This Day."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from src.sources.nws_alerts import NwsAlertsSource
from src.sources.air_quality import AirQualitySource, _aqi_level
from src.sources.usgs_earthquakes import UsgsEarthquakeSource, _magnitude_description
from src.sources.on_this_day import OnThisDaySource


# ---------------------------------------------------------------------------
# NWS Alerts
# ---------------------------------------------------------------------------

class TestNwsAlertsSource:
    def _make_source(self, lat="45.5", lng="-122.6"):
        return NwsAlertsSource({
            "source_id": "nws_alerts:test",
            "source_type": "nws_alerts",
            "url": f"{lat},{lng}",
            "category": "weather",
            "display_name": "NWS Test",
            "region": "test_region",
        })

    def test_init_parses_coords(self):
        src = self._make_source()
        assert src.lat == "45.5"
        assert src.lng == "-122.6"

    def test_init_rejects_bad_coords(self):
        with pytest.raises(ValueError, match="no valid coordinates"):
            NwsAlertsSource({
                "source_id": "nws:test",
                "source_type": "nws_alerts",
                "url": "bad",
                "category": "weather",
            })

    def test_api_url(self):
        src = self._make_source()
        assert "point=45.5,-122.6" in src.api_url

    @patch("src.sources.nws_alerts.httpx.get")
    def test_fetch_success(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "features": [
                {
                    "properties": {
                        "headline": "Wind Advisory until 10 PM",
                        "description": "Southwest winds 25-35 mph.",
                        "instruction": "Secure outdoor objects.",
                        "severity": "Moderate",
                        "urgency": "Expected",
                        "effective": "2026-04-05T12:00:00-07:00",
                    }
                }
            ]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        items = src.fetch()
        assert len(items) == 1
        assert "Wind Advisory" in items[0].title
        assert "Secure outdoor objects" in items[0].body

    @patch("src.sources.nws_alerts.httpx.get")
    def test_fetch_severe_uses_safety_category(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "features": [
                {
                    "properties": {
                        "headline": "Tornado Warning",
                        "description": "Take shelter immediately.",
                        "severity": "Extreme",
                        "urgency": "Immediate",
                        "effective": "2026-04-05T12:00:00Z",
                    }
                }
            ]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        items = src.fetch()
        assert len(items) == 1
        assert items[0].category == "safety"

    @patch("src.sources.nws_alerts.httpx.get")
    def test_fetch_empty_features(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"features": []}
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        assert src.fetch() == []

    @patch("src.sources.nws_alerts.httpx.get")
    def test_fetch_network_error(self, mock_get):
        mock_get.side_effect = Exception("Connection failed")
        src = self._make_source()
        assert src.fetch() == []


# ---------------------------------------------------------------------------
# Air Quality
# ---------------------------------------------------------------------------

class TestAirQualitySource:
    def _make_source(self):
        return AirQualitySource({
            "source_id": "air_quality:test",
            "source_type": "air_quality",
            "url": "45.5,-122.6",
            "category": "air_quality",
            "display_name": "AQ Test",
            "region": "test_region",
        })

    def test_aqi_level_good(self):
        name, _ = _aqi_level(30)
        assert name == "Good"

    def test_aqi_level_unhealthy(self):
        name, _ = _aqi_level(175)
        assert name == "Unhealthy"

    def test_aqi_level_hazardous(self):
        name, _ = _aqi_level(400)
        assert name == "Hazardous"

    def test_init_parses_coords(self):
        src = self._make_source()
        assert src.lat == "45.5"
        assert src.lng == "-122.6"

    @patch("src.sources.air_quality.httpx.get")
    def test_fetch_below_threshold_returns_empty(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "current": {"us_aqi": 25, "pm2_5": 5.0, "pm10": 10.0}
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        assert src.fetch() == []

    @patch("src.sources.air_quality.httpx.get")
    def test_fetch_above_threshold_returns_item(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "current": {"us_aqi": 120, "pm2_5": 45.3, "pm10": 60.1}
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        items = src.fetch()
        assert len(items) == 1
        assert "AQI 120" in items[0].title
        assert "Unhealthy for Sensitive Groups" in items[0].title
        assert "PM2.5: 45.3" in items[0].body

    @patch("src.sources.air_quality.httpx.get")
    def test_fetch_unhealthy_uses_safety_category(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "current": {"us_aqi": 200, "pm2_5": 100.0}
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        items = src.fetch()
        assert len(items) == 1
        assert items[0].category == "safety"

    @patch("src.sources.air_quality.httpx.get")
    def test_fetch_network_error(self, mock_get):
        mock_get.side_effect = Exception("Timeout")
        src = self._make_source()
        assert src.fetch() == []


# ---------------------------------------------------------------------------
# USGS Earthquakes
# ---------------------------------------------------------------------------

class TestUsgsEarthquakeSource:
    def _make_source(self):
        return UsgsEarthquakeSource({
            "source_id": "usgs:test",
            "source_type": "usgs_earthquakes",
            "url": "45.5,-122.6",
            "category": "earthquake",
            "display_name": "USGS Test",
            "region": "test_region",
        })

    def test_magnitude_descriptions(self):
        assert _magnitude_description(2.5) == "minor"
        assert _magnitude_description(3.5) == "light"
        assert _magnitude_description(4.5) == "moderate"
        assert _magnitude_description(5.5) == "strong"
        assert _magnitude_description(7.0) == "major"

    def test_init_parses_coords(self):
        src = self._make_source()
        assert src.lat == "45.5"
        assert src.lng == "-122.6"
        assert src.radius_km == 200

    def test_init_custom_radius(self):
        src = UsgsEarthquakeSource({
            "source_id": "usgs:test",
            "source_type": "usgs_earthquakes",
            "url": "45.5,-122.6,300",
            "category": "earthquake",
            "display_name": "USGS Test",
        })
        assert src.radius_km == 300

    def test_init_invalid_radius_defaults(self):
        src = UsgsEarthquakeSource({
            "source_id": "usgs:test",
            "source_type": "usgs_earthquakes",
            "url": "45.5,-122.6,not-a-number",
            "category": "earthquake",
            "display_name": "USGS Test",
        })
        assert src.radius_km == 200

    @patch("src.sources.usgs_earthquakes.httpx.get")
    def test_fetch_success(self, mock_get):
        now_ms = datetime.now(timezone.utc).timestamp() * 1000
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "features": [
                {
                    "properties": {
                        "mag": 3.2,
                        "place": "10km NE of Portland, OR",
                        "time": now_ms,
                        "url": "https://earthquake.usgs.gov/earthquakes/eventpage/test",
                        "felt": 50,
                    },
                    "geometry": {"coordinates": [-122.5, 45.6, 8.0]},
                }
            ]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        items = src.fetch()
        assert len(items) == 1
        assert "M3.2" in items[0].title
        assert "Portland" in items[0].title
        assert "Depth: 8.0 km" in items[0].body
        assert "Felt by 50" in items[0].body

    @patch("src.sources.usgs_earthquakes.httpx.get")
    def test_fetch_strong_earthquake_safety_category(self, mock_get):
        now_ms = datetime.now(timezone.utc).timestamp() * 1000
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "features": [
                {
                    "properties": {
                        "mag": 5.5,
                        "place": "20km S of Portland, OR",
                        "time": now_ms,
                        "url": "https://earthquake.usgs.gov/test",
                    },
                    "geometry": {"coordinates": [-122.5, 45.3, 15.0]},
                }
            ]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        items = src.fetch()
        assert len(items) == 1
        assert items[0].category == "safety"

    @patch("src.sources.usgs_earthquakes.httpx.get")
    def test_fetch_old_earthquake_skipped(self, mock_get):
        # 3 days old
        old_ms = (datetime.now(timezone.utc).timestamp() - 3 * 86400) * 1000
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "features": [
                {
                    "properties": {
                        "mag": 3.0,
                        "place": "Old quake",
                        "time": old_ms,
                    },
                    "geometry": {"coordinates": [-122.5, 45.6, 5.0]},
                }
            ]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        assert src.fetch() == []

    @patch("src.sources.usgs_earthquakes.httpx.get")
    def test_fetch_empty(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"features": []}
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        assert src.fetch() == []

    @patch("src.sources.usgs_earthquakes.httpx.get")
    def test_fetch_network_error(self, mock_get):
        mock_get.side_effect = Exception("Timeout")
        src = self._make_source()
        assert src.fetch() == []


# ---------------------------------------------------------------------------
# On This Day
# ---------------------------------------------------------------------------

class TestOnThisDaySource:
    def _make_source(self, keywords=""):
        return OnThisDaySource({
            "source_id": "on_this_day:test",
            "source_type": "on_this_day",
            "url": keywords,
            "category": "history",
            "display_name": "On This Day Test",
            "region": "test_region",
        })

    def test_init_parses_keywords(self):
        src = self._make_source("Oregon,Portland,Washington")
        assert src.keywords == ["oregon", "portland", "washington"]

    def test_init_no_keywords(self):
        src = self._make_source("")
        assert src.keywords == []

    @patch("src.sources.on_this_day.httpx.get")
    def test_fetch_success(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "events": [
                {
                    "year": 1980,
                    "text": "Mount St. Helens erupts in Washington state",
                    "pages": [
                        {
                            "content_urls": {
                                "desktop": {
                                    "page": "https://en.wikipedia.org/wiki/Mount_St._Helens"
                                }
                            }
                        }
                    ],
                },
                {
                    "year": 1927,
                    "text": "Something happened elsewhere",
                    "pages": [],
                },
            ]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        items = src.fetch()
        assert len(items) == 2
        assert "1980" in items[0].title
        assert "Mount St. Helens" in items[0].title
        assert items[0].source_url == "https://en.wikipedia.org/wiki/Mount_St._Helens"

    @patch("src.sources.on_this_day.httpx.get")
    def test_fetch_with_keyword_filter(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "events": [
                {"year": 1980, "text": "Mount St. Helens erupts in Washington state", "pages": []},
                {"year": 1927, "text": "Something unrelated in France", "pages": []},
                {"year": 1850, "text": "Oregon Territory established", "pages": []},
            ]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source("Oregon,Washington")
        items = src.fetch()
        # Should only include events matching keywords
        assert len(items) == 2
        titles = " ".join(i.title for i in items)
        assert "Washington" in titles
        assert "Oregon" in titles
        assert "France" not in titles

    @patch("src.sources.on_this_day.httpx.get")
    def test_fetch_empty_events(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"events": []}
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        assert src.fetch() == []

    @patch("src.sources.on_this_day.httpx.get")
    def test_fetch_network_error(self, mock_get):
        mock_get.side_effect = Exception("Timeout")
        src = self._make_source()
        assert src.fetch() == []

    @patch("src.sources.on_this_day.httpx.get")
    def test_max_items_limit(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "events": [
                {"year": 2020 - i, "text": f"Event {i}", "pages": []}
                for i in range(10)
            ]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        src = self._make_source()
        items = src.fetch()
        assert len(items) == 3  # _MAX_ITEMS = 3
