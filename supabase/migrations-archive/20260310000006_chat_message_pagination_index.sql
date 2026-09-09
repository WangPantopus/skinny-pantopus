-- Composite index for stable cursor pagination: (room_id, created_at DESC, id DESC).
-- Covers the hot path: fetching recent messages for a room with keyset pagination.
-- Partial index excludes deleted messages which are never shown in normal feeds.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_message_room_created_id
  ON "ChatMessage" (room_id, created_at DESC, id DESC)
  WHERE deleted = false;
