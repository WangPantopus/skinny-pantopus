-- Backwards compatible: yes. Adds a server-only read that returns pulse_home_area_matches' rows, in their order, with
-- each matched open area's public fields, so the backend reads a viewer's Pulse areas in one call instead of two. No
-- rows, tables or existing functions change. Deploy before the backend that calls it.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.pulse_home_area_context(p_home_ids uuid[])
RETURNS TABLE(home_id uuid, area_id uuid, inside boolean, distance_m double precision,
  kind text, name text, slug text, parent_id uuid, state text, opened_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT m.home_id, m.area_id, m.inside, m.distance_m, a.kind, a.name, a.slug, a.parent_id, a.state, a.opened_at
  FROM public.pulse_home_area_matches(p_home_ids) WITH ORDINALITY AS m(home_id, area_id, inside, distance_m, n)
  JOIN public."PulseArea" a ON a.id = m.area_id
  ORDER BY m.n;
$$;

REVOKE ALL ON FUNCTION public.pulse_home_area_context(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_home_area_context(uuid[]) TO service_role;

COMMIT;
