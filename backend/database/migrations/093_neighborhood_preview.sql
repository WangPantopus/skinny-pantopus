-- NeighborhoodPreview: per-geohash-6 cell density snapshot
-- Refreshed every 15 minutes by neighborhoodPreviewRefresh job.
CREATE TABLE IF NOT EXISTS "NeighborhoodPreview" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "geohash"                  text NOT NULL,
  "verified_users_count"     integer NOT NULL DEFAULT 0,
  "last_milestone_notified"  integer NOT NULL DEFAULT 0,
  "updated_at"               timestamptz NOT NULL DEFAULT now(),
  "created_at"               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_neighborhood_preview_geohash UNIQUE ("geohash")
);
