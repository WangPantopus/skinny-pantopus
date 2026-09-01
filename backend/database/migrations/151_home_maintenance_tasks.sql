-- 151_home_maintenance_tasks.sql
-- T6.3b / P10 — Extend `HomeMaintenanceLog` so it can back the new
-- per-home Maintenance screen (`/api/homes/:id/maintenance`).
--
-- Today's table is a backward-looking *performed* log (`performed_at`,
-- `performed_by`, `cost`, `notes`, optional `vendor_id` FK, optional
-- `document_id` FK). The new screen needs a forward-looking *task*
-- record: task name, free-text vendor (or DIY), recurrence, due date,
-- and a lifecycle status (`scheduled / in_progress / completed /
-- cancelled`).
--
-- Additive only. Every existing row stays valid:
--   - `task` defaults to `''` (will be backfilled at the route layer
--     from `notes` if the front-end ever queries legacy rows).
--   - `recurrence` defaults to `one_time` — matches the historical
--     "I logged this once" semantic of the original log.
--   - `status` defaults to `completed` — historical rows are already
--     past events; the route handler only surfaces `completed` history.
--   - `due_date` defaults to `performed_at` when set, otherwise NULL.
--   - `updated_at` defaults to `created_at`.
--   - `created_by` defaults to `performed_by`.
--
-- The `vendor_id` FK column stays for future template-driven flows; the
-- new free-text `vendor` column is what the design-spec DTO carries.

ALTER TABLE "public"."HomeMaintenanceLog"
  ADD COLUMN IF NOT EXISTS "task" "text" NOT NULL DEFAULT '';

ALTER TABLE "public"."HomeMaintenanceLog"
  ADD COLUMN IF NOT EXISTS "vendor" "text";

ALTER TABLE "public"."HomeMaintenanceLog"
  ADD COLUMN IF NOT EXISTS "recurrence" "text"
    NOT NULL DEFAULT 'one_time';

ALTER TABLE "public"."HomeMaintenanceLog"
  ADD COLUMN IF NOT EXISTS "due_date" timestamp with time zone;

ALTER TABLE "public"."HomeMaintenanceLog"
  ADD COLUMN IF NOT EXISTS "status" "text"
    NOT NULL DEFAULT 'scheduled';

ALTER TABLE "public"."HomeMaintenanceLog"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone
    NOT NULL DEFAULT "now"();

ALTER TABLE "public"."HomeMaintenanceLog"
  ADD COLUMN IF NOT EXISTS "created_by" "uuid";

-- Lifecycle constraint. The design uses `scheduled / in_progress /
-- completed / cancelled`; `dueSoon` and `overdue` are client-derived
-- from `status='scheduled' + due_date` (no separate enum value).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'HomeMaintenance_status_chk'
  ) THEN
    ALTER TABLE "public"."HomeMaintenanceLog"
      ADD CONSTRAINT "HomeMaintenance_status_chk"
      CHECK ("status" = ANY (ARRAY[
        'scheduled'::"text",
        'in_progress'::"text",
        'completed'::"text",
        'cancelled'::"text"
      ]));
  END IF;
END $$;

-- Recurrence constraint.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'HomeMaintenance_recurrence_chk'
  ) THEN
    ALTER TABLE "public"."HomeMaintenanceLog"
      ADD CONSTRAINT "HomeMaintenance_recurrence_chk"
      CHECK ("recurrence" = ANY (ARRAY[
        'one_time'::"text",
        'weekly'::"text",
        'monthly'::"text",
        'quarterly'::"text",
        'yearly'::"text"
      ]));
  END IF;
END $$;

-- created_by FK (mirrors HomeMaintenanceTemplate.created_by).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'HomeMaintenanceLog_created_by_fkey'
  ) THEN
    ALTER TABLE "public"."HomeMaintenanceLog"
      ADD CONSTRAINT "HomeMaintenanceLog_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "public"."User"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for the new screen's tab projections.
CREATE INDEX IF NOT EXISTS "idx_home_maint_log_status_due"
  ON "public"."HomeMaintenanceLog" ("home_id", "status", "due_date" ASC);

-- The existing performed_at index serves the Completed tab; the new
-- composite serves the Scheduled tab (status filter + due ordering).
