-- Backwards compatible: yes. Adds one nullable column; every existing row stays valid and keeps its
-- meaning (null: the automatic pick). Nothing reads it until the backend that uses it is deployed.
-- Deploy migration before backend.
--
-- Default home (docs/place-root-and-homes-brief-2026-10-12.md, WP4):
--   * UserNotificationPreferences.default_home_id: the Home the person chose as their default in the
--     apps' "Your homes" sheet. The row is private (profile endpoints never select it) and Today's
--     location resolver already reads it. No foreign key and no index: the backend validates the Home
--     on read and on write, and ignores it once the person can no longer open it.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."UserNotificationPreferences" ADD COLUMN IF NOT EXISTS default_home_id uuid;

COMMENT ON COLUMN public."UserNotificationPreferences".default_home_id IS
  'The Home the person chose as their default. Honored only while it is still one they can open; otherwise the automatic pick applies.';
