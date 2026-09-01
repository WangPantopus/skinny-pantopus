-- M4: PostComment mentioned_business_ids
-- Stores business user IDs @mentioned in comments for Nearby Providers pinning
ALTER TABLE "PostComment"
  ADD COLUMN IF NOT EXISTS "mentioned_business_ids" UUID[] DEFAULT '{}';
