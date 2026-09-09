-- Boost Portland Trail Blazers playoff coverage for the April 28, 2026 game.
--
-- The sports poster can read featured_matchups from sports_events.cadence.
-- Keeping the matchup in data lets operators adjust future game-day prompts
-- without another code deploy.

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
    '{
      "general_thread": 1,
      "game_thread": 2,
      "watch_prompt": 1,
      "featured_matchups": [
        {
          "matchup_key": "nba_playoffs_2026_blazers_spurs_game_5",
          "team_tag": "blazers",
          "team_name": "Portland Trail Blazers",
          "opponent_tag": "spurs",
          "opponent_name": "San Antonio Spurs",
          "matchup": "Trail Blazers at Spurs",
          "game_label": "Game 5",
          "round": "first round",
          "tip_off_at": "2026-04-29T01:30:00+00:00",
          "local_tip_time": "6:30 PM PT",
          "broadcast": "ESPN",
          "stakes": "Portland is facing elimination",
          "active_from": "2026-04-28T00:00:00+00:00",
          "active_until": "2026-04-29T08:00:00+00:00",
          "local_target_regions": ["portland_metro", "clark_county"]
        }
      ]
    }'::jsonb
  )
ON CONFLICT ("event_key") DO UPDATE
SET
  "cadence" =
    "sports_events"."cadence" ||
    '{
      "featured_matchups": [
        {
          "matchup_key": "nba_playoffs_2026_blazers_spurs_game_5",
          "team_tag": "blazers",
          "team_name": "Portland Trail Blazers",
          "opponent_tag": "spurs",
          "opponent_name": "San Antonio Spurs",
          "matchup": "Trail Blazers at Spurs",
          "game_label": "Game 5",
          "round": "first round",
          "tip_off_at": "2026-04-29T01:30:00+00:00",
          "local_tip_time": "6:30 PM PT",
          "broadcast": "ESPN",
          "stakes": "Portland is facing elimination",
          "active_from": "2026-04-28T00:00:00+00:00",
          "active_until": "2026-04-29T08:00:00+00:00",
          "local_target_regions": ["portland_metro", "clark_county"]
        }
      ]
    }'::jsonb,
  "updated_at" = now();

INSERT INTO "public"."seeder_sources"
  ("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
SELECT * FROM (VALUES
  (
    'google_news:trail_blazers',
    'google_news',
    '"Portland Trail Blazers" ("NBA Playoffs" OR playoffs OR Spurs OR "Game 5" OR elimination) -odds -betting -fantasy -player props -DraftKings -FanDuel',
    'sports',
    'Trail Blazers News',
    'clark_county',
    true,
    3
  ),
  (
    'google_news:trail_blazers',
    'google_news',
    '"Portland Trail Blazers" ("NBA Playoffs" OR playoffs OR Spurs OR "Game 5" OR elimination) -odds -betting -fantasy -player props -DraftKings -FanDuel',
    'sports',
    'Trail Blazers News',
    'portland_metro',
    true,
    3
  )
) AS v("source_id", "source_type", "url", "category", "display_name", "region", "active", "priority")
WHERE EXISTS (
  SELECT 1 FROM "public"."seeder_config" c WHERE c."region" = v."region"
)
ON CONFLICT ("source_id", "region") DO UPDATE
SET
  "source_type" = EXCLUDED."source_type",
  "url" = EXCLUDED."url",
  "category" = EXCLUDED."category",
  "display_name" = EXCLUDED."display_name",
  "active" = EXCLUDED."active",
  "priority" = EXCLUDED."priority";
