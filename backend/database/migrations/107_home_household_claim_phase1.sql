-- Migration 107: Home household claim Phase 1
--
-- Additive schema + compatibility backfill only.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'household_resolution_state'
  ) THEN
    CREATE TYPE "public"."household_resolution_state" AS ENUM (
      'unclaimed',
      'pending_single_claim',
      'contested',
      'verified_household',
      'disputed'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'claim_phase_v2'
  ) THEN
    CREATE TYPE "public"."claim_phase_v2" AS ENUM (
      'initiated',
      'evidence_submitted',
      'under_review',
      'verified',
      'challenged',
      'withdrawn',
      'expired',
      'merged_into_household',
      'rejected'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'claim_terminal_reason'
  ) THEN
    CREATE TYPE "public"."claim_terminal_reason" AS ENUM (
      'none',
      'withdrawn_by_user',
      'expired_no_evidence',
      'merged_via_invite',
      'rejected_review',
      'superseded_by_stronger_claim',
      'duplicate_redundant_claim',
      'revoked_after_challenge'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'claim_challenge_state'
  ) THEN
    CREATE TYPE "public"."claim_challenge_state" AS ENUM (
      'none',
      'challenged',
      'resolved_upheld',
      'resolved_revoked'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'claim_strength'
  ) THEN
    CREATE TYPE "public"."claim_strength" AS ENUM (
      'resident_low',
      'resident_standard',
      'owner_standard',
      'owner_strong',
      'owner_legal'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'claim_routing_classification'
  ) THEN
    CREATE TYPE "public"."claim_routing_classification" AS ENUM (
      'standalone_claim',
      'parallel_claim',
      'challenge_claim',
      'merge_candidate'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'identity_status'
  ) THEN
    CREATE TYPE "public"."identity_status" AS ENUM (
      'not_started',
      'pending',
      'verified',
      'failed'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'evidence_confidence_level'
  ) THEN
    CREATE TYPE "public"."evidence_confidence_level" AS ENUM (
      'low',
      'medium',
      'high'
    );
  END IF;
END
$$;

ALTER TABLE "public"."Home"
  ADD COLUMN IF NOT EXISTS "household_resolution_state" "public"."household_resolution_state" NOT NULL DEFAULT 'unclaimed',
  ADD COLUMN IF NOT EXISTS "household_resolution_updated_at" timestamptz;

ALTER TABLE "public"."HomeOwnershipClaim"
  ADD COLUMN IF NOT EXISTS "claim_phase_v2" "public"."claim_phase_v2",
  ADD COLUMN IF NOT EXISTS "terminal_reason" "public"."claim_terminal_reason" NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "challenge_state" "public"."claim_challenge_state" NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "claim_strength" "public"."claim_strength",
  ADD COLUMN IF NOT EXISTS "routing_classification" "public"."claim_routing_classification",
  ADD COLUMN IF NOT EXISTS "identity_status" "public"."identity_status" NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS "merged_into_claim_id" uuid,
  ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'HomeOwnershipClaim_merged_into_claim_id_fkey'
  ) THEN
    ALTER TABLE ONLY "public"."HomeOwnershipClaim"
      ADD CONSTRAINT "HomeOwnershipClaim_merged_into_claim_id_fkey"
      FOREIGN KEY ("merged_into_claim_id")
      REFERENCES "public"."HomeOwnershipClaim"("id")
      ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE "public"."HomeVerificationEvidence"
  ADD COLUMN IF NOT EXISTS "confidence_level" "public"."evidence_confidence_level";

UPDATE "public"."HomeOwnershipClaim"
SET "claim_phase_v2" = CASE "state"
  WHEN 'draft' THEN 'initiated'::"public"."claim_phase_v2"
  WHEN 'submitted' THEN 'evidence_submitted'::"public"."claim_phase_v2"
  WHEN 'needs_more_info' THEN 'under_review'::"public"."claim_phase_v2"
  WHEN 'pending_review' THEN 'under_review'::"public"."claim_phase_v2"
  WHEN 'pending_challenge_window' THEN 'under_review'::"public"."claim_phase_v2"
  WHEN 'approved' THEN 'verified'::"public"."claim_phase_v2"
  WHEN 'rejected' THEN 'rejected'::"public"."claim_phase_v2"
  WHEN 'disputed' THEN 'challenged'::"public"."claim_phase_v2"
  WHEN 'revoked' THEN 'rejected'::"public"."claim_phase_v2"
  ELSE "claim_phase_v2"
END
WHERE "claim_phase_v2" IS NULL;

UPDATE "public"."HomeOwnershipClaim"
SET "terminal_reason" = 'none'::"public"."claim_terminal_reason"
WHERE "terminal_reason" IS NULL;

UPDATE "public"."HomeOwnershipClaim"
SET "challenge_state" = 'challenged'::"public"."claim_challenge_state"
WHERE "state" = 'disputed'
  AND "challenge_state" = 'none'::"public"."claim_challenge_state";

WITH claim_activity AS (
  SELECT
    "home_id",
    COUNT(*) FILTER (
      WHERE "state" IN (
        'draft',
        'submitted',
        'needs_more_info',
        'pending_review',
        'pending_challenge_window'
      )
    ) AS active_claim_count
  FROM "public"."HomeOwnershipClaim"
  GROUP BY "home_id"
),
verified_owner_activity AS (
  SELECT
    "home_id",
    COUNT(*) FILTER (WHERE "owner_status" = 'verified') AS verified_owner_count
  FROM "public"."HomeOwner"
  GROUP BY "home_id"
),
seed_resolution AS (
  SELECT
    h."id" AS home_id,
    CASE
      WHEN COALESCE(voa.verified_owner_count, 0) > 0
        AND COALESCE(ca.active_claim_count, 0) = 0
        THEN 'verified_household'::"public"."household_resolution_state"
      WHEN COALESCE(ca.active_claim_count, 0) = 1
        THEN 'pending_single_claim'::"public"."household_resolution_state"
      WHEN COALESCE(ca.active_claim_count, 0) > 1
        THEN 'contested'::"public"."household_resolution_state"
      ELSE 'unclaimed'::"public"."household_resolution_state"
    END AS household_resolution_state
  FROM "public"."Home" h
  LEFT JOIN claim_activity ca
    ON ca."home_id" = h."id"
  LEFT JOIN verified_owner_activity voa
    ON voa."home_id" = h."id"
)
UPDATE "public"."Home" h
SET
  "household_resolution_state" = sr."household_resolution_state",
  "household_resolution_updated_at" = now()
FROM seed_resolution sr
WHERE h."id" = sr."home_id"
  AND h."household_resolution_updated_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_home_household_resolution_state"
  ON "public"."Home" ("household_resolution_state");

CREATE INDEX IF NOT EXISTS "idx_ownership_claim_challenge_state_home"
  ON "public"."HomeOwnershipClaim" ("home_id", "challenge_state");

CREATE INDEX IF NOT EXISTS "idx_ownership_claim_expires_initiated"
  ON "public"."HomeOwnershipClaim" ("expires_at")
  WHERE "claim_phase_v2" = 'initiated'::"public"."claim_phase_v2";

CREATE INDEX IF NOT EXISTS "idx_ownership_claim_home_claim_phase_v2"
  ON "public"."HomeOwnershipClaim" ("home_id", "claim_phase_v2");

CREATE INDEX IF NOT EXISTS "idx_ownership_claim_home_routing_classification"
  ON "public"."HomeOwnershipClaim" ("home_id", "routing_classification");

COMMIT;
