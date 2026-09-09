-- =============================================================================
-- Migration: Engagement Modes for Gigs MVP
-- Adds engagement_mode enum and column to Gig table
-- ADDITIVE ONLY: no existing columns or constraints are modified
-- =============================================================================

-- 1. Create the engagement_mode enum type
DO $$ BEGIN
  CREATE TYPE "public"."engagement_mode" AS ENUM (
    'instant_accept',
    'curated_offers',
    'quotes'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add engagement_mode column to Gig table (default ensures existing gigs get curated_offers)
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "engagement_mode" "public"."engagement_mode"
    DEFAULT 'curated_offers'::"public"."engagement_mode";

-- 3. Index on engagement_mode for filtered queries
CREATE INDEX IF NOT EXISTS "idx_gig_engagement_mode"
  ON "public"."Gig" ("engagement_mode");
