-- ============================================================================
-- Migration: Property Intelligence Cache — stores cached property profiles
-- from ATTOM API for the cold-start property intelligence feature.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."PropertyIntelligenceCache" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "home_id"     uuid NOT NULL REFERENCES "public"."Home"("id") ON DELETE CASCADE,
  "profile"     jsonb NOT NULL,           -- Full PropertyProfile object
  "fetched_at"  timestamptz NOT NULL DEFAULT now(),
  "expires_at"  timestamptz NOT NULL,     -- 30 days from fetched_at
  "source"      text NOT NULL DEFAULT 'attom',  -- 'attom' or 'fallback'
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_property_intelligence_cache_home UNIQUE ("home_id")
);

-- Index for cache lookups by home_id
CREATE INDEX IF NOT EXISTS idx_property_intelligence_cache_home
  ON "public"."PropertyIntelligenceCache" ("home_id");

-- Index for finding expired entries during cleanup
CREATE INDEX IF NOT EXISTS idx_property_intelligence_cache_expires
  ON "public"."PropertyIntelligenceCache" ("expires_at");

-- ============================================================================
-- RLS: service role only (like ExternalFeedCache)
-- ============================================================================
ALTER TABLE "public"."PropertyIntelligenceCache" ENABLE ROW LEVEL SECURITY;
