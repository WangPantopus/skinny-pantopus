"""Air Quality source — fetches current AQI data from Open-Meteo.

Open-Meteo's Air Quality API is completely free, requires no API key,
and provides US AQI based on PM2.5 and PM10 for any global coordinate.

Endpoint format:
    https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lng}&current=us_aqi,pm2_5,pm10
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from src.sources.base import ContentSource, RawContentItem

_FETCH_TIMEOUT = 15  # seconds

# Only generate posts when AQI is notable
_AQI_THRESHOLD = 51  # "Moderate" and above

_AQI_LEVELS = {
    (0, 50): ("Good", "Air quality is satisfactory with little or no risk."),
    (51, 100): ("Moderate", "Acceptable air quality. Sensitive individuals may experience minor issues."),
    (101, 150): ("Unhealthy for Sensitive Groups", "People with respiratory or heart conditions, children, and older adults should limit prolonged outdoor exertion."),
    (151, 200): ("Unhealthy", "Everyone may begin to experience health effects. Sensitive groups may experience more serious effects."),
    (201, 300): ("Very Unhealthy", "Health alert — everyone may experience more serious health effects. Limit outdoor activity."),
    (301, 500): ("Hazardous", "Health warning of emergency conditions. Everyone should avoid all outdoor activity."),
}

_USER_AGENT = "Pantopus-Seeder/1.0"


def _aqi_level(aqi: int) -> tuple[str, str]:
    """Return (level_name, description) for a given AQI value."""
    for (low, high), (name, desc) in _AQI_LEVELS.items():
        if low <= aqi <= high:
            return name, desc
    return "Hazardous", "AQI exceeds normal scale."


class AirQualitySource(ContentSource):
    """Fetches current air quality index from Open-Meteo and posts when notable."""

    def __init__(self, config: dict) -> None:
        super().__init__(config)
        coords = (config.get("url") or "").split(",")
        if len(coords) != 2:
            raise ValueError("AirQualitySource requires 'url' as 'lat,lng'")
        self.lat = coords[0].strip()
        self.lng = coords[1].strip()

    @property
    def api_url(self) -> str:
        return (
            f"https://air-quality-api.open-meteo.com/v1/air-quality?"
            f"latitude={self.lat}&longitude={self.lng}"
            f"&current=us_aqi,pm2_5,pm10"
        )

    def fetch(self) -> list[RawContentItem]:
        try:
            response = httpx.get(
                self.api_url,
                timeout=_FETCH_TIMEOUT,
                headers={"User-Agent": _USER_AGENT},
            )
            response.raise_for_status()
            data = response.json()
        except Exception:
            self.log.warning("Failed to fetch air quality for %s,%s", self.lat, self.lng, exc_info=True)
            return []

        current = data.get("current", {})
        aqi = current.get("us_aqi")
        if aqi is None:
            return []

        aqi = int(aqi)
        if aqi < _AQI_THRESHOLD:
            self.log.debug("AQI %d below threshold %d, skipping", aqi, _AQI_THRESHOLD)
            return []

        level_name, level_desc = _aqi_level(aqi)
        pm25 = current.get("pm2_5")
        pm10 = current.get("pm10")

        title = f"Air Quality Alert: AQI {aqi} ({level_name})"
        body_parts = [level_desc]
        if pm25 is not None:
            body_parts.append(f"PM2.5: {pm25} µg/m³")
        if pm10 is not None:
            body_parts.append(f"PM10: {pm10} µg/m³")

        body = " ".join(body_parts)
        now = datetime.now(timezone.utc)

        # Severe air quality → safety category
        category = "safety" if aqi >= 151 else self.category

        item = RawContentItem(
            title=title,
            body=body,
            source_url="https://air-quality-api.open-meteo.com",
            category=category,
            published_at=now,
            source_id=self.source_id,
            region=self.region,
        )

        return [item]
