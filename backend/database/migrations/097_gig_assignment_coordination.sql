-- ============================================================
-- 097: Assignment coordination – reminder state + worker-ack scaffolding
-- last_worker_reminder_at: cooldown tracking for owner reminders (Phase 1).
-- worker_ack_*: worker acknowledgement state (Phase 2).
-- ============================================================

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "last_worker_reminder_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "worker_ack_status"       character varying(50),
  ADD COLUMN IF NOT EXISTS "worker_ack_eta_minutes"  integer,
  ADD COLUMN IF NOT EXISTS "worker_ack_note"         text,
  ADD COLUMN IF NOT EXISTS "worker_ack_updated_at"   timestamp with time zone;

COMMENT ON COLUMN "public"."Gig"."last_worker_reminder_at" IS 'When the owner last sent a start-work reminder to the assigned worker';
COMMENT ON COLUMN "public"."Gig"."worker_ack_status"       IS 'Worker acknowledgement status (starting_now, running_late, cant_make_it)';
COMMENT ON COLUMN "public"."Gig"."worker_ack_eta_minutes"  IS 'Worker-provided ETA in minutes (used with running_late)';
COMMENT ON COLUMN "public"."Gig"."worker_ack_note"         IS 'Free-text note from the worker';
COMMENT ON COLUMN "public"."Gig"."worker_ack_updated_at"   IS 'When the worker last updated their acknowledgement';
