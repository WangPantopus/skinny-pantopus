-- Phase 1 / P1.10: Tier-rank-aware broadcast visibility.
--
-- Audience Profile design v2 §11.3 (4-option visibility selector) +
-- §13.4 (tier-gating tests). Adds the `target_tier_rank` column and
-- expands the visibility CHECK to include 'tier_or_above'. The legacy
-- 'subscribers' value stays in the CHECK as a transitional alias so:
--   * historical rows survive (the UPDATE below backfills them but
--     defense-in-depth is cheap),
--   * any unmigrated test fixture or external client that POSTs
--     'subscribers' continues to validate at the DB layer; the
--     application normalizes it into tier_or_above rank=2 going
--     forward.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Add target_tier_rank column.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."BroadcastMessage"
  ADD COLUMN IF NOT EXISTS "target_tier_rank" int;

-- ---------------------------------------------------------------------------
-- 2. Expand the visibility CHECK to accept 'tier_or_above' alongside the
--    legacy 'subscribers' alias.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."BroadcastMessage"
  DROP CONSTRAINT IF EXISTS "BroadcastMessage_visibility_check";

ALTER TABLE "public"."BroadcastMessage"
  ADD CONSTRAINT "BroadcastMessage_visibility_check"
  CHECK ("visibility" IN ('public', 'followers', 'tier_or_above', 'subscribers'));

-- ---------------------------------------------------------------------------
-- 3. target_tier_rank is mandatory iff visibility = 'tier_or_above'. Other
--    visibilities (public / followers / subscribers) MUST keep it NULL so
--    the rank field has unambiguous semantics for downstream readers.
--
--    Guarded with NOT EXISTS so the migration is re-runnable.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'BroadcastMessage'
      AND constraint_name = 'BroadcastMessage_target_tier_rank_check'
  ) THEN
    ALTER TABLE "public"."BroadcastMessage"
      ADD CONSTRAINT "BroadcastMessage_target_tier_rank_check"
      CHECK (
        ("visibility" = 'tier_or_above' AND "target_tier_rank" BETWEEN 1 AND 4)
        OR ("visibility" != 'tier_or_above' AND "target_tier_rank" IS NULL)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Backfill — any pre-existing 'subscribers' broadcast becomes
--    tier_or_above rank 2 (Member). This matches design v2 §7.1's
--    semantic mapping: "subscribers" historically meant "anyone paying",
--    which is the Member tier and above.
-- ---------------------------------------------------------------------------
UPDATE "public"."BroadcastMessage"
   SET "visibility" = 'tier_or_above',
       "target_tier_rank" = 2,
       "updated_at" = now()
 WHERE "visibility" = 'subscribers'
   AND "target_tier_rank" IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Index for the read-side filter
--    `WHERE persona_id = $1 AND visibility IN (...) ORDER BY published_at DESC`.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_broadcast_message_persona_visibility"
  ON "public"."BroadcastMessage" ("persona_id", "visibility", "published_at" DESC);
