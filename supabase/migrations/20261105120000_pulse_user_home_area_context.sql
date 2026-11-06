-- Backwards compatible: yes. Adds a server-only read that returns pulse_home_area_context's rows for the homes of a
-- person's active occupancies, so the backend reads a viewer's homes and their Pulse areas in one round trip instead
-- of two (the backend keeps only the rows of the homes it finds eligible). No rows, tables, policies or existing
-- functions change. A backend without this function, or deployed before it, keeps reading the areas as before.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.pulse_user_home_area_context(p_user_id uuid)
RETURNS TABLE(home_id uuid, area_id uuid, inside boolean, distance_m double precision,
  kind text, name text, slug text, parent_id uuid, state text, opened_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT c.home_id, c.area_id, c.inside, c.distance_m, c.kind, c.name, c.slug, c.parent_id, c.state, c.opened_at
  FROM public.pulse_home_area_context(ARRAY(
    SELECT o.home_id FROM public."HomeOccupancy" o
    WHERE o.user_id = p_user_id AND o.is_active
    ORDER BY o.created_at, o.home_id
  )) AS c;
$$;

REVOKE ALL ON FUNCTION public.pulse_user_home_area_context(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_user_home_area_context(uuid) TO service_role;

COMMIT;
