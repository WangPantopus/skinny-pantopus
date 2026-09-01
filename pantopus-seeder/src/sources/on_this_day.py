"""Wikipedia 'On This Day' source — fetches notable historical events for today.

Uses the Wikimedia REST API, which is free and requires no API key.

Endpoint format:
    https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/{MM}/{DD}
"""

from __future__ import annotations

from datetime import date, datetime, timezone

import httpx

from src.sources.base import ContentSource, RawContentItem

_FETCH_TIMEOUT = 15
_MAX_ITEMS = 3
_USER_AGENT = "Pantopus-Seeder/1.0"


class OnThisDaySource(ContentSource):
    """Fetches 'on this day' historical events from Wikipedia."""

    def __init__(self, config: dict) -> None:
        super().__init__(config)
        # url field is unused for this source type, but can contain
        # a comma-separated list of keywords to filter events by relevance
        self.keywords = [
            k.strip().lower()
            for k in (config.get("url") or "").split(",")
            if k.strip()
        ]

    def _api_url(self, today: date) -> str:
        return (
            f"https://en.wikipedia.org/api/rest_v1/feed/onthisday"
            f"/events/{today.month}/{today.day}"
        )

    def fetch(self) -> list[RawContentItem]:
        today = date.today()
        try:
            response = httpx.get(
                self._api_url(today),
                timeout=_FETCH_TIMEOUT,
                headers={
                    "User-Agent": _USER_AGENT,
                    "Accept": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()
        except Exception:
            self.log.warning("Failed to fetch On This Day for %s/%s", today.month, today.day, exc_info=True)
            return []

        events = data.get("events", [])
        if not events:
            return []

        # If keywords are provided, filter to events matching any keyword
        if self.keywords:
            scored = []
            for event in events:
                text = event.get("text", "").lower()
                if any(kw in text for kw in self.keywords):
                    scored.append(event)
            # Fall back to all events if no matches
            if scored:
                events = scored

        # Pick the most recent (highest year) notable events
        events.sort(key=lambda e: e.get("year", 0), reverse=True)

        items: list[RawContentItem] = []
        now = datetime.now(timezone.utc)

        for event in events[:_MAX_ITEMS]:
            year = event.get("year")
            text = event.get("text", "").strip()
            if not text:
                continue

            if year:
                title = f"On this day in {year}: {text}"
            else:
                title = f"On this day: {text}"

            # Get Wikipedia link from the first page if available
            source_url = None
            pages = event.get("pages", [])
            if pages:
                content_urls = pages[0].get("content_urls", {})
                desktop = content_urls.get("desktop", {})
                source_url = desktop.get("page")

            items.append(self._make_item(
                title=title,
                body=None,
                source_url=source_url,
                published_at=now,
            ))

        return items
