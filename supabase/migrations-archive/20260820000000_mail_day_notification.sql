-- 160_mail_day_notification.sql
-- Mail Day daily push — the delivery record.
--
-- `jobs/mailDayNotification.js` shipped as a Phase-1 stub: it built a
-- summary, wrote a `mail_day_notification` MailEvent row, and stopped
-- ("In a production system, this would call the notification service").
-- It also ran on a fixed `0 8 * * *` UTC schedule — 1am Pacific — so even
-- once wired it would have interrupted people in the middle of the night
-- about mail that had not been scanned yet.
--
-- The fix moves the trigger off the clock and onto scan completion: the
-- job runs frequently and sends when a user actually has unreviewed pieces
-- waiting, inside their own local daytime window. That needs a per-day
-- delivery record so a frequent job stays idempotent — exactly one push
-- per user per mail day, surviving restarts and overlapping runs.
--
-- MailDaySession is already one row per (user_id, day_date) with a unique
-- constraint, so the delivery record belongs there rather than in a new
-- table: the notification is a property of the mail day, and the row is
-- already created/upserted by the triage flow.

ALTER TABLE "public"."MailDaySession"
  ADD COLUMN IF NOT EXISTS "notified_at" timestamp with time zone;

COMMENT ON COLUMN "public"."MailDaySession"."notified_at" IS
  'When the Mail Day push was delivered for this day. Set once by jobs/mailDayNotification.js; its presence is the idempotency guard that keeps a frequently-scheduled job to one push per user per day.';

-- The job scans for unreviewed items and then checks the session, so the
-- hot path is (day_date, notified_at IS NULL). A partial index keeps the
-- scan proportional to the un-notified set rather than the whole history.
CREATE INDEX IF NOT EXISTS "MailDaySession_pending_notification_idx"
  ON "public"."MailDaySession" ("day_date")
  WHERE "notified_at" IS NULL;
