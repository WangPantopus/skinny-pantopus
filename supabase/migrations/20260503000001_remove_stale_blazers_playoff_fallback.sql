-- Stop fabricating stale Portland Trail Blazers playoff threads after their
-- configured game window has expired. Real queued NBA news and explicitly
-- active featured matchups can still post.

UPDATE "public"."sports_events"
SET
  "cadence" = "cadence" - 'local_team_fallbacks',
  "updated_at" = now()
WHERE
  "event_key" = 'nba_playoffs_2026'
  AND "cadence" ? 'local_team_fallbacks';
