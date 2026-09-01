-- Migration 079: find_nearest_activity_center
-- Returns the lat/lon of the closest activity record to a given center point.
-- Used by map viewport endpoints when zero results are found in the bounding box.

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
        p.effective_latitude::double precision AS latitude,
        p.effective_longitude::double precision AS longitude
      FROM "Post" p
      WHERE p.effective_latitude IS NOT NULL
        AND p.effective_longitude IS NOT NULL
        AND p.status = 'published'
      ORDER BY
        (p.effective_latitude - p_center_lat) * (p.effective_latitude - p_center_lat) +
        (p.effective_longitude - p_center_lon) * (p.effective_longitude - p_center_lon)
      LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
