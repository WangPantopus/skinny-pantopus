-- Backwards compatible: yes. Add coordinates to the service-only authorized
-- calendar context so local dates use the home's timezone in every state.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.get_home_pickup_calendar(p_home_id uuid, p_user_id uuid)
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
      'map_center_lat', v_home.map_center_lat, 'map_center_lng', v_home.map_center_lng,
      'location', ST_AsGeoJSON(v_home.location)::jsonb,
      'county', to_jsonb(v_home)->'county', 'timezone', to_jsonb(v_home)->'timezone'), 'rules', v_rules);
END;
$$;

REVOKE ALL ON FUNCTION public.get_home_pickup_calendar(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_pickup_calendar(uuid, uuid) TO service_role;
