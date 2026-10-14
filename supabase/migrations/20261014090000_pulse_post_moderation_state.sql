-- Backwards compatible: yes. Adds four columns to Post: one with a constant default ('live', what
-- every existing post is) and three null on every existing row, plus a CHECK the default passes.
-- Every existing row stays valid and keeps its meaning; nothing writes 'held' or 'removed' yet.
-- Deploy migration before backend (the backend reads moderation_state).
--
-- Pulse moderation states on posts (docs/product/pulse-build/02-contract.md §1, §4.1 and §5; slice
-- S11, PB's half):
--   * Post.moderation_state: 'live', 'held' (waiting for review: its author and staff read it) or
--     'removed' (its author alone reads it). The feeds and the map show live posts only.
--   * Post.moderation_rule, Post.moderation_note, Post.moderated_at: which rule, the plain reason
--     shown to the author, and when. PS's moderation actions (S11) and S8's held sale posts write
--     them; until then every post is live.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."Post" ADD COLUMN IF NOT EXISTS moderation_state text NOT NULL DEFAULT 'live';
ALTER TABLE public."Post" ADD COLUMN IF NOT EXISTS moderation_rule text;
ALTER TABLE public."Post" ADD COLUMN IF NOT EXISTS moderation_note text;
ALTER TABLE public."Post" ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

ALTER TABLE public."Post" DROP CONSTRAINT IF EXISTS "Post_moderation_state_check";
ALTER TABLE public."Post" ADD CONSTRAINT "Post_moderation_state_check" CHECK (moderation_state = ANY (ARRAY[
  'live'::text, 'held'::text, 'removed'::text
]));
