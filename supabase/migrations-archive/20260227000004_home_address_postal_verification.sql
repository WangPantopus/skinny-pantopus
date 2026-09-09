-- Migration: HomeAddress Postal Verification Fields
--
-- Extends the HomeAddress table with postal-grade verification and
-- classification columns required by the Address Verification & Classification
-- System (design doc v1.0).
--
-- New columns:
--   1. postal_code_plus4       — ZIP+4 for precise delivery point
--   2. dpv_match_code          — USPS Delivery Point Validation match code
--   3. rdi_type                — Residential Delivery Indicator
--   4. missing_secondary_flag  — multi-unit building missing unit number
--   5. commercial_mailbox_flag — CMRA (Commercial Mail Receiving Agency) flag
--   6. deliverability_status   — overall deliverability verdict
--   7. parcel_type             — land-use classification
--   8. building_type           — structural classification
--   9. google_place_types      — Google Places API type tags
--  10. validation_vendor       — which vendor last validated this address
--  11. last_validated_at       — when the address was last validated
--  12. validation_raw_response — raw vendor response for debugging/audit
--  13. geocode_granularity     — precision level from geocoding

-- ============================================================
-- 1. ZIP+4 for precise delivery point identification
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "postal_code_plus4" text;

-- ============================================================
-- 2. USPS DPV match code from postal verification vendor
--    Values like 'Y' (confirmed), 'D' (confirmed missing secondary),
--    'S' (confirmed by dropping secondary), 'N' (not confirmed)
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "dpv_match_code" text;

-- ============================================================
-- 3. Residential Delivery Indicator from USPS-licensed vendor
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "rdi_type" text DEFAULT 'unknown'
    CONSTRAINT "HomeAddress_rdi_type_chk"
    CHECK ("rdi_type" IN ('residential', 'business', 'unknown'));

-- ============================================================
-- 4. Whether the address is a multi-unit building missing a
--    unit/apartment number. Hard-blocks home creation.
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "missing_secondary_flag" boolean DEFAULT false;

-- ============================================================
-- 5. Commercial Mail Receiving Agency flag (e.g., UPS Store,
--    PO Box services). These are not valid residential addresses.
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "commercial_mailbox_flag" boolean DEFAULT false;

-- ============================================================
-- 6. Overall deliverability status from validation pipeline
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "deliverability_status" text DEFAULT 'unverified'
    CONSTRAINT "HomeAddress_deliverability_status_chk"
    CHECK ("deliverability_status" IN ('deliverable', 'undeliverable', 'partial', 'unverified'));

-- ============================================================
-- 7. Land-use / parcel classification from county data or
--    place type inference
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "parcel_type" text DEFAULT 'unknown'
    CONSTRAINT "HomeAddress_parcel_type_chk"
    CHECK ("parcel_type" IN ('residential', 'commercial', 'mixed', 'unknown'));

-- ============================================================
-- 8. Structural building classification
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "building_type" text DEFAULT 'unknown'
    CONSTRAINT "HomeAddress_building_type_chk"
    CHECK ("building_type" IN ('single_family', 'multi_unit', 'commercial', 'unknown'));

-- ============================================================
-- 9. Google Places API type tags (e.g., 'restaurant', 'store',
--    'point_of_interest'). Stored as text array for flexibility.
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "google_place_types" text[];

-- ============================================================
-- 10. Which vendor last validated this address
--     (e.g., 'google', 'smarty', 'melissa')
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "validation_vendor" text;

-- ============================================================
-- 11. Timestamp of last successful validation
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "last_validated_at" timestamptz;

-- ============================================================
-- 12. Raw vendor response for debugging and audit trail
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "validation_raw_response" jsonb DEFAULT '{}';

-- ============================================================
-- 13. Geocode precision level (e.g., 'ROOFTOP', 'RANGE_INTERPOLATED',
--     'GEOMETRIC_CENTER', 'APPROXIMATE')
-- ============================================================
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "geocode_granularity" text;

-- ============================================================
-- 14. Indexes for common query patterns
-- ============================================================

-- Filter addresses by residential vs business classification
CREATE INDEX IF NOT EXISTS idx_home_address_rdi_type
  ON "HomeAddress" ("rdi_type")
  WHERE "rdi_type" != 'unknown';

-- Filter addresses by deliverability status
CREATE INDEX IF NOT EXISTS idx_home_address_deliverability_status
  ON "HomeAddress" ("deliverability_status")
  WHERE "deliverability_status" != 'unverified';
