-- Migration 065: Add verification_status to HomeOccupancy
--
-- Adds a verification status column to HomeOccupancy so the backend can track
-- where each occupant sits in the onboarding/verification pipeline.
-- This column drives the applyOccupancyTemplate() permission-boolean logic:
--   verified              → full role-based booleans
--   provisional_bootstrap → can_manage_tasks only (cold-start creator)
--   provisional           → all booleans false (challenge window)
--   pending_postcard      → all booleans false (awaiting mail code)
--   pending_doc           → all booleans false (document under review)
--   pending_approval      → all booleans false (awaiting authority approval)
--   unverified            → all booleans false (default / no verification started)

-- 1) Create enum type for occupancy verification status
--    Separate from the existing public.verification_status enum which is used
--    by UserProfessionalProfile and has different semantics.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'home_occupancy_verification_status') THEN
    CREATE TYPE public.home_occupancy_verification_status AS ENUM (
      'verified',
      'provisional',
      'provisional_bootstrap',
      'pending_postcard',
      'pending_doc',
      'pending_approval',
      'unverified'
    );
    ALTER TYPE public.home_occupancy_verification_status OWNER TO postgres;
  END IF;
END
$$;

-- 2) Add the column to HomeOccupancy
--    Default 'unverified' for existing rows (safe — existing verified users
--    will be backfilled or updated via applyOccupancyTemplate on next interaction).
ALTER TABLE public."HomeOccupancy"
  ADD COLUMN IF NOT EXISTS "verification_status"
    public.home_occupancy_verification_status
    NOT NULL
    DEFAULT 'unverified'::public.home_occupancy_verification_status;

-- 3) Backfill existing active occupancies to 'verified'
--    All currently active members were admitted before this system existed,
--    so they are implicitly verified.
UPDATE public."HomeOccupancy"
  SET "verification_status" = 'verified'::public.home_occupancy_verification_status
  WHERE "is_active" = true
    AND "verification_status" = 'unverified'::public.home_occupancy_verification_status;

-- 4) Index for efficient queries on verification_status
CREATE INDEX IF NOT EXISTS idx_home_occupancy_verification_status
  ON public."HomeOccupancy" ("home_id", "verification_status")
  WHERE "is_active" = true;

-- 5) Grant permissions
GRANT USAGE ON TYPE public.home_occupancy_verification_status TO anon, authenticated, service_role;
