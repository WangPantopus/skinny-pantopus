-- ============================================================================
-- Migration: Alert Notification History no-bid nudge support
--
-- Aligns the AlertNotificationHistory alert_type CHECK constraint with the
-- deployed seeder handlers, which also record no-bid poster nudges.
-- ============================================================================

ALTER TABLE "public"."AlertNotificationHistory"
  DROP CONSTRAINT IF EXISTS "AlertNotificationHistory_alert_type_check";

ALTER TABLE "public"."AlertNotificationHistory"
  ADD CONSTRAINT "AlertNotificationHistory_alert_type_check"
  CHECK ("alert_type" IN ('weather', 'aqi', 'reminder', 'mail', 'no_bid_nudge'));
