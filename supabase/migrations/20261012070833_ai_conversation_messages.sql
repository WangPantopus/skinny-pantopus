-- Backwards compatible: yes. Adds one column with a default to "AIConversation" and changes two column
-- comments. The deployed API selects the row with `*` and ignores columns it doesn't know, writes only
-- the columns it already had, and `listConversations` names its columns; no existing column, row, index,
-- policy or trigger changes.
--
-- The assistant moved from OpenAI's Responses API, which kept the conversation on OpenAI's servers
-- behind `previous_response_id` (stored in "response_id"), to Claude's Messages API, which keeps
-- nothing: every turn is sent the conversation so far. "messages" holds that transcript, in the compact
-- form services/ai/agentLoop.js writes and checks (text, tool calls and tool results; no photos, no
-- thinking blocks; at most the last 60 messages). Conversations that began on OpenAI have no transcript
-- here, so their next message starts fresh in the same conversation. The API still answers, without
-- memory of earlier turns, if it runs before this migration is applied.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."AIConversation"
  ADD COLUMN IF NOT EXISTS messages jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public."AIConversation".messages IS
  'Compact transcript sent to Claude on each turn (Messages API is stateless). Written by services/ai/agentLoop.js compactForStorage.';
COMMENT ON COLUMN public."AIConversation".response_id IS
  'Legacy: OpenAI Responses API previous_response_id. Not written since the move to Claude; kept so older rows and deployed code keep working.';
