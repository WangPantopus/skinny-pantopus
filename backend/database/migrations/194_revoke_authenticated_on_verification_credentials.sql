-- Migration 194: take the verification-credential tables away from the
-- `authenticated` role.
--
-- Migration 185 closed the plaintext half of the mail-code bypass (the code was
-- being written into MailVerificationJob.metadata, which the claimant could read
-- back) but revoked only `anon`. Migration 070 still stands:
--
--   GRANT ALL ON TABLE "AddressVerificationToken" TO "authenticated";
--
-- together with policy `addr_verif_token_select_own`, which grants the requester
-- SELECT on their own token row. That row holds `code_hash` — an UNSALTED
-- SHA-256 over a six-digit code. A 900,000-entry rainbow table is built in well
-- under a second, so possession of the hash is possession of the code, and the
-- bypass 160 was written to close survives verbatim on the sibling table.
--
-- Migration 187 introduced the same shape on the legacy path that iOS and
-- Android actually use: it replaced HomePostcardCode's cleartext column with a
-- hash and then re-granted SELECT to `authenticated` under the comment "the hash
-- is never useful to them". For an unsalted SHA-256 of a six-digit code, it is.
--
-- Nothing in the application reads any of these tables as `anon` or
-- `authenticated`: every access goes through supabaseAdmin (the service role),
-- which is exempt from both grants and RLS. Migration 185's own header says as
-- much. The pending-postcard status a user is meant to see is already served
-- server-side by routes/homeIam.js, which selects only expires_at.
--
-- Revoking the grant is the control; the policies are dropped too so nothing
-- reads as though a client path were still intended.

BEGIN;

-- ── Mail-code channel (migration 070) ─────────────────────────
DROP POLICY IF EXISTS "addr_verif_token_select_own" ON "AddressVerificationToken";
DROP POLICY IF EXISTS "mail_verif_job_select_own" ON "MailVerificationJob";

REVOKE ALL ON TABLE "AddressVerificationToken" FROM "authenticated";
REVOKE ALL ON TABLE "MailVerificationJob" FROM "authenticated";

-- The attempt row carries no credential material, but it is only ever read
-- through the service role too, and leaving a blanket GRANT ALL on it lets a
-- client UPDATE its own attempt_count and status.
REVOKE ALL ON TABLE "AddressVerificationAttempt" FROM "authenticated";

-- ── Legacy postcard channel (migrations 036 / 162) ────────────
DROP POLICY IF EXISTS "home_postcard_code_select_own" ON "public"."HomePostcardCode";

REVOKE ALL ON TABLE "public"."HomePostcardCode" FROM "authenticated";

-- The service role keeps everything it had.
GRANT ALL ON TABLE "AddressVerificationToken" TO "service_role";
GRANT ALL ON TABLE "MailVerificationJob" TO "service_role";
GRANT ALL ON TABLE "AddressVerificationAttempt" TO "service_role";
GRANT ALL ON TABLE "public"."HomePostcardCode" TO "service_role";

COMMIT;
