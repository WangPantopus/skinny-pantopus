-- Migration 082: Fix get_user_home_locations to fall back to map_center_lat/lng
-- when the PostGIS location column is NULL.
-- This ensures homes with only flat coordinates still return their position.

CREATE OR REPLACE FUNCTION "public"."get_user_home_locations"("p_user_id" "uuid")
RETURNS TABLE(
  "home_id" "uuid",
  "home_name" "text",
  "address" character varying,
  "city" character varying,
  "state" character varying,
  "zipcode" character varying,
  "latitude" double precision,
  "longitude" double precision
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id        AS home_id,
    h.name      AS home_name,
    h.address,
    h.city,
    h.state,
    h.zipcode,
    COALESCE(
      CASE WHEN h.location IS NOT NULL THEN ST_Y(h.location::geometry) END,
      h.map_center_lat
    ) AS latitude,
    COALESCE(
      CASE WHEN h.location IS NOT NULL THEN ST_X(h.location::geometry) END,
      h.map_center_lng
    ) AS longitude
  FROM "HomeOccupancy" ho
  JOIN "Home" h ON ho.home_id = h.id
  WHERE ho.user_id = p_user_id
    AND ho.is_active = TRUE
  ORDER BY ho.created_at ASC;  -- first home = primary
END;
$$;
