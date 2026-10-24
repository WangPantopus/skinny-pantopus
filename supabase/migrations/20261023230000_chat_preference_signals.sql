-- Backwards compatible: yes. Adds an account-private preference invalidation
-- signal; existing listeners ignore it. Reuses the existing notification trigger.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.notify_chat_realtime() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_row jsonb;
  v_old jsonb;
  v_revision bigint;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_old := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  IF TG_TABLE_NAME = 'ChatParticipant' THEN
    IF v_old->>'last_read_message_id' IS DISTINCT FROM v_row->>'last_read_message_id' THEN
      PERFORM pg_notify('sync_changed', jsonb_build_object(
        't', 'ChatRead', 'r', v_row->>'room_id', 'u', v_row->>'user_id')::text);
    END IF;
    IF v_old->'notifications_enabled' IS DISTINCT FROM v_row->'notifications_enabled' THEN
      PERFORM pg_notify('sync_changed', jsonb_build_object(
        't', 'ChatPreferences', 'u', v_row->>'user_id')::text);
    END IF;
  ELSIF TG_TABLE_NAME = 'UserNotificationPreferences' THEN
    IF coalesce(v_old->'chat_muted_user_ids', '[]'::jsonb) IS DISTINCT FROM
      (CASE WHEN TG_OP = 'DELETE' THEN '[]'::jsonb ELSE coalesce(v_row->'chat_muted_user_ids', '[]'::jsonb) END) THEN
      PERFORM pg_notify('sync_changed', jsonb_build_object(
        't', 'ChatPreferences', 'u', v_row->>'user_id')::text);
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      SELECT message_revision INTO v_revision FROM public."ChatRoom" WHERE id = (v_row->>'room_id')::uuid;
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
CREATE TRIGGER chat_preferences_realtime AFTER UPDATE OF notifications_enabled ON public."ChatParticipant"
  FOR EACH ROW WHEN (OLD.notifications_enabled IS DISTINCT FROM NEW.notifications_enabled)
  EXECUTE FUNCTION public.notify_chat_realtime();
CREATE TRIGGER chat_preferences_realtime AFTER INSERT OR UPDATE OF chat_muted_user_ids OR DELETE ON public."UserNotificationPreferences"
  FOR EACH ROW EXECUTE FUNCTION public.notify_chat_realtime();

COMMIT;
