"""Coordinate parsing helpers shared across handlers and sources."""

from __future__ import annotations

import math


def parse_valid_coordinates(lat: object, lng: object) -> tuple[float, float] | None:
    """Return finite in-range coordinates, rejecting null-island and junk values."""
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(lat_f) or not math.isfinite(lng_f):
        return None
    if not (-90.0 <= lat_f <= 90.0 and -180.0 <= lng_f <= 180.0):
        return None
    if lat_f == 0.0 and lng_f == 0.0:
        return None

    return lat_f, lng_f
