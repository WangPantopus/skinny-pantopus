-- Backwards compatible: yes. Missing timezone choices now remain unset;
-- the preferences API still returns a resolved string for existing clients.
-- Preserve every existing choice, including Pacific (we cannot distinguish
-- an intentional choice from a historic database default).
SET LOCAL lock_timeout = '5s';
ALTER TABLE public."UserNotificationPreferences"
  ALTER COLUMN daily_briefing_timezone DROP NOT NULL,
  ALTER COLUMN daily_briefing_timezone DROP DEFAULT;
