-- Migration 107: Add HomeAddress.google_verdict
--
-- canonicalAddressService persists a compact Google validation verdict summary
-- so stored-address rechecks can reconstruct the same decision inputs later.
-- Some environments are missing this column because earlier migrations never
-- introduced it explicitly.

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "google_verdict" jsonb DEFAULT '{}'::jsonb;
