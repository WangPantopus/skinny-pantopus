-- Migration 066: HomeAddress Postal Verification Fields
--
-- Extends the HomeAddress table with postal-grade verification and
-- classification columns required by the Address Verification & Classification
-- System (design doc v1.0).
--
-- New columns:
--   postal_code_plus4, dpv_match_code, rdi_type, missing_secondary_flag,
--   commercial_mailbox_flag, deliverability_status, parcel_type, building_type,
--   google_place_types, validation_vendor, last_validated_at,
--   validation_raw_response, geocode_granularity
--
-- New indexes:
--   idx_home_address_rdi_type, idx_home_address_deliverability_status

-- 1) Add postal verification columns
ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "postal_code_plus4" text;

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "dpv_match_code" text;

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "rdi_type" text DEFAULT 'unknown'
    CONSTRAINT "HomeAddress_rdi_type_chk"
    CHECK ("rdi_type" IN ('residential', 'business', 'unknown'));

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "missing_secondary_flag" boolean DEFAULT false;

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "commercial_mailbox_flag" boolean DEFAULT false;

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "deliverability_status" text DEFAULT 'unverified'
    CONSTRAINT "HomeAddress_deliverability_status_chk"
    CHECK ("deliverability_status" IN ('deliverable', 'undeliverable', 'partial', 'unverified'));

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "parcel_type" text DEFAULT 'unknown'
    CONSTRAINT "HomeAddress_parcel_type_chk"
    CHECK ("parcel_type" IN ('residential', 'commercial', 'mixed', 'unknown'));

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "building_type" text DEFAULT 'unknown'
    CONSTRAINT "HomeAddress_building_type_chk"
    CHECK ("building_type" IN ('single_family', 'multi_unit', 'commercial', 'unknown'));

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "google_place_types" text[];

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "validation_vendor" text;

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "last_validated_at" timestamptz;

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "validation_raw_response" jsonb DEFAULT '{}';

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "geocode_granularity" text;

-- 2) Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_home_address_rdi_type
  ON "HomeAddress" ("rdi_type")
  WHERE "rdi_type" != 'unknown';

CREATE INDEX IF NOT EXISTS idx_home_address_deliverability_status
  ON "HomeAddress" ("deliverability_status")
  WHERE "deliverability_status" != 'unverified';
