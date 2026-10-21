-- Backwards compatible: yes. Existing rows and all columns keep their values
-- and shapes; older apps can still read and update either briefing switch.
-- Founder direction, October 17: default both briefings on and explain the
-- controls in an in-app notice. Existing false values may be explicit opt-outs;
-- do not backfill or reset anyone's preferences.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."UserNotificationPreferences"
  ALTER COLUMN daily_briefing_enabled SET DEFAULT true;

COMMENT ON COLUMN public."UserNotificationPreferences".daily_briefing_prompted_at IS
  'When the briefing notice was shown. Existing morning opt-in acknowledgements remain valid; never resets notification choices.';

COMMIT;
