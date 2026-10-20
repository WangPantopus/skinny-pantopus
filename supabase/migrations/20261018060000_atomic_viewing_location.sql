-- Keep the selected area and recent history together. The existing unique
-- user_id key serializes saves, including two devices choosing their first
-- location at once. No new tables or client grants are needed.
-- Backwards compatible: yes. Additive service-only function; the deployed app can keep
-- writing the existing tables. Apply this before deploying its new caller.
CREATE OR REPLACE FUNCTION public.set_user_viewing_location(p_user_id uuid, p_location jsonb)
RETURNS public."UserViewingLocation"
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
SET lock_timeout = '5s'
AS $$
DECLARE
  v_location public."UserViewingLocation";
BEGIN
  INSERT INTO public."UserViewingLocation" (
    user_id, label, type, latitude, longitude, radius_miles,
    is_pinned, source_id, city, state, zipcode, updated_at
  ) VALUES (
    p_user_id, p_location->>'label', (p_location->>'type')::public.viewing_location_type,
    (p_location->>'latitude')::double precision,
    (p_location->>'longitude')::double precision,
    (p_location->>'radius_miles')::integer,
    (p_location->>'is_pinned')::boolean,
    (p_location->>'source_id')::uuid,
    p_location->>'city', p_location->>'state', p_location->>'zipcode',
    clock_timestamp()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    label = EXCLUDED.label,
    type = EXCLUDED.type,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    radius_miles = EXCLUDED.radius_miles,
    is_pinned = EXCLUDED.is_pinned,
    source_id = EXCLUDED.source_id,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zipcode = EXCLUDED.zipcode,
    updated_at = clock_timestamp()
  RETURNING * INTO v_location;

  -- The row lock above lasts through history insertion and the existing trim
  -- trigger, so concurrent saves cannot leave duplicates or more than five.
  -- Equality treats %, _ and * in a label literally, unlike an ILIKE pattern.
  DELETE FROM public."UserRecentLocation"
  WHERE user_id = p_user_id AND lower(label) = lower(v_location.label);

  INSERT INTO public."UserRecentLocation" (
    user_id, label, type, latitude, longitude, radius_miles,
    source_id, city, state, zipcode, used_at
  ) VALUES (
    p_user_id, v_location.label, v_location.type,
    v_location.latitude, v_location.longitude, v_location.radius_miles,
    v_location.source_id, v_location.city, v_location.state,
    v_location.zipcode, clock_timestamp()
  );

  RETURN v_location;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_viewing_location(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_viewing_location(uuid, jsonb) TO service_role;
