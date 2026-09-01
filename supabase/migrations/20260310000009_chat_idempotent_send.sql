-- Add client_message_id column for idempotent message sends.
-- When a client retries a failed send with the same client_message_id,
-- the server returns the existing message instead of creating a duplicate.

ALTER TABLE "ChatMessage" ADD COLUMN "client_message_id" UUID;

-- Partial unique index: only enforce uniqueness when client_message_id is set
CREATE UNIQUE INDEX idx_chat_message_client_id
  ON "ChatMessage" (client_message_id)
  WHERE client_message_id IS NOT NULL;
