"""NWS Weather Alerts source — fetches active weather alerts from api.weather.gov.

The National Weather Service API is completely free, requires no API key, and
provides real-time weather watches, warnings, and advisories for any US location.

Endpoint format:
    https://api.weather.gov/alerts/active?point={lat},{lng}
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from src.sources.base import ContentSource, RawContentItem, resolve_coordinates


_FETCH_TIMEOUT = 15  # seconds
_MAX_ITEMS = 5
_USER_AGENT = "Pantopus-Seeder/1.0 (community content platform)"


class NwsAlertsSource(ContentSource):
    """Fetches active weather alerts from the NWS API for a lat/lng point."""

    def __init__(self, config: dict) -> None:
        super().__init__(config)
        self.lat, self.lng = resolve_coordinates(config, "NwsAlertsSource")

    @property
    def api_url(self) -> str:
        return f"https://api.weather.gov/alerts/active?point={self.lat},{self.lng}"

    def fetch(self) -> list[RawContentItem]:
        try:
            response = httpx.get(
                self.api_url,
                timeout=_FETCH_TIMEOUT,
                headers={
                    "User-Agent": _USER_AGENT,
                    "Accept": "application/geo+json",
                },
            )
            response.raise_for_status()
            data = response.json()
        except Exception:
            self.log.warning("Failed to fetch NWS alerts for %s,%s", self.lat, self.lng, exc_info=True)
            return []

        features = data.get("features", [])
        if not features:
            return []

        items: list[RawContentItem] = []

        for feature in features[:_MAX_ITEMS]:
            props = feature.get("properties", {})

            headline = props.get("headline") or props.get("event", "")
            if not headline:
                continue

            description = props.get("description", "")
            instruction = props.get("instruction", "")
            body = description
            if instruction:
                body = f"{description}\n\nAction: {instruction}" if description else instruction

            severity = props.get("severity", "")
            urgency = props.get("urgency", "")

            # Use safety category for severe/extreme alerts
            category = self.category
            if severity in ("Severe", "Extreme") or urgency in ("Immediate", "Expected"):
                category = "safety"

            # Parse effective date
            published_at = None
            effective = props.get("effective") or props.get("sent")
            if effective:
                try:
                    published_at = datetime.fromisoformat(effective.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass

            items.append(self._make_item(
                title=headline,
                body=body,
                source_url=f"https://alerts.weather.gov",
                published_at=published_at,
            ))
            # Override category per-item if needed
            if category != self.category:
                items[-1] = RawContentItem(
                    title=headline,
                    body=body,
                    source_url="https://alerts.weather.gov",
                    category=category,
                    published_at=published_at,
                    source_id=self.source_id,
                    region=self.region,
                )

        return items
