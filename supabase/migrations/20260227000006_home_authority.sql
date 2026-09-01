-- Migration: HomeAuthority table
--
-- Tracks who has authority to approve/deny residents at a home or building.
-- Separate from HomeOwner (property ownership). A property manager has
-- authority to manage tenants but does not own the property.
--
-- Uses the existing subject_type and owner_verification_tier enums.
-- added_via uses a text CHECK (not the owner_added_via enum) because the
-- allowed values differ from HomeOwner.

-- ============================================================
-- 1. Create HomeAuthority table
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."HomeAuthority" (
  "id"                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "home_id"            uuid NOT NULL REFERENCES "public"."Home"("id") ON DELETE CASCADE,
  "subject_type"       "public"."subject_type" DEFAULT 'user'::"public"."subject_type" NOT NULL,
  "subject_id"         uuid NOT NULL,
  "role"               text NOT NULL
    CONSTRAINT "HomeAuthority_role_chk"
    CHECK ("role" IN ('owner', 'manager')),
  "status"             text DEFAULT 'pending' NOT NULL
    CONSTRAINT "HomeAuthority_status_chk"
    CHECK ("status" IN ('pending', 'verified', 'revoked')),
  "verification_tier"  "public"."owner_verification_tier"
                         DEFAULT 'weak'::"public"."owner_verification_tier" NOT NULL,
  "added_via"          text DEFAULT 'claim'
    CONSTRAINT "HomeAuthority_added_via_chk"
    CHECK ("added_via" IN ('claim', 'landlord_portal', 'owner_delegation', 'property_data_match', 'escrow')),
  "created_at"         timestamptz DEFAULT now() NOT NULL,
  "updated_at"         timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."HomeAuthority" OWNER TO "postgres";

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Lookup authorities by home (e.g., "who can approve tenants here?")
CREATE INDEX IF NOT EXISTS idx_home_authority_home
  ON "public"."HomeAuthority" ("home_id");

-- Lookup all homes a subject has authority over
CREATE INDEX IF NOT EXISTS idx_home_authority_subject
  ON "public"."HomeAuthority" ("subject_type", "subject_id");

-- ============================================================
-- 3. Row Level Security
-- ============================================================

ALTER TABLE "public"."HomeAuthority" ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read authority records for homes they occupy,
-- or if they are the authority subject themselves
CREATE POLICY "homeauthority_select"
  ON "public"."HomeAuthority"
  FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM "public"."HomeOccupancy" "ho"
      WHERE "ho"."home_id" = "HomeAuthority"."home_id"
        AND "ho"."user_id" = "auth"."uid"()
        AND "ho"."is_active" = true
    ))
    OR ("subject_id" = "auth"."uid"())
  );

-- service_role has full access
CREATE POLICY "homeauthority_service"
  ON "public"."HomeAuthority"
  USING ("auth"."role"() = 'service_role'::"text");

-- ============================================================
-- 4. Grant permissions
-- ============================================================

GRANT ALL ON TABLE "public"."HomeAuthority" TO "anon";
GRANT ALL ON TABLE "public"."HomeAuthority" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeAuthority" TO "service_role";
