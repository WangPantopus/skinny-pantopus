-- ============================================================
-- Migration 170: MailDayItem materialization idempotency
--
-- ensureTodayItems was a check-then-insert with nothing behind it:
-- MailDayItem (migration 154) has only PRIMARY KEY(id) plus CHECKs, so
-- when two executors materialize the same user's day at once — the
-- */15 cron started by every app instance with no leader election, or
-- the job racing GET /mailday/today on an app open — both pass the
-- empty-check and every piece is inserted twice. The PR fixed this
-- exact race for the SEND (MailDaySession's unique claim) but left the
-- materialization unprotected.
--
-- This backfills the missing invariant: one MailDayItem per
-- (user_id, day_date, mail_id). Existing duplicates are collapsed
-- first (keeping the earliest row, which the user may have reviewed),
-- then the partial unique index makes the service's upsert-ignore a
-- true no-op for the race's loser. Partial (mail_id IS NOT NULL)
-- because the dev seed route writes rows without a mail_id.
-- ============================================================

-- 1) Collapse existing duplicates. Keep one row per
--    (user_id, day_date, mail_id), preferring a row the user already
--    reviewed over an unreviewed twin (their triage work survives),
--    then the earliest created.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, day_date, mail_id
           ORDER BY (status = 'unreviewed') ASC, created_at ASC, id ASC
         ) AS rn
  FROM "public"."MailDayItem"
  WHERE mail_id IS NOT NULL
)
DELETE FROM "public"."MailDayItem"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) The invariant.
CREATE UNIQUE INDEX IF NOT EXISTS "MailDayItem_user_day_mail_key"
  ON "public"."MailDayItem" (user_id, day_date, mail_id)
  WHERE mail_id IS NOT NULL;
