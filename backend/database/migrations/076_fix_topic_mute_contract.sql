-- ============================================================
-- MIGRATION 076: Fix topic-mute contract
--
-- Fixes:
--   1. muted_entity_id column type uuid → text (topics are strings)
--   2. Add 'topic' to muted_entity_type enum
--   3. Replace unique index to include surface (COALESCE for NULL)
-- ============================================================

-- 1. Change muted_entity_id from uuid to text so topic strings are valid
ALTER TABLE "public"."PostMute"
  ALTER COLUMN "muted_entity_id" TYPE text USING "muted_entity_id"::text;

-- 2. Add 'topic' to the muted_entity_type enum
ALTER TYPE "public"."muted_entity_type" ADD VALUE IF NOT EXISTS 'topic';

-- 3. Replace unique index to include surface
--    COALESCE handles NULL surface so uniqueness works correctly
DROP INDEX IF EXISTS "PostMute_user_entity_unique";
CREATE UNIQUE INDEX "PostMute_user_entity_surface_unique"
  ON "public"."PostMute" ("user_id", "muted_entity_type", "muted_entity_id", COALESCE("surface", '__global__'));
