-- Backwards compatible: yes. Valid direct/task topic messages keep the same
-- contract. Reject new mismatched topic bindings without rewriting history;
-- topic deletion may still clear its reference on an existing message.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.guard_chat_topic_binding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  topic public."ConversationTopic"%ROWTYPE;
  member_count integer;
BEGIN
  IF NEW.topic_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.topic_id IS NOT DISTINCT FROM OLD.topic_id
    AND NEW.room_id IS NOT DISTINCT FROM OLD.room_id
    AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
  THEN RETURN NEW; END IF;

  -- The existing revision trigger already locks ChatRoom before updating the
  -- topic's activity. Keep that room -> topic -> participant lock order.
  SELECT * INTO topic FROM public."ConversationTopic" WHERE id = NEW.topic_id FOR SHARE;
  IF NOT FOUND OR NEW.user_id NOT IN (topic.conversation_user_id_1, topic.conversation_user_id_2)
    OR NOT EXISTS (SELECT 1 FROM public."ChatRoom" r
      WHERE r.id = NEW.room_id AND r.type IN ('direct', 'gig'))
  THEN RAISE EXCEPTION 'CHAT_TOPIC_SCOPE_INVALID' USING ERRCODE = 'PT400'; END IF;

  -- Lock current memberships through commit, including non-key updates such as
  -- is_active/left_at. Ordered row locks also precede the existing unread update.
  PERFORM p.user_id FROM public."ChatParticipant" p
  WHERE p.room_id = NEW.room_id
    AND p.user_id IN (topic.conversation_user_id_1, topic.conversation_user_id_2)
    AND p.is_active AND p.left_at IS NULL
  ORDER BY p.user_id FOR UPDATE;
  GET DIAGNOSTICS member_count = ROW_COUNT;
  IF member_count <> 2 THEN
    RAISE EXCEPTION 'CHAT_TOPIC_SCOPE_INVALID' USING ERRCODE = 'PT400';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_chat_topic_binding
  BEFORE INSERT OR UPDATE OF topic_id, room_id, user_id ON public."ChatMessage"
  FOR EACH ROW EXECUTE FUNCTION public.guard_chat_topic_binding();
REVOKE ALL ON FUNCTION public.guard_chat_topic_binding() FROM PUBLIC, anon, authenticated;
COMMIT;
