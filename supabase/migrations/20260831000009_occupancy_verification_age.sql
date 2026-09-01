-- Migration 193: When was this residency actually verified?
--
-- §5.1 / LIF-04 — `HomeOccupancy.verification_status` is one bit and it is the
-- only bit. The system had no column recording WHEN a residency was verified,
-- so it structurally could not express "this verification is 29 months old".
-- Every trust decision treated a verification from three years ago and one from
-- this morning as identical, while roughly a tenth of the population moves each
-- year (audit 2026-08-22).
--
-- This adds the timestamps. It deliberately does NOT change any access
-- decision: enforcement is gated behind the `address.enforce_verification_expiry`
-- runtime flag (utils/addressRolloutFlags.js), shipped disabled.
-- Expiring the existing verified base is a product decision, not a migration.

BEGIN;

ALTER TABLE "public"."HomeOccupancy"
  ADD COLUMN IF NOT EXISTS "verified_at" timestamptz;

ALTER TABLE "public"."HomeOccupancy"
  ADD COLUMN IF NOT EXISTS "verification_expires_at" timestamptz;

-- Backfill from start_at, the best available proxy for when the residency
-- began. This is an approximation and is marked as such: it is better than
-- treating every historical verification as having happened today, which is
-- what a NULL would effectively mean to a staleness check.
UPDATE "public"."HomeOccupancy"
   SET "verified_at" = COALESCE("start_at", "created_at")
 WHERE "verified_at" IS NULL
   AND "verification_status" = 'verified';

CREATE INDEX IF NOT EXISTS "idx_home_occupancy_verification_age"
  ON "public"."HomeOccupancy" ("verification_expires_at")
  WHERE "is_active" = true AND "verification_status" = 'verified';

COMMENT ON COLUMN "public"."HomeOccupancy"."verified_at" IS
  'When this residency was last verified. Backfilled from start_at for rows '
  'predating migration 193, so historical values are approximate.';

COMMENT ON COLUMN "public"."HomeOccupancy"."verification_expires_at" IS
  'When this verification should be re-attested. Advisory unless the '
  'address.enforce_verification_expiry flag is enabled.';

COMMIT;
