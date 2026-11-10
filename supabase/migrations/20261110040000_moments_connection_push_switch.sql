-- Backwards compatible: yes. Adds one defaulted column to "UserNotificationPreferences". No existing column, row,
-- function, index or grant changes; the deployed backend and the apps in the stores never read or write it.
--
-- Moments (behind the `moments` flag): a person's connections get one push when they add a Moment ("Priya added a
-- Moment"). This is each person's switch for that push in Settings → Notifications, "Moments from your connections",
-- on by default like the other switches in this table. The founder approved the push and its switch on 2026-11-10;
-- no new table.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."UserNotificationPreferences"
  ADD COLUMN IF NOT EXISTS moments_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public."UserNotificationPreferences".moments_enabled IS
  'Push when a connection adds a Moment ("Moments from your connections" in Settings). On by default.';

COMMIT;
