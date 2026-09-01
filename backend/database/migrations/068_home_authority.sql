-- Migration 068: HomeAuthority table
--
-- Tracks who has authority to approve/deny residents at a home or building.
-- Separate from HomeOwner (property ownership). A property manager has
-- authority to manage tenants but does not own the property.
--
-- Uses the existing subject_type and owner_verification_tier enums.
-- added_via uses a text CHECK (not the owner_added_via enum) because the
-- allowed values differ from HomeOwner.

-- 1) Create table
CREATE TABLE IF NOT EXISTS "HomeAuthority" (
  "id"                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "home_id"            uuid NOT NULL REFERENCES "Home"("id") ON DELETE CASCADE,
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

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_home_authority_home
  ON "HomeAuthority" ("home_id");

CREATE INDEX IF NOT EXISTS idx_home_authority_subject
  ON "HomeAuthority" ("subject_type", "subject_id");

-- 3) Row Level Security
ALTER TABLE "HomeAuthority" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homeauthority_select"
  ON "HomeAuthority" FOR SELECT
  USING (
    (EXISTS (
      SELECT 1 FROM "HomeOccupancy" "ho"
      WHERE "ho"."home_id" = "HomeAuthority"."home_id"
        AND "ho"."user_id" = "auth"."uid"()
        AND "ho"."is_active" = true
    ))
    OR ("subject_id" = "auth"."uid"())
  );

CREATE POLICY "homeauthority_service"
  ON "HomeAuthority"
  USING ("auth"."role"() = 'service_role'::"text");

-- 4) Grants
GRANT ALL ON TABLE "HomeAuthority" TO "anon";
GRANT ALL ON TABLE "HomeAuthority" TO "authenticated";
GRANT ALL ON TABLE "HomeAuthority" TO "service_role";
