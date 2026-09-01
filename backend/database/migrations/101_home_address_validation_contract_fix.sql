-- Migration 101: Align HomeAddress validation enums and granularity column
--
-- The runtime address-validation pipeline uses:
--   rdi_type      = residential | commercial | unknown
--   building_type = single_family | multi_unit | commercial | mixed_use | unknown
--   geocode_granularity as the persisted Google precision column
--
-- Earlier migrations allowed 'business' for rdi_type, omitted 'mixed_use' for
-- building_type, and some environments may have received an ad hoc
-- google_granularity column from earlier app code. This migration reconciles
-- the DB contract with the live runtime.

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "geocode_granularity" text;

UPDATE "HomeAddress"
SET "rdi_type" = 'commercial'
WHERE "rdi_type" = 'business';

UPDATE "HomeAddress"
SET "building_type" = 'single_family'
WHERE "building_type" = 'residential';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'HomeAddress'
      AND column_name = 'google_granularity'
  ) THEN
    EXECUTE '
      UPDATE "HomeAddress"
      SET "geocode_granularity" = COALESCE("geocode_granularity", "google_granularity")
      WHERE "google_granularity" IS NOT NULL
    ';
    EXECUTE 'ALTER TABLE "HomeAddress" DROP COLUMN "google_granularity"';
  END IF;
END $$;

ALTER TABLE "HomeAddress"
  DROP CONSTRAINT IF EXISTS "HomeAddress_rdi_type_chk";

ALTER TABLE "HomeAddress"
  ADD CONSTRAINT "HomeAddress_rdi_type_chk"
  CHECK ("rdi_type" IN ('residential', 'commercial', 'unknown'));

ALTER TABLE "HomeAddress"
  DROP CONSTRAINT IF EXISTS "HomeAddress_building_type_chk";

ALTER TABLE "HomeAddress"
  ADD CONSTRAINT "HomeAddress_building_type_chk"
  CHECK ("building_type" IN ('single_family', 'multi_unit', 'commercial', 'mixed_use', 'unknown'));
