-- Add denormalized effective location columns
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS effective_latitude double precision;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS effective_longitude double precision;

-- Backfill from post's own coordinates
UPDATE "Post" SET
  effective_latitude = latitude,
  effective_longitude = longitude
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Backfill from home coordinates for posts without own coordinates
UPDATE "Post" p SET
  effective_latitude = ST_Y(h.location::geometry),
  effective_longitude = ST_X(h.location::geometry)
FROM "Home" h
WHERE p.home_id = h.id
  AND p.latitude IS NULL
  AND h.location IS NOT NULL
  AND p.effective_latitude IS NULL;

-- Create spatial index for Place feed queries
CREATE INDEX IF NOT EXISTS idx_post_effective_location
  ON "Post" (effective_latitude, effective_longitude)
  WHERE effective_latitude IS NOT NULL AND effective_longitude IS NOT NULL AND archived_at IS NULL;

-- Create index for cursor pagination
CREATE INDEX IF NOT EXISTS idx_post_feed_cursor
  ON "Post" (created_at DESC, id DESC)
  WHERE archived_at IS NULL;
