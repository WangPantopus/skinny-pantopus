-- Migration 032: Add optional lot_sq_ft to Home (lot size in square feet)
-- Pantopus — Add Home / Edit Home optional lot size

BEGIN;

ALTER TABLE "public"."Home"
  ADD COLUMN IF NOT EXISTS "lot_sq_ft" integer;

COMMENT ON COLUMN "public"."Home"."lot_sq_ft" IS 'Lot size in square feet (optional).';

COMMIT;
