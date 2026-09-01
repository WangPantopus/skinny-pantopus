"""Reverse geocoding for naming discovered regions.

Uses the free Nominatim API (OpenStreetMap) with no API key required.
Falls back to a lat/lng-based name if the API call fails.
"""

from __future__ import annotations

import logging
import re

import httpx

log = logging.getLogger("seeder.discovery.geocode")

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
_TIMEOUT = 10  # seconds
_USER_AGENT = "Pantopus-Seeder/1.0 (region-discovery)"


def reverse_geocode(lat: float, lng: float) -> dict[str, str]:
    """Reverse geocode a lat/lng to get city, state, and a display name.

    Returns a dict with keys:
        region_id:    slug like "seattle_wa" or "denver_co"
        display_name: human-readable like "Seattle, WA"
        city:         city name
        state:        state abbreviation
        query:        Google News search query like "Seattle WA local news"

    Falls back to coordinate-based naming on any failure.
    """
    try:
        response = httpx.get(
            _NOMINATIM_URL,
            params={
                "lat": lat,
                "lon": lng,
                "format": "jsonv2",
                "zoom": 10,  # city-level detail
                "addressdetails": 1,
            },
            headers={"User-Agent": _USER_AGENT},
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
    except Exception:
        log.warning("Nominatim reverse geocode failed for (%.4f, %.4f)", lat, lng, exc_info=True)
        return _fallback_name(lat, lng)

    address = data.get("address", {})

    # Extract city — Nominatim uses various keys depending on the area
    city = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
        or address.get("county", "").replace(" County", "")
    )

    state = address.get("state", "")
    state_abbr = _state_abbreviation(state)

    if not city:
        return _fallback_name(lat, lng)

    region_id = _slugify(f"{city}_{state_abbr}".lower())
    display_name = f"{city}, {state_abbr}" if state_abbr else city
    query = f"{city} {state_abbr} local news" if state_abbr else f"{city} local news"

    return {
        "region_id": region_id,
        "display_name": display_name,
        "city": city,
        "state": state_abbr,
        "query": query,
    }


def _fallback_name(lat: float, lng: float) -> dict[str, str]:
    """Generate a coordinate-based name when geocoding fails."""
    # Create a readable slug from coordinates
    lat_dir = "n" if lat >= 0 else "s"
    lng_dir = "e" if lng >= 0 else "w"
    lat_str = f"{abs(lat):.1f}".replace(".", "_")
    lng_str = f"{abs(lng):.1f}".replace(".", "_")
    region_id = f"region_{lat_dir}{lat_str}_{lng_dir}{lng_str}"

    return {
        "region_id": region_id,
        "display_name": f"Region ({lat:.2f}, {lng:.2f})",
        "city": "",
        "state": "",
        "query": f"{lat:.2f} {lng:.2f} local news",
    }


def _slugify(text: str) -> str:
    """Convert text to a URL/ID-safe slug."""
    text = re.sub(r"[^a-z0-9_]", "_", text.lower())
    text = re.sub(r"_+", "_", text)
    return text.strip("_")


# US state name → abbreviation mapping
_STATE_ABBREVS: dict[str, str] = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
    "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
    "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
    "new mexico": "NM", "new york": "NY", "north carolina": "NC",
    "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
    "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
    "vermont": "VT", "virginia": "VA", "washington": "WA",
    "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
    "district of columbia": "DC",
}


def _state_abbreviation(state: str) -> str:
    """Convert a full state name to its abbreviation. Returns as-is if already abbreviated."""
    if not state:
        return ""
    if len(state) <= 2:
        return state.upper()
    return _STATE_ABBREVS.get(state.lower(), state[:2].upper())
