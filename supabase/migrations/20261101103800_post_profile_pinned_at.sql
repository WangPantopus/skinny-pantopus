-- Backwards compatible: yes. Adds one nullable column to "Post" and one partial index; no other table, function,
-- constraint or grant changes. Deployed apps and the current backend never read or write it, and Post.is_pinned (the
-- platform's feed-wide pin that orders feeds) is untouched.
--
-- Profile redesign, SRV-3 (the founder approved this database change on 2026-11-01, decision D1): a person pins up to
-- three of their own posts to their profile. The backend enforces the limit and who may pin.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."Post" ADD COLUMN profile_pinned_at timestamptz;

COMMENT ON COLUMN public."Post".profile_pinned_at IS
  'When the author pinned this post to their profile (at most three per person), or null. Not is_pinned, the feed-wide pin.';

CREATE INDEX idx_post_profile_pinned ON public."Post" USING btree (user_id, profile_pinned_at DESC)
  WHERE profile_pinned_at IS NOT NULL;
