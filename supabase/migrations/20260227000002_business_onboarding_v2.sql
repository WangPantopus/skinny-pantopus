-- Migration: Business Onboarding V2
-- Adds verification tiers, profile completeness, verification evidence table,
-- founding business slots, atomic creation RPC, and updates discovery functions.

-- ============================================================================
-- 1. Add verification + completeness columns to BusinessProfile
-- ============================================================================

ALTER TABLE "public"."BusinessProfile"
  ADD COLUMN IF NOT EXISTS "verification_status" varchar(30) DEFAULT 'unverified' NOT NULL,
  ADD COLUMN IF NOT EXISTS "verification_tier" varchar(30) DEFAULT 'unverified' NOT NULL,
  ADD COLUMN IF NOT EXISTS "verified_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "verified_by" uuid REFERENCES "public"."User"(id),
  ADD COLUMN IF NOT EXISTS "profile_completeness" integer DEFAULT 0 NOT NULL;

-- ============================================================================
-- 2. CHECK constraint on verification_status (idempotent via DO block)
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE "public"."BusinessProfile"
    ADD CONSTRAINT "bp_verification_status_check"
    CHECK ("verification_status" IN ('unverified', 'self_attested', 'document_verified', 'government_verified'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- ============================================================================
-- 3. Create BusinessVerificationEvidence table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."BusinessVerificationEvidence" (
  "id"               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "business_user_id" uuid NOT NULL REFERENCES "public"."User"(id) ON DELETE CASCADE,
  "evidence_type"    varchar(50) NOT NULL
    CONSTRAINT "bve_evidence_type_check"
    CHECK ("evidence_type" IN ('business_license', 'ein_letter', 'utility_bill', 'state_registration', 'self_attestation')),
  "file_id"          uuid REFERENCES "public"."File"(id),
  "metadata"         jsonb DEFAULT '{}',
  "status"           varchar(30) DEFAULT 'pending' NOT NULL
    CONSTRAINT "bve_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected')),
  "reviewed_at"      timestamptz,
  "reviewed_by"      uuid REFERENCES "public"."User"(id),
  "reviewer_notes"   text,
  "created_at"       timestamptz DEFAULT now() NOT NULL,
  "updated_at"       timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."BusinessVerificationEvidence" OWNER TO "postgres";

-- ============================================================================
-- 4. Create FoundingBusinessSlot table (sequence-based slot_number)
-- ============================================================================

-- Create the sequence separately so we can control it
CREATE SEQUENCE IF NOT EXISTS "public"."founding_business_slot_number_seq"
  START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 50 NO CYCLE;

CREATE TABLE IF NOT EXISTS "public"."FoundingBusinessSlot" (
  "id"               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "business_user_id" uuid NOT NULL REFERENCES "public"."User"(id) ON DELETE CASCADE,
  "slot_number"      integer NOT NULL DEFAULT nextval('public.founding_business_slot_number_seq'),
  "claimed_at"       timestamptz DEFAULT now() NOT NULL,
  "status"           varchar(20) DEFAULT 'active' NOT NULL
    CONSTRAINT "fbs_status_check"
    CHECK ("status" IN ('active', 'expired', 'revoked')),
  CONSTRAINT "fbs_unique_business" UNIQUE ("business_user_id"),
  CONSTRAINT "fbs_unique_slot_number" UNIQUE ("slot_number"),
  CONSTRAINT "fbs_slot_number_range" CHECK ("slot_number" BETWEEN 1 AND 50)
);

ALTER TABLE "public"."FoundingBusinessSlot" OWNER TO "postgres";

-- Ensure the sequence is owned by the column for proper cleanup
ALTER SEQUENCE "public"."founding_business_slot_number_seq"
  OWNED BY "public"."FoundingBusinessSlot"."slot_number";

-- ============================================================================
-- 5. Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_bp_verification_status"
  ON "public"."BusinessProfile"("verification_status");

CREATE INDEX IF NOT EXISTS "idx_bp_completeness"
  ON "public"."BusinessProfile"("profile_completeness");

CREATE INDEX IF NOT EXISTS "idx_bve_business_status"
  ON "public"."BusinessVerificationEvidence"("business_user_id", "status");

-- ============================================================================
-- 6. Create atomic business creation RPC function
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."create_business_transaction"(
  p_username text,
  p_name text,
  p_email text,
  p_business_type text,
  p_categories text[],
  p_description text,
  p_public_phone text,
  p_website text,
  p_actor_user_id uuid
) RETURNS json
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_biz_user_id uuid;
BEGIN
  -- Step 1: Create the business User row
  INSERT INTO "User" (username, name, email, account_type)
  VALUES (p_username, p_name, p_email, 'business')
  RETURNING id INTO v_biz_user_id;

  -- Step 2: Create the BusinessProfile
  INSERT INTO "BusinessProfile" (
    business_user_id, business_type, categories,
    description, public_email, public_phone, website
  ) VALUES (
    v_biz_user_id, p_business_type, p_categories,
    p_description, p_email, p_public_phone, p_website
  );

  -- Step 3: Create the BusinessTeam entry (owner)
  INSERT INTO "BusinessTeam" (business_user_id, user_id, role_base, title, joined_at)
  VALUES (v_biz_user_id, p_actor_user_id, 'owner'::"public"."business_role_base", 'Owner', now());

  -- Step 4: Create the BusinessPrivate shell (for later legal/tax info)
  INSERT INTO "BusinessPrivate" (business_user_id)
  VALUES (v_biz_user_id);

  -- Step 5: Create the default Overview page
  INSERT INTO "BusinessPage" (business_user_id, slug, title, is_default, show_in_nav, nav_order)
  VALUES (v_biz_user_id, 'overview', 'Overview', true, true, 0);

  -- If ANY insert above fails, Postgres rolls back the entire function automatically
  RETURN json_build_object('business_user_id', v_biz_user_id);
END;
$$;

ALTER FUNCTION "public"."create_business_transaction"(text, text, text, text, text[], text, text, text, uuid)
  OWNER TO "postgres";

-- ============================================================================
-- 7. find_businesses_nearby update moved to migration 20260227000003
--    (must be a separate migration because 000002 was already partially applied)
-- ============================================================================

-- ============================================================================
-- 8. Grant permissions on new tables (matching existing Business table pattern)
-- ============================================================================

GRANT ALL ON TABLE "public"."BusinessVerificationEvidence" TO "anon";
GRANT ALL ON TABLE "public"."BusinessVerificationEvidence" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessVerificationEvidence" TO "service_role";

GRANT ALL ON TABLE "public"."FoundingBusinessSlot" TO "anon";
GRANT ALL ON TABLE "public"."FoundingBusinessSlot" TO "authenticated";
GRANT ALL ON TABLE "public"."FoundingBusinessSlot" TO "service_role";

GRANT ALL ON FUNCTION "public"."create_business_transaction"(text, text, text, text, text[], text, text, text, uuid) TO "anon";
GRANT ALL ON FUNCTION "public"."create_business_transaction"(text, text, text, text, text[], text, text, text, uuid) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_business_transaction"(text, text, text, text, text[], text, text, text, uuid) TO "service_role";

GRANT USAGE, SELECT ON SEQUENCE "public"."founding_business_slot_number_seq" TO "anon";
GRANT USAGE, SELECT ON SEQUENCE "public"."founding_business_slot_number_seq" TO "authenticated";
GRANT USAGE, SELECT ON SEQUENCE "public"."founding_business_slot_number_seq" TO "service_role";
