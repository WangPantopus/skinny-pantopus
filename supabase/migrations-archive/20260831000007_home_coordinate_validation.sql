-- Migration 191: Home.coordinate_validation
--
-- jobs/validateHomeCoordinates.js reverse-geocodes newly created homes and
-- compares the result against the stored address, to catch a home whose pin
-- does not match where it says it is. It filters and writes
-- `Home.coordinate_validation` — a column that appears in that one file and in
-- no migration and no schema (audit 2026-08-22, CRIT-04).
--
-- The job's own error handler recognised exactly this condition and returned
-- silently at info level ("schema not yet added — skipping"), so it has never
-- validated a home, fires ~17,500 times a year doing nothing, and reads as a
-- healthy control in the job registry.
--
-- This is also the backstop for CRIT-05: PATCH /api/homes/:id no longer stamps
-- client-supplied coordinates as verified, but a user-asserted pin that
-- disagrees with its address still needs to be caught.

ALTER TABLE "public"."Home"
  ADD COLUMN IF NOT EXISTS "coordinate_validation" text;

COMMENT ON COLUMN "public"."Home"."coordinate_validation" IS
  'Result of the reverse-geocode consistency check: null (unchecked), valid, '
  'missing_coordinates, outside_us, or flagged:<reason>.';

-- Partial index for the job's "not yet validated" scan.
CREATE INDEX IF NOT EXISTS "idx_home_coordinate_validation_pending"
  ON "public"."Home" ("created_at")
  WHERE "coordinate_validation" IS NULL;
