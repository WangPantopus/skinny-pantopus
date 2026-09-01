-- Migration 120: Backfill map_center_lat/lng from PostGIS location column
-- Fixes weather/briefing location resolution for homes created before
-- the home creation route started populating these flat coordinate columns.

UPDATE "Home"
SET
  map_center_lat = ST_Y(location::geometry),
  map_center_lng = ST_X(location::geometry)
WHERE location IS NOT NULL
  AND (map_center_lat IS NULL OR map_center_lng IS NULL);
