-- Add business_author_id to Post table for "Post as Business" identity
-- When set, the post is displayed as authored by the business entity.
ALTER TABLE "public"."Post"
  ADD COLUMN IF NOT EXISTS "business_author_id" uuid REFERENCES "public"."User"("id");

-- Index for fetching posts authored by a specific business
CREATE INDEX IF NOT EXISTS idx_post_business_author_id
  ON "public"."Post" ("business_author_id")
  WHERE "business_author_id" IS NOT NULL;

COMMENT ON COLUMN "public"."Post"."business_author_id" IS 'When set, post is displayed as authored by this business User (account_type=business)';
