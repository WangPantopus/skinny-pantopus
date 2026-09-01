-- Migration: Home Onboarding Security
--
-- Adds schema changes required for the Home onboarding overhaul:
--   1. Concurrent claim race condition prevention (unique partial indexes)
--   2. Occupancy verification status tracking
--   3. Open invite flag for household QR codes
--   4. Cold-start columns on HomeResidencyClaim
--   5. Challenge window tracking on HomeOccupancy
--   6. Vacancy tracking on Home

-- ============================================================
-- 1. Prevent concurrent ownership claims (BUG 1B)
--    Only one active ownership claim per home at a time.
--    States: submitted, pending_review, pending_challenge_window
--    (These are the "in-flight" states from ownership_claim_state enum.
--     'approved', 'rejected', 'disputed', 'revoked' are terminal.)
--
--    STEP 1a: Deduplicate existing data — keep the newest active claim
--    per home, revoke older duplicates so the unique index can be created.
-- ============================================================
UPDATE "HomeOwnershipClaim"
SET state = 'revoked',
    review_note = 'Auto-revoked by migration: duplicate active claim',
    updated_at = now()
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY home_id
             ORDER BY created_at DESC
           ) AS rn
    FROM "HomeOwnershipClaim"
    WHERE state IN ('submitted', 'pending_review', 'pending_challenge_window')
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_home_claim_active_unique
  ON "HomeOwnershipClaim" (home_id)
  WHERE state IN ('submitted', 'pending_review', 'pending_challenge_window');

-- ============================================================
-- 2. Prevent concurrent residency claims per user per home
--    One pending residency claim per (home, user) pair.
--
--    STEP 2a: Deduplicate existing data — keep the newest pending claim
--    per (home, user), reject older duplicates.
-- ============================================================
UPDATE "HomeResidencyClaim"
SET status = 'rejected',
    review_note = 'Auto-rejected by migration: duplicate pending claim',
    updated_at = now()
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY home_id, user_id
             ORDER BY created_at DESC
           ) AS rn
    FROM "HomeResidencyClaim"
    WHERE status = 'pending'
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_residency_claim_one_pending_per_user
  ON "HomeResidencyClaim" (home_id, user_id)
  WHERE status = 'pending';

-- ============================================================
-- 3. Add verification_status to HomeOccupancy
--    Tracks where each occupant is in the verification pipeline.
--    Used by applyOccupancyTemplate() to compute permission booleans.
--    Values: verified, provisional, provisional_bootstrap,
--            pending_postcard, pending_doc, pending_approval, unverified
-- ============================================================
ALTER TABLE "HomeOccupancy"
  ADD COLUMN IF NOT EXISTS verification_status varchar(50) DEFAULT 'unverified';

-- Backfill: existing active occupancies are implicitly verified
UPDATE "HomeOccupancy"
  SET verification_status = 'verified'
  WHERE is_active = true
    AND verification_status = 'unverified';

-- Index for efficient verification_status queries
CREATE INDEX IF NOT EXISTS idx_home_occupancy_verification_status
  ON "HomeOccupancy" (home_id, verification_status)
  WHERE is_active = true;

-- ============================================================
-- 4. Add is_open_invite to HomeInvite
--    true = household QR code / link, any authenticated user can accept
--    false (default) = targeted invite, must match invitee identity
-- ============================================================
ALTER TABLE "HomeInvite"
  ADD COLUMN IF NOT EXISTS is_open_invite boolean DEFAULT false;

-- ============================================================
-- 5. Add cold-start columns to HomeResidencyClaim
--    Tracks whether a claim was routed through cold-start logic
--    and which postcard code was auto-generated.
-- ============================================================
ALTER TABLE "HomeResidencyClaim"
  ADD COLUMN IF NOT EXISTS cold_start_mode varchar(30);

ALTER TABLE "HomeResidencyClaim"
  ADD COLUMN IF NOT EXISTS postcard_auto_routed boolean DEFAULT false;

ALTER TABLE "HomeResidencyClaim"
  ADD COLUMN IF NOT EXISTS postcard_code_id uuid REFERENCES "HomePostcardCode"(id);

-- ============================================================
-- 6. Add challenge window columns to HomeOccupancy
--    Used when a postcard-verified user joins a home that already
--    has active members. The 7-day window lets existing members
--    challenge the new occupant.
-- ============================================================
ALTER TABLE "HomeOccupancy"
  ADD COLUMN IF NOT EXISTS challenge_window_started_at timestamptz;

ALTER TABLE "HomeOccupancy"
  ADD COLUMN IF NOT EXISTS challenge_window_ends_at timestamptz;

-- Index for background job that processes expired challenge windows
CREATE INDEX IF NOT EXISTS idx_home_occupancy_challenge_window
  ON "HomeOccupancy" (challenge_window_ends_at)
  WHERE challenge_window_ends_at IS NOT NULL
    AND is_active = true;

-- ============================================================
-- 7. Add vacancy tracking to Home
--    Set when no active authorities remain after move-out.
--    Used by cold-start logic to detect vacant homes.
-- ============================================================
ALTER TABLE "Home"
  ADD COLUMN IF NOT EXISTS vacancy_at timestamptz;
