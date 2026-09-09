-- ============================================================
-- LISTING V2 EXTENSIONS
--
-- Adds trade, food/homemade, recurring, and pre-order columns
-- to the Listing table. Creates SavedSearch, ListingInteraction,
-- and DiscoveryCache supporting tables.
-- ============================================================

-- ─── Listing table new columns ───────────────────────────────

-- Trade support
ALTER TABLE "public"."Listing"
  ADD COLUMN IF NOT EXISTS "open_to_trades" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "trade_preferences" text;

-- Food & homemade support
ALTER TABLE "public"."Listing"
  ADD COLUMN IF NOT EXISTS "ingredients" text[],
  ADD COLUMN IF NOT EXISTS "allergens" text[],
  ADD COLUMN IF NOT EXISTS "preparation_date" date,
  ADD COLUMN IF NOT EXISTS "best_by_date" date,
  ADD COLUMN IF NOT EXISTS "food_handler_certified" boolean DEFAULT false;

-- Recurring listing support
ALTER TABLE "public"."Listing"
  ADD COLUMN IF NOT EXISTS "is_recurring" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recurrence_schedule" jsonb;

-- Pre-order support
ALTER TABLE "public"."Listing"
  ADD COLUMN IF NOT EXISTS "is_preorder" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "preorder_deadline" timestamptz,
  ADD COLUMN IF NOT EXISTS "preorder_fulfillment_date" date;

-- Interest / offer tracking
ALTER TABLE "public"."Listing"
  ADD COLUMN IF NOT EXISTS "active_offer_count" integer DEFAULT 0;

-- Image variants (for resize pipeline)
ALTER TABLE "public"."Listing"
  ADD COLUMN IF NOT EXISTS "media_thumbnails" text[];

-- ─── Listing partial indexes ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_listing_open_to_trades
  ON "public"."Listing" ("open_to_trades")
  WHERE "open_to_trades" = true AND "status" = 'active';

CREATE INDEX IF NOT EXISTS idx_listing_is_recurring
  ON "public"."Listing" ("is_recurring")
  WHERE "is_recurring" = true AND "status" = 'active';

CREATE INDEX IF NOT EXISTS idx_listing_is_preorder
  ON "public"."Listing" ("is_preorder")
  WHERE "is_preorder" = true AND "status" = 'active';

-- ─── SavedSearch ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."SavedSearch" (
  "id"                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id"             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "label"               text,
  "query"               text,
  "filters"             jsonb NOT NULL DEFAULT '{}',
  "notify_new_matches"  boolean DEFAULT true,
  "last_matched_at"     timestamptz,
  "created_at"          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_search_user
  ON "public"."SavedSearch" ("user_id");

CREATE INDEX IF NOT EXISTS idx_saved_search_notify
  ON "public"."SavedSearch" ("notify_new_matches")
  WHERE "notify_new_matches" = true;

ALTER TABLE "public"."SavedSearch" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own saved searches"
  ON "public"."SavedSearch" FOR ALL
  USING (auth.uid() = "user_id");

-- ─── ListingInteraction ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."ListingInteraction" (
  "id"                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "listing_id"        uuid NOT NULL REFERENCES "public"."Listing"("id") ON DELETE CASCADE,
  "user_id"           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "interaction_type"  text NOT NULL CHECK ("interaction_type" IN ('view', 'save', 'offer', 'share', 'question')),
  "created_at"        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interaction_listing
  ON "public"."ListingInteraction" ("listing_id");

CREATE INDEX IF NOT EXISTS idx_interaction_user
  ON "public"."ListingInteraction" ("user_id");

CREATE INDEX IF NOT EXISTS idx_interaction_type_time
  ON "public"."ListingInteraction" ("interaction_type", "created_at" DESC);

ALTER TABLE "public"."ListingInteraction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own interactions"
  ON "public"."ListingInteraction" FOR SELECT
  USING (auth.uid() = "user_id");

CREATE POLICY "Users can create interactions"
  ON "public"."ListingInteraction" FOR INSERT
  WITH CHECK (auth.uid() = "user_id");

-- ─── DiscoveryCache ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."DiscoveryCache" (
  "geohash_prefix"  text NOT NULL,
  "section_key"     text NOT NULL,
  "payload"         jsonb NOT NULL,
  "computed_at"     timestamptz NOT NULL DEFAULT now(),
  "expires_at"      timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
  PRIMARY KEY ("geohash_prefix", "section_key")
);

CREATE INDEX IF NOT EXISTS idx_discovery_cache_expires
  ON "public"."DiscoveryCache" ("expires_at");

-- RLS: server-only cache — block all client access
ALTER TABLE "public"."DiscoveryCache" ENABLE ROW LEVEL SECURITY;
