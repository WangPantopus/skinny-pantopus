"""Derive IANA timezone from coordinates using simple longitude-based rules.

Covers CONUS, Alaska, and Hawaii. Falls back to America/Chicago for
ambiguous cases. Good enough for auto-provisioned regions; operators
can override via seeder_config if needed.
"""

from __future__ import annotations


def timezone_from_coords(lat: float, lng: float) -> str:
    """Return an IANA timezone string for the given lat/lng."""
    # Hawaii
    if lat < 23 and lng < -154:
        return "Pacific/Honolulu"
    # Alaska
    if lat > 51 or lng < -130:
        return "America/Anchorage"
    # Arizona does not observe DST, except the Navajo Nation in the northeast corner.
    if 31.0 <= lat <= 37.1 and -114.9 <= lng <= -109.0:
        if lat >= 35.8 and lng >= -110.9:
            return "America/Denver"
        return "America/Phoenix"
    # Pacific (west of ~-114.5)
    if lng < -114.5:
        return "America/Los_Angeles"
    # Mountain (-114.5 to -102)
    if lng < -102:
        return "America/Denver"
    # Central (-102 to -87)
    if lng < -87:
        return "America/Chicago"
    # Eastern
    return "America/New_York"
