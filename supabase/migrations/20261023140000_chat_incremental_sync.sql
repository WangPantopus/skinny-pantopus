-- Backwards compatible: yes. Adds defaulted revision columns, triggers and a
-- service-only reader. Existing clients keep their history and message shapes.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- A room-local revision is allocated while locking the room row. Unlike a
-- sequence, this cannot publish a later revision before an earlier transaction
-- commits. Existing messages start at zero and are loaded by normal history.
ALTER TABLE public."ChatRoom"
  ADD COLUMN message_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN history_reset_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public."ChatMessage"
  ADD COLUMN sync_version bigint NOT NULL DEFAULT 0;

CREATE INDEX chat_message_sync_version_idx
  ON public."ChatMessage" (room_id, sync_version);

CREATE FUNCTION public.advance_chat_message_revision() RETURNS trigger
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

  IF TG_OP = 'INSERT' AND NEW.topic_id IS NOT NULL THEN
    UPDATE public."ConversationTopic"
       SET last_activity_at = GREATEST(last_activity_at, NEW.created_at)
     WHERE id = NEW.topic_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER advance_chat_message_revision
BEFORE INSERT OR UPDATE OR DELETE ON public."ChatMessage"
FOR EACH ROW EXECUTE FUNCTION public.advance_chat_message_revision();

CREATE FUNCTION public.advance_chat_reaction_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Updating only the revision does not change edited/edited_at or re-run the
  -- attachment/content admission triggers. The message trigger allocates it.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public."ChatMessage" SET sync_version = sync_version WHERE id = OLD.message_id;
  END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.message_id IS DISTINCT FROM OLD.message_id) THEN
    UPDATE public."ChatMessage" SET sync_version = sync_version WHERE id = NEW.message_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER advance_chat_reaction_revision
AFTER INSERT OR UPDATE OR DELETE ON public."MessageReaction"
FOR EACH ROW EXECUTE FUNCTION public.advance_chat_reaction_revision();

-- API callers authorize personal/business identity and task-room visibility.
-- Membership is checked again here, including the existing read-only history
-- boundary for someone who has left a room.
CREATE FUNCTION public.get_chat_message_changes(
  p_user_id uuid, p_room_ids uuid[], p_after jsonb, p_until jsonb, p_limit integer DEFAULT 201
) RETURNS SETOF public."ChatMessage"
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT m.*
    FROM public."ChatMessage" m
    JOIN public."ChatParticipant" p ON p.room_id = m.room_id AND p.user_id = p_user_id
   WHERE m.room_id = ANY(p_room_ids)
     AND (p.is_active = true OR (p.left_at IS NOT NULL AND m.created_at <= p.left_at))
     AND m.sync_version > (p_after ->> m.room_id::text)::bigint
     AND m.sync_version <= (p_until ->> m.room_id::text)::bigint
   ORDER BY m.room_id, m.sync_version, m.id
   LIMIT LEAST(GREATEST(p_limit, 1), 201);
$$;

REVOKE ALL ON FUNCTION public.advance_chat_message_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_chat_reaction_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_chat_message_changes(uuid, uuid[], jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_message_changes(uuid, uuid[], jsonb, jsonb, integer) TO service_role;

COMMENT ON COLUMN public."ChatMessage".sync_version IS 'Commit-ordered room revision for incremental cache reconciliation, including soft deletions and reactions.';
COMMIT;
