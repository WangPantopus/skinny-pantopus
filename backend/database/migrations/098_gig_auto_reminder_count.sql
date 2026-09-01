-- ============================================================
-- 098: Auto-reminder count for assignment coordination
-- Tracks how many automatic reminders have been sent to the
-- assigned worker, capped at 2 per assignment.
-- ============================================================

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "auto_reminder_count" integer DEFAULT 0;

COMMENT ON COLUMN "public"."Gig"."auto_reminder_count" IS 'Number of automatic start-work reminders sent to the assigned worker (capped at 2)';
