-- Add compound indexes for frequently queried patterns
-- Post: neighborhood/home feed filtered by audience
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_post_home_audience_created"
  ON "Post" USING "btree" ("home_id", "audience", "created_at" DESC)
  WHERE "is_archived" = false;

-- Listing: user's listings filtered by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_listing_user_status_created"
  ON "Listing" USING "btree" ("user_id", "status", "created_at" DESC);
