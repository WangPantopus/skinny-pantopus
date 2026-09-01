-- ============================================================
-- MIGRATION 038: Feed v1.1 — Surface Separation & Cursor Pagination
--
-- Adds:
--   - distribution_targets text[] on Post (routing: place/followers/connections)
--   - gps_timestamp for GPS freshness validation
--   - Cursor pagination indexes (created_at DESC, id DESC)
--   - Backfill distribution_targets from existing audience values
-- ============================================================

-- ─── 1. NEW COLUMNS ON Post ──────────────────────────────────

ALTER TABLE "public"."Post"
  ADD COLUMN IF NOT EXISTS "distribution_targets" text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS "gps_timestamp" timestamptz;

-- ─── 2. INDEXES FOR CURSOR PAGINATION ───────────────────────

-- Primary cursor index for all feed surfaces
CREATE INDEX IF NOT EXISTS "Post_cursor_idx"
  ON "public"."Post" ("created_at" DESC, "id" DESC)
  WHERE "archived_at" IS NULL;

-- GIN index for distribution_targets array containment queries
CREATE INDEX IF NOT EXISTS "Post_distribution_targets_idx"
  ON "public"."Post" USING GIN ("distribution_targets")
  WHERE "archived_at" IS NULL;

-- Composite index for Following/Connections surface (user_id + cursor)
CREATE INDEX IF NOT EXISTS "Post_user_cursor_idx"
  ON "public"."Post" ("user_id", "created_at" DESC, "id" DESC)
  WHERE "archived_at" IS NULL;

-- Spatial + cursor for Place surface
CREATE INDEX IF NOT EXISTS "Post_location_cursor_idx"
  ON "public"."Post" USING GIST ("location")
  WHERE "archived_at" IS NULL AND "location" IS NOT NULL;

-- ─── 3. BACKFILL distribution_targets FROM EXISTING audience ─

-- Place-audience posts get 'place'
UPDATE "public"."Post"
SET distribution_targets = ARRAY['place']
WHERE audience IN ('nearby', 'neighborhood', 'saved_place', 'target_area')
  AND (distribution_targets = '{}' OR distribution_targets IS NULL);

-- Followers posts get 'followers'
UPDATE "public"."Post"
SET distribution_targets = ARRAY['followers']
WHERE audience = 'followers'
  AND (distribution_targets = '{}' OR distribution_targets IS NULL);

-- Connections posts get 'connections'
UPDATE "public"."Post"
SET distribution_targets = ARRAY['connections']
WHERE audience = 'connections'
  AND (distribution_targets = '{}' OR distribution_targets IS NULL);

-- Network posts get both followers + connections
UPDATE "public"."Post"
SET distribution_targets = ARRAY['followers', 'connections']
WHERE audience = 'network'
  AND (distribution_targets = '{}' OR distribution_targets IS NULL);

-- Household posts stay empty (not public feed surface)
-- No update needed for household audience

-- ─── 4. GRANTS ──────────────────────────────────────────────

GRANT ALL ON TABLE "public"."Post" TO "authenticated";
GRANT ALL ON TABLE "public"."Post" TO "service_role";
