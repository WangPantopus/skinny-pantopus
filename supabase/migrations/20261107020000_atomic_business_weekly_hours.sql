-- Backwards compatible: yes. Adds a service-only replacement operation on the
-- existing hours table; existing columns, reads and the 1–7 row API stay valid.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE FUNCTION public.replace_business_weekly_hours(
  p_business_id uuid,
  p_location_id uuid,
  p_hours jsonb
) RETURNS SETOF public."BusinessHours"
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '5s'
AS $$
DECLARE
  requested_hours jsonb;
  saved_hours jsonb;
BEGIN
  -- The backend checks hours.edit before calling this service-only function.
  -- Lock the parent so concurrent replacements cannot combine two schedules.
  PERFORM 1 FROM public."BusinessLocation"
  WHERE id = p_location_id AND business_user_id = p_business_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Location not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_hours IS NULL OR jsonb_typeof(p_hours) <> 'array' THEN
    RAISE EXCEPTION 'Invalid weekly hours' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_hours) NOT BETWEEN 1 AND 7 THEN
    RAISE EXCEPTION 'Invalid weekly hours' USING ERRCODE = '22023';
  END IF;

  -- Parse times before changing rows. Normalize the same fields as the API,
  -- retaining multiple intervals per day and optional notes.
  SELECT jsonb_agg(to_jsonb(h) ORDER BY day_of_week, open_time, close_time, is_closed, notes)
  INTO requested_hours
  FROM (
    SELECT day_of_week,
      CASE WHEN is_closed THEN NULL ELSE open_time END AS open_time,
      CASE WHEN is_closed THEN NULL ELSE close_time END AS close_time,
      is_closed, nullif(notes, '') AS notes
    FROM jsonb_to_recordset(p_hours) AS incoming(
      day_of_week smallint, open_time time, close_time time, is_closed boolean, notes text
    )
  ) h;

  SELECT jsonb_agg(to_jsonb(h) ORDER BY day_of_week, open_time, close_time, is_closed, notes)
  INTO saved_hours
  FROM (
    SELECT day_of_week, open_time, close_time, is_closed, notes
    FROM public."BusinessHours" WHERE location_id = p_location_id
  ) h;

  -- A retry after a lost successful response must not regenerate row IDs or
  -- timestamps. Input order and HH:MM versus HH:MM:SS do not change the week.
  IF requested_hours IS DISTINCT FROM saved_hours THEN
    DELETE FROM public."BusinessHours" WHERE location_id = p_location_id;
    INSERT INTO public."BusinessHours"
      (location_id, day_of_week, open_time, close_time, is_closed, notes)
    SELECT p_location_id, day_of_week, open_time, close_time, is_closed, notes
    FROM jsonb_to_recordset(requested_hours) AS incoming(
      day_of_week smallint, open_time time, close_time time, is_closed boolean, notes text
    );
    -- Any insert failure rolls the deletion back with this transaction.
  END IF;

  RETURN QUERY SELECT h.* FROM public."BusinessHours" h
    WHERE h.location_id = p_location_id ORDER BY h.day_of_week, h.open_time, h.id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_business_weekly_hours(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_business_weekly_hours(uuid, uuid, jsonb) TO service_role;

COMMIT;
