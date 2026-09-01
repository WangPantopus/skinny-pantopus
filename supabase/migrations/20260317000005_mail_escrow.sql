-- ============================================================
-- Mail Escrow: support sending mail to non-Pantopus users
-- Adds escrow columns + claim token to the Mail table.
-- ============================================================

-- Escrow fields on the Mail table
ALTER TABLE "Mail"
  ADD COLUMN IF NOT EXISTS escrow_recipient_contact TEXT,
  ADD COLUMN IF NOT EXISTS escrow_status TEXT
    CHECK (escrow_status IS NULL OR escrow_status IN ('pending', 'claimed', 'expired', 'withdrawn')),
  ADD COLUMN IF NOT EXISTS escrow_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escrow_claim_token TEXT;

-- Index for looking up escrowed mail by claim token
CREATE INDEX IF NOT EXISTS idx_mail_escrow_claim_token
  ON "Mail" (escrow_claim_token)
  WHERE escrow_claim_token IS NOT NULL;

-- Index for looking up escrowed mail by recipient contact
CREATE INDEX IF NOT EXISTS idx_mail_escrow_recipient_contact
  ON "Mail" (escrow_recipient_contact, escrow_status)
  WHERE escrow_recipient_contact IS NOT NULL;

-- Index for rate-limit queries (sender + escrow contact + created_at)
CREATE INDEX IF NOT EXISTS idx_mail_escrow_sender_rate_limit
  ON "Mail" (sender_user_id, escrow_recipient_contact, created_at)
  WHERE escrow_recipient_contact IS NOT NULL;
