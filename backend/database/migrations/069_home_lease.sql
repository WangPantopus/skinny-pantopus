-- Migration 069: HomeLease and HomeLeaseResident tables
--
-- HomeLease tracks lease records that drive occupancy attach/detach.
-- HomeLeaseResident is a join table for additional residents on a lease
-- beyond the primary resident.

-- 1) HomeLease
CREATE TABLE IF NOT EXISTS "HomeLease" (
  "id"                         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "home_id"                    uuid NOT NULL REFERENCES "Home"("id") ON DELETE CASCADE,
  "approved_by_subject_type"   "public"."subject_type",
  "approved_by_subject_id"     uuid,
  "primary_resident_user_id"   uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "start_at"                   timestamptz NOT NULL,
  "end_at"                     timestamptz,
  "state"                      text DEFAULT 'pending' NOT NULL
    CONSTRAINT "HomeLease_state_chk"
    CHECK ("state" IN ('pending', 'active', 'ended', 'canceled', 'disputed')),
  "source"                     text NOT NULL
    CONSTRAINT "HomeLease_source_chk"
    CHECK ("source" IN ('tenant_request', 'landlord_invite', 'doc_verified', 'mail_verified')),
  "metadata"                   jsonb DEFAULT '{}',
  "created_at"                 timestamptz DEFAULT now() NOT NULL,
  "updated_at"                 timestamptz DEFAULT now() NOT NULL
);

-- 2) HomeLeaseResident
CREATE TABLE IF NOT EXISTS "HomeLeaseResident" (
  "id"        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "lease_id"  uuid NOT NULL REFERENCES "HomeLease"("id") ON DELETE CASCADE,
  "user_id"   uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "added_at"  timestamptz DEFAULT now() NOT NULL
);

-- 3) Indexes — HomeLease
CREATE INDEX IF NOT EXISTS idx_home_lease_home
  ON "HomeLease" ("home_id");

CREATE INDEX IF NOT EXISTS idx_home_lease_resident
  ON "HomeLease" ("primary_resident_user_id");

CREATE INDEX IF NOT EXISTS idx_home_lease_active
  ON "HomeLease" ("home_id")
  WHERE "state" = 'active';

-- 4) Indexes — HomeLeaseResident
CREATE UNIQUE INDEX IF NOT EXISTS idx_lease_resident_unique
  ON "HomeLeaseResident" ("lease_id", "user_id");

-- 5) RLS — HomeLease
ALTER TABLE "HomeLease" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homelease_select"
  ON "HomeLease" FOR SELECT
  USING (
    "primary_resident_user_id" = "auth"."uid"()
    OR "approved_by_subject_id" = "auth"."uid"()
    OR EXISTS (
      SELECT 1 FROM "HomeOccupancy" "ho"
      WHERE "ho"."home_id" = "HomeLease"."home_id"
        AND "ho"."user_id" = "auth"."uid"()
        AND "ho"."is_active" = true
    )
  );

CREATE POLICY "homelease_service"
  ON "HomeLease"
  USING ("auth"."role"() = 'service_role'::"text");

-- 6) RLS — HomeLeaseResident
ALTER TABLE "HomeLeaseResident" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homeleaseresident_select"
  ON "HomeLeaseResident" FOR SELECT
  USING (
    "user_id" = "auth"."uid"()
    OR EXISTS (
      SELECT 1 FROM "HomeLease" "hl"
        JOIN "HomeOccupancy" "ho" ON "ho"."home_id" = "hl"."home_id"
      WHERE "hl"."id" = "HomeLeaseResident"."lease_id"
        AND "ho"."user_id" = "auth"."uid"()
        AND "ho"."is_active" = true
    )
  );

CREATE POLICY "homeleaseresident_service"
  ON "HomeLeaseResident"
  USING ("auth"."role"() = 'service_role'::"text");

-- 7) Grants
GRANT ALL ON TABLE "HomeLease" TO "anon";
GRANT ALL ON TABLE "HomeLease" TO "authenticated";
GRANT ALL ON TABLE "HomeLease" TO "service_role";

GRANT ALL ON TABLE "HomeLeaseResident" TO "anon";
GRANT ALL ON TABLE "HomeLeaseResident" TO "authenticated";
GRANT ALL ON TABLE "HomeLeaseResident" TO "service_role";
