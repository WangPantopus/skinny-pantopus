-- Migration: Add sports content sources for PNW teams and World Cup 2026
-- New category: sports
-- Teams: Trail Blazers, Timbers, Thorns, Seahawks, Sounders, Kraken, Mariners

-- Only inserts if the region exists in seeder_config

INSERT INTO seeder_sources (source_id, source_type, url, category, display_name, region, active)
SELECT * FROM (VALUES
  ('google_news:trail_blazers', 'google_news', 'Portland Trail Blazers NBA', 'sports', 'Trail Blazers News', 'clark_county', true),
  ('rss:reddit_ripcity', 'rss', 'https://www.reddit.com/r/ripcity/top/.rss?sort=top&t=day', 'sports', 'r/ripcity (Trail Blazers)', 'clark_county', true),
  ('google_news:timbers', 'google_news', 'Portland Timbers MLS', 'sports', 'Timbers News', 'clark_county', true),
  ('google_news:thorns', 'google_news', 'Portland Thorns NWSL', 'sports', 'Thorns News', 'clark_county', true),
  ('google_news:world_cup_portland', 'google_news', 'FIFA World Cup 2026 Portland Seattle', 'sports', 'World Cup 2026', 'clark_county', true)
) AS v(source_id, source_type, url, category, display_name, region, active)
WHERE EXISTS (SELECT 1 FROM seeder_config WHERE region = 'clark_county')
ON CONFLICT (source_id, region) DO UPDATE
SET source_type = EXCLUDED.source_type, url = EXCLUDED.url,
    category = EXCLUDED.category, display_name = EXCLUDED.display_name, active = EXCLUDED.active;

INSERT INTO seeder_sources (source_id, source_type, url, category, display_name, region, active)
SELECT * FROM (VALUES
  ('google_news:trail_blazers', 'google_news', 'Portland Trail Blazers NBA', 'sports', 'Trail Blazers News', 'portland_metro', true),
  ('rss:reddit_ripcity', 'rss', 'https://www.reddit.com/r/ripcity/top/.rss?sort=top&t=day', 'sports', 'r/ripcity (Trail Blazers)', 'portland_metro', true),
  ('google_news:timbers', 'google_news', 'Portland Timbers MLS', 'sports', 'Timbers News', 'portland_metro', true),
  ('google_news:thorns', 'google_news', 'Portland Thorns NWSL', 'sports', 'Thorns News', 'portland_metro', true),
  ('rss:reddit_timbers', 'rss', 'https://www.reddit.com/r/timbers/top/.rss?sort=top&t=day', 'sports', 'r/timbers', 'portland_metro', true),
  ('rss:kgw_sports', 'rss', 'https://www.kgw.com/feeds/syndication/rss/sports', 'sports', 'KGW Sports', 'portland_metro', true),
  ('google_news:seahawks', 'google_news', 'Seattle Seahawks NFL', 'sports', 'Seahawks News', 'portland_metro', true),
  ('google_news:world_cup_portland', 'google_news', 'FIFA World Cup 2026 Portland Seattle', 'sports', 'World Cup 2026', 'portland_metro', true)
) AS v(source_id, source_type, url, category, display_name, region, active)
WHERE EXISTS (SELECT 1 FROM seeder_config WHERE region = 'portland_metro')
ON CONFLICT (source_id, region) DO UPDATE
SET source_type = EXCLUDED.source_type, url = EXCLUDED.url,
    category = EXCLUDED.category, display_name = EXCLUDED.display_name, active = EXCLUDED.active;
