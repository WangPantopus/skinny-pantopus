-- Backwards compatible: yes. Replaces find_nearest_activity_center with the same
-- signature, owner and grants and the same gig, business and listing branches;
-- the 'post' branch is gone, so p_content_type => 'post' returns no row.
--
-- The posts map's empty-viewport hint no longer comes from this function: the
-- API picks it from the posts the viewer's map would show, at the points the
-- map shows them (backend/services/feedService.js findNearestMapPost,
-- docs/location-privacy-matrix.md). An API from before that change gets no hint
-- for posts until it is updated, and the map itself works as before.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.find_nearest_activity_center(p_center_lat double precision, p_center_lon double precision, p_content_type text DEFAULT 'gig'::text) RETURNS TABLE(latitude double precision, longitude double precision)
    LANGUAGE plpgsql STABLE
    AS $$
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
$$;
