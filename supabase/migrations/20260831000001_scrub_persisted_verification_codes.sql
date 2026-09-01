-- Migration 185: Remove plaintext verification codes from MailVerificationJob
--
-- SECURITY. `startVerification` used to write the plaintext mail-verification
-- code into `MailVerificationJob.metadata` alongside the SHA-256 `code_hash`
-- kept in `AddressVerificationToken`. RLS policy `mail_verif_job_select_own`
-- (migration 070) grants the requesting user SELECT on their own
-- MailVerificationJob row, and migration 070 additionally does
-- `GRANT ALL ON TABLE "MailVerificationJob" TO "authenticated"`.
--
-- The combination let a claimant read their own verification code straight out
-- of the database and confirm an address they had never received mail at,
-- defeating mail verification entirely for any address.
--
-- The application no longer persists the code (it is passed to the mail vendor
-- in memory). This migration removes the codes that were already written.

BEGIN;

UPDATE "MailVerificationJob"
   SET "metadata" = "metadata" - 'code'
 WHERE "metadata" ? 'code';

-- Belt and braces: revoke the blanket grants. Reads continue to work through
-- the existing RLS policies; nothing in the application uses the anon or
-- authenticated role for this table (all access is via the service role).
REVOKE ALL ON TABLE "MailVerificationJob" FROM "anon";
REVOKE ALL ON TABLE "AddressVerificationToken" FROM "anon";
REVOKE ALL ON TABLE "AddressVerificationAttempt" FROM "anon";

COMMIT;
