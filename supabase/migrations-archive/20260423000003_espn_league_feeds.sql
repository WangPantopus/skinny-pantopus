-- Add ESPN league-level RSS feeds as sports sources.
--
-- Direct RSS from official team/league sites (NBA.com, MLB.com, NHL.com,
-- MLS.com, NFL.com) is inconsistent, so ESPN remains the reliable RSS layer.
-- One feed per league covers every team in that league — a Trail Blazers or
-- Seahawks story will flow through naturally alongside league-wide news.
--
-- Verified reachable as of 2026-04-22.

INSERT INTO "public"."seeder_sources"
  ("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
SELECT * FROM (VALUES
  ('rss:espn_nba',    'rss', 'https://www.espn.com/espn/rss/nba/news',    'sports', 'ESPN NBA',     'clark_county', true, 3),
  ('rss:espn_nfl',    'rss', 'https://www.espn.com/espn/rss/nfl/news',    'sports', 'ESPN NFL',     'clark_county', true, 3),
  ('rss:espn_mlb',    'rss', 'https://www.espn.com/espn/rss/mlb/news',    'sports', 'ESPN MLB',     'clark_county', true, 3),
  ('rss:espn_nhl',    'rss', 'https://www.espn.com/espn/rss/nhl/news',    'sports', 'ESPN NHL',     'clark_county', true, 3),
  ('rss:espn_soccer', 'rss', 'https://www.espn.com/espn/rss/soccer/news', 'sports', 'ESPN Soccer',  'clark_county', true, 3)
) AS v("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
WHERE EXISTS (SELECT 1 FROM "public"."seeder_config" WHERE "region" = 'clark_county')
ON CONFLICT ("source_id", "region") DO UPDATE
SET
  "source_type"  = EXCLUDED."source_type",
  "url"          = EXCLUDED."url",
  "category"     = EXCLUDED."category",
  "display_name" = EXCLUDED."display_name",
  "active"       = EXCLUDED."active",
  "priority"     = EXCLUDED."priority";

INSERT INTO "public"."seeder_sources"
  ("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
SELECT * FROM (VALUES
  ('rss:espn_nba',    'rss', 'https://www.espn.com/espn/rss/nba/news',    'sports', 'ESPN NBA',     'portland_metro', true, 3),
  ('rss:espn_nfl',    'rss', 'https://www.espn.com/espn/rss/nfl/news',    'sports', 'ESPN NFL',     'portland_metro', true, 3),
  ('rss:espn_mlb',    'rss', 'https://www.espn.com/espn/rss/mlb/news',    'sports', 'ESPN MLB',     'portland_metro', true, 3),
  ('rss:espn_nhl',    'rss', 'https://www.espn.com/espn/rss/nhl/news',    'sports', 'ESPN NHL',     'portland_metro', true, 3),
  ('rss:espn_soccer', 'rss', 'https://www.espn.com/espn/rss/soccer/news', 'sports', 'ESPN Soccer',  'portland_metro', true, 3)
) AS v("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
WHERE EXISTS (SELECT 1 FROM "public"."seeder_config" WHERE "region" = 'portland_metro')
ON CONFLICT ("source_id", "region") DO UPDATE
SET
  "source_type"  = EXCLUDED."source_type",
  "url"          = EXCLUDED."url",
  "category"     = EXCLUDED."category",
  "display_name" = EXCLUDED."display_name",
  "active"       = EXCLUDED."active",
  "priority"     = EXCLUDED."priority";
