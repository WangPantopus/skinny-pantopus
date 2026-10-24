-- Backwards compatible: yes. Adds a private wrapper around the existing read
-- cursor RPC; old clients and the old function remain supported. No new tables.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.mark_chat_read_boundaries(
  p_user_id uuid, p_room_ids uuid[], p_boundaries jsonb DEFAULT NULL,
  p_through_message_id uuid DEFAULT NULL, p_request_at timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  cursors jsonb := p_boundaries;
  cursor_room uuid;
  cursor_message uuid;
  entry record;
  result_rows jsonb := '[]'::jsonb;
  room_rows jsonb;
  remaining bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(p_room_ids) r(id) WHERE NOT EXISTS (
    SELECT 1 FROM public."ChatParticipant" p
    WHERE p.room_id = r.id AND p.user_id = p_user_id AND p.is_active
  )) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;

  IF cursors IS NOT NULL THEN
    IF jsonb_typeof(cursors) <> 'object' THEN
      RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(cursors)) > 500 THEN
      RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE = '22023';
    END IF;
    -- Validate the whole acknowledgement before advancing any room. A message
    -- from a different room must never become this room's read boundary.
    FOR entry IN SELECT key, value FROM jsonb_each_text(cursors) LOOP
      BEGIN
        cursor_room := entry.key::uuid;
        cursor_message := entry.value::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE = '22023';
      END;
      IF NOT coalesce(cursor_room = ANY(p_room_ids), false) OR NOT EXISTS (
        SELECT 1 FROM public."ChatMessage" m
        WHERE m.id = cursor_message AND m.room_id = cursor_room
      ) THEN RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE = '22023'; END IF;
    END LOOP;
    IF p_through_message_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM jsonb_each_text(cursors) c WHERE c.value::uuid = p_through_message_id
    ) THEN RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE = '22023'; END IF;
  ELSIF p_through_message_id IS NOT NULL THEN
    SELECT m.room_id INTO cursor_room FROM public."ChatMessage" m
    WHERE m.id = p_through_message_id AND m.room_id = ANY(p_room_ids);
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid read cursor' USING ERRCODE = '22023'; END IF;
    -- Existing clients send one visible message. Only its own room is known
    -- visible; leaving other rooms unread is safer than acknowledging unseen rows.
    cursors := jsonb_build_object(cursor_room::text, p_through_message_id::text);
  ELSE
    -- Older clients without any cursor retain request-time semantics, choosing
    -- each room's own boundary rather than copying another room's timestamp.
    SELECT coalesce(jsonb_object_agg(r.id::text, NULL::text), '{}'::jsonb)
      INTO cursors FROM unnest(p_room_ids) r(id);
  END IF;

  -- The existing RPC locks participants and advances monotonically. Sorted
  -- room order also keeps two multi-room readers from locking in reverse order.
  FOR entry IN SELECT key, value FROM jsonb_each_text(cursors) ORDER BY key LOOP
    SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO room_rows
    FROM public.mark_chat_read_through(p_user_id, ARRAY[entry.key::uuid],
      entry.value::uuid, p_request_at) r;
    result_rows := result_rows || room_rows;
  END LOOP;
  SELECT coalesce(sum(p.unread_count), 0) INTO remaining
  FROM public."ChatParticipant" p
  WHERE p.user_id = p_user_id AND p.room_id = ANY(p_room_ids) AND p.is_active;
  RETURN jsonb_build_object('data', result_rows, 'unreadCount', remaining);
END;
$$;
REVOKE ALL ON FUNCTION public.mark_chat_read_boundaries(uuid, uuid[], jsonb, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_read_boundaries(uuid, uuid[], jsonb, uuid, timestamptz)
  TO service_role;
COMMIT;
