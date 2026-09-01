-- Migration: Address Verification (Mail) tables
--
-- Replaces and improves on HomePostcardCode with three tables:
--   AddressVerificationAttempt — tracks each verification attempt
--   AddressVerificationToken   — stores hashed codes/QR tokens with rate-limiting
--   MailVerificationJob        — tracks vendor fulfillment (Lob, postGrid, etc.)

-- ============================================================
-- 1. AddressVerificationAttempt
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."AddressVerificationAttempt" (
  "id"          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id"     uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "address_id"  uuid NOT NULL REFERENCES "public"."HomeAddress"("id") ON DELETE CASCADE,
  "method"      text DEFAULT 'mail_code' NOT NULL
    CONSTRAINT "AddressVerificationAttempt_method_chk"
    CHECK ("method" IN ('mail_code', 'landlord_approval', 'doc_upload', 'manual_review')),
  "status"      text DEFAULT 'created' NOT NULL
    CONSTRAINT "AddressVerificationAttempt_status_chk"
    CHECK ("status" IN ('created', 'sent', 'delivered_unknown', 'verified', 'expired', 'canceled', 'locked')),
  "risk_tier"   text DEFAULT 'low' NOT NULL
    CONSTRAINT "AddressVerificationAttempt_risk_tier_chk"
    CHECK ("risk_tier" IN ('low', 'medium', 'high')),
  "expires_at"  timestamptz NOT NULL,
  "created_at"  timestamptz DEFAULT now() NOT NULL,
  "updated_at"  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."AddressVerificationAttempt" OWNER TO "postgres";

-- ============================================================
-- 2. AddressVerificationToken
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."AddressVerificationToken" (
  "id"             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "attempt_id"     uuid NOT NULL REFERENCES "public"."AddressVerificationAttempt"("id") ON DELETE CASCADE,
  "code_hash"      text NOT NULL,
  "qr_token_hash"  text,
  "max_attempts"   integer DEFAULT 5 NOT NULL,
  "attempt_count"  integer DEFAULT 0 NOT NULL,
  "resend_count"   integer DEFAULT 0 NOT NULL,
  "cooldown_until" timestamptz,
  "used_at"        timestamptz,
  "created_at"     timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."AddressVerificationToken" OWNER TO "postgres";

-- ============================================================
-- 3. MailVerificationJob
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."MailVerificationJob" (
  "id"             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "attempt_id"     uuid NOT NULL REFERENCES "public"."AddressVerificationAttempt"("id") ON DELETE CASCADE,
  "vendor"         text NOT NULL,
  "template_id"    text,
  "vendor_job_id"  text,
  "sent_at"        timestamptz,
  "vendor_status"  text DEFAULT 'pending' NOT NULL,
  "metadata"       jsonb DEFAULT '{}',
  "created_at"     timestamptz DEFAULT now() NOT NULL,
  "updated_at"     timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."MailVerificationJob" OWNER TO "postgres";

-- ============================================================
-- 4. Indexes — AddressVerificationAttempt
-- ============================================================

-- Lookup by user
CREATE INDEX IF NOT EXISTS idx_addr_verif_attempt_user
  ON "public"."AddressVerificationAttempt" ("user_id");

-- Lookup by address
CREATE INDEX IF NOT EXISTS idx_addr_verif_attempt_address
  ON "public"."AddressVerificationAttempt" ("address_id");

-- Active/pending attempts per user+address
CREATE INDEX IF NOT EXISTS idx_addr_verif_attempt_active
  ON "public"."AddressVerificationAttempt" ("user_id", "address_id")
  WHERE "status" IN ('created', 'sent', 'delivered_unknown');

-- ============================================================
-- 5. Indexes — AddressVerificationToken
-- ============================================================

-- Lookup token by attempt
CREATE INDEX IF NOT EXISTS idx_addr_verif_token_attempt
  ON "public"."AddressVerificationToken" ("attempt_id");

-- ============================================================
-- 6. Indexes — MailVerificationJob
-- ============================================================

-- Lookup jobs by attempt
CREATE INDEX IF NOT EXISTS idx_mail_verif_job_attempt
  ON "public"."MailVerificationJob" ("attempt_id");

-- Lookup by vendor job ID for webhook callbacks
CREATE INDEX IF NOT EXISTS idx_mail_verif_job_vendor_id
  ON "public"."MailVerificationJob" ("vendor_job_id")
  WHERE "vendor_job_id" IS NOT NULL;

-- ============================================================
-- 7. Row Level Security — AddressVerificationAttempt
-- ============================================================

ALTER TABLE "public"."AddressVerificationAttempt" ENABLE ROW LEVEL SECURITY;

-- Users can read their own attempts
CREATE POLICY "addr_verif_attempt_select_own"
  ON "public"."AddressVerificationAttempt"
  FOR SELECT TO "authenticated"
  USING ("user_id" = "auth"."uid"());

-- service_role has full access
CREATE POLICY "addr_verif_attempt_service"
  ON "public"."AddressVerificationAttempt"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 8. Row Level Security — AddressVerificationToken
-- ============================================================

ALTER TABLE "public"."AddressVerificationToken" ENABLE ROW LEVEL SECURITY;

-- Users can read tokens for their own attempts
CREATE POLICY "addr_verif_token_select_own"
  ON "public"."AddressVerificationToken"
  FOR SELECT TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."AddressVerificationAttempt" "a"
      WHERE "a"."id" = "AddressVerificationToken"."attempt_id"
        AND "a"."user_id" = "auth"."uid"()
    )
  );

-- service_role has full access
CREATE POLICY "addr_verif_token_service"
  ON "public"."AddressVerificationToken"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 9. Row Level Security — MailVerificationJob
-- ============================================================

ALTER TABLE "public"."MailVerificationJob" ENABLE ROW LEVEL SECURITY;

-- Users can read jobs for their own attempts
CREATE POLICY "mail_verif_job_select_own"
  ON "public"."MailVerificationJob"
  FOR SELECT TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."AddressVerificationAttempt" "a"
      WHERE "a"."id" = "MailVerificationJob"."attempt_id"
        AND "a"."user_id" = "auth"."uid"()
    )
  );

-- service_role has full access
CREATE POLICY "mail_verif_job_service"
  ON "public"."MailVerificationJob"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 10. Grant permissions
-- ============================================================

GRANT ALL ON TABLE "public"."AddressVerificationAttempt" TO "anon";
GRANT ALL ON TABLE "public"."AddressVerificationAttempt" TO "authenticated";
GRANT ALL ON TABLE "public"."AddressVerificationAttempt" TO "service_role";

GRANT ALL ON TABLE "public"."AddressVerificationToken" TO "anon";
GRANT ALL ON TABLE "public"."AddressVerificationToken" TO "authenticated";
GRANT ALL ON TABLE "public"."AddressVerificationToken" TO "service_role";

GRANT ALL ON TABLE "public"."MailVerificationJob" TO "anon";
GRANT ALL ON TABLE "public"."MailVerificationJob" TO "authenticated";
GRANT ALL ON TABLE "public"."MailVerificationJob" TO "service_role";
