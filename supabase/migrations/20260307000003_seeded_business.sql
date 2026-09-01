-- ============================================================================
-- Migration: Seeded Business Directory — lightweight directory of local service
-- businesses to bridge the cold-start gap before organic businesses join.
-- ============================================================================

-- Ensure PostGIS extension is available (may already exist)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS "public"."SeededBusiness" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"        text NOT NULL,
  "category"    text NOT NULL,           -- Pantopus gig category
  "subcategory" text,
  "address"     text,
  "city"        text NOT NULL,
  "state"       text NOT NULL,
  "zipcode"     text NOT NULL,
  "latitude"    double precision NOT NULL,
  "longitude"   double precision NOT NULL,
  "phone"       text,
  "website"     text,
  "source"      text NOT NULL DEFAULT 'manual_seed',
  "source_id"   text,                    -- External ID for deduplication
  "is_active"   boolean NOT NULL DEFAULT true,
  "claimed_by"  uuid REFERENCES "public"."User"("id") ON DELETE SET NULL,
  "claimed_at"  timestamptz,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_seeded_business_source UNIQUE ("source", "source_id")
);

-- Spatial index for proximity queries (PostGIS point from lat/lng)
CREATE INDEX IF NOT EXISTS idx_seeded_business_geo
  ON "public"."SeededBusiness"
  USING GIST (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326));

-- Index for category + city lookups
CREATE INDEX IF NOT EXISTS idx_seeded_business_category_city
  ON "public"."SeededBusiness" ("category", "city");

-- Index for active businesses
CREATE INDEX IF NOT EXISTS idx_seeded_business_active
  ON "public"."SeededBusiness" ("is_active") WHERE "is_active" = true;

-- ============================================================================
-- RLS: public read, service role write
-- ============================================================================
ALTER TABLE "public"."SeededBusiness" ENABLE ROW LEVEL SECURITY;

-- Anyone can read active seeded businesses
CREATE POLICY "seeded_business_public_read"
  ON "public"."SeededBusiness"
  FOR SELECT
  USING ("is_active" = true);

-- ============================================================================
-- RPC: Count nearby businesses by category within a radius
-- ============================================================================
CREATE OR REPLACE FUNCTION public.count_nearby_seeded_businesses(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters double precision DEFAULT 8047  -- ~5 miles
)
RETURNS TABLE (category text, cnt bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    sb."category",
    COUNT(*) AS cnt
  FROM "public"."SeededBusiness" sb
  WHERE sb."is_active" = true
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(sb."longitude", sb."latitude"), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  GROUP BY sb."category"
  ORDER BY cnt DESC;
$$;
