-- ============================================================================
-- Migration: Neighborhood Profile Cache — stores cached neighborhood profiles
-- from Census ACS, Walk Score, and FEMA APIs for the cold-start Pulse.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."NeighborhoodProfileCache" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tract_id"    text NOT NULL,                 -- Census FIPS tract code (e.g. '53011041100')
  "profile"     jsonb NOT NULL,                -- Full NeighborhoodProfile object
  "fetched_at"  timestamptz NOT NULL DEFAULT now(),
  "expires_at"  timestamptz NOT NULL,          -- 90 days from fetched_at
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_neighborhood_profile_cache_tract UNIQUE ("tract_id")
);

-- Index for cache lookups by tract_id
CREATE INDEX IF NOT EXISTS idx_neighborhood_profile_cache_tract
  ON "public"."NeighborhoodProfileCache" ("tract_id");

-- Index for finding expired entries during cleanup
CREATE INDEX IF NOT EXISTS idx_neighborhood_profile_cache_expires
  ON "public"."NeighborhoodProfileCache" ("expires_at");

-- ============================================================================
-- RLS: service role only (like ExternalFeedCache / PropertyIntelligenceCache)
-- ============================================================================
ALTER TABLE "public"."NeighborhoodProfileCache" ENABLE ROW LEVEL SECURITY;
