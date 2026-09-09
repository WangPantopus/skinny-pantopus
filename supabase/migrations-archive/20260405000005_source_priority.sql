-- Add priority column to seeder_sources (1=critical, 2=core, 3=enrichment, 4=filler)
ALTER TABLE seeder_sources ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 2;

-- Add source_priority to queue items so the poster can rank by it
ALTER TABLE seeder_content_queue ADD COLUMN IF NOT EXISTS source_priority smallint NOT NULL DEFAULT 2;

-- Set priorities for existing sources based on their type/category
-- P1: Critical (safety, weather, earthquakes)
UPDATE seeder_sources SET priority = 1
WHERE source_type IN ('nws_alerts', 'usgs_earthquakes')
   OR category IN ('safety');

-- P2: Core (local news, events, seasonal) — already default

-- P3: Enrichment (community, sports, air quality)
UPDATE seeder_sources SET priority = 3
WHERE category IN ('community_resource', 'sports', 'air_quality')
   OR source_id LIKE 'rss:reddit_%'
   OR source_id LIKE 'rss:oregon_metro'
   OR source_id LIKE 'rss:city_%';

-- P4: Filler (history, reddit sports subs)
UPDATE seeder_sources SET priority = 4
WHERE category = 'history'
   OR source_id LIKE 'rss:reddit_ripcity'
   OR source_id LIKE 'rss:reddit_timbers';

-- Index for efficient priority-based queue queries
CREATE INDEX IF NOT EXISTS idx_queue_priority
  ON seeder_content_queue (region, status, source_priority, fetched_at DESC);
