-- Backwards compatible: yes. Existing RPC signatures and reference rows remain;
-- invalid or unverified shared membership and minor authority now fail closed.
-- No new role defaults, membership mutation policy or verification-age rollout.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.home_role_rank(p_role public.home_role_base)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT CASE p_role
    WHEN 'service_provider' THEN 5 WHEN 'guest' THEN 10
    WHEN 'restricted_member' THEN 20 WHEN 'member' THEN 30
    WHEN 'lease_resident' THEN 35 WHEN 'manager' THEN 40
    WHEN 'admin' THEN 50 WHEN 'owner' THEN 60 ELSE 0 END;
$$;

-- SECURITY DEFINER avoids recursing through Home/HomeOccupancy/override RLS.
-- Only service_role may invoke the resolver directly. Existing public wrappers
-- call it as the function owner, but the original database role/JWT still limits
-- their p_user_id to the current user. Never authorize from current_user here:
-- that would be the SECURITY DEFINER owner for every caller.
CREATE FUNCTION public.home_effective_access(p_home_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_denied constant jsonb := '{"role_base":null,"effective_role_base":null,"age_band":null,"has_access":false,"is_owner":false,"permissions":[]}';
  v_home public."Home"%ROWTYPE;
  v_occ public."HomeOccupancy"%ROWTYPE;
  v_has_occ boolean;
  v_role public.home_role_base;
  v_effective_role public.home_role_base;
  v_owner boolean := false;
  v_minor boolean := false;
  v_permissions text[];
  v_age_ceiling text[] := ARRAY[
    'home.view', 'members.view', 'tasks.view', 'calendar.view', 'docs.view',
    'packages.view', 'maintenance.view', 'assets.view', 'devices.view', 'vendors.view'];
BEGIN
  IF p_home_id IS NULL OR p_user_id IS NULL THEN RETURN v_denied; END IF;
  IF p_user_id IS DISTINCT FROM auth.uid()
    AND coalesce(current_setting('role', true), '') <> 'service_role'
    AND NOT (coalesce(current_setting('role', true), 'none') = 'none'
      AND session_user IN ('postgres', 'supabase_admin')) THEN
    RETURN v_denied;
  END IF;

  SELECT * INTO v_home FROM public."Home" WHERE id = p_home_id;
  IF NOT FOUND THEN RETURN v_denied; END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy"
    WHERE home_id = p_home_id AND user_id = p_user_id;
  v_has_occ := FOUND;
  IF v_has_occ THEN
    v_role := v_occ.role_base;
    IF v_role IS NULL THEN
      v_role := CASE v_occ.role
        WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin'
        WHEN 'manager' THEN 'manager' WHEN 'property_manager' THEN 'manager'
        WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
        WHEN 'lease_resident' THEN 'lease_resident'
        WHEN 'member' THEN 'member' WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member'
        WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
        WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider'
        ELSE NULL END;
    END IF;
    -- An existing revoked/invalid occupancy fences even legacy/verified owners.
    -- NULL verification status is historical unknown, not verified residency.
    IF v_occ.is_active IS DISTINCT FROM true OR v_role IS NULL
      OR v_occ.verification_status IS DISTINCT FROM 'verified'
      OR (v_occ.start_at IS NOT NULL AND v_occ.start_at > now())
      OR (v_occ.end_at IS NOT NULL AND v_occ.end_at <= now())
      OR (v_occ.access_start_at IS NOT NULL AND v_occ.access_start_at > now())
      OR (v_occ.access_end_at IS NOT NULL AND v_occ.access_end_at <= now()) THEN
      RETURN v_denied;
    END IF;
    v_minor := v_occ.age_band IN ('child', 'teen');
  END IF;

  v_owner := v_home.owner_id = p_user_id OR EXISTS (
    SELECT FROM public."HomeOwner" o WHERE o.home_id = p_home_id
      AND o.subject_type = 'user' AND o.subject_id = p_user_id AND o.owner_status = 'verified')
    OR (v_has_occ AND v_role = 'owner');
  v_owner := coalesce(v_owner, false);
  IF NOT v_has_occ AND NOT v_owner THEN RETURN v_denied; END IF;
  v_role := coalesce(v_role, 'owner'::public.home_role_base);
  v_effective_role := CASE WHEN v_owner THEN 'owner'::public.home_role_base ELSE v_role END;
  IF coalesce(v_minor, false) THEN
    IF v_occ.age_band = 'child' AND public.home_role_rank(v_effective_role) > 20 THEN
      v_effective_role := 'restricted_member';
    ELSIF v_occ.age_band = 'teen' AND public.home_role_rank(v_effective_role) > 30 THEN
      v_effective_role := 'member';
    END IF;
    IF v_occ.age_band = 'teen' THEN
      v_age_ceiling := v_age_ceiling || ARRAY[
        'tasks.edit', 'calendar.edit', 'docs.upload', 'maintenance.edit', 'packages.edit'];
    END IF;
  END IF;

  -- Preserve explicit user grants over role defaults. Owner entitlement uses
  -- owner defaults; a recorded member default cannot demote verified ownership.
  -- Explicit user denies win, then minor ceilings restrict every source.
  SELECT coalesce(array_agg(p::text ORDER BY p::text), '{}'::text[])
    INTO v_permissions
    FROM unnest(enum_range(NULL::public.home_permission)) AS p
    WHERE ((v_owner AND NOT EXISTS (
      SELECT FROM public."HomeRolePermission" r WHERE r.role_base = 'owner'
        AND r.permission = p AND NOT r.allowed)) OR (NOT v_owner AND EXISTS (
      SELECT FROM public."HomeRolePermission" r WHERE r.role_base = v_role
        AND r.permission = p AND r.allowed))
      OR EXISTS (SELECT FROM public."HomePermissionOverride" o
        WHERE o.home_id = p_home_id AND o.user_id = p_user_id AND o.permission = p AND o.allowed))
    AND NOT EXISTS (SELECT FROM public."HomePermissionOverride" o
      WHERE o.home_id = p_home_id AND o.user_id = p_user_id AND o.permission = p AND NOT o.allowed)
    AND (NOT coalesce(v_minor, false) OR p::text = ANY(v_age_ceiling));

  RETURN jsonb_build_object('role_base', v_role, 'effective_role_base', v_effective_role,
    'age_band', v_occ.age_band, 'has_access', true,
    'is_owner', v_owner AND NOT coalesce(v_minor, false), 'permissions', v_permissions);
END;
$$;
REVOKE ALL ON FUNCTION public.home_effective_access(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_effective_access(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.home_get_user_permissions(p_home_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT ARRAY(SELECT jsonb_array_elements_text(
    public.home_effective_access(p_home_id, p_user_id)->'permissions'));
$$;
CREATE OR REPLACE FUNCTION public.home_has_permission(p_home_id uuid, p_perm public.home_permission, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(p_perm::text = ANY(public.home_get_user_permissions(p_home_id, p_user_id)), false);
$$;
CREATE OR REPLACE FUNCTION public.home_is_active_member(p_home_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce((public.home_effective_access(p_home_id, p_user_id)->>'has_access')::boolean, false);
$$;
CREATE OR REPLACE FUNCTION public.home_my_role(p_home_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS public.home_role_base LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (public.home_effective_access(p_home_id, p_user_id)->>'effective_role_base')::public.home_role_base;
$$;
CREATE OR REPLACE FUNCTION public.home_has_role_at_least(p_home_id uuid, p_min_role public.home_role_base, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_min_role IS NOT NULL AND public.home_is_active_member(p_home_id, p_user_id)
    AND public.home_role_rank(public.home_my_role(p_home_id, p_user_id)) >= public.home_role_rank(p_min_role);
$$;
CREATE OR REPLACE FUNCTION public.home_can_see_visibility(p_home_id uuid, p_vis public.home_record_visibility, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.home_is_active_member(p_home_id, p_user_id) AND coalesce(CASE p_vis
    WHEN 'public' THEN true WHEN 'members' THEN true
    WHEN 'managers' THEN public.home_has_role_at_least(p_home_id, 'manager', p_user_id)
    WHEN 'sensitive' THEN public.home_has_permission(p_home_id, 'sensitive.view', p_user_id)
    ELSE false END, false);
$$;
CREATE OR REPLACE FUNCTION public.has_home_permission(p_home_id uuid, p_perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(CASE p_perm
    WHEN 'manage_home' THEN public.home_has_permission(p_home_id, 'home.edit')
    -- Legacy bill/subscription policies use this flag for mutations. A viewer
    -- must not gain write authority merely because it can read finance data.
    WHEN 'manage_finance' THEN public.home_has_permission(p_home_id, 'finance.manage')
    WHEN 'manage_access' THEN public.home_has_permission(p_home_id, 'access.manage') OR public.home_has_permission(p_home_id, 'members.manage')
    WHEN 'manage_tasks' THEN public.home_has_permission(p_home_id, 'tasks.edit') OR public.home_has_permission(p_home_id, 'tasks.manage')
    WHEN 'view_sensitive' THEN public.home_has_permission(p_home_id, 'sensitive.view')
    ELSE false END, false);
$$;
CREATE OR REPLACE FUNCTION public.home_member_can(p_home_id uuid, p_perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.has_home_permission(p_home_id, p_perm);
$$;

CREATE OR REPLACE FUNCTION public.is_home_member(p_home_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.home_is_active_member(p_home_id);
$$;

-- Keep existing callable wrappers (including anonymous RLS evaluation), remove
-- implicit PUBLIC execution, and make their intended grants explicit.
REVOKE ALL ON FUNCTION public.home_role_rank(public.home_role_base),
  public.home_get_user_permissions(uuid, uuid),
  public.home_has_permission(uuid, public.home_permission, uuid),
  public.home_is_active_member(uuid, uuid), public.home_my_role(uuid, uuid),
  public.home_has_role_at_least(uuid, public.home_role_base, uuid),
  public.home_can_see_visibility(uuid, public.home_record_visibility, uuid),
  public.has_home_permission(uuid, text), public.home_member_can(uuid, text),
  public.is_home_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.home_role_rank(public.home_role_base),
  public.home_get_user_permissions(uuid, uuid),
  public.home_has_permission(uuid, public.home_permission, uuid),
  public.home_is_active_member(uuid, uuid), public.home_my_role(uuid, uuid),
  public.home_has_role_at_least(uuid, public.home_role_base, uuid),
  public.home_can_see_visibility(uuid, public.home_record_visibility, uuid),
  public.has_home_permission(uuid, text), public.home_member_can(uuid, text),
  public.is_home_member(uuid) TO anon, authenticated, service_role;
