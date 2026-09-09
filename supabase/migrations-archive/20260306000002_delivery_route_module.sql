-- =============================================================================
-- Migration: Delivery/Errands Route Module
-- Adds pickup/dropoff location fields and delivery proof columns to Gig table
-- ADDITIVE ONLY: all columns nullable or defaulted, no existing changes
-- =============================================================================

-- 1. Add pickup location columns
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "pickup_address" text,
  ADD COLUMN IF NOT EXISTS "pickup_location" "public"."geography"(Point, 4326),
  ADD COLUMN IF NOT EXISTS "pickup_notes" text;

-- 2. Add dropoff location columns
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "dropoff_address" text,
  ADD COLUMN IF NOT EXISTS "dropoff_location" "public"."geography"(Point, 4326),
  ADD COLUMN IF NOT EXISTS "dropoff_notes" text;

-- 3. Add delivery proof columns
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "delivery_proof_required" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "delivery_proof_photos" text[],
  ADD COLUMN IF NOT EXISTS "delivery_proof_qr" text;

-- 4. Spatial indexes on pickup and dropoff locations
CREATE INDEX IF NOT EXISTS "idx_gig_pickup_location"
  ON "public"."Gig" USING gist ("pickup_location");

CREATE INDEX IF NOT EXISTS "idx_gig_dropoff_location"
  ON "public"."Gig" USING gist ("dropoff_location");
