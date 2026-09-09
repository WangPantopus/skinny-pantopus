-- =============================================================================
-- Migration: ETA & Status Tracking
-- Adds helper location tracking and shareable status link fields to Gig table
-- ADDITIVE ONLY: all columns nullable, no existing changes
-- =============================================================================

-- 1. Add ETA and helper location columns
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "helper_eta_minutes" integer,
  ADD COLUMN IF NOT EXISTS "helper_last_location" "public"."geography"(Point, 4326),
  ADD COLUMN IF NOT EXISTS "helper_location_updated_at" timestamptz;

-- 2. Add status sharing columns
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "status_share_token" text,
  ADD COLUMN IF NOT EXISTS "status_share_expires_at" timestamptz;

-- 3. Partial index on share token (only non-null tokens need lookup)
CREATE INDEX IF NOT EXISTS "idx_gig_status_share_token"
  ON "public"."Gig" ("status_share_token")
  WHERE "status_share_token" IS NOT NULL;
