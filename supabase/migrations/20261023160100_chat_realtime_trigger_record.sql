-- Backwards compatible: yes. Keeps both existing trigger bindings and payloads.
-- Read the message-only revision through JSON so the shared trigger also compiles
-- when bound to ChatParticipant. No applied migration is edited.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.notify_chat_realtime() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_row jsonb;
  v_revision bigint;
BEGIN
  IF TG_TABLE_NAME = 'ChatParticipant' THEN
    PERFORM pg_notify('sync_changed', jsonb_build_object(
      't', 'ChatRead', 'r', NEW.room_id, 'u', NEW.user_id)::text);
  ELSE
    v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
    IF TG_OP = 'DELETE' THEN
      SELECT message_revision INTO v_revision FROM public."ChatRoom" WHERE id = OLD.room_id;
    ELSE
      v_revision := (v_row->>'sync_version')::bigint;
    END IF;
    PERFORM pg_notify('sync_changed', jsonb_build_object(
      't', 'ChatMessage', 'r', v_row->>'room_id', 'm', v_row->>'id',
      'op', TG_OP, 'v', v_revision)::text);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_chat_realtime() FROM PUBLIC, anon, authenticated;
COMMIT;
