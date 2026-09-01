-- ============================================================
-- Migration 074: Marketplace Browse Redesign — Cursor Indexes
-- ============================================================
-- Adds composite indexes for keyset cursor pagination on the Listing table.
-- These support the new /api/listings/browse endpoint which replaces the
-- fragmented RPC-based /nearby and /in-bounds endpoints.
--
-- Existing index: idx_listing_location (gist on location geography column)
-- already covers spatial queries. No new PostGIS index needed.

-- Composite index for default (newest) sort cursor pagination
CREATE INDEX IF NOT EXISTS idx_listing_browse_cursor_newest
  ON "public"."Listing" (created_at DESC, id DESC)
  WHERE status = 'active' AND archived_at IS NULL;

-- Composite index for price_low sort cursor pagination
CREATE INDEX IF NOT EXISTS idx_listing_browse_cursor_price_asc
  ON "public"."Listing" (price ASC NULLS LAST, id ASC)
  WHERE status = 'active' AND archived_at IS NULL;

-- Composite index for price_high sort cursor pagination
CREATE INDEX IF NOT EXISTS idx_listing_browse_cursor_price_desc
  ON "public"."Listing" (price DESC NULLS LAST, id DESC)
  WHERE status = 'active' AND archived_at IS NULL;

-- Partial index for bounding box queries on lat/lng (non-null only)
-- Complements the existing gist index on the geography column
CREATE INDEX IF NOT EXISTS idx_listing_browse_latlon
  ON "public"."Listing" (latitude, longitude)
  WHERE status = 'active' AND archived_at IS NULL
    AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index for free items (used by discover free_nearby section)
CREATE INDEX IF NOT EXISTS idx_listing_browse_free
  ON "public"."Listing" (is_free, created_at DESC)
  WHERE status = 'active' AND archived_at IS NULL AND is_free = true;

-- Index for wanted items (used by discover wanted_nearby section)
CREATE INDEX IF NOT EXISTS idx_listing_browse_wanted
  ON "public"."Listing" (is_wanted, created_at DESC)
  WHERE status = 'active' AND archived_at IS NULL AND is_wanted = true;
