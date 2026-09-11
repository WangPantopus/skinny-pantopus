-- Migration 189: Residency letters — expiry, and row level security
--
-- A residency letter is a server-attested, publicly-verifiable credential that
-- is consumed OUTSIDE our trust boundary, by landlords, schools and the DMV. It
-- carries the resident's legal name and full street address.
--
-- As shipped it had no expiry, could be revoked only by its issuer, kept
-- reporting valid:true after revocation, and the table had no RLS while
-- migration 157 granted the anon and authenticated roles blanket access
-- (audit 2026-08-22, SEC-10/LIF-06).

BEGIN;

-- ── Expiry ────────────────────────────────────────────────────
ALTER TABLE "public"."ResidencyLetter"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;

-- Why a letter was revoked (manual, residency_ended, ...), for the audit trail.
ALTER TABLE "public"."ResidencyLetter"
  ADD COLUMN IF NOT EXISTS "revoke_reason" text;

-- Letters issued before this migration get a 90-day life from issuance.
UPDATE "public"."ResidencyLetter"
   SET "expires_at" = "issued_at" + interval '90 days'
 WHERE "expires_at" IS NULL;

-- ── 'expired' becomes a representable state ───────────────────
ALTER TABLE "public"."ResidencyLetter"
  DROP CONSTRAINT IF EXISTS "ResidencyLetter_status_check";

ALTER TABLE "public"."ResidencyLetter"
  ADD CONSTRAINT "ResidencyLetter_status_check"
  CHECK ("status" IN ('issued', 'revoked', 'expired'));

CREATE INDEX IF NOT EXISTS "idx_residency_letter_expires"
  ON "public"."ResidencyLetter" ("expires_at")
  WHERE "status" = 'issued';

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE "public"."ResidencyLetter" ENABLE ROW LEVEL SECURITY;

-- A resident may see their own letters. Public verification goes through the
-- service role, which applies the status and expiry rules; it must never be a
-- direct table read.
DROP POLICY IF EXISTS "residency_letter_select_own" ON "public"."ResidencyLetter";
CREATE POLICY "residency_letter_select_own"
  ON "public"."ResidencyLetter"
  FOR SELECT TO "authenticated"
  USING ("user_id" = "auth"."uid"());

DROP POLICY IF EXISTS "residency_letter_service" ON "public"."ResidencyLetter";
CREATE POLICY "residency_letter_service"
  ON "public"."ResidencyLetter"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE "public"."ResidencyLetter" FROM "anon";
REVOKE ALL ON TABLE "public"."ResidencyLetter" FROM "authenticated";
GRANT SELECT ON TABLE "public"."ResidencyLetter" TO "authenticated";
GRANT ALL ON TABLE "public"."ResidencyLetter" TO "service_role";

COMMIT;
