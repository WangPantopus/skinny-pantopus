-- Backwards compatible: yes. Recheck existing write/reply admission at commit
-- without changing old messages, tables, client grants or system notices.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.guard_chat_writer_binding() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
BEGIN
  -- Only trusted server callers can insert system notices; the REST schema and
  -- table grants do not let clients use this exception. Lifecycle notices may
  -- follow a departure or room closure and retain their existing admission.
  IF NEW.type = 'system' THEN RETURN NEW; END IF;

  -- advance_chat_message_revision already holds the room lock. The topic guard
  -- (when present) takes its ordered participant locks before this trigger.
  -- Keep the displayed sender's membership locked through the insert commit;
  -- an API preflight cannot protect a send that waits behind another writer.
  PERFORM 1 FROM public."ChatParticipant" p
   WHERE p.room_id = NEW.room_id AND p.user_id = NEW.user_id
     AND p.is_active IS NOT FALSE AND p.left_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHAT_WRITER_NOT_MEMBER' USING ERRCODE = 'PT403';
  END IF;

  -- Every message mutation takes the same room revision lock, so this fresh
  -- snapshot observes a reply deletion that committed before this insert.
  -- Avoid reversing the existing message-row -> room lock order with another
  -- explicit reply-row lock. A later deletion may still retire the quote.
  IF NEW.reply_to_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."ChatMessage" m
     WHERE m.id = NEW.reply_to_id AND m.room_id = NEW.room_id
       AND m.deleted IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'CHAT_REPLY_SCOPE_INVALID' USING ERRCODE = 'PT400';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_chat_writer_binding BEFORE INSERT ON public."ChatMessage"
  FOR EACH ROW EXECUTE FUNCTION public.guard_chat_writer_binding();
REVOKE ALL ON FUNCTION public.guard_chat_writer_binding() FROM PUBLIC, anon, authenticated;
COMMIT;
