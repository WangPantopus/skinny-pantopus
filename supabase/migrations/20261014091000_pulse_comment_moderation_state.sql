-- Backwards compatible: yes. Adds two columns to PostComment: one with a constant default ('live',
-- what every existing reply is) and one null on every existing row, plus a CHECK the default
-- passes. Every existing row stays valid and keeps its meaning; nothing writes 'held' or 'removed'
-- yet. Deploy migration before backend (the backend reads moderation_state).
--
-- Pulse moderation states on replies (docs/product/pulse-build/02-contract.md §4.1 and §5; slice
-- S11, PB's half, part 2):
--   * PostComment.moderation_state: 'live', 'held' (waiting for review) or 'removed'. A held or
--     removed reply reads only for its author; everyone else's comment lists leave it out.
--   * PostComment.moderation_rule: which rule. PS's moderation actions (S11) write both.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."PostComment" ADD COLUMN IF NOT EXISTS moderation_state text NOT NULL DEFAULT 'live';
ALTER TABLE public."PostComment" ADD COLUMN IF NOT EXISTS moderation_rule text;

ALTER TABLE public."PostComment" DROP CONSTRAINT IF EXISTS "PostComment_moderation_state_check";
ALTER TABLE public."PostComment" ADD CONSTRAINT "PostComment_moderation_state_check" CHECK (moderation_state = ANY (ARRAY[
  'live'::text, 'held'::text, 'removed'::text
]));
