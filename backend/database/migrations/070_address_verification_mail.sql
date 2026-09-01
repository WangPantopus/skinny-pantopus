-- Migration 070: Address Verification (Mail) tables
--
-- Replaces and improves on HomePostcardCode with three tables:
--   AddressVerificationAttempt — tracks each verification attempt
--   AddressVerificationToken   — stores hashed codes/QR tokens with rate-limiting
--   MailVerificationJob        — tracks vendor fulfillment (Lob, postGrid, etc.)

-- 1) AddressVerificationAttempt
CREATE TABLE IF NOT EXISTS "AddressVerificationAttempt" (
  "id"          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id"     uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "address_id"  uuid NOT NULL REFERENCES "HomeAddress"("id") ON DELETE CASCADE,
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

-- 2) AddressVerificationToken
CREATE TABLE IF NOT EXISTS "AddressVerificationToken" (
  "id"             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "attempt_id"     uuid NOT NULL REFERENCES "AddressVerificationAttempt"("id") ON DELETE CASCADE,
  "code_hash"      text NOT NULL,
  "qr_token_hash"  text,
  "max_attempts"   integer DEFAULT 5 NOT NULL,
  "attempt_count"  integer DEFAULT 0 NOT NULL,
  "resend_count"   integer DEFAULT 0 NOT NULL,
  "cooldown_until" timestamptz,
  "used_at"        timestamptz,
  "created_at"     timestamptz DEFAULT now() NOT NULL
);

-- 3) MailVerificationJob
CREATE TABLE IF NOT EXISTS "MailVerificationJob" (
  "id"             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "attempt_id"     uuid NOT NULL REFERENCES "AddressVerificationAttempt"("id") ON DELETE CASCADE,
  "vendor"         text NOT NULL,
  "template_id"    text,
  "vendor_job_id"  text,
  "sent_at"        timestamptz,
  "vendor_status"  text DEFAULT 'pending' NOT NULL,
  "metadata"       jsonb DEFAULT '{}',
  "created_at"     timestamptz DEFAULT now() NOT NULL,
  "updated_at"     timestamptz DEFAULT now() NOT NULL
);

-- 4) Indexes — AddressVerificationAttempt
CREATE INDEX IF NOT EXISTS idx_addr_verif_attempt_user
  ON "AddressVerificationAttempt" ("user_id");

CREATE INDEX IF NOT EXISTS idx_addr_verif_attempt_address
  ON "AddressVerificationAttempt" ("address_id");

CREATE INDEX IF NOT EXISTS idx_addr_verif_attempt_active
  ON "AddressVerificationAttempt" ("user_id", "address_id")
  WHERE "status" IN ('created', 'sent', 'delivered_unknown');

-- 5) Indexes — AddressVerificationToken
CREATE INDEX IF NOT EXISTS idx_addr_verif_token_attempt
  ON "AddressVerificationToken" ("attempt_id");

-- 6) Indexes — MailVerificationJob
CREATE INDEX IF NOT EXISTS idx_mail_verif_job_attempt
  ON "MailVerificationJob" ("attempt_id");

CREATE INDEX IF NOT EXISTS idx_mail_verif_job_vendor_id
  ON "MailVerificationJob" ("vendor_job_id")
  WHERE "vendor_job_id" IS NOT NULL;

-- 7) RLS — AddressVerificationAttempt
ALTER TABLE "AddressVerificationAttempt" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addr_verif_attempt_select_own"
  ON "AddressVerificationAttempt"
  FOR SELECT TO "authenticated"
  USING ("user_id" = "auth"."uid"());

CREATE POLICY "addr_verif_attempt_service"
  ON "AddressVerificationAttempt"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

-- 8) RLS — AddressVerificationToken
ALTER TABLE "AddressVerificationToken" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addr_verif_token_select_own"
  ON "AddressVerificationToken"
  FOR SELECT TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "AddressVerificationAttempt" "a"
      WHERE "a"."id" = "AddressVerificationToken"."attempt_id"
        AND "a"."user_id" = "auth"."uid"()
    )
  );

CREATE POLICY "addr_verif_token_service"
  ON "AddressVerificationToken"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

-- 9) RLS — MailVerificationJob
ALTER TABLE "MailVerificationJob" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_verif_job_select_own"
  ON "MailVerificationJob"
  FOR SELECT TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM "AddressVerificationAttempt" "a"
      WHERE "a"."id" = "MailVerificationJob"."attempt_id"
        AND "a"."user_id" = "auth"."uid"()
    )
  );

CREATE POLICY "mail_verif_job_service"
  ON "MailVerificationJob"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

-- 10) Grants
GRANT ALL ON TABLE "AddressVerificationAttempt" TO "anon";
GRANT ALL ON TABLE "AddressVerificationAttempt" TO "authenticated";
GRANT ALL ON TABLE "AddressVerificationAttempt" TO "service_role";

GRANT ALL ON TABLE "AddressVerificationToken" TO "anon";
GRANT ALL ON TABLE "AddressVerificationToken" TO "authenticated";
GRANT ALL ON TABLE "AddressVerificationToken" TO "service_role";

GRANT ALL ON TABLE "MailVerificationJob" TO "anon";
GRANT ALL ON TABLE "MailVerificationJob" TO "authenticated";
GRANT ALL ON TABLE "MailVerificationJob" TO "service_role";
