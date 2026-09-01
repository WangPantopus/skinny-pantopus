-- Track the last density milestone shown to the user for their home
ALTER TABLE "HomeOccupancy"
  ADD COLUMN IF NOT EXISTS "density_milestone_seen" integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN "HomeOccupancy"."density_milestone_seen"
  IS 'Last neighbor-density milestone (25/50/100/200/500) the user has seen for this home';

-- Count distinct verified users with homes within a given radius of a point.
-- Uses PostGIS ST_DWithin on the Home.location geography column.
CREATE OR REPLACE FUNCTION public.count_neighbors_within(
  center_lat double precision,
  center_lng double precision,
  radius_meters integer DEFAULT 1609
)
RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT count(DISTINCT ho.user_id)::integer
  FROM "HomeOccupancy" ho
  JOIN "Home" h ON h.id = ho.home_id
  WHERE ho.is_active = true
    AND h.location IS NOT NULL
    AND ST_DWithin(
          h.location,
          ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
          radius_meters
        );
$$;
