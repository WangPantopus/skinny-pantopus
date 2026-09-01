-- ============================================================================
-- Migration: Dynamic Regions — Move region config from code to database
--
-- Adds geographic columns to seeder_config so regions are fully DB-driven.
-- Creates seeder_sources table to store per-region content source definitions.
-- Removes the hardcoded region CHECK constraint on seeder_content_queue.
-- ============================================================================

-- ============================================================================
-- 1. Add geographic columns to seeder_config
-- ============================================================================

ALTER TABLE "public"."seeder_config"
  ADD COLUMN IF NOT EXISTS "lat"            double precision,
  ADD COLUMN IF NOT EXISTS "lng"            double precision,
  ADD COLUMN IF NOT EXISTS "radius_meters"  integer NOT NULL DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS "timezone"       text NOT NULL DEFAULT 'America/Los_Angeles',
  ADD COLUMN IF NOT EXISTS "display_name"   text;

-- Backfill existing rows
UPDATE "public"."seeder_config"
SET lat = 45.6387, lng = -122.6615, display_name = 'Clark County'
WHERE region = 'clark_county' AND lat IS NULL;

UPDATE "public"."seeder_config"
SET lat = 45.5152, lng = -122.6784, display_name = 'Portland Metro'
WHERE region = 'portland_metro' AND lat IS NULL;

-- Default any remaining rows that weren't explicitly backfilled
UPDATE "public"."seeder_config"
SET lat = 0, lng = 0
WHERE lat IS NULL;

-- Make lat/lng NOT NULL after backfill
ALTER TABLE "public"."seeder_config"
  ALTER COLUMN "lat" SET NOT NULL,
  ALTER COLUMN "lng" SET NOT NULL;

-- ============================================================================
-- 2. seeder_sources — per-region content source definitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."seeder_sources" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_id"     text NOT NULL,          -- e.g. 'rss:seattle_times', 'google_news:seattle_wa'
  "source_type"   text NOT NULL            -- 'rss', 'seasonal', 'google_news'
                    CHECK ("source_type" IN ('rss', 'seasonal', 'google_news')),
  "url"           text,                    -- feed URL (NULL for seasonal)
  "category"      text NOT NULL
                    CHECK ("category" IN ('local_news', 'event', 'weather', 'seasonal',
                                          'community_resource', 'safety')),
  "display_name"  text NOT NULL,
  "region"        text NOT NULL REFERENCES "public"."seeder_config"("region") ON DELETE CASCADE,
  "active"        boolean NOT NULL DEFAULT true,
  "created_at"    timestamptz NOT NULL DEFAULT now(),

  -- A source_id is unique within a region
  UNIQUE ("source_id", "region")
);

ALTER TABLE "public"."seeder_sources" OWNER TO "postgres";

CREATE INDEX idx_seeder_sources_region ON "public"."seeder_sources" ("region");
CREATE INDEX idx_seeder_sources_active ON "public"."seeder_sources" ("region", "active");

-- RLS: service_role only
ALTER TABLE "public"."seeder_sources" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seeder_sources_service"
  ON "public"."seeder_sources"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE "public"."seeder_sources" TO "service_role";

-- ============================================================================
-- 3. Remove hardcoded region CHECK on seeder_content_queue
--
-- The old constraint only allowed 'clark_county', 'portland_metro', 'both'.
-- Now regions are dynamic, so we drop the constraint entirely.
-- ============================================================================

ALTER TABLE "public"."seeder_content_queue"
  DROP CONSTRAINT IF EXISTS "seeder_content_queue_region_check";

-- ============================================================================
-- 4. Seed existing sources into seeder_sources from the old hardcoded config
--    Only inserts if the region already exists in seeder_config (i.e., the
--    setup_curator_account.py script has been run). Safe to skip — the setup
--    script creates all sources when adding a region.
-- ============================================================================

INSERT INTO "public"."seeder_sources" (source_id, source_type, url, category, display_name, region)
SELECT * FROM (VALUES
  ('rss:columbian', 'rss', 'https://www.columbian.com/feed/', 'local_news', 'The Columbian', 'clark_county'),
  ('rss:clark_county_gov', 'rss', 'https://clark.wa.gov/feed', 'community_resource', 'Clark County', 'clark_county'),
  ('rss:city_vancouver', 'rss', 'https://www.cityofvancouver.us/feed/', 'community_resource', 'City of Vancouver WA', 'clark_county'),
  ('rss:camas_washougal', 'rss', 'https://www.camaspostrecord.com/feed/', 'local_news', 'Camas-Washougal Post-Record', 'clark_county'),
  ('seasonal:pnw', 'seasonal', NULL::text, 'seasonal', 'Pantopus Seasonal', 'clark_county')
) AS v(source_id, source_type, url, category, display_name, region)
WHERE EXISTS (SELECT 1 FROM "public"."seeder_config" WHERE region = 'clark_county')
ON CONFLICT (source_id, region) DO NOTHING;

INSERT INTO "public"."seeder_sources" (source_id, source_type, url, category, display_name, region)
SELECT * FROM (VALUES
  ('rss:oregonlive_local', 'rss', 'https://www.oregonlive.com/arc/outboundfeeds/rss/category/portland/?outputType=xml', 'local_news', 'OregonLive', 'portland_metro'),
  ('rss:portland_tribune', 'rss', 'https://www.portlandtribune.com/feed', 'local_news', 'Portland Tribune', 'portland_metro'),
  ('rss:city_portland', 'rss', 'https://www.portland.gov/news/feed', 'community_resource', 'City of Portland', 'portland_metro'),
  ('rss:portland_parks', 'rss', 'https://www.portland.gov/parks/news/feed', 'event', 'Portland Parks & Rec', 'portland_metro'),
  ('seasonal:pnw', 'seasonal', NULL::text, 'seasonal', 'Pantopus Seasonal', 'portland_metro')
) AS v(source_id, source_type, url, category, display_name, region)
WHERE EXISTS (SELECT 1 FROM "public"."seeder_config" WHERE region = 'portland_metro')
ON CONFLICT (source_id, region) DO NOTHING;

-- ============================================================================
-- ROLLBACK (run manually if you need to revert)
-- ============================================================================
-- DROP TABLE IF EXISTS "public"."seeder_sources";
-- ALTER TABLE "public"."seeder_config" DROP COLUMN IF EXISTS "lat";
-- ALTER TABLE "public"."seeder_config" DROP COLUMN IF EXISTS "lng";
-- ALTER TABLE "public"."seeder_config" DROP COLUMN IF EXISTS "radius_meters";
-- ALTER TABLE "public"."seeder_config" DROP COLUMN IF EXISTS "timezone";
-- ALTER TABLE "public"."seeder_config" DROP COLUMN IF EXISTS "display_name";
-- ALTER TABLE "public"."seeder_content_queue"
--   ADD CONSTRAINT "seeder_content_queue_region_check"
--   CHECK ("region" IN ('clark_county', 'portland_metro', 'both'));
