-- Add per-business fee override to BusinessProfile
-- NULL means use the platform default (15%).
-- Allows nonprofits, religious orgs, and founding businesses to have reduced or zero platform fees.

ALTER TABLE "public"."BusinessProfile"
  ADD COLUMN IF NOT EXISTS "fee_override_pct" NUMERIC(5,2) DEFAULT NULL;

ALTER TABLE "public"."BusinessProfile"
  ADD CONSTRAINT "business_profile_fee_override_range"
  CHECK ("fee_override_pct" IS NULL OR ("fee_override_pct" >= 0 AND "fee_override_pct" <= 100));
