-- M2: Post matched business IDs
-- Stores matched business IDs (truth) and a JSONB render cache for intent-matching
ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "matched_business_ids" UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "matched_businesses_cache" JSONB DEFAULT '[]';
