-- Sports topic lane: adds first-class topic/scope/metadata/origin on Post,
-- national audience, sports_events registry + active view, and queue scope.
--
-- Phase 1 of the Sports topic lane on Pulse. See
-- supabase/migrations/20260423000001_sports_topic.sql for the canonical ordering.

-- 1) First-class columns on Post
ALTER TABLE "public"."Post"
  ADD COLUMN IF NOT EXISTS "topic"         text,
  ADD COLUMN IF NOT EXISTS "sports_scope"  text,
  ADD COLUMN IF NOT EXISTS "post_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "origin"        text  NOT NULL DEFAULT 'user';

-- origin is server-derived from req.user.accountType; never trusted from the client.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Post_origin_check'
  ) THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_origin_check"
      CHECK ("origin" IN ('user', 'curator', 'system'));
  END IF;
END$$;

-- Optional scope values in Phase 1 (kept loose to allow evolution).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Post_sports_scope_check'
  ) THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_sports_scope_check"
      CHECK (
        "sports_scope" IS NULL
        OR "sports_scope" IN ('local', 'regional', 'national', 'youth', 'school', 'rec', 'watch')
      );
  END IF;
END$$;

-- Topic is currently only 'sports', but left nullable + free-text so we can add more.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Post_topic_check'
  ) THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_topic_check"
      CHECK ("topic" IS NULL OR "topic" IN ('sports'));
  END IF;
END$$;

-- Indexes used by the Sports feed and ranker on every request.
CREATE INDEX IF NOT EXISTS idx_post_topic_created
  ON "public"."Post" ("topic", "created_at" DESC)
  WHERE "topic" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_topic_scope_created
  ON "public"."Post" ("topic", "sports_scope", "created_at" DESC)
  WHERE "topic" = 'sports';

CREATE INDEX IF NOT EXISTS idx_post_metadata_gin
  ON "public"."Post"
  USING gin ("post_metadata" jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_post_origin
  ON "public"."Post" ("origin")
  WHERE "origin" <> 'user';

-- 2) post_audience enum: add 'national' (Sports national lane).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'post_audience' AND e.enumlabel = 'national'
  ) THEN
    ALTER TYPE "public"."post_audience" ADD VALUE 'national';
  END IF;
END$$;

-- 3) sports_events registry + active view.
CREATE TABLE IF NOT EXISTS "public"."sports_events" (
  "event_key"    text PRIMARY KEY,
  "display_name" text NOT NULL,
  "short_label"  text NOT NULL,
  "league"       text NOT NULL,
  "country"      text NOT NULL DEFAULT 'US',
  "starts_at"    timestamptz NOT NULL,
  "ends_at"      timestamptz NOT NULL,
  "priority"     integer NOT NULL DEFAULT 100,
  "cadence"      jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sports_events_window
  ON "public"."sports_events" ("starts_at", "ends_at");

-- Generated columns cannot depend on now(); use a view instead.
CREATE OR REPLACE VIEW "public"."active_sports_events" AS
  SELECT *
    FROM "public"."sports_events"
   WHERE "starts_at" <= now()
     AND "ends_at"   >= now()
   ORDER BY "priority" ASC, "starts_at" DESC;

-- 4) seeder_content_queue: scope column for national vs local lane.
ALTER TABLE "public"."seeder_content_queue"
  ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS "event_key" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seeder_content_queue_scope_check'
  ) THEN
    ALTER TABLE "public"."seeder_content_queue"
      ADD CONSTRAINT "seeder_content_queue_scope_check"
      CHECK ("scope" IN ('local', 'national'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_seeder_queue_scope_status
  ON "public"."seeder_content_queue" ("scope", "status", "category");

CREATE INDEX IF NOT EXISTS idx_seeder_queue_scope_event_status
  ON "public"."seeder_content_queue" ("scope", "category", "status", "event_key")
  WHERE "event_key" IS NOT NULL;
