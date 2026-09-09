-- RPC: get_room_previews(p_room_ids UUID[])
-- Returns the most recent non-deleted message per room using DISTINCT ON.
-- Leverages the composite index idx_chat_message_room_created_id
-- (room_id, created_at DESC, id DESC) WHERE deleted = false.
--
-- Replaces the heuristic "fetch N*3 rows and dedupe in JS" pattern
-- used in GET /rooms and GET /unified-conversations.

CREATE OR REPLACE FUNCTION get_room_previews(p_room_ids UUID[])
RETURNS TABLE (
  room_id UUID,
  message TEXT,
  created_at TIMESTAMPTZ,
  deleted BOOLEAN,
  type TEXT,
  attachments JSONB
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (m.room_id)
    m.room_id,
    m.message,
    m.created_at,
    m.deleted,
    m.type,
    m.attachments
  FROM "ChatMessage" m
  WHERE m.room_id = ANY(p_room_ids)
    AND m.deleted = false
  ORDER BY m.room_id, m.created_at DESC, m.id DESC;
$$;
