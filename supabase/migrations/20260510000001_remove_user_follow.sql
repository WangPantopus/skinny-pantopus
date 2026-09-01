-- Migration 140: Remove peer-to-peer Following feature.
--
-- Pulse → Following tab and the underlying UserFollow graph are removed in
-- favor of the existing Connections (mutual trust) and Public Profile
-- subscriptions (PersonaMembership) graphs. This migration:
--   1. Migrates existing Post rows that target the legacy 'followers' audience
--      to 'connections' (skipping persona-context posts, where 'followers'
--      means PersonaMembership audience and stays valid).
--   2. Replaces the post_select_public RLS policy with a version that no
--      longer references UserFollow.
--   3. Drops legacy get_neighborhood_feed* stored procedures (no longer
--      called; superseded by feedService.js / getListFeed).
--   4. Drops the sync_followers_count trigger and function.
--   5. Drops the UserFollow table.
--   6. Drops the now-stale User.followers_count column. Business reads that
--      previously used this denormalized counter must compute from
--      BusinessFollow on demand.
--   7. Drops UserFeedPreference.show_politics_following — the Following surface
--      is gone, so this politics opt-in column has no read path.
--
-- Idempotent: safe to re-run after partial failure.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Migrate Post rows: 'followers' → 'connections' for non-persona posts
-- ---------------------------------------------------------------------------

-- Personal/local posts: visibility, audience, profile_visibility_scope
UPDATE "public"."Post"
SET visibility = 'connections'
WHERE visibility = 'followers'
  AND COALESCE(identity_context_type, 'local') <> 'persona'
  AND COALESCE(post_as, 'personal') <> 'persona';

UPDATE "public"."Post"
SET audience = 'connections'
WHERE audience = 'followers'
  AND COALESCE(identity_context_type, 'local') <> 'persona'
  AND COALESCE(post_as, 'personal') <> 'persona';

UPDATE "public"."Post"
SET profile_visibility_scope = 'connections'
WHERE profile_visibility_scope = 'followers'
  AND COALESCE(identity_context_type, 'local') <> 'persona'
  AND COALESCE(post_as, 'personal') <> 'persona';

-- distribution_targets[]: replace 'followers' with 'connections', dedupe.
-- Only touches non-persona posts; persona posts use 'persona_followers'
-- in this array, not the bare 'followers' marker.
UPDATE "public"."Post"
SET distribution_targets = (
  SELECT ARRAY(
    SELECT DISTINCT CASE WHEN x = 'followers' THEN 'connections' ELSE x END
    FROM unnest(distribution_targets) AS x
  )
)
WHERE 'followers' = ANY(distribution_targets)
  AND COALESCE(identity_context_type, 'local') <> 'persona'
  AND COALESCE(post_as, 'personal') <> 'persona';

-- ---------------------------------------------------------------------------
-- 2. Replace post_select_public RLS policy (drop reference to UserFollow)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "post_select_public" ON "public"."Post";

CREATE POLICY "post_select_public" ON "public"."Post"
  FOR SELECT
  USING (
    (visibility::text = 'public')
    OR (user_id = auth.uid())
    OR (
      visibility::text = 'neighborhood'
      AND EXISTS (
        SELECT 1
        FROM "public"."User" u1, "public"."User" u2
        WHERE u1.id = auth.uid()
          AND u2.id = "Post".user_id
          AND u1.city::text = u2.city::text
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Drop legacy neighborhood-feed RPCs that reference UserFollow.
--    These are no longer called from application code; the canonical entry
--    point is feedService.getListFeed in Node. CASCADE pulls along any
--    dependent grants.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS "public"."get_neighborhood_feed"("uuid", "integer", "integer") CASCADE;
DROP FUNCTION IF EXISTS "public"."get_neighborhood_feed"("uuid", "integer", "integer", "text", "integer") CASCADE;
DROP FUNCTION IF EXISTS "public"."get_neighborhood_feed_at"("uuid", "double precision", "double precision", "integer", "integer", "text", "integer") CASCADE;
DROP FUNCTION IF EXISTS "public"."get_neighborhood_feed_v2"("uuid", "double precision", "double precision", "integer", "integer", "text", "integer", "text"[]) CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Drop the sync_followers_count trigger and function.
--    The User.followers_count column it maintained is dropped in step 6.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public."UserFollow"') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS "trg_sync_followers_count" ON "public"."UserFollow";
  END IF;
END $$;
DROP FUNCTION IF EXISTS "public"."sync_followers_count"() CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Drop the UserFollow table.
--    CASCADE removes the index/constraint/grant dependencies. Any RLS
--    policies referencing the table were already replaced above.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS "public"."UserFollow" CASCADE;

-- ---------------------------------------------------------------------------
-- 6. Drop the denormalized User.followers_count column.
--    The trigger that maintained it was removed in step 4. Any business
--    follower-count reads should query BusinessFollow directly.
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."User" DROP COLUMN IF EXISTS "followers_count";

-- ---------------------------------------------------------------------------
-- 7. Drop UserFeedPreference.show_politics_following — the Following surface
--    is removed, so this column has no read path.
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."UserFeedPreference" DROP COLUMN IF EXISTS "show_politics_following";

COMMIT;
