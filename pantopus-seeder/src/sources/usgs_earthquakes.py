"""USGS Earthquake source — fetches recent nearby earthquakes.

The USGS Earthquake Hazards API is free, requires no API key, and provides
real-time earthquake data globally.

Endpoint format:
    https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude={lat}&longitude={lng}&maxradiuskm={radius}&minmagnitude={min_mag}&orderby=time&limit={limit}
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

import httpx

from src.sources.base import ContentSource, RawContentItem, resolve_coordinates

_FETCH_TIMEOUT = 15
_MAX_ITEMS = 5
_DEFAULT_RADIUS_KM = 200
_DEFAULT_MIN_MAGNITUDE = 2.5
_USER_AGENT = "Pantopus-Seeder/1.0"


def _magnitude_description(mag: float) -> str:
    """Return a human-readable description of earthquake magnitude."""
    if mag < 3.0:
        return "minor"
    if mag < 4.0:
        return "light"
    if mag < 5.0:
        return "moderate"
    if mag < 6.0:
        return "strong"
    return "major"


class UsgsEarthquakeSource(ContentSource):
    """Fetches recent earthquakes near a given location from the USGS API."""

    def __init__(self, config: dict) -> None:
        super().__init__(config)
        self.lat, self.lng = resolve_coordinates(config, "UsgsEarthquakeSource")
        # Optional third segment in url: radius_km
        coords = (config.get("url") or "").split(",")
        try:
            self.radius_km = int(coords[2].strip()) if len(coords) > 2 else _DEFAULT_RADIUS_KM
        except (TypeError, ValueError):
            self.radius_km = _DEFAULT_RADIUS_KM

    @property
    def api_url(self) -> str:
        return (
            f"https://earthquake.usgs.gov/fdsnws/event/1/query?"
            f"format=geojson&latitude={self.lat}&longitude={self.lng}"
            f"&maxradiuskm={self.radius_km}&minmagnitude={_DEFAULT_MIN_MAGNITUDE}"
            f"&orderby=time&limit={_MAX_ITEMS}"
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
            self.log.warning("Failed to fetch USGS earthquakes for %s,%s", self.lat, self.lng, exc_info=True)
            return []

        features = data.get("features", [])
        if not features:
            return []

        items: list[RawContentItem] = []
        now = datetime.now(timezone.utc)

        for feature in features:
            props = feature.get("properties", {})
            geometry = feature.get("geometry", {})

            mag = props.get("mag")
            place = props.get("place", "Unknown location")
            time_ms = props.get("time")
            url = props.get("url")

            if mag is None:
                continue

            mag = float(mag)
            desc = _magnitude_description(mag)

            # Parse timestamp (USGS uses milliseconds since epoch)
            published_at = None
            if time_ms:
                try:
                    published_at = datetime.fromtimestamp(time_ms / 1000, tz=timezone.utc)
                except (ValueError, TypeError, OverflowError):
                    pass

            # Skip earthquakes older than 48 hours
            if published_at and (now - published_at).total_seconds() > 48 * 3600:
                continue

            title = f"M{mag:.1f} {desc} earthquake — {place}"

            body_parts = [f"Magnitude {mag:.1f} ({desc})"]
            coords_list = geometry.get("coordinates", [])
            if len(coords_list) >= 3:
                depth = coords_list[2]
                body_parts.append(f"Depth: {depth:.1f} km")

            felt = props.get("felt")
            if felt:
                body_parts.append(f"Felt by {felt} people")

            body = ". ".join(body_parts) + "."

            # Strong+ earthquakes → safety category
            category = "safety" if mag >= 5.0 else self.category

            items.append(RawContentItem(
                title=title,
                body=body,
                source_url=url,
                category=category,
                published_at=published_at,
                source_id=self.source_id,
                region=self.region,
            ))

        return items
