-- ============================================================
-- MIGRATION 033: Feed + Posting Redesign
--
-- Adds support for:
--   - Post identity (post_as: personal/business/home)
--   - Audience targeting (nearby, followers, connections, network, etc.)
--   - Post muting and hiding
--   - Auto-archiving with category TTL
--   - Stories (24h expiring posts)
-- ============================================================

-- ─── 1. NEW ENUM TYPES ────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "public"."post_as_type" AS ENUM ('personal', 'business', 'home');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."post_audience" AS ENUM (
    'connections', 'followers', 'network', 'nearby',
    'saved_place', 'household', 'neighborhood', 'target_area'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."archive_reason" AS ENUM (
    'expired', 'resolved', 'manual', 'moderation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."muted_entity_type" AS ENUM ('user', 'business');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. NEW COLUMNS ON Post ──────────────────────────────────

ALTER TABLE "public"."Post"
  ADD COLUMN IF NOT EXISTS "post_as"           "public"."post_as_type"    DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS "audience"          "public"."post_audience"   DEFAULT 'nearby',
  ADD COLUMN IF NOT EXISTS "target_place_id"   "uuid"                     REFERENCES "public"."SavedPlace"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "business_id"       "uuid",
  ADD COLUMN IF NOT EXISTS "resolved_at"       timestamptz,
  ADD COLUMN IF NOT EXISTS "archived_at"       timestamptz,
  ADD COLUMN IF NOT EXISTS "archive_reason"    "public"."archive_reason",
  ADD COLUMN IF NOT EXISTS "is_story"          boolean                    DEFAULT false,
  ADD COLUMN IF NOT EXISTS "story_expires_at"  timestamptz;

-- ─── 3. NEW TABLES ───────────────────────────────────────────

-- PostMute: user mutes a person or business across all feeds
CREATE TABLE IF NOT EXISTS "public"."PostMute" (
  "id"                "uuid"                      DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id"           "uuid"                      NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "muted_entity_type" "public"."muted_entity_type" NOT NULL,
  "muted_entity_id"   "uuid"                      NOT NULL,
  "created_at"        timestamptz                 DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "PostMute_user_entity_unique"
  ON "public"."PostMute" ("user_id", "muted_entity_type", "muted_entity_id");

-- PostHide: user hides a specific post
CREATE TABLE IF NOT EXISTS "public"."PostHide" (
  "id"         "uuid"      DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id"    "uuid"      NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "post_id"    "uuid"      NOT NULL REFERENCES "public"."Post"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "PostHide_user_post_unique"
  ON "public"."PostHide" ("user_id", "post_id");

-- PostCategoryTTL: category auto-archive TTL reference table
CREATE TABLE IF NOT EXISTS "public"."PostCategoryTTL" (
  "post_type" varchar(50) PRIMARY KEY,
  "ttl_days"  integer     NOT NULL
);

INSERT INTO "public"."PostCategoryTTL" ("post_type", "ttl_days") VALUES
  ('safety_alert',    7),
  ('lost_found',      14),
  ('deals_promos',    3),
  ('services_offers', 30),
  ('event',           1),
  ('question',        14),
  ('recommendation',  60),
  ('announcement',    14),
  ('resources_howto', 90),
  ('progress_wins',   60),
  ('general',         30)
ON CONFLICT ("post_type") DO NOTHING;

-- ─── 4. INDEXES ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "Post_audience_idx"
  ON "public"."Post" ("audience");

CREATE INDEX IF NOT EXISTS "Post_post_as_idx"
  ON "public"."Post" ("post_as");

CREATE INDEX IF NOT EXISTS "Post_business_id_idx"
  ON "public"."Post" ("business_id")
  WHERE "business_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Post_archived_at_idx"
  ON "public"."Post" ("archived_at")
  WHERE "archived_at" IS NULL;

CREATE INDEX IF NOT EXISTS "Post_target_place_idx"
  ON "public"."Post" ("target_place_id")
  WHERE "target_place_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Post_story_expires_idx"
  ON "public"."Post" ("story_expires_at")
  WHERE "is_story" = true;

-- Composite index for the Nearby feed (most common query)
CREATE INDEX IF NOT EXISTS "Post_nearby_feed_idx"
  ON "public"."Post" ("audience", "is_archived", "created_at" DESC)
  WHERE "archived_at" IS NULL;

-- ─── 5. UPDATE VISIBILITY CHECK CONSTRAINT ───────────────────

-- Extend visibility to include 'connections' value
ALTER TABLE "public"."Post" DROP CONSTRAINT IF EXISTS "Post_visibility_check";
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_visibility_check"
  CHECK (visibility::text = ANY (ARRAY[
    'public', 'neighborhood', 'followers', 'private', 'city', 'radius', 'connections'
  ]::text[]));
