-- Backwards compatible: yes. Existing inserts still receive server timestamps;
-- timestamps explicitly supplied by trusted historical writers stay unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Omitted timestamps are filled by the existing BEFORE INSERT trigger below.
ALTER TABLE public."ChatMessage" ALTER COLUMN created_at DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.advance_chat_message_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Hard deletion (for example account erasure) cannot leave a message
    -- tombstone. Tell cached clients to replace their window instead.
    UPDATE public."ChatRoom"
       SET message_revision = message_revision + 1,
           history_reset_revision = message_revision + 1,
           updated_at = clock_timestamp()
     WHERE id = OLD.room_id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.room_id IS DISTINCT FROM OLD.room_id THEN
    RAISE EXCEPTION 'A chat message cannot move between rooms' USING ERRCODE = '22023';
  END IF;

  UPDATE public."ChatRoom"
     SET message_revision = message_revision + 1, updated_at = clock_timestamp()
   WHERE id = NEW.room_id
   RETURNING message_revision INTO NEW.sync_version;

  -- A transaction may have started before a newer message committed. Assign
  -- default timestamps only after obtaining the room's existing revision lock.
  -- Preserve explicit historical timestamps used by trusted imports.
  IF TG_OP = 'INSERT' AND NEW.created_at IS NULL THEN
    NEW.created_at := clock_timestamp();
  END IF;

  IF TG_OP = 'INSERT' AND NEW.topic_id IS NOT NULL THEN
    UPDATE public."ConversationTopic"
       SET last_activity_at = GREATEST(last_activity_at, NEW.created_at)
     WHERE id = NEW.topic_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_chat_message_revision() FROM PUBLIC, anon, authenticated;
COMMIT;
