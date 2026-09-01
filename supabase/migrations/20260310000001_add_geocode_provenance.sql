-- Migration: Add geocode provenance metadata to all location-storing tables
-- Purpose: Enable auditing of where each stored coordinate came from
-- All columns are NULLable so existing rows are unaffected (backfill later)

-- ============================================================
-- 1. Home — stores household address + map center
-- ============================================================
ALTER TABLE "public"."Home"
  ADD COLUMN IF NOT EXISTS "geocode_provider"    text,
  ADD COLUMN IF NOT EXISTS "geocode_mode"        text,
  ADD COLUMN IF NOT EXISTS "geocode_accuracy"    text,
  ADD COLUMN IF NOT EXISTS "geocode_place_id"    text,
  ADD COLUMN IF NOT EXISTS "geocode_created_at"  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "geocode_source_flow" text;

COMMENT ON COLUMN "public"."Home"."geocode_provider"    IS 'Geocoding vendor: mapbox, google_validation, smarty, nominatim, manual';
COMMENT ON COLUMN "public"."Home"."geocode_mode"        IS 'Geocode lifecycle: verified, permanent, temporary';
COMMENT ON COLUMN "public"."Home"."geocode_accuracy"    IS 'Geocode precision: rooftop, address, street, city';
COMMENT ON COLUMN "public"."Home"."geocode_place_id"    IS 'Vendor-specific place ID for audit trail';
COMMENT ON COLUMN "public"."Home"."geocode_source_flow" IS 'App flow that produced this geocode: home_onboarding, home_edit, etc.';

-- ============================================================
-- 2. HomeAddress — canonical normalized address with geocode
-- ============================================================
ALTER TABLE "public"."HomeAddress"
  ADD COLUMN IF NOT EXISTS "geocode_provider"    text,
  ADD COLUMN IF NOT EXISTS "geocode_mode"        text,
  ADD COLUMN IF NOT EXISTS "geocode_accuracy"    text,
  ADD COLUMN IF NOT EXISTS "geocode_place_id"    text,
  ADD COLUMN IF NOT EXISTS "geocode_created_at"  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "geocode_source_flow" text;

-- ============================================================
-- 3. BusinessLocation — business address geocodes
-- ============================================================
ALTER TABLE "public"."BusinessLocation"
  ADD COLUMN IF NOT EXISTS "geocode_provider"    text,
  ADD COLUMN IF NOT EXISTS "geocode_mode"        text,
  ADD COLUMN IF NOT EXISTS "geocode_accuracy"    text,
  ADD COLUMN IF NOT EXISTS "geocode_place_id"    text,
  ADD COLUMN IF NOT EXISTS "geocode_created_at"  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "geocode_source_flow" text;

-- ============================================================
-- 3b. BusinessAddress — canonical validated business addresses
-- ============================================================
ALTER TABLE "public"."BusinessAddress"
  ADD COLUMN IF NOT EXISTS "geocode_provider"    text,
  ADD COLUMN IF NOT EXISTS "geocode_mode"        text,
  ADD COLUMN IF NOT EXISTS "geocode_accuracy"    text,
  ADD COLUMN IF NOT EXISTS "geocode_place_id"    text,
  ADD COLUMN IF NOT EXISTS "geocode_created_at"  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "geocode_source_flow" text;

-- ============================================================
-- 4. SeededBusiness — pre-loaded business directory entries
-- ============================================================
ALTER TABLE "public"."SeededBusiness"
  ADD COLUMN IF NOT EXISTS "geocode_provider"    text,
  ADD COLUMN IF NOT EXISTS "geocode_mode"        text,
  ADD COLUMN IF NOT EXISTS "geocode_accuracy"    text,
  ADD COLUMN IF NOT EXISTS "geocode_place_id"    text,
  ADD COLUMN IF NOT EXISTS "geocode_created_at"  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "geocode_source_flow" text;

-- ============================================================
-- 5. Gig — task locations (exact, approx, pickup, dropoff)
-- ============================================================
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "geocode_provider"    text,
  ADD COLUMN IF NOT EXISTS "geocode_mode"        text,
  ADD COLUMN IF NOT EXISTS "geocode_accuracy"    text,
  ADD COLUMN IF NOT EXISTS "geocode_place_id"    text,
  ADD COLUMN IF NOT EXISTS "geocode_created_at"  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "geocode_source_flow" text;

-- ============================================================
-- 6. GigPrivateLocation — exact location revealed to assignee
-- ============================================================
ALTER TABLE "public"."GigPrivateLocation"
  ADD COLUMN IF NOT EXISTS "geocode_provider"    text,
  ADD COLUMN IF NOT EXISTS "geocode_mode"        text,
  ADD COLUMN IF NOT EXISTS "geocode_accuracy"    text,
  ADD COLUMN IF NOT EXISTS "geocode_place_id"    text,
  ADD COLUMN IF NOT EXISTS "geocode_created_at"  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "geocode_source_flow" text;

-- ============================================================
-- 7. Listing — marketplace item locations
-- ============================================================
ALTER TABLE "public"."Listing"
  ADD COLUMN IF NOT EXISTS "geocode_provider"    text,
  ADD COLUMN IF NOT EXISTS "geocode_mode"        text,
  ADD COLUMN IF NOT EXISTS "geocode_accuracy"    text,
  ADD COLUMN IF NOT EXISTS "geocode_place_id"    text,
  ADD COLUMN IF NOT EXISTS "geocode_created_at"  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "geocode_source_flow" text;

-- ============================================================
-- 8. Post — feed post locations
-- ============================================================
ALTER TABLE "public"."Post"
  ADD COLUMN IF NOT EXISTS "geocode_provider"    text,
  ADD COLUMN IF NOT EXISTS "geocode_mode"        text,
  ADD COLUMN IF NOT EXISTS "geocode_accuracy"    text,
  ADD COLUMN IF NOT EXISTS "geocode_place_id"    text,
  ADD COLUMN IF NOT EXISTS "geocode_created_at"  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "geocode_source_flow" text;

-- ============================================================
-- 9. UserPlace — user's saved places (work, gym, etc.)
-- ============================================================
ALTER TABLE "public"."UserPlace"
  ADD COLUMN IF NOT EXISTS "geocode_provider"    text,
  ADD COLUMN IF NOT EXISTS "geocode_mode"        text,
  ADD COLUMN IF NOT EXISTS "geocode_accuracy"    text,
  ADD COLUMN IF NOT EXISTS "geocode_place_id"    text,
  ADD COLUMN IF NOT EXISTS "geocode_created_at"  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "geocode_source_flow" text;

-- ============================================================
-- 10. SavedPlace — cached location search results
-- ============================================================
ALTER TABLE "public"."SavedPlace"
  ADD COLUMN IF NOT EXISTS "geocode_provider"    text,
  ADD COLUMN IF NOT EXISTS "geocode_mode"        text,
  ADD COLUMN IF NOT EXISTS "geocode_accuracy"    text,
  ADD COLUMN IF NOT EXISTS "geocode_place_id"    text,
  ADD COLUMN IF NOT EXISTS "geocode_created_at"  timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "geocode_source_flow" text;
