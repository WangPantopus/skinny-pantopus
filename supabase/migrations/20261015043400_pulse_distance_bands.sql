-- Backwards compatible: yes. Adds a service-only density lookup using existing
-- Home/HomeOccupancy rows. The server applies the shared current-resident policy;
-- no private points, home ids or measured distances enter a Pulse response.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.pulse_distance_band_occupancies(
  p_reader_home uuid, p_low_m double precision, p_high_m double precision
)
RETURNS SETOF public."HomeOccupancy"
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT o.*
  FROM public."Home" reader
  JOIN public."Home" h ON ST_DWithin(h.location, reader.location, p_high_m)
    AND ST_Distance(h.location, reader.location) >= p_low_m
    AND ST_Distance(h.location, reader.location) < p_high_m
  JOIN public."HomeOccupancy" o ON o.home_id = h.id
  WHERE reader.id = p_reader_home AND reader.location IS NOT NULL
    AND p_low_m >= 0 AND p_high_m > p_low_m
  ORDER BY h.id, o.id;
$$;

REVOKE ALL ON FUNCTION public.pulse_distance_band_occupancies(uuid, double precision, double precision)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_distance_band_occupancies(uuid, double precision, double precision)
  TO service_role;

COMMIT;
