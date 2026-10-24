-- Backwards compatible: yes. Adds content-free commit signals to the existing
-- listener channel. Old listeners ignore the added keys and ChatRead signal.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.notify_chat_realtime() RETURNS trigger
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
      v_revision := NEW.sync_version;
    END IF;
    PERFORM pg_notify('sync_changed', jsonb_build_object(
      't', 'ChatMessage', 'r', v_row->>'room_id', 'm', v_row->>'id',
      'op', TG_OP, 'v', v_revision)::text);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_chat_realtime() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER chat_realtime AFTER INSERT OR UPDATE OR DELETE ON public."ChatMessage"
  FOR EACH ROW EXECUTE FUNCTION public.notify_chat_realtime();
CREATE TRIGGER chat_read_realtime AFTER UPDATE ON public."ChatParticipant"
  FOR EACH ROW WHEN (OLD.last_read_message_id IS DISTINCT FROM NEW.last_read_message_id)
  EXECUTE FUNCTION public.notify_chat_realtime();

COMMIT;
