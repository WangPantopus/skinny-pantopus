-- Backwards compatible: yes. Adds three columns (two null on every existing row, one with a
-- constant default), adds two CHECKs those values already pass, widens one CHECK and adds two
-- reference rows. Every existing row stays valid and keeps its meaning. Deploy migration before
-- backend.
--
-- Pulse post lifecycle (docs/product/pulse-build/02-contract.md §1 and §4.1, slice S7):
--   * Post.expires_at: when a post ends (a Heads-up's named time; set from the type for new Pulse
--     posts). Null on older posts, which keep ending by PostCategoryTTL as today.
--   * Post.resolution: how it ended; null while open, and on older posts.
--   * Post.claim_mode: how an Offer is claimed, 'choose' unless the giver picks 'first'.
--   * Post_post_type_check gains 'share' and 'offer'. Nothing creates them until S8.
--   * PostCategoryTTL: Share 3 days and Offer 7 days (the other types' rows already exist).
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."Post" ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public."Post" ADD COLUMN IF NOT EXISTS resolution text;
ALTER TABLE public."Post" ADD COLUMN IF NOT EXISTS claim_mode text DEFAULT 'choose';

ALTER TABLE public."Post" DROP CONSTRAINT IF EXISTS "Post_resolution_check";
ALTER TABLE public."Post" ADD CONSTRAINT "Post_resolution_check" CHECK (resolution IS NULL OR resolution = ANY (ARRAY[
  'answered'::text, 'closed'::text, 'closed_unanswered'::text, 'claimed'::text,
  'expired'::text, 'happened'::text, 'reunited'::text
]));

ALTER TABLE public."Post" DROP CONSTRAINT IF EXISTS "Post_claim_mode_check";
ALTER TABLE public."Post" ADD CONSTRAINT "Post_claim_mode_check" CHECK (claim_mode IS NULL OR claim_mode = ANY (ARRAY[
  'choose'::text, 'first'::text
]));

ALTER TABLE public."Post" DROP CONSTRAINT IF EXISTS "Post_post_type_check";
ALTER TABLE public."Post" ADD CONSTRAINT "Post_post_type_check" CHECK ((post_type)::text = ANY (ARRAY[
  'ask_local'::text, 'recommendation'::text, 'event'::text, 'lost_found'::text, 'alert'::text,
  'deal'::text, 'local_update'::text, 'neighborhood_win'::text, 'visitor_guide'::text,
  'general'::text, 'personal_update'::text, 'announcement'::text, 'service_offer'::text,
  'resources_howto'::text, 'progress_wins'::text,
  'share'::text, 'offer'::text
]));

INSERT INTO public."PostCategoryTTL" (post_type, ttl_days) VALUES ('share', 3), ('offer', 7)
  ON CONFLICT (post_type) DO NOTHING;
