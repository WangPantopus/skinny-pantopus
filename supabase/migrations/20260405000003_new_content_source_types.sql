-- Migration: Add new content source types and categories for expanded content coverage
-- New source types: nws_alerts, air_quality, usgs_earthquakes, on_this_day
-- New categories: air_quality, earthquake, history, sports

-- Step 0: Ensure seeder_sources table exists (safe to re-run if migration 2 already created it)
CREATE TABLE IF NOT EXISTS "public"."seeder_sources" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_id"     text NOT NULL,
  "source_type"   text NOT NULL,
  "url"           text,
  "category"      text NOT NULL,
  "display_name"  text NOT NULL,
  "region"        text NOT NULL REFERENCES "public"."seeder_config"("region") ON DELETE CASCADE,
  "active"        boolean NOT NULL DEFAULT true,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("source_id", "region")
);

ALTER TABLE "public"."seeder_sources" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS idx_seeder_sources_region ON "public"."seeder_sources" ("region");
CREATE INDEX IF NOT EXISTS idx_seeder_sources_active ON "public"."seeder_sources" ("region", "active");

ALTER TABLE "public"."seeder_sources" ENABLE ROW LEVEL SECURITY;

-- Safe: CREATE POLICY will error if it already exists, so use DO block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'seeder_sources' AND policyname = 'seeder_sources_service'
  ) THEN
    CREATE POLICY "seeder_sources_service"
      ON "public"."seeder_sources"
      FOR ALL TO "service_role"
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE "public"."seeder_sources" TO "service_role";

-- Step 1: Expand CHECK constraints to allow new source types and categories
-- (Must happen before inserting rows with new values)

ALTER TABLE "public"."seeder_sources"
  DROP CONSTRAINT IF EXISTS "seeder_sources_source_type_check";

ALTER TABLE "public"."seeder_sources"
  ADD CONSTRAINT "seeder_sources_source_type_check"
  CHECK ("source_type" IN (
    'rss', 'seasonal', 'google_news',
    'nws_alerts', 'air_quality', 'usgs_earthquakes', 'on_this_day'
  ));

ALTER TABLE "public"."seeder_sources"
  DROP CONSTRAINT IF EXISTS "seeder_sources_category_check";

ALTER TABLE "public"."seeder_sources"
  ADD CONSTRAINT "seeder_sources_category_check"
  CHECK ("category" IN (
    'local_news', 'event', 'weather', 'seasonal',
    'community_resource', 'safety',
    'air_quality', 'earthquake', 'history', 'sports'
  ));

ALTER TABLE "public"."seeder_content_queue"
  DROP CONSTRAINT IF EXISTS "seeder_content_queue_category_check";

ALTER TABLE "public"."seeder_content_queue"
  ADD CONSTRAINT "seeder_content_queue_category_check"
  CHECK ("category" IN (
    'local_news', 'event', 'weather', 'seasonal',
    'community_resource', 'safety',
    'air_quality', 'earthquake', 'history', 'sports'
  ));

-- Step 2: Add provisioned_by column to track how regions were created
ALTER TABLE "public"."seeder_config"
  ADD COLUMN IF NOT EXISTS "provisioned_by" text NOT NULL DEFAULT 'manual';

-- Step 3: Add new sources for existing regions
--         Only inserts if the region exists in seeder_config (safe before setup script runs)

INSERT INTO seeder_sources (source_id, source_type, url, category, display_name, region, active)
SELECT * FROM (VALUES
  ('nws_alerts:clark_county', 'nws_alerts', '45.6387,-122.6615', 'weather', 'NWS Weather Alerts', 'clark_county', true),
  ('air_quality:clark_county', 'air_quality', '45.6387,-122.6615', 'air_quality', 'Air Quality (Open-Meteo)', 'clark_county', true),
  ('usgs_earthquakes:clark_county', 'usgs_earthquakes', '45.6387,-122.6615', 'earthquake', 'USGS Earthquakes', 'clark_county', true),
  ('on_this_day:clark_county', 'on_this_day', 'Oregon,Washington,Portland,Vancouver', 'history', 'On This Day (Wikipedia)', 'clark_county', true),
  ('google_news:clark_county', 'google_news', 'Clark County WA local news', 'local_news', 'Google News (Clark County)', 'clark_county', true),
  ('rss:reddit_vancouverwa', 'rss', 'https://www.reddit.com/r/vancouverwa/top/.rss?sort=top&t=day', 'community_resource', 'r/vancouverwa', 'clark_county', true)
) AS v(source_id, source_type, url, category, display_name, region, active)
WHERE EXISTS (SELECT 1 FROM seeder_config WHERE region = 'clark_county')
ON CONFLICT (source_id, region) DO UPDATE
SET source_type = EXCLUDED.source_type, url = EXCLUDED.url,
    category = EXCLUDED.category, display_name = EXCLUDED.display_name, active = EXCLUDED.active;

INSERT INTO seeder_sources (source_id, source_type, url, category, display_name, region, active)
SELECT * FROM (VALUES
  ('nws_alerts:portland_metro', 'nws_alerts', '45.5152,-122.6784', 'weather', 'NWS Weather Alerts', 'portland_metro', true),
  ('air_quality:portland_metro', 'air_quality', '45.5152,-122.6784', 'air_quality', 'Air Quality (Open-Meteo)', 'portland_metro', true),
  ('usgs_earthquakes:portland_metro', 'usgs_earthquakes', '45.5152,-122.6784', 'earthquake', 'USGS Earthquakes', 'portland_metro', true),
  ('on_this_day:portland_metro', 'on_this_day', 'Oregon,Portland', 'history', 'On This Day (Wikipedia)', 'portland_metro', true),
  ('rss:kgw_local', 'rss', 'https://www.kgw.com/feeds/syndication/rss/news/local', 'local_news', 'KGW News', 'portland_metro', true),
  ('rss:opb_news', 'rss', 'https://www.opb.org/feeds/all/', 'local_news', 'OPB', 'portland_metro', true),
  ('rss:reddit_portland', 'rss', 'https://www.reddit.com/r/Portland/top/.rss?sort=top&t=day', 'community_resource', 'r/Portland', 'portland_metro', true),
  ('rss:oregon_metro', 'rss', 'https://www.oregonmetro.gov/metro-rss-feeds', 'community_resource', 'Oregon Metro', 'portland_metro', true)
) AS v(source_id, source_type, url, category, display_name, region, active)
WHERE EXISTS (SELECT 1 FROM seeder_config WHERE region = 'portland_metro')
ON CONFLICT (source_id, region) DO UPDATE
SET source_type = EXCLUDED.source_type, url = EXCLUDED.url,
    category = EXCLUDED.category, display_name = EXCLUDED.display_name, active = EXCLUDED.active;

-- Deactivate broken feeds (only if they exist)
UPDATE seeder_sources SET active = false
WHERE source_id IN ('rss:clark_county_gov', 'rss:city_vancouver', 'rss:portland_tribune')
  AND active = true;
