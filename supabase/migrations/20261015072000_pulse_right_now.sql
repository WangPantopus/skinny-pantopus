-- Backwards compatible: yes. Adds the approved private RightNowEvent and RightNowReport tables
-- (contract §4.2, tables 7 and 8; founder approval of October 14, 2026), a nullable
-- Post.right_now_event_id (no default, so no rewrite) and two service-only functions; no existing
-- row or endpoint changes, and older clients ignore the feed's right_now. Deploy before backend.
--
-- Right now (S12, contract §2.16): one active event per area and kind; reports belong to a
-- verified home, one per person and event. Ending an event also ends the Heads-ups that wait on it.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public."RightNowEvent" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public."PulseArea"(id),
  -- Never a crime kind (build spec §8).
  kind text NOT NULL CHECK (kind IN ('power_outage', 'water_outage', 'smoke', 'road_closure', 'severe_weather', 'boil_notice')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  origin text NOT NULL CHECK (origin IN ('official', 'neighbors')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  official_source_label text CHECK (official_source_label IS NULL OR char_length(official_source_label) <= 120),
  official_source_url text CHECK (official_source_url IS NULL OR char_length(official_source_url) <= 500),
  official_text text CHECK (official_text IS NULL OR char_length(official_text) <= 1000),
  official_updated_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  end_reason text CHECK (end_reason IS NULL OR end_reason IN ('cleared', 'its_back', 'quiet')),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public."User"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (origin = 'neighbors' OR (official_source_label IS NOT NULL AND official_text IS NOT NULL)),
  CHECK ((status = 'active') = (resolved_at IS NULL))
);
ALTER TABLE public."RightNowEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."RightNowEvent" FROM anon, authenticated;
GRANT ALL ON public."RightNowEvent" TO service_role;
CREATE UNIQUE INDEX "RightNowEvent_one_active" ON public."RightNowEvent" (area_id, kind) WHERE status = 'active';
CREATE INDEX ON public."RightNowEvent" (status, last_activity_at);

CREATE TABLE public."RightNowReport" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public."RightNowEvent"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  home_id uuid NOT NULL REFERENCES public."Home"(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('me_too', 'its_back')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public."RightNowReport" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."RightNowReport" FROM anon, authenticated;
GRANT ALL ON public."RightNowReport" TO service_role;
CREATE INDEX ON public."RightNowReport" (event_id, kind);
CREATE INDEX ON public."RightNowReport" (user_id);

-- A Heads-up tagged to an event (contract §2.16).
ALTER TABLE public."Post" ADD COLUMN right_now_event_id uuid REFERENCES public."RightNowEvent"(id) ON DELETE SET NULL;
CREATE INDEX "Post_right_now_event_idx" ON public."Post" (right_now_event_id) WHERE right_now_event_id IS NOT NULL;

-- Ends an active event and the Heads-ups that wait on it (tagged without their own end time).
CREATE FUNCTION public.pulse_right_now_end(p_event_id uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public."RightNowEvent" SET status = 'ended', resolved_at = now(), end_reason = p_reason, updated_at = now()
    WHERE id = p_event_id AND status = 'active';
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public."Post" SET expires_at = now()
    WHERE right_now_event_id = p_event_id AND post_metadata->>'ends_with_event' = 'true'
      AND (expires_at IS NULL OR expires_at > now());
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_right_now_end(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_right_now_end(uuid, text) TO service_role;

-- A home's report (the server checked the verified home first). One report per person and event,
-- replaced by a later one. Three homes saying "It's back" end a neighbors' event.
CREATE FUNCTION public.pulse_right_now_report(p_event_id uuid, p_user_id uuid, p_home_id uuid, p_kind text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  event public."RightNowEvent";
  back integer;
BEGIN
  SELECT * INTO event FROM public."RightNowEvent" WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'RIGHT_NOW_NOT_FOUND'); END IF;
  IF event.status <> 'active' THEN RETURN jsonb_build_object('code', 'RIGHT_NOW_ENDED'); END IF;
  IF p_kind IS NULL THEN
    DELETE FROM public."RightNowReport" WHERE event_id = event.id AND user_id = p_user_id;
    RETURN jsonb_build_object('code', NULL, 'ended', false);
  END IF;
  INSERT INTO public."RightNowReport" (event_id, user_id, home_id, kind) VALUES (event.id, p_user_id, p_home_id, p_kind)
    ON CONFLICT (event_id, user_id) DO UPDATE SET kind = EXCLUDED.kind, home_id = EXCLUDED.home_id, updated_at = now();
  UPDATE public."RightNowEvent" SET last_activity_at = now() WHERE id = event.id;
  IF event.origin = 'neighbors' AND p_kind = 'its_back' THEN
    SELECT count(DISTINCT r.home_id) INTO back FROM public."RightNowReport" r WHERE r.event_id = event.id AND r.kind = 'its_back';
    IF back >= 3 THEN
      PERFORM public.pulse_right_now_end(event.id, 'its_back');
      RETURN jsonb_build_object('code', NULL, 'ended', true);
    END IF;
  END IF;
  RETURN jsonb_build_object('code', NULL, 'ended', false);
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_right_now_report(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_right_now_report(uuid, uuid, uuid, text) TO service_role;
COMMIT;
