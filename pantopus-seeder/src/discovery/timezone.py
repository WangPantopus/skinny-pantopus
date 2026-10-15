"""Offline IANA timezone lookup from geographic polygons, including US exceptions."""

from __future__ import annotations

import struct
from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from src.utils.coordinates import parse_valid_coordinates


def valid_timezone(value: object) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        ZoneInfo(value)
        return value
    except (ValueError, ZoneInfoNotFoundError):
        return None


@lru_cache(maxsize=1)
def _finder():
    # Read polygon data on demand rather than retaining the entire dataset in
    # every Lambda. Reuse the index for the lifetime of the warm invocation.
    from timezonefinder import TimezoneFinder
    return TimezoneFinder(in_memory=False)


def timezone_from_coords(lat: object, lng: object, fallback: str | None = "UTC") -> str | None:
    point = parse_valid_coordinates(lat, lng)
    if point:
        zone = _finder().timezone_at(lat=point[0], lng=point[1])
        if valid_timezone(zone):
            return zone
    return valid_timezone(fallback) or (None if fallback is None else "UTC")


def timezone_for_home(home: dict, fallback: str | None = "UTC") -> str | None:
    explicit = valid_timezone(home.get("timezone"))
    if explicit:
        return explicit
    point = parse_valid_coordinates(home.get("map_center_lat"), home.get("map_center_lng"))
    if point is None:
        point = parse_valid_coordinates(home.get("latitude"), home.get("longitude"))
    location = home.get("location")
    if point is None and isinstance(location, dict):
        coords = location.get("coordinates", [])
        if len(coords) >= 2:
            point = parse_valid_coordinates(coords[1], coords[0])
    if point is None and isinstance(location, str):
        try:
            if "POINT(" in location:
                lng, lat = location.split("POINT(", 1)[1].rstrip(")").split()
                point = parse_valid_coordinates(lat, lng)
            elif len(location) in (42, 50):
                data = bytes.fromhex(location)
                order = "<" if data[0] == 1 else ">"
                kind = struct.unpack_from(order + "I", data, 1)[0]
                if kind & 0xFF == 1:
                    lng, lat = struct.unpack_from(order + "dd", data, 9 if kind & 0x20000000 else 5)
                    point = parse_valid_coordinates(lat, lng)
        except (ValueError, TypeError, struct.error):
            pass
    return timezone_from_coords(*(point or (None, None)), fallback=fallback)
