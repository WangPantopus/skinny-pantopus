-- Seed the default national sports event registry.
--
-- The sports topic migration creates sports_events, but the national sports
-- fetcher/poster are gated by active_sports_events. If the companion script is
-- not run after deploy, NBA Playoffs and other major events never activate.
-- Keep this idempotent so production can be repaired by applying migrations.

INSERT INTO "public"."sports_events"
  ("event_key", "display_name", "short_label", "league", "country", "starts_at", "ends_at", "priority", "cadence")
VALUES
  (
    'nba_playoffs_2026',
    'NBA Playoffs',
    'NBA Playoffs',
    'nba',
    'US',
    '2026-04-18T00:00:00+00:00',
    '2026-06-22T23:59:59+00:00',
    10,
    '{"general_thread": 1, "game_thread": 2, "watch_prompt": 1}'::jsonb
  ),
  (
    'nhl_playoffs_2026',
    'NHL Playoffs',
    'NHL Playoffs',
    'nhl',
    'US',
    '2026-04-20T00:00:00+00:00',
    '2026-06-22T23:59:59+00:00',
    20,
    '{"general_thread": 1, "game_thread": 2, "watch_prompt": 1}'::jsonb
  ),
  (
    'mlb_opening_2026',
    'MLB Season',
    'MLB',
    'mlb',
    'US',
    '2026-03-26T00:00:00+00:00',
    '2026-10-01T23:59:59+00:00',
    50,
    '{"general_thread": 1, "game_thread": 1, "watch_prompt": 1}'::jsonb
  ),
  (
    'fifa_world_cup_2026',
    'FIFA World Cup',
    'World Cup',
    'other',
    'US',
    '2026-06-11T00:00:00+00:00',
    '2026-07-19T23:59:59+00:00',
    5,
    '{"general_thread": 1, "game_thread": 2, "watch_prompt": 2}'::jsonb
  )
ON CONFLICT ("event_key") DO UPDATE
SET
  "display_name" = EXCLUDED."display_name",
  "short_label"  = EXCLUDED."short_label",
  "league"       = EXCLUDED."league",
  "country"      = EXCLUDED."country",
  "starts_at"    = EXCLUDED."starts_at",
  "ends_at"      = EXCLUDED."ends_at",
  "priority"     = EXCLUDED."priority",
  "cadence"      = EXCLUDED."cadence",
  "updated_at"   = now();
