-- Add founding badge and benefit expiry columns to BusinessProfile
ALTER TABLE "public"."BusinessProfile"
  ADD COLUMN IF NOT EXISTS "founding_badge" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "founding_benefit_expires_at" TIMESTAMPTZ;

-- Index for discovery queries that filter on founding_badge
CREATE INDEX IF NOT EXISTS idx_business_profile_founding_badge
  ON "public"."BusinessProfile" ("founding_badge")
  WHERE "founding_badge" = true;

COMMENT ON COLUMN "public"."BusinessProfile"."founding_badge" IS 'True if this business holds a founding slot (first 50)';
COMMENT ON COLUMN "public"."BusinessProfile"."founding_benefit_expires_at" IS 'When founding benefits (fee override, discovery boost) expire';
