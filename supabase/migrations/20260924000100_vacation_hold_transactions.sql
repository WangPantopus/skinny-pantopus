-- Backwards compatible: yes. Adds a service-only function; existing tables,
-- columns and endpoint response shapes remain supported. Old app callers work.
-- Deploy before the backend. No tables or existing rows change at deployment.
-- Separate PostgREST writes acknowledged failed User updates/cancellations and
-- overwrote another surviving hold's summary. One per-user transaction owns
-- these existing rows; stored handling preferences do not execute deliveries.
CREATE OR REPLACE FUNCTION public.vacation_hold_transition(
  p_user_id uuid,
  p_action text,
  p_hold_id uuid DEFAULT NULL,
  p_home_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_hold_action text DEFAULT 'hold_in_vault',
  p_package_action text DEFAULT 'hold_at_carrier',
  p_auto_neighbor_request boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET lock_timeout = '5s'
AS $$
DECLARE
  v_hold public."VacationHold"%ROWTYPE;
  v_active public."VacationHold"%ROWTYPE;
  v_upcoming public."VacationHold"%ROWTYPE;
  v_summary public."VacationHold"%ROWTYPE;
  v_now timestamp;
  v_reused boolean := false;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('start', 'cancel', 'status') THEN
    RAISE EXCEPTION 'VACATION_ACTION_INVALID';
  END IF;
  -- The backend supplies its authenticated actor; only service_role can call.
  -- Every writer, including the hourly job, takes the same existing row lock.
  PERFORM id FROM public."User" WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VACATION_USER_NOT_FOUND'; END IF;
  v_now := clock_timestamp() AT TIME ZONE 'UTC';

  IF p_action = 'start' THEN
    IF p_home_id IS NULL OR p_start_date IS NULL OR p_end_date IS NULL
      OR NOT isfinite(p_start_date) OR NOT isfinite(p_end_date)
      OR p_end_date < p_start_date THEN
      RAISE EXCEPTION 'VACATION_DATES_INVALID';
    END IF;
    -- Replaying an identical save after a lost reply must not create a second
    -- record. Cancelled rows are deliberately excluded from this reuse.
    SELECT * INTO v_hold FROM public."VacationHold"
      WHERE user_id = p_user_id AND home_id = p_home_id
        AND start_date = p_start_date AND end_date = p_end_date
        AND hold_action = p_hold_action AND package_action = p_package_action
        AND auto_neighbor_request IS NOT DISTINCT FROM p_auto_neighbor_request
        AND status <> 'cancelled'
      ORDER BY created_at, id LIMIT 1;
    v_reused := FOUND;
    IF NOT v_reused THEN
      INSERT INTO public."VacationHold" (user_id, home_id, start_date, end_date,
        hold_action, package_action, auto_neighbor_request, status, items_held_count)
      VALUES (p_user_id, p_home_id, p_start_date, p_end_date, p_hold_action,
        p_package_action, p_auto_neighbor_request, 'scheduled', 0)
      RETURNING * INTO v_hold;
    END IF;
  ELSIF p_action = 'cancel' THEN
    SELECT * INTO v_hold FROM public."VacationHold"
      WHERE id = p_hold_id AND user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'VACATION_HOLD_NOT_OWNED'; END IF;
    v_reused := v_hold.status = 'cancelled';
    UPDATE public."VacationHold" SET status = 'cancelled'
      WHERE id = v_hold.id AND status <> 'cancelled';
  END IF;

  -- Preserve the existing UTC instant boundary: a return DATE represents its
  -- UTC midnight, and the interval is finished once that instant has passed.
  -- A job that missed the entire scheduled interval completes it directly.
  UPDATE public."VacationHold"
    SET status = CASE WHEN end_date::timestamp < v_now THEN 'completed'
      WHEN start_date::timestamp <= v_now THEN 'active' ELSE 'scheduled' END
    WHERE user_id = p_user_id AND status IN ('active', 'scheduled')
      AND status IS DISTINCT FROM CASE WHEN end_date::timestamp < v_now THEN 'completed'
        WHEN start_date::timestamp <= v_now THEN 'active' ELSE 'scheduled' END;

  SELECT * INTO v_active FROM public."VacationHold"
    WHERE user_id = p_user_id AND status = 'active'
    ORDER BY start_date, created_at, id LIMIT 1;
  SELECT * INTO v_upcoming FROM public."VacationHold"
    WHERE user_id = p_user_id AND status = 'scheduled'
    ORDER BY start_date, created_at, id LIMIT 1;
  IF v_active.id IS NOT NULL THEN v_summary := v_active;
  ELSE v_summary := v_upcoming; END IF;
  UPDATE public."User" SET vacation_mode = (v_active.id IS NOT NULL),
    vacation_start = v_summary.start_date, vacation_end = v_summary.end_date
    WHERE id = p_user_id;

  IF v_hold.id IS NOT NULL THEN
    SELECT * INTO v_hold FROM public."VacationHold" WHERE id = v_hold.id;
  END IF;
  RETURN jsonb_build_object('hold', CASE WHEN v_hold.id IS NULL THEN NULL ELSE to_jsonb(v_hold) END,
    'active', CASE WHEN v_active.id IS NULL THEN NULL ELSE to_jsonb(v_active) END,
    'upcoming', CASE WHEN v_upcoming.id IS NULL THEN NULL ELSE to_jsonb(v_upcoming) END,
    'reused', v_reused);
END $$;

REVOKE ALL ON FUNCTION public.vacation_hold_transition(uuid,text,uuid,uuid,date,date,text,text,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vacation_hold_transition(uuid,text,uuid,uuid,date,date,text,text,boolean)
  TO service_role;
