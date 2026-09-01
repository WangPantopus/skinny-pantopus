-- ============================================================
-- MIGRATION 041: Feed v1.1 — Auto-Archive Expired Posts
--
-- Creates a database function to archive posts past their TTL,
-- deals past deal_expires_at, and events past event_end_date.
-- Intended to be called hourly via pg_cron or backend cron.
-- ============================================================

-- ─── 1. AUTO-ARCHIVE FUNCTION ──────────────────────────────

CREATE OR REPLACE FUNCTION auto_archive_expired_posts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archived_count integer := 0;
  ttl_row RECORD;
BEGIN
  -- Archive posts that exceeded their category TTL
  FOR ttl_row IN
    SELECT post_type, ttl_days FROM "public"."PostCategoryTTL" WHERE ttl_days > 0
  LOOP
    UPDATE "public"."Post"
    SET archived_at = now(),
        archive_reason = 'expired'
    WHERE post_type = ttl_row.post_type
      AND archived_at IS NULL
      AND created_at < (now() - (ttl_row.ttl_days || ' days')::interval);

    archived_count := archived_count + ROW_COUNT;
  END LOOP;

  -- Archive deals past their explicit expiration
  UPDATE "public"."Post"
  SET archived_at = now(),
      archive_reason = 'expired'
  WHERE post_type IN ('deal', 'deals_promos')
    AND archived_at IS NULL
    AND deal_expires_at IS NOT NULL
    AND deal_expires_at < now();

  archived_count := archived_count + ROW_COUNT;

  -- Archive events past their end date (with 24h grace period)
  UPDATE "public"."Post"
  SET archived_at = now(),
      archive_reason = 'expired'
  WHERE post_type = 'event'
    AND archived_at IS NULL
    AND event_end_date IS NOT NULL
    AND event_end_date < (now() - interval '24 hours');

  archived_count := archived_count + ROW_COUNT;

  -- Archive expired stories
  UPDATE "public"."Post"
  SET archived_at = now(),
      archive_reason = 'expired'
  WHERE is_story = true
    AND archived_at IS NULL
    AND story_expires_at IS NOT NULL
    AND story_expires_at < now();

  archived_count := archived_count + ROW_COUNT;

  RETURN archived_count;
END;
$$;

-- ─── 2. SCHEDULE (if pg_cron available) ─────────────────────
-- Uncomment if pg_cron is enabled on your Supabase instance:
-- SELECT cron.schedule('auto-archive-posts', '0 * * * *', 'SELECT auto_archive_expired_posts()');

-- ─── 3. GRANTS ──────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION auto_archive_expired_posts() TO "service_role";
