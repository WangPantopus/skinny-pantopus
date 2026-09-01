-- Add global pin support: posts that appear at the top of every feed
-- regardless of surface, location, or social graph.

ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS is_global_pin boolean NOT NULL DEFAULT false;

-- Index for fast lookup of global pins (very few rows expected)
CREATE INDEX IF NOT EXISTS idx_post_global_pin
  ON "Post" (is_global_pin)
  WHERE is_global_pin = true;
