-- Migration 080: Fix post branch + add listing branch to find_nearest_activity_center
-- The post branch was using nonexistent effective_latitude/effective_longitude columns
-- and Euclidean distance instead of PostGIS KNN operator.
-- Post table has a proper location geography(Point,4326) column — use it like other branches.
-- Also adds a 'listing' content_type branch for MarketplaceMap.

CREATE OR REPLACE FUNCTION find_nearest_activity_center(
  p_center_lat double precision,
  p_center_lon double precision,
  p_content_type text DEFAULT 'gig'
)
RETURNS TABLE(latitude double precision, longitude double precision) AS $$
BEGIN
  IF p_content_type = 'gig' THEN
    RETURN QUERY
      SELECT
        ST_Y(g.approx_location::geometry)::double precision AS latitude,
        ST_X(g.approx_location::geometry)::double precision AS longitude
      FROM "Gig" g
      WHERE g.approx_location IS NOT NULL
        AND g.status = 'open'
      ORDER BY g.approx_location <-> ST_SetSRID(ST_MakePoint(p_center_lon, p_center_lat), 4326)::geography
      LIMIT 1;

  ELSIF p_content_type = 'business' THEN
    RETURN QUERY
      SELECT
        ST_Y(bl.location::geometry)::double precision AS latitude,
        ST_X(bl.location::geometry)::double precision AS longitude
      FROM "BusinessLocation" bl
      WHERE bl.location IS NOT NULL
        AND bl.is_primary = true
      ORDER BY bl.location <-> ST_SetSRID(ST_MakePoint(p_center_lon, p_center_lat), 4326)::geography
      LIMIT 1;

  ELSIF p_content_type = 'post' THEN
    RETURN QUERY
      SELECT
        ST_Y(p.location::geometry)::double precision AS latitude,
        ST_X(p.location::geometry)::double precision AS longitude
      FROM "Post" p
      WHERE p.location IS NOT NULL
        AND p.is_archived = false
      ORDER BY p.location <-> ST_SetSRID(ST_MakePoint(p_center_lon, p_center_lat), 4326)::geography
      LIMIT 1;

  ELSIF p_content_type = 'listing' THEN
    RETURN QUERY
      SELECT
        ST_Y(l.location::geometry)::double precision AS latitude,
        ST_X(l.location::geometry)::double precision AS longitude
      FROM "Listing" l
      WHERE l.location IS NOT NULL
        AND l.status = 'active'
      ORDER BY l.location <-> ST_SetSRID(ST_MakePoint(p_center_lon, p_center_lat), 4326)::geography
      LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
