-- Additional PNW sports sources — Mariners, Kraken, Sounders, Ducks, Beavers,
-- and the Clark County instance of KGW Sports RSS.
--
-- The 20260405000004_sports_content_sources.sql migration's comment claimed
-- Mariners/Kraken/Sounders were seeded but the INSERT block never actually
-- created them. This migration closes that gap and adds college coverage.

INSERT INTO "public"."seeder_sources"
  ("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
SELECT * FROM (VALUES
  -- Seattle teams the original migration promised but never inserted
  ('google_news:mariners', 'google_news',
   'Seattle Mariners -odds -betting -fantasy -DraftKings -FanDuel -picks',
   'sports', 'Mariners News', 'clark_county', true, 3),
  ('google_news:kraken', 'google_news',
   'Seattle Kraken NHL -odds -betting -fantasy -DraftKings -FanDuel',
   'sports', 'Kraken News', 'clark_county', true, 3),
  ('google_news:sounders', 'google_news',
   'Seattle Sounders -odds -betting -fantasy -DraftKings -FanDuel',
   'sports', 'Sounders News', 'clark_county', true, 3),
  -- PNW college
  ('google_news:oregon_ducks', 'google_news',
   'Oregon Ducks football basketball -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'Oregon Ducks News', 'clark_county', true, 3),
  ('google_news:oregon_state_beavers', 'google_news',
   'Oregon State Beavers football basketball -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'Oregon State Beavers News', 'clark_county', true, 3),
  -- Clark County users watch Portland TV sports — KGW Sports belongs here too.
  ('rss:kgw_sports', 'rss',
   'https://www.kgw.com/feeds/syndication/rss/sports',
   'sports', 'KGW Sports', 'clark_county', true, 3)
) AS v("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
WHERE EXISTS (SELECT 1 FROM "public"."seeder_config" WHERE "region" = 'clark_county')
ON CONFLICT ("source_id", "region") DO UPDATE
SET
  "source_type" = EXCLUDED."source_type",
  "url"         = EXCLUDED."url",
  "category"    = EXCLUDED."category",
  "display_name" = EXCLUDED."display_name",
  "active"      = EXCLUDED."active",
  "priority"    = EXCLUDED."priority";

INSERT INTO "public"."seeder_sources"
  ("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
SELECT * FROM (VALUES
  ('google_news:mariners', 'google_news',
   'Seattle Mariners -odds -betting -fantasy -DraftKings -FanDuel -picks',
   'sports', 'Mariners News', 'portland_metro', true, 3),
  ('google_news:kraken', 'google_news',
   'Seattle Kraken NHL -odds -betting -fantasy -DraftKings -FanDuel',
   'sports', 'Kraken News', 'portland_metro', true, 3),
  ('google_news:sounders', 'google_news',
   'Seattle Sounders -odds -betting -fantasy -DraftKings -FanDuel',
   'sports', 'Sounders News', 'portland_metro', true, 3),
  ('google_news:oregon_ducks', 'google_news',
   'Oregon Ducks football basketball -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'Oregon Ducks News', 'portland_metro', true, 3),
  ('google_news:oregon_state_beavers', 'google_news',
   'Oregon State Beavers football basketball -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'Oregon State Beavers News', 'portland_metro', true, 3)
) AS v("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
WHERE EXISTS (SELECT 1 FROM "public"."seeder_config" WHERE "region" = 'portland_metro')
ON CONFLICT ("source_id", "region") DO UPDATE
SET
  "source_type" = EXCLUDED."source_type",
  "url"         = EXCLUDED."url",
  "category"    = EXCLUDED."category",
  "display_name" = EXCLUDED."display_name",
  "active"      = EXCLUDED."active",
  "priority"    = EXCLUDED."priority";
