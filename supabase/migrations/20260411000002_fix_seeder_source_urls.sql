-- ============================================================================
-- Migration: Fix stale seeder source URLs
--
-- Production had drifted to older RSS endpoints for Camas-Washougal and
-- Portland. Oregon Metro's configured URL currently resolves to HTML rather
-- than an RSS/Atom feed, so deactivate it until a valid feed is available.
-- ============================================================================

UPDATE "public"."seeder_sources"
SET "url" = 'https://www.camaspostrecord.com/feed/'
WHERE "source_id" = 'rss:camas_washougal';

UPDATE "public"."seeder_sources"
SET "url" = 'https://www.portland.gov/news/rss'
WHERE "source_id" = 'rss:city_portland';

UPDATE "public"."seeder_sources"
SET "active" = false
WHERE "source_id" = 'rss:oregon_metro';
