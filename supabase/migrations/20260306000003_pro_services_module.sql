-- =============================================================================
-- Migration: Pro Services Module
-- Adds professional service fields (license, insurance, deposit, scope) to Gig table
-- ADDITIVE ONLY: all columns nullable or defaulted, no existing changes
-- =============================================================================

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "requires_license" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "license_type" text,
  ADD COLUMN IF NOT EXISTS "requires_insurance" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deposit_required" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deposit_amount" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "scope_description" text;
