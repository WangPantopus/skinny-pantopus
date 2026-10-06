-- Backwards compatible: yes. Replaces one internal policy helper; no table,
-- column or data change, and its grants are restated unchanged.
-- Pickup days are a household utility: everyone with Home access can see them
-- and residents can change them unless an owner denies calendar.edit. The write
-- check only refused explicit denies, and the guest and service-provider roles
-- have none, so a household guest (an invited house sitter or cleaner) could
-- replace the whole household's schedule and its reminders. Only that check
-- changes: those two roles need an explicit calendar.edit grant to write; reads,
-- residents, the private-setup creator path and explicit denies are unchanged.
-- Latest definition: supabase/migrations/20260910003000_home_pickup_private_access.sql:5
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.home_pickup_calendar_allowed(p_home_id uuid, p_user_id uuid, p_write boolean)
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
    -- Guests and service providers don't live here: they see the household's
    -- pickup days, but only an explicit calendar.edit grant lets them change it.
    IF p_write AND v_role IN ('guest', 'service_provider') AND v_override IS NOT TRUE THEN
      RETURN false;
    END IF;
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

REVOKE ALL ON FUNCTION public.home_pickup_calendar_allowed(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_pickup_calendar_allowed(uuid, uuid, boolean) TO service_role;
