-- Backwards compatible: yes. Adds a nullable read scope; every existing post keeps
-- its existing audience rules. No creation path writes a scope until the shared
-- audience wall is installed on every read path. Deploy migration before backend.
-- The two server-only functions resolve public area ancestry, not residency.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."Post" ADD COLUMN read_scope text
  CHECK (read_scope IN ('public', 'verified_town', 'verified_area'));

CREATE FUNCTION public.pulse_area_town_id(p_area_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH RECURSIVE ancestors AS (
    SELECT a.id, a.parent_id, a.kind, ARRAY[a.id] AS visited
    FROM public."PulseArea" a
    WHERE a.id = p_area_id AND a.opened_at IS NOT NULL AND a.opened_at <= now()
    UNION ALL
    SELECT parent.id, parent.parent_id, parent.kind, ancestors.visited || parent.id
    FROM ancestors JOIN public."PulseArea" parent ON parent.id = ancestors.parent_id
    WHERE parent.opened_at IS NOT NULL AND parent.opened_at <= now()
      AND NOT parent.id = ANY(ancestors.visited) AND cardinality(ancestors.visited) < 16
  )
  SELECT id FROM ancestors WHERE kind = 'town' LIMIT 1;
$$;

-- A PostgREST computed field lets the shared server predicate filter by verified
-- town before pagination without sending every street/place id in a request URL.
-- The unnamed row argument keeps it out of the RPC interface.
CREATE FUNCTION public.pulse_post_town_id(public."Post")
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, extensions
AS $$ SELECT public.pulse_area_town_id($1.area_id); $$;

REVOKE ALL ON FUNCTION public.pulse_area_town_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pulse_post_town_id(public."Post") FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_area_town_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pulse_post_town_id(public."Post") TO service_role;

COMMIT;
