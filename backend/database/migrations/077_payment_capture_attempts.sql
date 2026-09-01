-- ============================================================
-- MIGRATION 077: Add capture_attempts counter to Payment
--
-- Tracks the number of times capturePayment has been called for
-- a given payment. Used by the retryCaptureFailures job to stop
-- retrying after 3 failed attempts.
-- ============================================================

ALTER TABLE "public"."Payment"
  ADD COLUMN IF NOT EXISTS "capture_attempts" integer NOT NULL DEFAULT 0;
