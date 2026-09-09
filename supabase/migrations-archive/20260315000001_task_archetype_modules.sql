-- =============================================================================
-- Migration: Task Archetype + Module JSONB Columns
-- Adds task_archetype enum, column, JSONB module columns, and urgent fields.
-- ADDITIVE ONLY: no existing columns or constraints are modified.
-- =============================================================================

-- 1. Create the task_archetype enum type
DO $$ BEGIN
  CREATE TYPE "public"."task_archetype" AS ENUM (
    'quick_help',
    'delivery_errand',
    'home_service',
    'pro_service_quote',
    'care_task',
    'event_shift',
    'remote_task',
    'recurring_service',
    'general'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add task_archetype column to Gig table
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "task_archetype" "public"."task_archetype"
    DEFAULT 'general'::"public"."task_archetype";

-- 3. Add JSONB module columns (all nullable, no default)
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "care_details" jsonb;

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "logistics_details" jsonb;

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "remote_details" jsonb;

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "urgent_details" jsonb;

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "event_details" jsonb;

-- 4. Add urgent task fields
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "starts_asap" boolean DEFAULT false;

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "response_window_minutes" integer;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS "idx_gig_task_archetype"
  ON "public"."Gig" USING btree ("task_archetype");

CREATE INDEX IF NOT EXISTS "idx_gig_starts_asap"
  ON "public"."Gig" ("starts_asap")
  WHERE ("starts_asap" = true);
