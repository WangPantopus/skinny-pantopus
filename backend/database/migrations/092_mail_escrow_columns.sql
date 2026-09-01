-- Migration: 092_mail_escrow_columns
-- Adds escrow-related columns to Mail table for non-user mail delivery.
-- When a mail is sent to a non-Pantopus user (via email/phone), it is held
-- in escrow until the recipient claims it via a unique token link.

ALTER TABLE "public"."Mail"
  ADD COLUMN IF NOT EXISTS "escrow_recipient_contact" text,
  ADD COLUMN IF NOT EXISTS "escrow_status" text DEFAULT NULL
    CHECK ("escrow_status" IS NULL OR "escrow_status" IN ('pending', 'claimed', 'expired', 'withdrawn')),
  ADD COLUMN IF NOT EXISTS "escrow_expires_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "escrow_claim_token" text;

-- Index for looking up pending escrow mail by contact (phone/email)
CREATE INDEX IF NOT EXISTS "idx_mail_escrow_contact"
  ON "public"."Mail" ("escrow_recipient_contact")
  WHERE "escrow_recipient_contact" IS NOT NULL;

-- Index for expiration sweeper job
CREATE INDEX IF NOT EXISTS "idx_mail_escrow_pending_expires"
  ON "public"."Mail" ("escrow_expires_at")
  WHERE "escrow_status" = 'pending';
