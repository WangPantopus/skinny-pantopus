-- Backwards compatible: yes. Existing pickup rules and RPC remain unchanged;
-- new service-only entry points preserve scoped private first use and retries.
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.home_pickup_calendar_allowed(p_home_id uuid, p_user_id uuid, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_occ public."HomeOccupancy"%ROWTYPE;
  v_access jsonb; v_permission public.home_permission; v_override boolean; v_role public.home_role_base;
BEGIN
  IF p_home_id IS NULL OR p_user_id IS NULL OR p_write IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id = p_home_id;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id = p_home_id AND user_id = p_user_id;
  IF v_occ.age_band = 'child' AND p_write THEN RETURN false; END IF;
  v_permission := (CASE WHEN p_write THEN 'calendar.edit' ELSE 'calendar.view' END)::public.home_permission;
  SELECT allowed INTO v_override FROM public."HomePermissionOverride"
    WHERE home_id = p_home_id AND user_id = p_user_id AND permission = v_permission;
  IF v_override IS FALSE THEN RETURN false; END IF;
  v_access := public.home_effective_access(p_home_id, p_user_id);
  IF (v_access->>'has_access')::boolean THEN
    -- Pickup is the existing membership-based utility, not a new shared event
    -- grant. Preserve that entitlement while respecting an explicit deny.
    v_role := CASE WHEN (v_access->>'is_owner')::boolean THEN 'owner'
      ELSE (v_access->>'role_base')::public.home_role_base END;
    RETURN v_override IS TRUE OR NOT EXISTS (SELECT FROM public."HomeRolePermission"
      WHERE role_base = v_role AND permission = v_permission AND NOT allowed);
  END IF;

  -- A pending creator may organize their own pickup calendar only. A matching
  -- address, a pending claim, another person's historic occupancy or any
  -- foreign-authored household rule cannot turn this into household access.
  IF v_home.created_by_user_id IS DISTINCT FROM p_user_id
    OR (v_home.owner_id IS NOT NULL AND v_home.owner_id <> p_user_id)
    OR v_home.security_state IN ('frozen', 'frozen_silent')
    OR v_occ.id IS NULL OR v_occ.is_active IS DISTINCT FROM true
    OR v_occ.verification_status NOT IN ('provisional_bootstrap', 'pending_doc')
    OR v_occ.verification_status IS NULL
    OR (v_occ.role_base IS NULL AND v_occ.role NOT IN ('owner','admin','manager','property_manager',
      'tenant','renter','lease_resident','member','roommate','family','restricted_member','caregiver','guest','service_provider'))
    OR (v_occ.role_base IS NULL AND v_occ.role IS NULL)
    OR v_occ.start_at > now() OR v_occ.end_at <= now()
    OR v_occ.access_start_at > now() OR v_occ.access_end_at <= now()
    OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id = p_home_id AND user_id <> p_user_id)
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id = p_home_id AND subject_id <> p_user_id)
    OR EXISTS (SELECT FROM public."AddressCalendarRule" WHERE scope_type = 'home'
      AND scope_key = p_home_id::text AND created_by IS DISTINCT FROM p_user_id) THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

-- Read authorization and all returned rules share one database snapshot.
-- The private creator cannot pass a check then read another member's new rule.
CREATE FUNCTION public.get_home_pickup_calendar(p_home_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_home public."Home"%ROWTYPE; v_rules jsonb;
BEGIN
  IF NOT public.home_pickup_calendar_allowed(p_home_id, p_user_id, false) THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id = p_home_id;
  SELECT coalesce(jsonb_agg(to_jsonb(r) - 'created_by' - 'created_at' - 'updated_at' ORDER BY r.id), '[]'::jsonb)
    INTO v_rules FROM public."AddressCalendarRule" r
    WHERE (r.scope_type = 'home' AND r.scope_key = p_home_id::text)
      OR (r.scope_type = 'state' AND r.scope_key = upper(trim(v_home.state)))
      OR (r.scope_type = 'city' AND r.scope_key = upper(trim(v_home.state)) || ':' || trim(v_home.city))
      OR (r.scope_type = 'county' AND r.scope_key = upper(trim(v_home.state)) || ':' || trim(to_jsonb(v_home)->>'county'));
  RETURN jsonb_build_object('allowed', true,
    'home', jsonb_build_object('id', v_home.id, 'city', v_home.city, 'state', v_home.state,
      'county', to_jsonb(v_home)->'county', 'timezone', to_jsonb(v_home)->'timezone'), 'rules', v_rules);
END;
$$;

CREATE FUNCTION public.mutate_home_pickup_calendar(p_home_id uuid, p_user_id uuid, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
SET lock_timeout = '5s' AS $$
DECLARE v_count integer;
BEGIN
  IF p_home_id IS NULL OR p_user_id IS NULL THEN RETURN jsonb_build_object('allowed', false); END IF;
  -- Lock the Home first: foreign-key insertions cannot create a competing
  -- occupancy/authority after the private-only test. Existing rows are locked
  -- as well so concurrent role/revocation writes settle before authorization.
  PERFORM id FROM public."Home" WHERE id = p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed', false); END IF;
  -- scope_key has no Home FK. Serialize brief writes against legacy/direct
  -- rule writers too, including insertion into a previously empty scope.
  LOCK TABLE public."AddressCalendarRule" IN SHARE ROW EXCLUSIVE MODE;
  PERFORM id FROM public."HomeOccupancy" WHERE home_id = p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeOwner" WHERE home_id = p_home_id ORDER BY id FOR UPDATE;
  PERFORM permission FROM public."HomePermissionOverride"
    WHERE home_id = p_home_id AND user_id = p_user_id ORDER BY permission FOR UPDATE;
  PERFORM id FROM public."AddressCalendarRule"
    WHERE scope_type = 'home' AND scope_key = p_home_id::text ORDER BY id FOR UPDATE;
  IF NOT public.home_pickup_calendar_allowed(p_home_id, p_user_id, true) THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;
  IF p_rows IS NULL THEN
    DELETE FROM public."AddressCalendarRule" WHERE scope_type = 'home' AND scope_key = p_home_id::text
      AND kind IN ('garbage', 'recycling', 'yard_waste');
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 3 THEN
      RAISE EXCEPTION 'Invalid pickup rules' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT FROM jsonb_array_elements(p_rows) r WHERE jsonb_typeof(r) <> 'object'
      OR r->>'kind' IS NULL OR r->>'kind' NOT IN ('garbage', 'recycling', 'yard_waste')
      OR r->>'created_by' IS DISTINCT FROM p_user_id::text) THEN
      RAISE EXCEPTION 'Invalid pickup author or kind' USING ERRCODE = '22023';
    END IF;
    SELECT public.set_home_pickup_rules(p_home_id::text, p_rows) INTO v_count;
  END IF;
  RETURN jsonb_build_object('allowed', true, 'count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.home_pickup_calendar_allowed(uuid, uuid, boolean),
  public.get_home_pickup_calendar(uuid, uuid), public.mutate_home_pickup_calendar(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_pickup_calendar_allowed(uuid, uuid, boolean),
  public.get_home_pickup_calendar(uuid, uuid), public.mutate_home_pickup_calendar(uuid, uuid, jsonb)
  TO service_role;
