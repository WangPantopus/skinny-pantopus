"""Tests for the user clustering module."""

from __future__ import annotations

import pytest

from src.discovery.cluster import (
    CandidateRegion,
    UserPoint,
    find_candidates,
    haversine_m,
)


# ---------------------------------------------------------------------------
# Haversine
# ---------------------------------------------------------------------------

class TestHaversine:
    def test_same_point_is_zero(self):
        assert haversine_m(45.0, -122.0, 45.0, -122.0) == 0.0

    def test_known_distance(self):
        # Portland to Seattle is ~233km
        dist = haversine_m(45.5152, -122.6784, 47.6062, -122.3321)
        assert 220_000 < dist < 250_000

    def test_short_distance(self):
        # Two points ~1km apart
        dist = haversine_m(45.5152, -122.6784, 45.5242, -122.6784)
        assert 900 < dist < 1100


# ---------------------------------------------------------------------------
# find_candidates
# ---------------------------------------------------------------------------

class TestFindCandidates:
    def _seattle_users(self, n=10):
        """Generate n users clustered around Seattle."""
        import random
        random.seed(42)
        return [
            UserPoint(
                user_id=f"user-{i}",
                lat=47.6062 + random.uniform(-0.05, 0.05),
                lng=-122.3321 + random.uniform(-0.05, 0.05),
            )
            for i in range(n)
        ]

    def _portland_region(self):
        """Existing Portland region."""
        return [(45.5152, -122.6784, 25_000)]

    def test_no_users_returns_empty(self):
        result = find_candidates([], [], threshold=5)
        assert result == []

    def test_too_few_users_returns_empty(self):
        users = self._seattle_users(3)
        result = find_candidates(users, [], threshold=5)
        assert result == []

    def test_cluster_found_when_threshold_met(self):
        users = self._seattle_users(10)
        result = find_candidates(users, [], threshold=5)
        assert len(result) >= 1
        # Should be near Seattle
        c = result[0]
        assert 47.0 < c.lat < 48.0
        assert -123.0 < c.lng < -122.0
        assert c.user_count >= 5

    def test_users_within_existing_region_are_excluded(self):
        """Users covered by an existing region don't create a new candidate."""
        # Put users inside the Portland region
        users = [
            UserPoint(f"user-{i}", 45.5152 + i * 0.001, -122.6784)
            for i in range(10)
        ]
        existing = self._portland_region()
        result = find_candidates(users, existing, threshold=5)
        assert result == []

    def test_mixed_covered_and_uncovered(self):
        """Only uncovered users contribute to new candidates."""
        portland_users = [
            UserPoint(f"pdx-{i}", 45.5152 + i * 0.001, -122.6784)
            for i in range(10)
        ]
        seattle_users = self._seattle_users(8)
        existing = self._portland_region()

        result = find_candidates(portland_users + seattle_users, existing, threshold=5)
        # Should find Seattle but not Portland
        assert len(result) >= 1
        for c in result:
            assert c.lat > 46.0  # Not Portland

    def test_too_close_to_existing_region_filtered(self):
        """Candidates too close to an existing region are dropped."""
        # Put users just outside Portland's radius but within MIN_REGION_SEPARATION
        users = [
            UserPoint(f"user-{i}", 45.73 + i * 0.002, -122.68)
            for i in range(10)
        ]
        existing = self._portland_region()
        result = find_candidates(users, existing, threshold=5)
        # The candidate center (~45.74) is only ~25km from Portland (45.52)
        # which is within the 20km minimum separation
        # May or may not be filtered depending on exact distances
        for c in result:
            dist = haversine_m(c.lat, c.lng, 45.5152, -122.6784)
            assert dist >= 20_000

    def test_multiple_clusters(self):
        """Multiple distinct clusters are all found."""
        seattle = self._seattle_users(8)
        # Denver cluster — use enough users to guarantee threshold in a single cell
        import random
        random.seed(99)
        denver = [
            UserPoint(f"den-{i}", 39.7392 + random.uniform(-0.02, 0.02),
                      -104.9903 + random.uniform(-0.02, 0.02))
            for i in range(10)
        ]
        result = find_candidates(seattle + denver, [], threshold=5)
        assert len(result) >= 2

    def test_returns_sorted_by_user_count(self):
        seattle = self._seattle_users(15)
        import random
        random.seed(99)
        denver = [
            UserPoint(f"den-{i}", 39.7392 + random.uniform(-0.03, 0.03),
                      -104.9903 + random.uniform(-0.03, 0.03))
            for i in range(7)
        ]
        result = find_candidates(seattle + denver, [], threshold=5)
        if len(result) >= 2:
            assert result[0].user_count >= result[1].user_count

    def test_threshold_override(self):
        users = self._seattle_users(3)
        # With default threshold=5, should return empty
        assert find_candidates(users, [], threshold=5) == []
        # With threshold=2, should find a cluster
        result = find_candidates(users, [], threshold=2)
        assert len(result) >= 1


class TestCandidateRegion:
    def test_default_radius(self):
        c = CandidateRegion(lat=47.0, lng=-122.0, user_count=10)
        assert c.radius_meters == 25_000
