-- Backwards compatible: yes. Adds service-only area candidate and displayed-point
-- lookups; keeps all existing endpoints and Post data. The caller applies the shared
-- audience predicate, then tests legacy rows' privacy-snapped points before pagination.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.pulse_feed_area_candidates(p_area_id uuid)
RETURNS SETOF public."Post"
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT p.* FROM public."Post" p
  JOIN public."PulseArea" a ON a.id = p_area_id
    AND a.opened_at IS NOT NULL AND a.opened_at <= now()
  CROSS JOIN LATERAL (SELECT
    CASE WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL THEN p.latitude ELSE p.effective_latitude END AS lat,
    CASE WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL THEN p.longitude ELSE p.effective_longitude END AS lng
  ) point
  WHERE p.distribution_targets @> ARRAY['place']::text[]
    AND (
      (p.area_id IS NOT NULL AND CASE WHEN a.kind = 'town'
        THEN public.pulse_area_town_id(p.area_id) = a.id ELSE p.area_id = a.id END)
      OR (p.area_id IS NULL AND a.kind = 'town'
        AND point.lat BETWEEN -90 AND 90
        AND point.lng BETWEEN -180 AND 180
        AND ST_DWithin(
          coalesce(a.boundary, a.centroid),
          ST_SetSRID(ST_MakePoint(point.lng, point.lat), 4326)::geography,
          CASE WHEN a.boundary IS NULL THEN a.radius_m ELSE 0 END + 2000))
    );
$$;

CREATE FUNCTION public.pulse_area_contains_displayed_points(p_area_id uuid, p_points jsonb)
RETURNS TABLE(id uuid)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT point.id FROM public."PulseArea" a
  CROSS JOIN jsonb_to_recordset(p_points) AS point(id uuid, latitude double precision, longitude double precision)
  WHERE a.id = p_area_id AND a.opened_at IS NOT NULL AND a.opened_at <= now()
    AND point.latitude BETWEEN -90 AND 90 AND point.longitude BETWEEN -180 AND 180
    AND CASE WHEN a.boundary IS NOT NULL THEN ST_Covers(a.boundary,
      ST_SetSRID(ST_MakePoint(point.longitude, point.latitude), 4326)::geography)
      ELSE ST_DWithin(a.centroid,
        ST_SetSRID(ST_MakePoint(point.longitude, point.latitude), 4326)::geography, a.radius_m) END;
$$;

REVOKE ALL ON FUNCTION public.pulse_feed_area_candidates(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_feed_area_candidates(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.pulse_area_contains_displayed_points(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_area_contains_displayed_points(uuid, jsonb) TO service_role;
COMMIT;
