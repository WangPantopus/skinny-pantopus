-- ============================================================================
-- Migration: Add media columns to seeder_content_queue
--
-- Stores media URLs and types extracted from RSS feed entries so they can
-- be passed through to the Pantopus Post API (which already accepts
-- mediaUrls / mediaTypes arrays).
-- ============================================================================

ALTER TABLE "public"."seeder_content_queue"
  ADD COLUMN IF NOT EXISTS "media_urls"  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "media_types" text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN "public"."seeder_content_queue"."media_urls"
  IS 'Image/video URLs extracted from source (RSS media:content, enclosures, etc.)';
COMMENT ON COLUMN "public"."seeder_content_queue"."media_types"
  IS 'Parallel array of media types — image, video (matches Pantopus Post.media_types)';
