-- Backwards compatible: yes. Adds a read cursor to existing participants and a
-- service-only RPC; clients without a cursor retain the existing read operation.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."ChatParticipant" ADD COLUMN IF NOT EXISTS last_read_message_id uuid;

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
    IF boundary.id IS NOT NULL AND (participant.last_read_at IS NULL OR
      (boundary.created_at, boundary.id) > (participant.last_read_at,
        coalesce(participant.last_read_message_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))) THEN
      SELECT count(*)::integer INTO remaining FROM public."ChatMessage" m
      WHERE m.room_id = participant.room_id AND m.user_id <> p_user_id AND NOT m.deleted
        AND (m.created_at, m.id) > (boundary.created_at, boundary.id);
      UPDATE public."ChatParticipant" p SET unread_count = remaining,
        last_read_at = boundary.created_at, last_read_message_id = boundary.id
      WHERE p.id = participant.id;
      participant.unread_count := remaining;
      participant.last_read_at := boundary.created_at;
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
REVOKE ALL ON FUNCTION public.mark_chat_read_through(uuid, uuid[], uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_read_through(uuid, uuid[], uuid, timestamptz) TO service_role;
COMMIT;
