-- 162_daily_briefing_prompt.sql
-- The morning briefing opt-in — asked once, recorded per account.
--
-- `daily_briefing_enabled` defaults to FALSE while `evening_briefing_enabled`
-- defaults to TRUE, so the morning briefing has effectively never shipped:
-- the control exists in Settings → Notifications with a time picker, and
-- almost nobody has ever seen it.
--
-- The fix is deliberately NOT to flip the default. Turning on a push for
-- existing users without asking is exactly the move that burns a
-- notification channel, and it is the user's decision to make rather than a
-- migration's. Instead the product asks once, in context, with the time
-- visible — and takes "no" for an answer permanently.
--
-- This column records that the question was asked, so it is asked once per
-- ACCOUNT rather than once per device. A dismissal stored in localStorage
-- would re-interrupt the same person on every browser and every reinstall,
-- which is how a polite one-time ask turns into nagging.
--
-- Note the semantics: this records that we ASKED, not what they answered.
-- The answer lives in `daily_briefing_enabled`. Both a yes and a no set
-- this, so neither is ever asked again.

ALTER TABLE "public"."UserNotificationPreferences"
  ADD COLUMN IF NOT EXISTS "daily_briefing_prompted_at" timestamp with time zone;

COMMENT ON COLUMN "public"."UserNotificationPreferences"."daily_briefing_prompted_at" IS
  'When the morning-briefing opt-in was shown to this user. Set on both accept and decline, so the ask happens exactly once per account. Null means never asked.';
