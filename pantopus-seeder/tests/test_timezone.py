"""Tests for timezone derivation from coordinates."""

from src.discovery.timezone import timezone_from_coords


class TestTimezoneFromCoords:
    def test_eastern_new_york(self):
        assert timezone_from_coords(40.7128, -74.0060) == "America/New_York"

    def test_eastern_miami(self):
        assert timezone_from_coords(25.7617, -80.1918) == "America/New_York"

    def test_central_chicago(self):
        assert timezone_from_coords(41.8781, -87.6298) == "America/Chicago"

    def test_central_dallas(self):
        assert timezone_from_coords(32.7767, -96.7970) == "America/Chicago"

    def test_mountain_denver(self):
        assert timezone_from_coords(39.7392, -104.9903) == "America/Denver"

    def test_mountain_phoenix(self):
        assert timezone_from_coords(33.4484, -112.0740) == "America/Phoenix"

    def test_navajo_nation_stays_denver(self):
        assert timezone_from_coords(36.99, -109.05) == "America/Denver"

    def test_pacific_los_angeles(self):
        assert timezone_from_coords(34.0522, -118.2437) == "America/Los_Angeles"

    def test_pacific_seattle(self):
        assert timezone_from_coords(47.6062, -122.3321) == "America/Los_Angeles"

    def test_pacific_portland(self):
        assert timezone_from_coords(45.5152, -122.6784) == "America/Los_Angeles"

    def test_alaska_anchorage(self):
        assert timezone_from_coords(61.2181, -149.9003) == "America/Anchorage"

    def test_hawaii_honolulu(self):
        assert timezone_from_coords(21.3069, -157.8583) == "Pacific/Honolulu"
