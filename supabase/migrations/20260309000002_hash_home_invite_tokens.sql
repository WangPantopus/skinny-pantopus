-- ============================================================
-- AUTH-3.1: Hash HomeInvite tokens at rest
--
-- Adds a token_hash column for SHA-256 hashed token lookup.
-- The old plaintext "token" column is kept temporarily for
-- backward compatibility during migration.
-- ============================================================

ALTER TABLE "HomeInvite" ADD COLUMN IF NOT EXISTS token_hash text;

CREATE INDEX IF NOT EXISTS idx_home_invite_token_hash ON "HomeInvite" (token_hash);

-- ── Backfill existing rows (run once after deploying) ───────
-- UPDATE "HomeInvite"
--   SET token_hash = encode(sha256(token::bytea), 'hex')
--   WHERE token IS NOT NULL AND token_hash IS NULL;
--
-- After backfill is verified:
-- ALTER TABLE "HomeInvite" DROP COLUMN token;
