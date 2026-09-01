"""Density-based clustering to find user concentrations not covered by existing regions.

Algorithm:
1. Load all user viewing locations from UserViewingLocation
2. Load all active regions from seeder_config
3. Filter out users already within an existing region's radius
4. For remaining "uncovered" users, find the densest concentration
5. If density >= threshold, propose a new region at that cluster center

Uses a simple grid-cell approach (no external dependencies):
- Divide the map into ~25km cells
- Count uncovered users per cell
- The densest cell (if >= threshold) becomes a candidate region
- Merge adjacent dense cells into a single region center
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass

log = logging.getLogger("seeder.discovery.cluster")

# Default: 5 users in one area triggers a new region
DEFAULT_USER_THRESHOLD = 5

# Grid cell size in degrees (~25km at mid-latitudes)
_CELL_SIZE_DEG = 0.25  # ~27.8km at 45° latitude

# Minimum distance between a new region center and any existing region (meters)
_MIN_REGION_SEPARATION_M = 20_000

# Earth radius in meters
_EARTH_RADIUS_M = 6_371_000


@dataclass(frozen=True)
class UserPoint:
    """A user's location."""

    user_id: str
    lat: float
    lng: float


@dataclass(frozen=True)
class CandidateRegion:
    """A proposed new region discovered from user clustering."""

    lat: float
    lng: float
    user_count: int
    radius_meters: int = 25_000


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in meters between two lat/lng points."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * _EARTH_RADIUS_M * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _is_within_any_region(
    lat: float,
    lng: float,
    existing_regions: list[tuple[float, float, int]],
) -> bool:
    """Check if a point is within any existing region's radius.

    existing_regions is a list of (lat, lng, radius_meters).
    """
    for rlat, rlng, radius in existing_regions:
        if haversine_m(lat, lng, rlat, rlng) <= radius:
            return True
    return False


def _grid_key(lat: float, lng: float) -> tuple[int, int]:
    """Map a lat/lng to a grid cell key."""
    return (int(math.floor(lat / _CELL_SIZE_DEG)), int(math.floor(lng / _CELL_SIZE_DEG)))


def _cell_center(key: tuple[int, int]) -> tuple[float, float]:
    """Return the center lat/lng of a grid cell."""
    return (
        (key[0] + 0.5) * _CELL_SIZE_DEG,
        (key[1] + 0.5) * _CELL_SIZE_DEG,
    )


def find_candidates(
    user_points: list[UserPoint],
    existing_regions: list[tuple[float, float, int]],
    threshold: int = DEFAULT_USER_THRESHOLD,
) -> list[CandidateRegion]:
    """Find user clusters that warrant new regions.

    Args:
        user_points: All user locations.
        existing_regions: List of (lat, lng, radius_meters) for active regions.
        threshold: Minimum users in a cluster to propose a new region.

    Returns:
        List of CandidateRegion, sorted by user_count descending.
    """
    # Step 1: Filter out users already covered by existing regions
    uncovered: list[UserPoint] = [
        p for p in user_points
        if not _is_within_any_region(p.lat, p.lng, existing_regions)
    ]

    log.info(
        "User clustering: %d total users, %d uncovered by existing regions",
        len(user_points),
        len(uncovered),
    )

    if len(uncovered) < threshold:
        return []

    # Step 2: Grid-cell counting
    cells: dict[tuple[int, int], list[UserPoint]] = {}
    for p in uncovered:
        key = _grid_key(p.lat, p.lng)
        cells.setdefault(key, []).append(p)

    # Step 3: Find cells meeting the threshold
    dense_cells = [
        (key, points) for key, points in cells.items()
        if len(points) >= threshold
    ]

    if not dense_cells:
        # Try merging adjacent cells: a 2x2 block might collectively meet threshold
        candidates = _merge_adjacent_cells(cells, threshold)
    else:
        candidates = []
        for key, points in dense_cells:
            # Use the centroid of actual users (not the grid center) for better accuracy
            avg_lat = sum(p.lat for p in points) / len(points)
            avg_lng = sum(p.lng for p in points) / len(points)
            candidates.append(CandidateRegion(lat=avg_lat, lng=avg_lng, user_count=len(points)))

    # Step 4: Ensure candidates aren't too close to existing regions
    filtered = []
    for c in candidates:
        too_close = any(
            haversine_m(c.lat, c.lng, rlat, rlng) < _MIN_REGION_SEPARATION_M
            for rlat, rlng, _ in existing_regions
        )
        if too_close:
            log.info("Candidate at (%.4f, %.4f) too close to existing region, skipping", c.lat, c.lng)
            continue
        filtered.append(c)

    # Also ensure new candidates aren't too close to each other
    final: list[CandidateRegion] = []
    for c in sorted(filtered, key=lambda x: x.user_count, reverse=True):
        if any(haversine_m(c.lat, c.lng, f.lat, f.lng) < _MIN_REGION_SEPARATION_M for f in final):
            continue
        final.append(c)

    return final


def _merge_adjacent_cells(
    cells: dict[tuple[int, int], list[UserPoint]],
    threshold: int,
) -> list[CandidateRegion]:
    """Try to merge adjacent grid cells to find clusters that span cell boundaries."""
    candidates = []
    visited: set[tuple[int, int]] = set()

    for key in sorted(cells.keys(), key=lambda k: len(cells[k]), reverse=True):
        if key in visited:
            continue

        # Collect this cell + all neighbors (3x3 block)
        r, c = key
        cluster_points: list[UserPoint] = []
        cluster_keys: list[tuple[int, int]] = []

        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                neighbor = (r + dr, c + dc)
                if neighbor in cells and neighbor not in visited:
                    cluster_points.extend(cells[neighbor])
                    cluster_keys.append(neighbor)

        if len(cluster_points) >= threshold:
            avg_lat = sum(p.lat for p in cluster_points) / len(cluster_points)
            avg_lng = sum(p.lng for p in cluster_points) / len(cluster_points)
            candidates.append(CandidateRegion(
                lat=avg_lat, lng=avg_lng, user_count=len(cluster_points)
            ))
            # Mark all cells in this cluster as visited
            for ck in cluster_keys:
                visited.add(ck)

    return candidates
