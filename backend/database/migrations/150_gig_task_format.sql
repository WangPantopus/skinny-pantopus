-- 150_gig_task_format.sql
-- T6.0b — Adds `task_format` to Gig so My tasks V2 can render the
-- engagement-mode badge (in_person / drop_off / remote / hybrid).
--
-- Per the T6 open-question decision Q13, the design's `engagement_mode`
-- concept is renamed to `task_format` on the backend so it doesn't
-- collide with the existing `engagement_mode` enum
-- (`instant_accept|curated_offers|quotes`, which encodes the offer-
-- acceptance mode, not the helper-engagement format).
--
-- Additive only: existing rows default to `in_person` (the historical
-- assumption for tasks posted before this column existed).

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
