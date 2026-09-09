-- Beacon device alerts can be disabled without removing in-app notifications.
-- Backwards compatible: yes; existing clients ignore the additive field and
-- existing/missing preference rows retain enabled behavior. No notification replay.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."UserNotificationPreferences"
  ADD COLUMN beacon_push_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public."UserNotificationPreferences".beacon_push_enabled IS
  'Device push for Beacon publications only; in-app notifications remain available. Global push opt-out takes precedence.';
