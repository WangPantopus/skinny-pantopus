-- Migration 090: Home Graph Remediation P0
--
-- Make owner_id nullable, add ownership_state column.
-- This unblocks non-owner home creation (renters, household members,
-- property managers) which currently fails with:
--   "null value in column owner_id of relation Home violates not-null constraint"
--
-- See: Pantopus-Home-Graph-Remediation-v2.md

BEGIN;

-- 1) Create enum type for home ownership state
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'home_ownership_state') THEN
    CREATE TYPE public.home_ownership_state AS ENUM (
      'unknown',
      'unclaimed',
      'claim_pending',
      'owner_verified',
      'manager_controlled_no_owner',
      'disputed'
    );
    ALTER TYPE public.home_ownership_state OWNER TO postgres;
  END IF;
END
$$;

-- 2) Add ownership_state column to Home
--    Default 'unknown' for existing rows — backfill below resolves real states.
ALTER TABLE public."Home"
  ADD COLUMN IF NOT EXISTS "ownership_state"
    public.home_ownership_state
    NOT NULL
    DEFAULT 'unknown'::public.home_ownership_state;

-- 3) Make owner_id nullable
--    The FK constraint (Home_owner_id_fkey) remains intact — it already allows
--    NULL values when the column is nullable. Only the NOT NULL is dropped.
ALTER TABLE public."Home"
  ALTER COLUMN "owner_id" DROP NOT NULL;

-- 4) Backfill ownership_state from existing data
--    Each UPDATE targets only rows still at 'unknown' so earlier updates
--    are not overwritten. Order matters: verified > claim_pending > unclaimed.

-- 4a. Homes with a verified HomeOwner → 'owner_verified'
UPDATE public."Home" h
SET "ownership_state" = 'owner_verified'::public.home_ownership_state
WHERE h."ownership_state" = 'unknown'::public.home_ownership_state
  AND EXISTS (
    SELECT 1 FROM public."HomeOwner" ho
    WHERE ho."home_id" = h."id"
      AND ho."owner_status" = 'verified'
  );

-- 4b. Homes with a pending ownership claim → 'claim_pending'
UPDATE public."Home" h
SET "ownership_state" = 'claim_pending'::public.home_ownership_state
WHERE h."ownership_state" = 'unknown'::public.home_ownership_state
  AND EXISTS (
    SELECT 1 FROM public."HomeOwnershipClaim" hoc
    WHERE hoc."home_id" = h."id"
      AND hoc."state" IN ('submitted', 'pending_review', 'pending_challenge_window')
  );

-- 4c. Homes with owner_id set but still at 'unknown' (no verified owner,
--     no pending claim) → 'claim_pending'
UPDATE public."Home" h
SET "ownership_state" = 'claim_pending'::public.home_ownership_state
WHERE h."ownership_state" = 'unknown'::public.home_ownership_state
  AND h."owner_id" IS NOT NULL;

-- 4d. Homes with owner_id NULL + active occupants → 'unclaimed'
UPDATE public."Home" h
SET "ownership_state" = 'unclaimed'::public.home_ownership_state
WHERE h."ownership_state" = 'unknown'::public.home_ownership_state
  AND h."owner_id" IS NULL
  AND EXISTS (
    SELECT 1 FROM public."HomeOccupancy" ho
    WHERE ho."home_id" = h."id" AND ho."is_active" = true
  );

-- 4e. Remaining 'unknown' records are truly orphaned — leave as 'unknown'
--     for manual investigation.

-- 5) Index for ownership_state queries (skip verified/unknown — they're the bulk)
CREATE INDEX IF NOT EXISTS idx_home_ownership_state
  ON public."Home" ("ownership_state")
  WHERE "ownership_state" NOT IN ('owner_verified', 'unknown');

-- 6) Grant enum permissions
GRANT USAGE ON TYPE public.home_ownership_state TO anon, authenticated, service_role;

COMMIT;

-- ============================================================
-- UNIQUE INDEX — RUN SEPARATELY (cannot run inside a transaction)
-- ============================================================
-- First check for existing duplicates:
-- SELECT address_hash, count(*) FROM "Home" WHERE home_status='active' AND address_hash IS NOT NULL GROUP BY address_hash HAVING count(*)>1;
-- If no duplicates, run:
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "idx_home_address_hash_active_unique" ON public."Home" ("address_hash") WHERE "home_status" = 'active' AND "address_hash" IS NOT NULL;
