-- Phase 1 / P1.1: PersonaTier + PersonaMembership extension.
--
-- Audience Profile + Paid Tier Ladder Design v2 (§5.3 — PersonaTier and
-- PersonaMembership schemas; §7.1 — default v1.0 ladder Follower/Member/
-- Insider; §6.4 — free Follower tier behaviour).
--
-- This migration is the foundation every Phase 1 feature reads from. It:
--   1. Creates the PersonaTier table with the cumulative-tier-ladder constraints.
--   2. Seeds a default 3-tier ladder (Follower/Member/Insider) for every
--      existing PublicPersona. Member and Insider are created with
--      status='active' but stripe_price_id IS NULL — they only become
--      subscribable after Stripe Connect onboarding (P1.7).
--   3. Extends PersonaMembership with the columns needed for the paid-tier
--      lifecycle (Stripe IDs, period dates, cancel_at_period_end,
--      scheduled_tier_change_id) plus the verified-local marker.
--   4. Backfills every existing PersonaMembership row to point at its
--      persona's freshly-seeded rank-1 (Follower) tier.
--   5. Promotes tier_id to NOT NULL and adds the foreign key, completing the
--      transition that migration 132 (P0.1) deliberately left half-finished.
--   6. Recreates the legacy PersonaFollow view with the same column shape it
--      had in migration 132, but filtering on tier rank = 1 instead of
--      tier_id IS NULL — required because step 4 makes tier_id non-null on
--      every existing row.
--   7. Drops the migration_original_username column retained by P0.1 for
--      verification; it has no remaining consumers.
--
-- Idempotent: safe to re-run after a partial failure.

-- ---------------------------------------------------------------------------
-- 1. PersonaTier table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."PersonaTier" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" uuid NOT NULL,
  "rank" int NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price_cents" int NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'USD',
  "billing_interval" text NOT NULL DEFAULT 'month',
  "msg_threads_per_period" int,
  "video_calls_per_period" int,
  "video_call_duration_minutes" int DEFAULT 15,
  "creator_can_initiate_dm" boolean NOT NULL DEFAULT false,
  "reply_policy" text NOT NULL DEFAULT 'discretion',
  "status" text NOT NULL DEFAULT 'active',
  "stripe_price_id" text,
  "position" int NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PersonaTier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonaTier_rank_check" CHECK ("rank" BETWEEN 1 AND 4),
  CONSTRAINT "PersonaTier_billing_interval_check"
    CHECK ("billing_interval" IN ('month','year')),
  CONSTRAINT "PersonaTier_status_check"
    CHECK ("status" IN ('active','hidden','archived')),
  CONSTRAINT "PersonaTier_reply_policy_check"
    CHECK ("reply_policy" IN ('discretion','within_3_days','within_7_days','within_14_days','always')),
  CONSTRAINT "PersonaTier_persona_rank_key" UNIQUE ("persona_id", "rank"),
  CONSTRAINT "PersonaTier_price_rank_check" CHECK (
    ("price_cents" = 0 AND "rank" = 1) OR ("price_cents" > 0 AND "rank" > 1)
  ),
  CONSTRAINT "PersonaTier_persona_id_fkey"
    FOREIGN KEY ("persona_id") REFERENCES "public"."PublicPersona"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_persona_tier_persona_active"
  ON "public"."PersonaTier" ("persona_id", "rank")
  WHERE "status" = 'active';

-- ---------------------------------------------------------------------------
-- 2. Seed the v1.0 default 3-tier ladder for every existing PublicPersona.
--    Rank 4 (Direct / video calls) is reserved for v1.1 and is NOT seeded
--    here — its UI surface ships in PR 10. See design v2 §7.1.
-- ---------------------------------------------------------------------------
INSERT INTO "public"."PersonaTier" (
  "persona_id", "rank", "name", "description",
  "price_cents", "msg_threads_per_period", "creator_can_initiate_dm",
  "reply_policy", "position"
)
SELECT id, 1, 'Follower',
       'Public posts + follower updates',
       0, NULL, false, 'discretion', 1
FROM "public"."PublicPersona"
ON CONFLICT ("persona_id", "rank") DO NOTHING;

INSERT INTO "public"."PersonaTier" (
  "persona_id", "rank", "name", "description",
  "price_cents", "msg_threads_per_period", "creator_can_initiate_dm",
  "reply_policy", "position"
)
SELECT id, 2, 'Member',
       'Everything in Follower, plus 5 message threads per month',
       500, 5, false, 'discretion', 2
FROM "public"."PublicPersona"
ON CONFLICT ("persona_id", "rank") DO NOTHING;

INSERT INTO "public"."PersonaTier" (
  "persona_id", "rank", "name", "description",
  "price_cents", "msg_threads_per_period", "creator_can_initiate_dm",
  "reply_policy", "position"
)
SELECT id, 3, 'Insider',
       'Everything in Member, plus 25 threads/month and creator can DM you back',
       1500, 25, true, 'within_7_days', 3
FROM "public"."PublicPersona"
ON CONFLICT ("persona_id", "rank") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Extend PersonaMembership with paid-tier lifecycle columns.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."PersonaMembership"
  ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "scheduled_tier_change_id" uuid,
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text,
  ADD COLUMN IF NOT EXISTS "current_period_start" timestamptz,
  ADD COLUMN IF NOT EXISTS "current_period_end" timestamptz,
  ADD COLUMN IF NOT EXISTS "trial_end" timestamptz,
  ADD COLUMN IF NOT EXISTS "canceled_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "verified_local" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verified_local_at" timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'PersonaMembership'
      AND constraint_name = 'PersonaMembership_scheduled_tier_change_id_fkey'
  ) THEN
    ALTER TABLE "public"."PersonaMembership"
      ADD CONSTRAINT "PersonaMembership_scheduled_tier_change_id_fkey"
        FOREIGN KEY ("scheduled_tier_change_id")
        REFERENCES "public"."PersonaTier"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_persona_membership_period_end"
  ON "public"."PersonaMembership" ("current_period_end")
  WHERE "status" = 'active';
CREATE INDEX IF NOT EXISTS "idx_persona_membership_stripe_subscription"
  ON "public"."PersonaMembership" ("stripe_subscription_id")
  WHERE "stripe_subscription_id" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Backfill PersonaMembership.tier_id to each persona's rank-1 tier.
--    Step 2 guarantees a rank-1 row exists for every PublicPersona, so this
--    lookup is total over rows whose persona still exists. (FK ON DELETE
--    CASCADE on PersonaMembership.persona_id → PublicPersona.id ensures
--    there are no orphaned memberships.)
-- ---------------------------------------------------------------------------
UPDATE "public"."PersonaMembership" pm
   SET "tier_id" = pt."id"
  FROM "public"."PersonaTier" pt
 WHERE pt."persona_id" = pm."persona_id"
   AND pt."rank" = 1
   AND pm."tier_id" IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Promote tier_id to NOT NULL and add the FK to PersonaTier.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."PersonaMembership"
  ALTER COLUMN "tier_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'PersonaMembership'
      AND constraint_name = 'PersonaMembership_tier_id_fkey'
  ) THEN
    ALTER TABLE "public"."PersonaMembership"
      ADD CONSTRAINT "PersonaMembership_tier_id_fkey"
        FOREIGN KEY ("tier_id") REFERENCES "public"."PersonaTier"("id");
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Recreate the PersonaFollow view.
--
--    Migration 132 created the view with WHERE tier_id IS NULL. After the
--    backfill in step 4, that filter would match zero rows in production —
--    every membership now has a non-null tier_id. Recreate the view filtered
--    on tier rank = 1 so legacy PersonaFollow callers continue to see only
--    free Follower rows; paid members are handled through PersonaMembership.
--
--    Column shape MUST stay byte-identical to migration 132's view so all
--    existing read paths (services/feedService.js, routes/personas.js,
--    routes/identitySearch.js, routes/broadcastChannels.js, routes/posts.js,
--    utils/identityProfiles.js) keep working.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS "public"."PersonaFollow";

CREATE VIEW "public"."PersonaFollow" AS
SELECT
  pm."id",
  pm."persona_id",
  pm."user_id" AS "follower_user_id",
  pm."relationship_type",
  pm."status",
  pm."source",
  pm."notification_level",
  pm."public_visibility",
  pm."approved_by_user_id",
  pm."approved_at",
  pm."created_at",
  pm."updated_at"
FROM "public"."PersonaMembership" pm
JOIN "public"."PersonaTier" pt ON pt."id" = pm."tier_id"
WHERE pt."rank" = 1;

GRANT SELECT ON "public"."PersonaFollow" TO "anon", "authenticated", "service_role";

-- ---------------------------------------------------------------------------
-- 7. Drop the P0.1 migration audit column. It was retained for one rollout
--    window so operators could verify the random-handle privacy invariant
--    against the source User.username; that verification has run.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."PersonaMembership"
  DROP COLUMN IF EXISTS "migration_original_username";

-- ---------------------------------------------------------------------------
-- 8. Grants on the new table. Service role bypasses RLS as elsewhere; anon
--    and authenticated have no direct PersonaTier access. Tier discovery
--    flows through API serializers in P1.5.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."PersonaTier" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."PersonaTier" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."PersonaTier" TO "service_role";
