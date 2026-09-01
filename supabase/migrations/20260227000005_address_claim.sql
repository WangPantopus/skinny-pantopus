-- Migration: AddressClaim table
--
-- Tracks user claims against canonical addresses. Each claim records the
-- verification method and a snapshot of the AddressVerdict at claim time.
-- A unique partial index prevents duplicate active (pending/verified) claims
-- for the same user + address + unit combination.

-- ============================================================
-- 1. Create AddressClaim table
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."AddressClaim" (
  "id"                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id"              uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "address_id"           uuid NOT NULL REFERENCES "public"."HomeAddress"("id") ON DELETE CASCADE,
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

ALTER TABLE "public"."AddressClaim" OWNER TO "postgres";

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Lookup claims by user
CREATE INDEX IF NOT EXISTS idx_address_claim_user
  ON "public"."AddressClaim" ("user_id");

-- Lookup claims by address
CREATE INDEX IF NOT EXISTS idx_address_claim_address
  ON "public"."AddressClaim" ("address_id");

-- Prevent duplicate active claims for the same user + address + unit.
-- COALESCE handles NULL unit_number so (user, addr, NULL) is still unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_address_claim_active
  ON "public"."AddressClaim" ("user_id", "address_id", COALESCE("unit_number", ''))
  WHERE "claim_status" IN ('pending', 'verified');

-- ============================================================
-- 3. Row Level Security
-- ============================================================

ALTER TABLE "public"."AddressClaim" ENABLE ROW LEVEL SECURITY;

-- Users can read their own claims
CREATE POLICY "addressclaim_select_own"
  ON "public"."AddressClaim"
  FOR SELECT
  USING ("user_id" = "auth"."uid"());

-- Users can create claims for themselves
CREATE POLICY "addressclaim_insert_own"
  ON "public"."AddressClaim"
  FOR INSERT
  WITH CHECK ("user_id" = "auth"."uid"());

-- service_role bypasses RLS but we add an explicit policy for clarity
CREATE POLICY "addressclaim_service"
  ON "public"."AddressClaim"
  USING ("auth"."role"() = 'service_role'::"text");

-- ============================================================
-- 4. Grant permissions (matching existing table pattern)
-- ============================================================

GRANT ALL ON TABLE "public"."AddressClaim" TO "anon";
GRANT ALL ON TABLE "public"."AddressClaim" TO "authenticated";
GRANT ALL ON TABLE "public"."AddressClaim" TO "service_role";
