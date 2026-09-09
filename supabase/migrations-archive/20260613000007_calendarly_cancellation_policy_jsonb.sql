-- 166_calendarly_cancellation_policy_jsonb.sql
-- BookingPage.cancellation_policy: text -> jsonb.
--
-- The clients' custom-policy editors (iOS CancellationPolicyEditor, web PageManager) save a
-- STRUCTURED policy — {preset, free_cancel_window_min, refund_after_pct, ...} — while the
-- column and Joi schema only accepted text, so saving any custom policy 400'd. Presets are
-- plain strings ('flexible' | 'moderate' | 'strict') and stay strings.
--
-- to_jsonb(text) wraps existing values as JSON strings ('flexible' -> '"flexible"'), so
-- string policies keep decoding as strings on every client after the change.

ALTER TABLE "public"."BookingPage"
  ALTER COLUMN "cancellation_policy" TYPE "jsonb"
  USING CASE WHEN "cancellation_policy" IS NULL THEN NULL ELSE to_jsonb("cancellation_policy") END;
