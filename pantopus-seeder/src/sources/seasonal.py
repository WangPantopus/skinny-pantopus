"""Date-based seasonal tip generator for the PNW region."""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from src.sources.base import ContentSource, RawContentItem

PACIFIC = ZoneInfo("America/Los_Angeles")

# ---------------------------------------------------------------------------
# PNW Seasonal Calendar
# ---------------------------------------------------------------------------
# Each season: name, (start_month, start_day), (end_month, end_day), tips list.
# Date ranges are inclusive. Overlaps are intentional.

SEASONAL_CALENDAR: list[dict] = [
    {
        "name": "winter_ice",
        "start": (12, 1),
        "end": (2, 29),
        "tips": [
            "If you haven't insulated exposed pipes yet, late fall is the time. "
            "A single hard freeze can burst an unprotected outdoor spigot, and plumber "
            "availability drops fast once temperatures dip below 30.",
            "Rock salt works on driveways but it kills grass along the edges. "
            "Sand or kitty litter gives traction on walkways without the lawn damage.",
            "Keep a flashlight, batteries, and a phone charger bank somewhere easy to grab. "
            "Portland-Vancouver ice storms knock out power for days more often than people expect.",
            "January is a great month for indoor projects — organizing the garage, painting a room, "
            "or finally fixing that sticky cabinet door. The daylight is short anyway.",
            "Schedule a furnace tune-up before the coldest stretch hits. Most HVAC companies "
            "offer lower rates in early December before the holiday rush.",
        ],
    },
    {
        "name": "spring_cleanup",
        "start": (3, 1),
        "end": (4, 30),
        "tips": [
            "Clark County, WA and Portland both run yard debris pickup in March and April. "
            "Check your hauler's schedule so you don't miss the free pickup window.",
            "Gutters packed with winter debris cause basement leaks during spring rain. "
            "Flushing them in early March saves a lot of headaches later.",
            "Moss grows aggressively on PNW roofs over winter. Treating it in spring "
            "before it sets deep roots makes removal a lot easier and cheaper.",
            "Pressure washing the driveway and siding in April clears a winter's worth "
            "of algae and grime before it stains permanently.",
            "Early spring is the best planting window for PNW natives — Oregon grape, "
            "sword fern, and red flowering currant all do well when planted before May.",
        ],
    },
    {
        "name": "summer_dry",
        "start": (6, 1),
        "end": (8, 31),
        "tips": [
            "Most PNW lawns go dormant in summer heat and come back fine in fall. "
            "Watering deeply once a week beats light daily sprinkling every time.",
            "Outdoor painting and staining projects go fastest in July and August "
            "when you can count on dry weather for proper curing.",
            "If you're traveling this summer, neighborhood pet-sitting swaps "
            "are more reliable than apps — ask around before booking a stranger.",
            "Vegetable gardens here need about an inch of water per week through August. "
            "A soaker hose on a timer is the easiest way to stay consistent.",
            "Clear dry brush and dead vegetation at least 30 feet from your home. "
            "Wildfire risk in the Portland-Vancouver area has climbed noticeably in recent summers.",
        ],
    },
    {
        "name": "smoke_season",
        "start": (7, 15),
        "end": (9, 30),
        "tips": [
            "Smoke season typically runs July through September in the Portland-Vancouver area. "
            "Replacing HVAC filters before it starts makes a real difference indoors.",
            "On heavy smoke days, the library, community centers, and malls all have filtered air. "
            "Worth knowing if your home doesn't have good air sealing.",
            "If anyone in your household has asthma or respiratory issues, stock up on medications "
            "before smoke season peaks. Pharmacies get busy when air quality drops.",
            "A box fan with a furnace filter taped to the back is a cheap DIY air purifier "
            "that actually works. MERV 13 filters are the sweet spot for smoke particles.",
        ],
    },
    {
        "name": "fall_prep",
        "start": (9, 1),
        "end": (11, 30),
        "tips": [
            "Late October is when most Clark County, WA homeowners schedule gutter cleaning. "
            "Booking early usually means better rates and more availability.",
            "Big-leaf maples drop an enormous volume of leaves in the Portland-Vancouver area. "
            "Mulching them into the lawn with a mower is faster than raking and feeds the soil.",
            "Weatherstripping doors and windows before November pays for itself in a single "
            "heating season. The foam tape from any hardware store takes about ten minutes per door.",
            "If your furnace hasn't run since spring, turn it on before you actually need it. "
            "Finding out it needs repair on the first cold night is not ideal.",
            "Roof inspections are easiest in dry October weather. Missing or cracked shingles "
            "caught now won't become leaks during November rain.",
        ],
    },
    {
        "name": "holiday_season",
        "start": (11, 15),
        "end": (12, 31),
        "tips": [
            "Package theft spikes between Thanksgiving and Christmas. If you won't be home, "
            "a neighbor willing to grab your boxes is the simplest solution.",
            "Outdoor holiday lights pull more current than people expect. Using one heavy-duty "
            "outdoor extension cord per circuit prevents tripped breakers and fire risk.",
            "Heading out of town for the holidays? A neighbor who can check on your house "
            "and grab your mail is worth more than any smart-home camera.",
            "Winterization deadlines sneak up fast — disconnect garden hoses and shut off "
            "exterior spigot valves before the first hard freeze, usually by mid-December here.",
        ],
    },
]

# Optional narrower publication windows for tips that mention specific timing.
# The broad seasonal calendar says when a theme is relevant; these windows keep
# date-specific copy from being posted after its useful window has passed.
TIP_ACTIVE_WINDOWS: dict[str, tuple[tuple[int, int], tuple[int, int]]] = {
    "January is a great month for indoor projects — organizing the garage, painting a room, "
    "or finally fixing that sticky cabinet door. The daylight is short anyway.": (
        (1, 1),
        (1, 31),
    ),
    "Schedule a furnace tune-up before the coldest stretch hits. Most HVAC companies "
    "offer lower rates in early December before the holiday rush.": (
        (12, 1),
        (12, 15),
    ),
    "Gutters packed with winter debris cause basement leaks during spring rain. "
    "Flushing them in early March saves a lot of headaches later.": (
        (3, 1),
        (3, 15),
    ),
    "Pressure washing the driveway and siding in April clears a winter's worth "
    "of algae and grime before it stains permanently.": (
        (4, 1),
        (4, 30),
    ),
    "Early spring is the best planting window for PNW natives — Oregon grape, "
    "sword fern, and red flowering currant all do well when planted before May.": (
        (3, 1),
        (4, 30),
    ),
    "Smoke season typically runs July through September in the Portland-Vancouver area. "
    "Replacing HVAC filters before it starts makes a real difference indoors.": (
        (6, 1),
        (7, 14),
    ),
    "Late October is when most Clark County, WA homeowners schedule gutter cleaning. "
    "Booking early usually means better rates and more availability.": (
        (9, 1),
        (10, 31),
    ),
    "Weatherstripping doors and windows before November pays for itself in a single "
    "heating season. The foam tape from any hardware store takes about ten minutes per door.": (
        (9, 1),
        (10, 31),
    ),
    "Roof inspections are easiest in dry October weather. Missing or cracked shingles "
    "caught now won't become leaks during November rain.": (
        (10, 1),
        (10, 31),
    ),
    "Winterization deadlines sneak up fast — disconnect garden hoses and shut off "
    "exterior spigot valves before the first hard freeze, usually by mid-December here.": (
        (11, 15),
        (12, 15),
    ),
}


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


def get_active_seasons(month: int, day: int) -> list[dict]:
    """Return all seasons active on the given month/day."""
    return [
        season for season in SEASONAL_CALENDAR
        if _date_in_range(month, day, season["start"], season["end"])
    ]


def is_tip_active(tip: str, month: int, day: int) -> bool:
    """Return whether a tip is appropriate to publish on the given date."""
    window = TIP_ACTIVE_WINDOWS.get(tip)
    if window is None:
        return True

    start, end = window
    return _date_in_range(month, day, start, end)


class SeasonalSource(ContentSource):
    """Generates seasonal tips based on the current date and PNW seasonal calendar."""

    def __init__(self, config: dict, recently_used_tip_hashes: list[str] | None = None) -> None:
        super().__init__(config)
        self._recently_used = set(recently_used_tip_hashes or [])

    def fetch(self) -> list[RawContentItem]:
        """Generate seasonal tip items for the current date."""
        now = datetime.now(PACIFIC)
        active = get_active_seasons(now.month, now.day)

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
