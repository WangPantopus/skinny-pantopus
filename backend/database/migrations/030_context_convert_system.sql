-- ============================================================
-- MIGRATION: Context + Convert System
-- Adds: SavedPlace table, Gig items/source columns, Listing source columns
-- Run this on Supabase before deploying the mobile app update.
-- ============================================================

-- 1. SavedPlace table
CREATE TABLE IF NOT EXISTS "public"."SavedPlace" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "place_type" text NOT NULL DEFAULT 'searched',
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "city" text,
  "state" text,
  "source_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  UNIQUE("user_id", "latitude", "longitude")
);

ALTER TABLE "public"."SavedPlace" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved places"
  ON "public"."SavedPlace" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved places"
  ON "public"."SavedPlace" FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved places"
  ON "public"."SavedPlace" FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Gig table: items JSONB, source link columns, ref_post_id
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "items" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "source_type" text,
  ADD COLUMN IF NOT EXISTS "source_id" uuid,
  ADD COLUMN IF NOT EXISTS "ref_post_id" uuid;

COMMENT ON COLUMN "public"."Gig"."items" IS 'Optional item details for errand/pickup tasks. Array of {name, notes, budgetCap, preferredStore}';
COMMENT ON COLUMN "public"."Gig"."source_type" IS 'Type of source object this task was created from: listing, post, event';
COMMENT ON COLUMN "public"."Gig"."source_id" IS 'ID of the source object this task was created from';
COMMENT ON COLUMN "public"."Gig"."ref_post_id" IS 'Reference to a Post that this task was created from';

DO $$ BEGIN
  ALTER TABLE "public"."Gig"
    ADD CONSTRAINT "gig_source_type_check"
    CHECK (source_type IS NULL OR source_type IN ('listing', 'post', 'event'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Listing table: source link columns
ALTER TABLE "public"."Listing"
  ADD COLUMN IF NOT EXISTS "source_type" text,
  ADD COLUMN IF NOT EXISTS "source_id" uuid;

COMMENT ON COLUMN "public"."Listing"."source_type" IS 'Type of source object this listing was created from: gig, post';
COMMENT ON COLUMN "public"."Listing"."source_id" IS 'ID of the source object this listing was created from';

DO $$ BEGIN
  ALTER TABLE "public"."Listing"
    ADD CONSTRAINT "listing_source_type_check"
    CHECK (source_type IS NULL OR source_type IN ('gig', 'post'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Index for fast saved-place lookup
CREATE INDEX IF NOT EXISTS "idx_saved_place_user" ON "public"."SavedPlace" ("user_id");

-- 5. Index for source lookups on Gig
CREATE INDEX IF NOT EXISTS "idx_gig_source" ON "public"."Gig" ("source_type", "source_id") WHERE source_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_gig_ref_listing" ON "public"."Gig" ("ref_listing_id") WHERE ref_listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_gig_ref_post" ON "public"."Gig" ("ref_post_id") WHERE ref_post_id IS NOT NULL;
