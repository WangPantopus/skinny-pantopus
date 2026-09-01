-- Allow transfer statuses written by runtime jobs/webhooks.
-- Keeps DB constraint aligned with application logic.
--
-- Uses NOT VALID + VALIDATE to avoid ACCESS EXCLUSIVE lock during
-- the full-table validation scan. The ADD ... NOT VALID takes a brief
-- ACCESS EXCLUSIVE only to register the constraint metadata (no scan).
-- VALIDATE CONSTRAINT then takes a weaker SHARE UPDATE EXCLUSIVE lock
-- which allows concurrent reads and writes to continue.

-- 1. Drop the old constraint (brief ACCESS EXCLUSIVE, metadata-only).
ALTER TABLE "public"."Payment"
  DROP CONSTRAINT IF EXISTS "Payment_transfer_status_check";

-- 2. Add the new constraint as NOT VALID (brief ACCESS EXCLUSIVE, no scan).
ALTER TABLE "public"."Payment"
  ADD CONSTRAINT "Payment_transfer_status_check"
  CHECK (
    ("transfer_status")::text = ANY (
      ARRAY[
        'pending',
        'in_transit',
        'paid',
        'failed',
        'reversed',
        'wallet_credited',
        'partially_reversed'
      ]::text[]
    )
  )
  NOT VALID;

-- 3. Validate existing rows (SHARE UPDATE EXCLUSIVE — reads/writes not blocked).
ALTER TABLE "public"."Payment"
  VALIDATE CONSTRAINT "Payment_transfer_status_check";
