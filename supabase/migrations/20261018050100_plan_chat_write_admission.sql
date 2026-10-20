-- Backwards compatible: yes. Add a message-write guard to the existing chat
-- table. No new tables, columns, client privileges or history-read changes.
-- Plan cancellation commits before the best-effort chat-room close; the Plan
-- row is therefore authoritative even if ChatRoom.is_active is still true.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.plan_chat_write_admission() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
DECLARE v_plan public."Plan"%ROWTYPE; v_active boolean; v_type text;
BEGIN
  SELECT type INTO v_type FROM public."ChatRoom" WHERE id = NEW.room_id;
  IF v_type IS DISTINCT FROM 'plan' THEN RETURN NEW; END IF;

  -- FOR SHARE conflicts with cancellation/closure updates. Re-read under the
  -- lock so a send that waits for cancellation cannot use the old open state.
  -- Hold Plan before ChatRoom, matching cancellation's order.
  SELECT * INTO v_plan FROM public."Plan" WHERE chat_room_id = NEW.room_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PLAN_CHAT_CLOSED' USING ERRCODE = 'PT403';
  END IF;
  SELECT is_active INTO v_active FROM public."ChatRoom" WHERE id = NEW.room_id FOR SHARE;

  -- Only server-created notices can follow cancellation (including the cancel
  -- notice itself). Clients have no table-write grant and REST cannot send a
  -- system type. An edit cannot turn an ordinary message into such a notice.
  IF TG_OP = 'INSERT' AND NEW.type = 'system'
    AND NEW.metadata @> '{"plan_system":true}'::jsonb
    AND NEW.user_id = v_plan.host_user_id THEN RETURN NEW; END IF;

  IF v_plan.status = 'cancelled' OR v_plan.chat_closed_at IS NOT NULL
    OR v_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PLAN_CHAT_CLOSED' USING ERRCODE = 'PT403';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER plan_chat_write_admission
BEFORE INSERT OR UPDATE OF room_id, user_id, actor_user_id, message, type,
  attachments, metadata, reply_to_id, topic_id ON public."ChatMessage"
FOR EACH ROW EXECUTE FUNCTION public.plan_chat_write_admission();

REVOKE ALL ON FUNCTION public.plan_chat_write_admission() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_chat_write_admission() TO service_role;
COMMIT;
