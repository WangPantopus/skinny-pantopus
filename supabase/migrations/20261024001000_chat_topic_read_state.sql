-- Backwards compatible: yes. The founder approved this topic-read table on
-- October 23. Room-wide acknowledgements retain their existing contract.
-- Topic acknowledgements require explicit visible boundaries and never advance
-- the room-wide boundary. No message content or device identifiers are stored.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public."ChatTopicRead" (
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  topic_id uuid NOT NULL,
  last_read_message_id uuid NOT NULL,
  last_read_message_at timestamptz NOT NULL,
  read_at timestamptz NOT NULL,
  PRIMARY KEY (room_id, user_id, topic_id),
  FOREIGN KEY (room_id, user_id) REFERENCES public."ChatParticipant"(room_id, user_id) ON DELETE CASCADE
);
-- A removed topic/message must not undo an accepted read. These UUIDs are
-- historical boundaries, deliberately not cascading topic/message references.
ALTER TABLE public."ChatTopicRead" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ChatTopicRead" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ChatTopicRead" TO service_role;

-- ConversationTopic deletion sets ChatMessage.topic_id to NULL. Retain only its
-- original read namespace so that this does not make read messages unread again.
-- This helper field is private and omitted from message serializers.
ALTER TABLE public."ChatMessage" ADD COLUMN read_topic_id uuid;
CREATE FUNCTION public.keep_chat_read_topic() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.read_topic_id := CASE WHEN TG_OP = 'INSERT' THEN NEW.topic_id ELSE coalesce(OLD.read_topic_id, OLD.topic_id) END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER keep_chat_read_topic BEFORE INSERT OR UPDATE ON public."ChatMessage"
  FOR EACH ROW EXECUTE FUNCTION public.keep_chat_read_topic();
REVOKE ALL ON FUNCTION public.keep_chat_read_topic() FROM PUBLIC, anon, authenticated;
CREATE INDEX chat_message_topic_read_boundary ON public."ChatMessage"
  (room_id, (coalesce(read_topic_id, topic_id)), created_at, id) WHERE deleted = false;

CREATE FUNCTION public.mark_chat_topic_read_boundaries(
  p_user_id uuid, p_room_ids uuid[], p_topic_id uuid, p_boundaries jsonb,
  p_through_message_id uuid DEFAULT NULL, p_request_at timestamptz DEFAULT now(),
  p_other_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  topic public."ConversationTopic"%ROWTYPE;
  participant public."ChatParticipant"%ROWTYPE;
  previous public."ChatTopicRead"%ROWTYPE;
  boundary public."ChatMessage"%ROWTYPE;
  cursors jsonb := p_boundaries;
  entry record;
  cursor_room uuid;
  cursor_message uuid;
  newly_read integer;
  remaining bigint;
  result_rows jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO topic FROM public."ConversationTopic" WHERE id = p_topic_id;
  IF NOT FOUND OR p_user_id NOT IN (topic.conversation_user_id_1, topic.conversation_user_id_2)
    OR (p_other_user_id IS NOT NULL AND
      (p_other_user_id = p_user_id OR p_other_user_id NOT IN (topic.conversation_user_id_1, topic.conversation_user_id_2)))
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_room_ids) r(id) WHERE NOT EXISTS (
    SELECT 1 FROM public."ChatParticipant" p
    WHERE p.room_id = r.id AND p.user_id = p_user_id AND p.is_active
  )) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;

  IF cursors IS NULL AND p_through_message_id IS NOT NULL THEN
    SELECT m.room_id INTO cursor_room FROM public."ChatMessage" m
    WHERE m.id = p_through_message_id AND m.room_id = ANY(p_room_ids) AND m.topic_id = p_topic_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE = '22023'; END IF;
    cursors := jsonb_build_object(cursor_room::text, p_through_message_id::text);
  END IF;
  -- Unlike legacy room reads, a topic read without visible boundaries is unsafe.
  IF cursors IS NULL OR jsonb_typeof(cursors) <> 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(cursors)) > 500
  THEN RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE = '22023'; END IF;
  FOR entry IN SELECT key, value FROM jsonb_each_text(cursors) LOOP
    BEGIN
      cursor_room := entry.key::uuid;
      cursor_message := entry.value::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE = '22023';
    END;
    IF NOT coalesce(cursor_room = ANY(p_room_ids), false) OR NOT EXISTS (
      SELECT 1 FROM public."ChatMessage" m WHERE m.id = cursor_message
        AND m.room_id = cursor_room AND m.topic_id = p_topic_id
    ) THEN RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE = '22023'; END IF;
  END LOOP;
  IF p_through_message_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jsonb_each_text(cursors) c WHERE c.value::uuid = p_through_message_id
  ) THEN RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE = '22023'; END IF;

  -- The same participant lock serializes all-topic reads, topic reads and
  -- insert/delete counter changes. Validate the entire map before any writes.
  FOR entry IN SELECT key, value FROM jsonb_each_text(cursors) ORDER BY key LOOP
    SELECT * INTO participant FROM public."ChatParticipant" p
    WHERE p.room_id = entry.key::uuid AND p.user_id = p_user_id AND p.is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;
    SELECT * INTO boundary FROM public."ChatMessage" WHERE id = entry.value::uuid;
    SELECT * INTO previous FROM public."ChatTopicRead" tr
    WHERE tr.room_id = participant.room_id AND tr.user_id = p_user_id AND tr.topic_id = p_topic_id;
    IF previous.last_read_message_id IS NULL OR
      (boundary.created_at, boundary.id) > (previous.last_read_message_at, previous.last_read_message_id) THEN
      SELECT count(*)::integer INTO newly_read FROM public."ChatMessage" m
      WHERE m.room_id = participant.room_id AND coalesce(m.read_topic_id, m.topic_id) = p_topic_id AND NOT m.deleted
        AND m.user_id <> p_user_id AND (m.created_at, m.id) <= (boundary.created_at, boundary.id)
        AND (previous.last_read_message_id IS NULL OR
          (m.created_at, m.id) > (previous.last_read_message_at, previous.last_read_message_id))
        AND ((participant.last_read_message_at IS NULL AND
          (participant.last_read_at IS NULL OR m.created_at > participant.last_read_at)) OR
          (m.created_at, m.id) > (participant.last_read_message_at,
            coalesce(participant.last_read_message_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)));
      INSERT INTO public."ChatTopicRead" AS tr(room_id, user_id, topic_id, last_read_message_id, last_read_message_at, read_at)
      VALUES (participant.room_id, p_user_id, p_topic_id, boundary.id, boundary.created_at, coalesce(p_request_at, now()))
      ON CONFLICT (room_id, user_id, topic_id) DO UPDATE SET
        last_read_message_id = EXCLUDED.last_read_message_id,
        last_read_message_at = EXCLUDED.last_read_message_at,
        read_at = greatest(tr.read_at, EXCLUDED.read_at)
      RETURNING * INTO previous;
      UPDATE public."ChatParticipant" p SET unread_count = greatest(0, coalesce(p.unread_count, 0) - newly_read)
      WHERE p.id = participant.id RETURNING * INTO participant;
      PERFORM pg_notify('sync_changed', jsonb_build_object('t', 'ChatTopicRead',
        'r', participant.room_id, 'u', p_user_id, 'q', p_topic_id)::text);
    END IF;
    result_rows := result_rows || jsonb_build_array(jsonb_build_object(
      'room_id', participant.room_id, 'topic_id', p_topic_id, 'unread_count', participant.unread_count,
      'read_at', previous.read_at, 'through_message_id', previous.last_read_message_id));
  END LOOP;
  SELECT coalesce(sum(p.unread_count), 0) INTO remaining FROM public."ChatParticipant" p
  WHERE p.user_id = p_user_id AND p.room_id = ANY(p_room_ids) AND p.is_active;
  RETURN jsonb_build_object('data', result_rows, 'unreadCount', remaining);
END;
$$;
REVOKE ALL ON FUNCTION public.mark_chat_topic_read_boundaries(uuid, uuid[], uuid, jsonb, uuid, timestamptz, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_topic_read_boundaries(uuid, uuid[], uuid, jsonb, uuid, timestamptz, uuid)
  TO service_role;

-- Existing room-read, counter and push readers are replaced below in this new
-- migration; the previously applied migrations remain immutable.

-- Readers pass only messages from their already-authorized room scope. Bound
-- this private helper by visible message IDs, never all topics in a large inbox.
CREATE FUNCTION public.get_chat_message_receipts(p_user_id uuid, p_message_ids uuid[])
RETURNS TABLE(message_id uuid, read_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF cardinality(p_message_ids) > 500 THEN
    RAISE EXCEPTION 'Too many receipt messages' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT m.id, CASE
    WHEN global_read.covered AND topic_read.covered THEN least(cp.last_read_at, tr.read_at)
    WHEN global_read.covered THEN cp.last_read_at
    WHEN topic_read.covered THEN tr.read_at ELSE NULL END
  FROM public."ChatMessage" m
  JOIN public."ChatRoom" r ON r.id = m.room_id AND r.type = 'direct'
  JOIN public."ChatParticipant" cp ON cp.room_id = m.room_id AND cp.is_active AND cp.user_id <> m.user_id
  LEFT JOIN public."ChatTopicRead" tr ON tr.room_id = m.room_id AND tr.user_id = cp.user_id
    AND tr.topic_id = coalesce(m.read_topic_id, m.topic_id)
  CROSS JOIN LATERAL (SELECT cp.last_read_message_id IS NOT NULL AND cp.last_read_message_at IS NOT NULL
    AND (m.created_at,m.id) <= (cp.last_read_message_at,cp.last_read_message_id) AS covered) global_read
  CROSS JOIN LATERAL (SELECT tr.last_read_message_id IS NOT NULL
    AND (m.created_at,m.id) <= (tr.last_read_message_at,tr.last_read_message_id) AS covered) topic_read
  WHERE m.id = ANY(p_message_ids) AND NOT m.deleted
    AND (m.user_id = p_user_id OR m.actor_user_id = p_user_id)
    AND NOT EXISTS (SELECT 1 FROM public."ChatParticipant" other
      WHERE other.room_id = m.room_id AND other.is_active AND other.user_id NOT IN (m.user_id, cp.user_id));
END;
$$;
REVOKE ALL ON FUNCTION public.get_chat_message_receipts(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_message_receipts(uuid, uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_chat_read_through(
  p_user_id uuid, p_room_ids uuid[], p_through_message_id uuid DEFAULT NULL,
  p_request_at timestamptz DEFAULT now()
) RETURNS TABLE(room_id uuid, unread_count integer, read_at timestamptz, through_message_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  boundary public."ChatMessage"%ROWTYPE;
  participant public."ChatParticipant"%ROWTYPE;
  remaining integer;
BEGIN
  -- The API authorizes personal/business/gig access. Enforce active membership
  -- here too, and never accept a cursor from another conversation.
  IF EXISTS (SELECT 1 FROM unnest(p_room_ids) r(id) WHERE NOT EXISTS (
    SELECT 1 FROM public."ChatParticipant" p
    WHERE p.room_id = r.id AND p.user_id = p_user_id AND p.is_active
  )) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;

  IF p_through_message_id IS NOT NULL THEN
    SELECT * INTO boundary FROM public."ChatMessage" m
    WHERE m.id = p_through_message_id AND m.room_id = ANY(p_room_ids);
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE = '22023'; END IF;
  ELSE
    SELECT * INTO boundary FROM public."ChatMessage" m
    WHERE m.room_id = ANY(p_room_ids) AND m.created_at <= p_request_at
    ORDER BY m.created_at DESC, m.id DESC LIMIT 1;
  END IF;

  -- Serialize against the existing insert/unread trigger. A message committed
  -- after this read increments the count after the lock is released.
  FOR participant IN SELECT p.* FROM public."ChatParticipant" p
    WHERE p.room_id = ANY(p_room_ids) AND p.user_id = p_user_id AND p.is_active
    ORDER BY p.room_id FOR UPDATE
  LOOP
    IF boundary.id IS NOT NULL AND (participant.last_read_message_at IS NULL OR
      (boundary.created_at, boundary.id) > (participant.last_read_message_at,
        coalesce(participant.last_read_message_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))) THEN
      SELECT count(*)::integer INTO remaining FROM public."ChatMessage" m
      WHERE m.room_id = participant.room_id AND m.user_id <> p_user_id AND NOT m.deleted
        AND (m.created_at, m.id) > (boundary.created_at, boundary.id)
        AND NOT EXISTS (SELECT 1 FROM public."ChatTopicRead" tr
          WHERE tr.room_id = m.room_id AND tr.user_id = p_user_id
            AND tr.topic_id = coalesce(m.read_topic_id, m.topic_id)
            AND (m.created_at, m.id) <= (tr.last_read_message_at, tr.last_read_message_id));
      UPDATE public."ChatParticipant" p SET unread_count = remaining,
        last_read_at = greatest(coalesce(p_request_at, now()), participant.last_read_at),
        last_read_message_at = boundary.created_at, last_read_message_id = boundary.id
      WHERE p.id = participant.id;
      participant.unread_count := remaining;
      participant.last_read_at := greatest(coalesce(p_request_at, now()), participant.last_read_at);
      participant.last_read_message_at := boundary.created_at;
      participant.last_read_message_id := boundary.id;
    END IF;
    room_id := participant.room_id;
    unread_count := coalesce(participant.unread_count, 0);
    read_at := participant.last_read_at;
    through_message_id := participant.last_read_message_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_chat_message_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  difference integer;
  row_value public."ChatMessage"%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    difference := CASE WHEN NEW.deleted = false THEN 1 ELSE 0 END;
    row_value := NEW;
  ELSIF TG_OP = 'DELETE' THEN
    difference := CASE WHEN OLD.deleted = false THEN -1 ELSE 0 END;
    row_value := OLD;
  ELSE
    difference := (CASE WHEN NEW.deleted = false THEN 1 ELSE 0 END)
                - (CASE WHEN OLD.deleted = false THEN 1 ELSE 0 END);
    row_value := NEW;
  END IF;
  IF difference = 0 THEN RETURN NULL; END IF;
  UPDATE public."ChatRoom" SET message_count = message_count + difference WHERE id = row_value.room_id;
  -- INSERT has its existing unread trigger. A removal/restoration changes only
  -- recipients whose read boundary has not passed this message. The row lock
  -- serializes the arithmetic with simultaneous reads and sends.
  IF TG_OP <> 'INSERT' THEN
    -- Acquire the shared read/counter lock before looking up topic boundaries.
    -- A subquery in the waiting UPDATE could otherwise retain a snapshot from
    -- before a concurrent topic acknowledgement and decrement a second time.
    PERFORM 1 FROM public."ChatParticipant" p
      WHERE p.room_id = row_value.room_id AND p.is_active AND p.user_id <> row_value.user_id
      ORDER BY p.user_id FOR UPDATE;
    UPDATE public."ChatParticipant" p SET unread_count = greatest(0, coalesce(p.unread_count, 0) + difference)
     WHERE p.room_id = row_value.room_id AND p.is_active AND p.user_id <> row_value.user_id
       AND ((p.last_read_message_at IS NULL AND (p.last_read_at IS NULL OR row_value.created_at > p.last_read_at))
         OR (row_value.created_at, row_value.id) >
           (p.last_read_message_at, coalesce(p.last_read_message_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
       AND NOT EXISTS (SELECT 1 FROM public."ChatTopicRead" tr
         WHERE tr.room_id = p.room_id AND tr.user_id = p.user_id
           AND tr.topic_id = coalesce(row_value.read_topic_id, row_value.topic_id)
           AND (row_value.created_at, row_value.id) <= (tr.last_read_message_at, tr.last_read_message_id));
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_unread_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.deleted = false THEN
    PERFORM 1 FROM public."ChatParticipant" p
      WHERE p.room_id = NEW.room_id AND p.user_id <> NEW.user_id AND p.is_active
      ORDER BY p.user_id FOR UPDATE;
    UPDATE public."ChatParticipant" p SET unread_count = coalesce(p.unread_count, 0) + 1
     WHERE p.room_id = NEW.room_id AND p.user_id <> NEW.user_id AND p.is_active
       AND ((p.last_read_message_at IS NULL AND (p.last_read_at IS NULL OR NEW.created_at > p.last_read_at))
         OR (NEW.created_at, NEW.id) >
           (p.last_read_message_at, coalesce(p.last_read_message_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
       AND NOT EXISTS (SELECT 1 FROM public."ChatTopicRead" tr
         WHERE tr.room_id = p.room_id AND tr.user_id = p.user_id
           AND tr.topic_id = coalesce(NEW.read_topic_id, NEW.topic_id)
           AND (NEW.created_at, NEW.id) <= (tr.last_read_message_at, tr.last_read_message_id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.read_chat_push_delivery(p_id uuid, p_lease uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
SELECT jsonb_build_object('message', to_jsonb(m), 'pushAllowed',
 j.push_allowed_at_send AND cp.notifications_enabled IS DISTINCT FROM false
 AND mp.push_notifications IS DISTINCT FROM false
 AND NOT (r.type IN ('direct','gig') AND m.user_id = ANY(coalesce(np.chat_muted_user_ids,'{}'::uuid[]))))
FROM public."ChatPushDelivery" j JOIN public."ChatMessage" m ON m.id = j.message_id
JOIN public."ChatRoom" r ON r.id = m.room_id
JOIN public."ChatParticipant" cp ON cp.room_id = m.room_id AND cp.user_id = j.identity_user_id
LEFT JOIN public."MailPreferences" mp ON mp.user_id = j.recipient_user_id
LEFT JOIN public."UserNotificationPreferences" np ON np.user_id = j.identity_user_id
WHERE j.id = p_id AND j.lease_id = p_lease AND j.status = 'leased' AND j.lease_until > now() AND j.expires_at > now()
 AND NOT m.deleted AND r.is_active IS DISTINCT FROM false
 AND public.chat_push_recipient_allowed(m.room_id, j.recipient_user_id, j.identity_user_id)
 AND (cp.last_read_message_at IS NULL OR (m.created_at,m.id) > (cp.last_read_message_at,cp.last_read_message_id))
 AND (cp.last_read_message_at IS NOT NULL OR cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)
 AND NOT EXISTS (SELECT 1 FROM public."ChatTopicRead" tr
   WHERE tr.room_id = m.room_id AND tr.user_id = j.identity_user_id
     AND tr.topic_id = coalesce(m.read_topic_id, m.topic_id)
     AND (m.created_at,m.id) <= (tr.last_read_message_at,tr.last_read_message_id))
 AND NOT EXISTS (SELECT 1 FROM public."UserBlock" b
   WHERE (b.blocker_user_id = m.user_id AND b.blocked_user_id IN (j.recipient_user_id,j.identity_user_id))
      OR (b.blocked_user_id = m.user_id AND b.blocker_user_id IN (j.recipient_user_id,j.identity_user_id)))
 AND NOT EXISTS (SELECT 1 FROM public."Plan" p WHERE p.chat_room_id = r.id
   AND (p.status = 'cancelled' OR p.chat_closed_at IS NOT NULL));
$$;

REVOKE ALL ON FUNCTION public.mark_chat_read_through(uuid, uuid[], uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.maintain_chat_message_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_unread_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_chat_push_delivery(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_read_through(uuid, uuid[], uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_chat_push_delivery(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
