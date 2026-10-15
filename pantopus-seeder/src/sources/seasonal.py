"""Seasonal tips filtered by publishing geography before any AI rewriting."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import random
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from src.sources.base import ContentSource, RawContentItem
from src.discovery.timezone import timezone_from_coords
from src.utils.coordinates import parse_valid_coordinates

# The existing backend climate calendar is the canonical source. Packaging
# copies this public JSON alongside the seeder; source checkouts read it in place.
_PACKAGED = Path(__file__).resolve().parents[1] / "config" / "seasonalClimate.json"
_SOURCE = Path(__file__).resolve().parents[3] / "backend" / "services" / "ai" / "seasonalClimate.json"
CLIMATE = json.loads((_PACKAGED if _PACKAGED.exists() else _SOURCE).read_text())
SEASONAL_CALENDAR = [
    {"name": key, "months": value["months"], "tips": CLIMATE["tips"].get(key, [])}
    for key, value in CLIMATE["seasons"].items()
]


def climate_region(config: dict) -> str | None:
    state = str(config.get("state") or "").strip().upper()
    if state in CLIMATE["states"]:
        return CLIMATE["states"][state]
    coords = parse_valid_coordinates(config.get("region_lat"), config.get("region_lng"))
    if coords is None:
        return None
    lat, lng = coords
    return next((area["region"] for area in CLIMATE["coordinate_regions"]
                 if area["lat"][0] <= lat <= area["lat"][1]
                 and area["lng"][0] <= lng <= area["lng"][1]), None)


def _tip_hash(tip: str) -> str:
    """Return a short hash for a tip string."""
    return hashlib.md5(tip.encode()).hexdigest()[:12]


def _date_in_range(month: int, day: int, start: tuple[int, int], end: tuple[int, int]) -> bool:
    """Check if (month, day) falls within a season range, handling year wraps."""
    s_month, s_day = start
    e_month, e_day = end

    # Wrap-around range (e.g. Dec 1 – Feb 28)
    if (s_month, s_day) > (e_month, e_day):
        return (month, day) >= (s_month, s_day) or (month, day) <= (e_month, e_day)

    return (s_month, s_day) <= (month, day) <= (e_month, e_day)


def get_active_seasons(month: int, day: int, region: str | None = None, coordinates: tuple[float, float] | None = None) -> list[dict]:
    """Use the shared climate month windows, never an unrelated fallback."""
    config = CLIMATE["regions"].get(region)
    if config is None:
        return []
    active = [season for season in SEASONAL_CALENDAR
              if month - 1 in season["months"] and season["name"] not in config["exclude"]]
    for key, months in config["overlays"].items():
        if month - 1 in months:
            areas = CLIMATE.get("overlay_regions", {}).get(key)
            if areas and (coordinates is None or not any(
                area["lat"][0] <= coordinates[0] <= area["lat"][1]
                and area["lng"][0] <= coordinates[1] <= area["lng"][1] for area in areas)):
                continue
            tips = CLIMATE.get("regional_tips", {}).get(region, {}).get(key, CLIMATE["overlays"][key]["tips"])
            active.append({"name": key, "tips": tips})
    return active


def is_tip_active(tip: str, month: int, day: int) -> bool:
    # Shared tips contain no narrower date-specific claims. Season windows are
    # applied before selection; no LLM is responsible for geographic filtering.
    return True


class SeasonalSource(ContentSource):
    """Generates seasonal tips based on the publishing region and shared climate calendar."""

    def __init__(self, config: dict, recently_used_tip_hashes: list[str] | None = None) -> None:
        super().__init__(config)
        self._climate = climate_region(config)
        self._coordinates = parse_valid_coordinates(config.get("region_lat"), config.get("region_lng"))
        self._timezone = ZoneInfo(timezone_from_coords(config.get("region_lat"), config.get("region_lng"), "UTC"))
        self._recently_used = set(recently_used_tip_hashes or [])

    def fetch(self) -> list[RawContentItem]:
        """Generate seasonal tip items for the current date."""
        now = datetime.now(self._timezone)
        active = get_active_seasons(now.month, now.day, self._climate, self._coordinates)

        if not active:
            self.log.info("No active season for %s-%s", now.month, now.day)
            return []

        items: list[RawContentItem] = []
        now_utc = now.astimezone(timezone.utc)

        for season in active:
            tip = self._pick_tip(season["tips"], now.month, now.day)
            if tip is None:
                self.log.info("All tips exhausted for season %s", season["name"])
                continue

            items.append(self._make_item(
                title=tip,
                published_at=now_utc,
            ))

        return items

    def _pick_tip(self, tips: list[str], month: int, day: int) -> str | None:
        """Pick a tip not in the recently-used set. Falls back to random if all used."""
        active_tips = [t for t in tips if is_tip_active(t, month, day)]
        available = [t for t in active_tips if _tip_hash(t) not in self._recently_used]
        if available:
            return random.choice(available)
        # All active tips have been used recently — repeat an active tip rather
        # than falling back to stale copy from another part of the season.
        if active_tips:
            return random.choice(active_tips)
        return None
