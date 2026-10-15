-- Backwards compatible: yes. Reuses AddressCalendarRule and existing service-only
-- writers; existing weekly/biweekly rules and household authorization are unchanged.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.set_home_pickup_rules(p_home_id text, p_rows jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    inserted integer;
BEGIN
    DELETE FROM "public"."AddressCalendarRule"
     WHERE scope_type = 'home'
       AND scope_key = p_home_id
       AND kind IN ('garbage', 'recycling', 'yard_waste', 'bulk_pickup');

    INSERT INTO "public"."AddressCalendarRule"
        (scope_type, scope_key, kind, title, detail, rrule, dtstart, until, all_day,
         lead_days, source, source_url, confidence, created_by, updated_at)
    SELECT 'home',
           p_home_id,
           r.kind,
           r.title,
           r.detail,
           r.rrule,
           r.dtstart,
           r.until,
           COALESCE(r.all_day, true),
           COALESCE(r.lead_days, 1),
           r.source,
           r.source_url,
           COALESCE(r.confidence, 'official'),
           r.created_by,
           COALESCE(r.updated_at, now())
      FROM jsonb_to_recordset(p_rows) AS r(
           kind text, title text, detail text, rrule text, dtstart date, until date,
           all_day boolean, lead_days integer, source text, source_url text,
           confidence text, created_by uuid, updated_at timestamptz);

    GET DIAGNOSTICS inserted = ROW_COUNT;
    RETURN inserted;
END;
$$;



CREATE OR REPLACE FUNCTION public.mutate_home_pickup_calendar(p_home_id uuid, p_user_id uuid, p_rows jsonb)
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
      AND kind IN ('garbage', 'recycling', 'yard_waste', 'bulk_pickup');
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 4 THEN
      RAISE EXCEPTION 'Invalid pickup rules' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT FROM jsonb_array_elements(p_rows) r WHERE jsonb_typeof(r) <> 'object'
      OR r->>'kind' IS NULL OR r->>'kind' NOT IN ('garbage', 'recycling', 'yard_waste', 'bulk_pickup')
      OR r->>'created_by' IS DISTINCT FROM p_user_id::text) THEN
      RAISE EXCEPTION 'Invalid pickup author or kind' USING ERRCODE = '22023';
    END IF;
    SELECT public.set_home_pickup_rules(p_home_id::text, p_rows) INTO v_count;
  END IF;
  RETURN jsonb_build_object('allowed', true, 'count', v_count);
END;
$$;


CREATE OR REPLACE FUNCTION public.home_pickup_schedule_version(p_home_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(md5(string_agg(id::text, ',' ORDER BY id)), 'none')
  FROM public."AddressCalendarRule"
  WHERE scope_type = 'home' AND scope_key = p_home_id::text
    AND kind IN ('garbage', 'recycling', 'yard_waste', 'bulk_pickup');
$$;


REVOKE ALL ON FUNCTION public.set_home_pickup_rules(text, jsonb),
  public.mutate_home_pickup_calendar(uuid, uuid, jsonb), public.home_pickup_schedule_version(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_home_pickup_rules(text, jsonb),
  public.mutate_home_pickup_calendar(uuid, uuid, jsonb) TO service_role;
