-- ============================================================
-- 099: GigBid pending_payment support
-- Adds columns to track the intermediate state when a bid is
-- accepted but payment authorization is still in progress.
-- ============================================================

ALTER TABLE "public"."GigBid"
  ADD COLUMN IF NOT EXISTS "pending_payment_expires_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "pending_payment_intent_id" text;

COMMENT ON COLUMN "public"."GigBid"."pending_payment_expires_at" IS 'When the pending_payment state expires and reverts to pending';
COMMENT ON COLUMN "public"."GigBid"."pending_payment_intent_id" IS 'Stripe PaymentIntent or SetupIntent ID created during payment authorization';
