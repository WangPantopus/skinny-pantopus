-- Add official league and major publisher sports sources.
--
-- Direct RSS from many official league sites is inconsistent, so these use
-- Google News queries scoped to source-owned domains. That gives the seeder
-- NBA.com, MLB.com, NFL.com, Bleacher Report, FOX Sports, Olympics.com, and
-- FIFA.com coverage without adding custom scrapers.

INSERT INTO "public"."seeder_sources"
  ("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
SELECT * FROM (VALUES
  ('google_news:nba_official', 'google_news',
   'site:nba.com "Portland Trail Blazers" OR "NBA Playoffs" OR "NBA Finals" -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'NBA.com', 'clark_county', true, 3),
  ('google_news:mlb_official', 'google_news',
   'site:mlb.com "Seattle Mariners" OR "World Series" OR MLB playoffs -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'MLB.com', 'clark_county', true, 3),
  ('google_news:nfl_official', 'google_news',
   'site:nfl.com "Seattle Seahawks" OR "Super Bowl" OR "NFL Playoffs" -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'NFL.com', 'clark_county', true, 3),
  ('google_news:bleacher_report_sports', 'google_news',
   'site:bleacherreport.com Portland Seattle sports "Trail Blazers" Seahawks Mariners Timbers Thorns -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'Bleacher Report Sports', 'clark_county', true, 3),
  ('google_news:fox_sports', 'google_news',
   'site:foxsports.com Portland Seattle sports NBA NFL MLB MLS NWSL -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'FOX Sports', 'clark_county', true, 3),
  ('google_news:olympics_official', 'google_news',
   'site:olympics.com Olympics "Team USA" Portland Seattle -odds -betting -fantasy',
   'sports', 'Olympics.com', 'clark_county', true, 3),
  ('google_news:fifa_official', 'google_news',
   'site:fifa.com "FIFA World Cup 2026" Seattle Portland Vancouver -odds -betting -fantasy',
   'sports', 'FIFA.com', 'clark_county', true, 3)
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
  ('google_news:nba_official', 'google_news',
   'site:nba.com "Portland Trail Blazers" OR "NBA Playoffs" OR "NBA Finals" -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'NBA.com', 'portland_metro', true, 3),
  ('google_news:mlb_official', 'google_news',
   'site:mlb.com "Seattle Mariners" OR "World Series" OR MLB playoffs -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'MLB.com', 'portland_metro', true, 3),
  ('google_news:nfl_official', 'google_news',
   'site:nfl.com "Seattle Seahawks" OR "Super Bowl" OR "NFL Playoffs" -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'NFL.com', 'portland_metro', true, 3),
  ('google_news:bleacher_report_sports', 'google_news',
   'site:bleacherreport.com Portland Seattle sports "Trail Blazers" Seahawks Mariners Timbers Thorns -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'Bleacher Report Sports', 'portland_metro', true, 3),
  ('google_news:fox_sports', 'google_news',
   'site:foxsports.com Portland Seattle sports NBA NFL MLB MLS NWSL -odds -betting -fantasy -DraftKings -FanDuel -props',
   'sports', 'FOX Sports', 'portland_metro', true, 3),
  ('google_news:olympics_official', 'google_news',
   'site:olympics.com Olympics "Team USA" Portland Seattle -odds -betting -fantasy',
   'sports', 'Olympics.com', 'portland_metro', true, 3),
  ('google_news:fifa_official', 'google_news',
   'site:fifa.com "FIFA World Cup 2026" Seattle Portland Vancouver -odds -betting -fantasy',
   'sports', 'FIFA.com', 'portland_metro', true, 3)
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
