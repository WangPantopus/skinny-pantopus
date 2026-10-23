-- Backwards compatible: yes. Keeps spatial-reference rows and server geography
-- operations unchanged; denies client-role writes, including TRUNCATE. No new
-- table. Supabase owns this extension as supabase_admin: REVOKE by postgres can
-- merely warn, but its existing TRIGGER privilege permits this statement guard.
-- Keep the guard even on installations where the migration role can revoke.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.guard_spatial_reference_writes() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'Spatial reference metadata is server-managed' USING ERRCODE='42501';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.guard_spatial_reference_writes() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER spatial_reference_server_writes
  BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.spatial_ref_sys
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_spatial_reference_writes();

DO $$
BEGIN
  -- Only issue REVOKE when this role can actually change the extension owner's
  -- grants; avoid another warning-only migration that appears to close access.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c
    WHERE c.oid='public.spatial_ref_sys'::regclass
      AND pg_catalog.pg_has_role(current_user, c.relowner, 'USAGE')) THEN
    REVOKE ALL ON public.spatial_ref_sys, public.geometry_columns, public.geography_columns
      FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
