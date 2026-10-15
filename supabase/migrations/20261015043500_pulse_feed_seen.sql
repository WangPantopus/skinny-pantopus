-- Backwards compatible: yes. Adds nullable markers to the existing preferences
-- table and a service-only atomic update; old clients and preferences keep working.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."UserFeedPreference"
  ADD COLUMN pulse_nearby_seen_at timestamptz,
  ADD COLUMN pulse_following_seen_at timestamptz;

CREATE FUNCTION public.pulse_advance_feed_seen(p_user_id uuid, p_view text, p_through timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = public
AS $$
DECLARE marker timestamptz;
BEGIN
  IF p_view NOT IN ('nearby', 'following') OR p_view IS NULL OR p_through IS NULL
    OR NOT isfinite(p_through) THEN
    RAISE EXCEPTION 'Invalid Pulse seen marker' USING ERRCODE = '22023';
  END IF;
  IF p_view = 'nearby' THEN
    INSERT INTO public."UserFeedPreference" (user_id, pulse_nearby_seen_at)
      VALUES (p_user_id, least(p_through, now()))
      ON CONFLICT (user_id) DO UPDATE SET pulse_nearby_seen_at =
        greatest("UserFeedPreference".pulse_nearby_seen_at, excluded.pulse_nearby_seen_at)
      RETURNING pulse_nearby_seen_at INTO marker;
  ELSE
    INSERT INTO public."UserFeedPreference" (user_id, pulse_following_seen_at)
      VALUES (p_user_id, least(p_through, now()))
      ON CONFLICT (user_id) DO UPDATE SET pulse_following_seen_at =
        greatest("UserFeedPreference".pulse_following_seen_at, excluded.pulse_following_seen_at)
      RETURNING pulse_following_seen_at INTO marker;
  END IF;
  RETURN marker;
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_advance_feed_seen(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_advance_feed_seen(uuid, text, timestamptz) TO service_role;
COMMIT;
