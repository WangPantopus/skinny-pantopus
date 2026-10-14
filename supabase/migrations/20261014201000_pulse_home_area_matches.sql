-- Backwards compatible: yes. Adds a server-only spatial lookup for Pulse's existing
-- Home and PulseArea records. No rows or existing functions change. The caller first
-- checks current occupancy and address verification with the shared Home policy.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.pulse_home_area_matches(p_home_ids uuid[])
RETURNS TABLE(home_id uuid, area_id uuid, inside boolean, distance_m double precision)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT h.id, a.id,
    CASE WHEN a.boundary IS NOT NULL THEN ST_Covers(a.boundary, h.location)
      ELSE ST_DWithin(a.centroid, h.location, a.radius_m) END,
    CASE WHEN a.boundary IS NOT NULL THEN ST_Distance(a.boundary, h.location)
      ELSE greatest(0::double precision, ST_Distance(a.centroid, h.location) - a.radius_m) END
  FROM public."Home" h
  CROSS JOIN public."PulseArea" a
  WHERE h.id = ANY(p_home_ids)
    AND h.location IS NOT NULL
    AND a.opened_at IS NOT NULL AND a.opened_at <= now()
    AND CASE WHEN a.boundary IS NOT NULL THEN ST_DWithin(a.boundary, h.location, 24140.16)
      ELSE ST_DWithin(a.centroid, h.location, a.radius_m + 24140.16) END;
$$;

REVOKE ALL ON FUNCTION public.pulse_home_area_matches(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_home_area_matches(uuid[]) TO service_role;

COMMIT;
