-- Backwards compatible: yes. Adds one event to the existing funnel vocabulary;
-- a Helpful transition records once under the same reply lock, never on retry.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public."FunnelEvent" DROP CONSTRAINT funnelevent_type_check;
ALTER TABLE public."FunnelEvent" ADD CONSTRAINT funnelevent_type_check CHECK (
  event_type IN (
    't0_preview_viewed', 't0_aha_viewed', 't0_share_clicked',
    't0_wall_viewed', 'register_started', 't1_account_created',
    'session_open', 'reminder_sent', 'reminder_action', 'suggestion_decision',
    'plan_viewed', 'plan_created', 'plan_requested', 'plan_accepted',
    'plan_attended', 'plan_hosted_again', 'plan_share_opened',
    'pulse_helpful_marked'
  )
);

CREATE FUNCTION public.pulse_record_helpful_mark()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public."FunnelEvent" (event_type, user_id, meta)
    VALUES ('pulse_helpful_marked', NEW.helpful_by,
      jsonb_build_object('post_id', NEW.post_id, 'reply_id', NEW.id));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.pulse_record_helpful_mark() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_record_helpful_mark() TO service_role;
CREATE TRIGGER pulse_record_helpful_mark AFTER UPDATE OF helpful_at ON public."PostComment"
  FOR EACH ROW WHEN (OLD.helpful_at IS NULL AND NEW.helpful_at IS NOT NULL)
  EXECUTE FUNCTION public.pulse_record_helpful_mark();
COMMIT;
