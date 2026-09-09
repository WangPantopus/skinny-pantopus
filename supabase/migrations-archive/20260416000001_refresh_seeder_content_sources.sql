-- ============================================================================
-- Migration: Refresh seeder source mix after Reddit RSS blocking
--
-- Reddit community and sports RSS feeds are returning 403s from Lambda.
-- Replace them with more stable Google News queries, tune sports queries away
-- from betting/fantasy spam, and move OPB to its current official RSS feed.
-- ============================================================================

UPDATE "public"."seeder_sources"
SET "active" = false
WHERE "source_id" IN (
  'rss:reddit_vancouverwa',
  'rss:reddit_portland',
  'rss:reddit_ripcity',
  'rss:reddit_timbers'
);

UPDATE "public"."seeder_sources"
SET "url" = 'https://www.opb.org/arc/outboundfeeds/rss/?outputType=xml'
WHERE "source_id" = 'rss:opb_news';

UPDATE "public"."seeder_sources"
SET "url" = 'Portland Trail Blazers -odds -betting -fantasy -player props'
WHERE "source_id" = 'google_news:trail_blazers';

UPDATE "public"."seeder_sources"
SET "url" = 'Portland Timbers -odds -betting -fantasy'
WHERE "source_id" = 'google_news:timbers';

UPDATE "public"."seeder_sources"
SET "url" = 'Portland Thorns -odds -betting -fantasy'
WHERE "source_id" = 'google_news:thorns';

UPDATE "public"."seeder_sources"
SET "url" = 'Seattle Seahawks -odds -betting -fantasy'
WHERE "source_id" = 'google_news:seahawks';

INSERT INTO "public"."seeder_sources"
  ("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
SELECT * FROM (VALUES
  ('google_news:trimet', 'google_news', 'TriMet Portland transit -crime -shooting -election', 'community_resource', 'TriMet Updates', 'clark_county', true, 3),
  ('google_news:pdx_airport', 'google_news', 'PDX airport Portland updates', 'community_resource', 'PDX Airport Updates', 'clark_county', true, 3),
  ('google_news:portland_fire', 'google_news', 'Portland Fire WNBA -wildfire -fire department -odds -betting -fantasy', 'sports', 'Portland Fire News', 'clark_county', true, 3),
  ('google_news:winterhawks', 'google_news', 'Portland Winterhawks -odds -betting -fantasy', 'sports', 'Winterhawks News', 'clark_county', true, 3)
) AS v("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
WHERE EXISTS (SELECT 1 FROM "public"."seeder_config" WHERE "region" = 'clark_county')
ON CONFLICT ("source_id", "region") DO UPDATE
SET
  "source_type" = EXCLUDED."source_type",
  "url" = EXCLUDED."url",
  "category" = EXCLUDED."category",
  "display_name" = EXCLUDED."display_name",
  "active" = EXCLUDED."active",
  "priority" = EXCLUDED."priority";

INSERT INTO "public"."seeder_sources"
  ("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
SELECT * FROM (VALUES
  ('google_news:trimet', 'google_news', 'TriMet Portland transit -crime -shooting -election', 'community_resource', 'TriMet Updates', 'portland_metro', true, 3),
  ('google_news:pdx_airport', 'google_news', 'PDX airport Portland updates', 'community_resource', 'PDX Airport Updates', 'portland_metro', true, 3),
  ('google_news:portland_fire', 'google_news', 'Portland Fire WNBA -wildfire -fire department -odds -betting -fantasy', 'sports', 'Portland Fire News', 'portland_metro', true, 3),
  ('google_news:winterhawks', 'google_news', 'Portland Winterhawks -odds -betting -fantasy', 'sports', 'Winterhawks News', 'portland_metro', true, 3)
) AS v("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
WHERE EXISTS (SELECT 1 FROM "public"."seeder_config" WHERE "region" = 'portland_metro')
ON CONFLICT ("source_id", "region") DO UPDATE
SET
  "source_type" = EXCLUDED."source_type",
  "url" = EXCLUDED."url",
  "category" = EXCLUDED."category",
  "display_name" = EXCLUDED."display_name",
  "active" = EXCLUDED."active",
  "priority" = EXCLUDED."priority";
