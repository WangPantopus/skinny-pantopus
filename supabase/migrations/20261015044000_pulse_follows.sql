-- Backwards compatible: yes. Adds the approved private follow graph. Existing
-- saves, mutes, connections and feed preferences remain separate and unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE public."PulseFollow" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'topic', 'place')),
  target_id text NOT NULL,
  area_id uuid REFERENCES public."PulseArea"(id) ON DELETE CASCADE,
  notify text NOT NULL DEFAULT 'off' CHECK (notify IN ('off', 'recap', 'each')),
  ends_on_resolve boolean NOT NULL DEFAULT false,
  until_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pulse_follow_area CHECK ((target_type = 'topic') = (area_id IS NOT NULL)),
  CONSTRAINT pulse_follow_resolve CHECK (NOT ends_on_resolve OR target_type = 'post'),
  UNIQUE NULLS NOT DISTINCT (user_id, target_type, target_id, area_id)
);
ALTER TABLE public."PulseFollow" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PulseFollow" FROM anon, authenticated;
GRANT ALL ON public."PulseFollow" TO service_role;
CREATE INDEX ON public."PulseFollow" (target_type, target_id);

CREATE FUNCTION public.pulse_follow_upsert(
  p_user_id uuid, p_target_type text, p_target_id text, p_area_id uuid, p_notify text, p_ends text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
  post public."Post";
  result public."PulseFollow";
BEGIN
  IF p_ends NOT IN ('on_resolve', 'week', 'keep') THEN RETURN jsonb_build_object('code', 'INVALID_FOLLOW'); END IF;
  IF p_target_type = 'post' THEN
    SELECT * INTO post FROM public."Post" WHERE id = p_target_id::uuid FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('code', 'POST_NOT_FOUND'); END IF;
    IF p_ends = 'on_resolve' AND (post.state <> 'open' OR post.resolution IS NOT NULL
      OR post.archived_at IS NOT NULL OR post.expires_at <= now()) THEN
      RETURN jsonb_build_object('code', 'POST_ENDED');
    END IF;
  END IF;
  INSERT INTO public."PulseFollow" AS existing
    (user_id, target_type, target_id, area_id, notify, ends_on_resolve, until_at)
  VALUES (p_user_id, p_target_type, p_target_id, p_area_id, p_notify, p_ends = 'on_resolve',
    CASE WHEN p_ends = 'week' THEN now() + interval '7 days' END)
  ON CONFLICT (user_id, target_type, target_id, area_id) DO UPDATE SET
    notify = EXCLUDED.notify, ends_on_resolve = EXCLUDED.ends_on_resolve,
    until_at = CASE WHEN p_ends = 'week' AND NOT existing.ends_on_resolve AND existing.until_at > now()
      THEN existing.until_at ELSE EXCLUDED.until_at END,
    created_at = CASE WHEN existing.until_at <= now() THEN now() ELSE existing.created_at END,
    updated_at = now()
  RETURNING * INTO result;
  RETURN to_jsonb(result);
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_follow_upsert(uuid, text, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_follow_upsert(uuid, text, text, uuid, text, text) TO service_role;

CREATE FUNCTION public.pulse_end_conversation_follows()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public."PulseFollow" WHERE target_type = 'post' AND target_id = OLD.id::text;
    RETURN OLD;
  END IF;
  -- Checking the old deadline too prevents restoring an expired conversation
  -- before the archive job runs from reviving its "until it ends" follows.
  IF NEW.state <> 'open' OR NEW.resolution IS NOT NULL OR NEW.archived_at IS NOT NULL
      OR NEW.expires_at <= now() OR OLD.expires_at <= now() THEN
    UPDATE public."PulseFollow" SET until_at = now(), updated_at = now()
      WHERE target_type = 'post' AND target_id = NEW.id::text AND ends_on_resolve
        AND (until_at IS NULL OR until_at > now());
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_end_conversation_follows() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_end_conversation_follows() TO service_role;
CREATE TRIGGER pulse_end_conversation_follows
  AFTER DELETE OR UPDATE OF state, resolution, archived_at, expires_at ON public."Post"
  FOR EACH ROW EXECUTE FUNCTION public.pulse_end_conversation_follows();

ALTER TABLE public."FunnelEvent" DROP CONSTRAINT funnelevent_type_check;
ALTER TABLE public."FunnelEvent" ADD CONSTRAINT funnelevent_type_check CHECK (
  event_type IN (
    't0_preview_viewed', 't0_aha_viewed', 't0_share_clicked',
    't0_wall_viewed', 'register_started', 't1_account_created',
    'session_open', 'reminder_sent', 'reminder_action', 'suggestion_decision',
    'plan_viewed', 'plan_created', 'plan_requested', 'plan_accepted',
    'plan_attended', 'plan_hosted_again', 'plan_share_opened',
    'pulse_helpful_marked', 'pulse_follow'
  )
);
CREATE FUNCTION public.pulse_record_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    INSERT INTO public."FunnelEvent" (event_type, user_id, meta)
      VALUES ('pulse_follow', NEW.user_id, jsonb_build_object(
        'target_type', NEW.target_type, 'target_id', NEW.target_id, 'area_id', NEW.area_id));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_record_follow() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_record_follow() TO service_role;
CREATE TRIGGER pulse_record_follow AFTER INSERT OR UPDATE OF created_at ON public."PulseFollow"
  FOR EACH ROW EXECUTE FUNCTION public.pulse_record_follow();
COMMIT;
