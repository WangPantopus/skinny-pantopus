-- Backwards compatible: yes. Adds a version helper and a new service-only entry
-- point. get_home_pickup_calendar and the three-argument
-- mutate_home_pickup_calendar are unchanged, so clients that send no version
-- keep today's last-write-wins save.
SET LOCAL lock_timeout = '5s';

-- The household schedule a person loaded. Every save replaces the household's
-- pickup rules (set_home_pickup_rules deletes and inserts, so the ids are new)
-- and a reset deletes them, so the rule ids identify that schedule. The backend
-- derives the same value from the rule ids it returns
-- (addressCalendarService.pickupScheduleVersion).
CREATE FUNCTION public.home_pickup_schedule_version(p_home_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(md5(string_agg(id::text, ',' ORDER BY id)), 'none')
  FROM public."AddressCalendarRule"
  WHERE scope_type = 'home' AND scope_key = p_home_id::text
    AND kind IN ('garbage', 'recycling', 'yard_waste');
$$;

-- A save from a form that loaded an older schedule changes nothing and says
-- so, instead of silently undoing a save made meanwhile on another device.
CREATE FUNCTION public.mutate_home_pickup_calendar_if_unchanged(p_home_id uuid, p_user_id uuid,
  p_rows jsonb, p_expected_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
SET lock_timeout = '5s' AS $$
BEGIN
  IF p_home_id IS NULL OR p_user_id IS NULL THEN RETURN jsonb_build_object('allowed', false); END IF;
  IF p_expected_version IS NULL OR p_expected_version !~ '^(none|[0-9a-f]{32})$' THEN
    RAISE EXCEPTION 'Invalid pickup schedule version' USING ERRCODE = '22023';
  END IF;
  -- The same lock order as mutate_home_pickup_calendar, which takes these again.
  -- A competing save commits before this version check or waits behind it.
  PERFORM id FROM public."Home" WHERE id = p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed', false); END IF;
  LOCK TABLE public."AddressCalendarRule" IN SHARE ROW EXCLUSIVE MODE;
  IF public.home_pickup_schedule_version(p_home_id) IS DISTINCT FROM p_expected_version THEN
    -- Only someone who may change this calendar learns that it changed.
    IF NOT public.home_pickup_calendar_allowed(p_home_id, p_user_id, true) THEN
      RETURN jsonb_build_object('allowed', false);
    END IF;
    RETURN jsonb_build_object('allowed', true, 'changed', true);
  END IF;
  RETURN public.mutate_home_pickup_calendar(p_home_id, p_user_id, p_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.home_pickup_schedule_version(uuid),
  public.mutate_home_pickup_calendar_if_unchanged(uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_home_pickup_calendar_if_unchanged(uuid, uuid, jsonb, text)
  TO service_role;
