-- =============================================================================
-- Migration: Gig task_format (T6.0b)
-- Adds `task_format` enum + column to Gig so My tasks V2 can render the
-- engagement-mode badge (in_person / drop_off / remote / hybrid).
-- Per T6 Q13 the design's `engagement_mode` concept is renamed
-- `task_format` here so it doesn't collide with the existing
-- `engagement_mode` enum (instant_accept|curated_offers|quotes).
-- ADDITIVE ONLY: no existing columns or constraints are modified.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE "public"."task_format" AS ENUM (
    'in_person',
    'drop_off',
    'remote',
    'hybrid'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "task_format" "public"."task_format"
    NOT NULL
    DEFAULT 'in_person'::"public"."task_format";

CREATE INDEX IF NOT EXISTS "idx_gig_task_format"
  ON "public"."Gig" ("task_format");
