-- Backwards compatible: yes. Adds one defaulted column to "UserNotificationPreferences" and one nullable column to
-- "UserFeedPreference". No existing column, row, function, index or grant changes; the deployed backend and the apps in
-- the stores never read or write either.
--
-- Moments (behind the `moments` flag): a person's connections get one push when they add a Moment ("Priya added a
-- Moment"). The founder approved the push and its switch on 2026-11-10; no new table.
--   moments_enabled:       each person's switch for that push in Settings → Notifications, "Moments from your
--                          connections", on by default like the other switches in this table.
--   moments_app_seen_at:   when the person's app last asked for Moments (set at most once a day). Only an app that
--                          has Moments asks, so the push goes to people it can open for and never to someone still
--                          on an older app. Beside the Pulse "seen" times this table already keeps per person.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."UserNotificationPreferences"
  ADD COLUMN IF NOT EXISTS moments_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public."UserNotificationPreferences".moments_enabled IS
  'Push when a connection adds a Moment ("Moments from your connections" in Settings). On by default.';

ALTER TABLE public."UserFeedPreference"
  ADD COLUMN IF NOT EXISTS moments_app_seen_at timestamptz;

COMMENT ON COLUMN public."UserFeedPreference".moments_app_seen_at IS
  'When this person''s app last called a Moments route (written at most once a day). Null: no app with Moments yet.';

COMMIT;
