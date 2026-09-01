-- Migration 067: AddressClaim table
--
-- Tracks user claims against canonical addresses. Each claim records the
-- verification method and a snapshot of the AddressVerdict at claim time.
-- A unique partial index prevents duplicate active (pending/verified) claims
-- for the same user + address + unit combination.

-- 1) Create table
CREATE TABLE IF NOT EXISTS "AddressClaim" (
  "id"                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id"              uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "address_id"           uuid NOT NULL REFERENCES "HomeAddress"("id") ON DELETE CASCADE,
  "unit_number"          text,
  "claim_status"         text DEFAULT 'pending' NOT NULL
    CONSTRAINT "AddressClaim_claim_status_chk"
    CHECK ("claim_status" IN ('pending', 'verified', 'rejected', 'expired')),
  "verification_method"  text
    CONSTRAINT "AddressClaim_verification_method_chk"
    CHECK ("verification_method" IN ('autocomplete_ok', 'mail_code', 'landlord_approval', 'doc_upload', 'manual_review')),
  "verdict_snapshot"     jsonb DEFAULT '{}',
  "created_at"           timestamptz DEFAULT now() NOT NULL,
  "updated_at"           timestamptz DEFAULT now() NOT NULL,
  "expires_at"           timestamptz
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_address_claim_user
  ON "AddressClaim" ("user_id");

CREATE INDEX IF NOT EXISTS idx_address_claim_address
  ON "AddressClaim" ("address_id");

CREATE UNIQUE INDEX IF NOT EXISTS idx_address_claim_active
  ON "AddressClaim" ("user_id", "address_id", COALESCE("unit_number", ''))
  WHERE "claim_status" IN ('pending', 'verified');

-- 3) Row Level Security
ALTER TABLE "AddressClaim" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addressclaim_select_own"
  ON "AddressClaim" FOR SELECT
  USING ("user_id" = "auth"."uid"());

CREATE POLICY "addressclaim_insert_own"
  ON "AddressClaim" FOR INSERT
  WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "addressclaim_service"
  ON "AddressClaim"
  USING ("auth"."role"() = 'service_role'::"text");

-- 4) Grants
GRANT ALL ON TABLE "AddressClaim" TO "anon";
GRANT ALL ON TABLE "AddressClaim" TO "authenticated";
GRANT ALL ON TABLE "AddressClaim" TO "service_role";
