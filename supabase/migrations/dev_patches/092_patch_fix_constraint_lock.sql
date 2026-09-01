-- DEV PATCH: Fix 092_payment_transfer_status_values.sql constraint locking
--
-- Run this on development databases that already applied the original 092
-- migration. The original ADD CONSTRAINT (without NOT VALID) took an
-- ACCESS EXCLUSIVE lock for the full validation scan. This patch drops
-- and re-adds the constraint using NOT VALID + VALIDATE to match the
-- production-safe version.
--
-- This is idempotent — safe to run multiple times.

-- 1. Drop the constraint that was added with the full-table lock.
ALTER TABLE "public"."Payment"
  DROP CONSTRAINT IF EXISTS "Payment_transfer_status_check";

-- 2. Re-add as NOT VALID (no scan, brief metadata lock).
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

-- 3. Validate existing rows with a weaker SHARE UPDATE EXCLUSIVE lock.
ALTER TABLE "public"."Payment"
  VALIDATE CONSTRAINT "Payment_transfer_status_check";
