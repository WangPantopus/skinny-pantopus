-- Migration: HomeLease and HomeLeaseResident tables
--
-- HomeLease tracks lease records that drive occupancy attach/detach.
-- HomeLeaseResident is a join table for additional residents on a lease
-- beyond the primary resident.

-- ============================================================
-- 1. Create HomeLease table
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."HomeLease" (
  "id"                         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "home_id"                    uuid NOT NULL REFERENCES "public"."Home"("id") ON DELETE CASCADE,
  "approved_by_subject_type"   "public"."subject_type",
  "approved_by_subject_id"     uuid,
  "primary_resident_user_id"   uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
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

ALTER TABLE "public"."HomeLease" OWNER TO "postgres";

-- ============================================================
-- 2. Create HomeLeaseResident table
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."HomeLeaseResident" (
  "id"        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "lease_id"  uuid NOT NULL REFERENCES "public"."HomeLease"("id") ON DELETE CASCADE,
  "user_id"   uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "added_at"  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."HomeLeaseResident" OWNER TO "postgres";

-- ============================================================
-- 3. Indexes — HomeLease
-- ============================================================

-- Lookup leases by home
CREATE INDEX IF NOT EXISTS idx_home_lease_home
  ON "public"."HomeLease" ("home_id");

-- Lookup leases by primary resident
CREATE INDEX IF NOT EXISTS idx_home_lease_resident
  ON "public"."HomeLease" ("primary_resident_user_id");

-- Fast lookup of active leases per home
CREATE INDEX IF NOT EXISTS idx_home_lease_active
  ON "public"."HomeLease" ("home_id")
  WHERE "state" = 'active';

-- ============================================================
-- 4. Indexes — HomeLeaseResident
-- ============================================================

-- One row per (lease, user) pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_lease_resident_unique
  ON "public"."HomeLeaseResident" ("lease_id", "user_id");

-- ============================================================
-- 5. Row Level Security — HomeLease
-- ============================================================

ALTER TABLE "public"."HomeLease" ENABLE ROW LEVEL SECURITY;

-- Primary resident can read their own leases
-- Home occupants can read leases for their home
-- Authority subject who approved can read the lease
CREATE POLICY "homelease_select"
  ON "public"."HomeLease"
  FOR SELECT
  USING (
    "primary_resident_user_id" = "auth"."uid"()
    OR "approved_by_subject_id" = "auth"."uid"()
    OR EXISTS (
      SELECT 1 FROM "public"."HomeOccupancy" "ho"
      WHERE "ho"."home_id" = "HomeLease"."home_id"
        AND "ho"."user_id" = "auth"."uid"()
        AND "ho"."is_active" = true
    )
  );

-- service_role has full access
CREATE POLICY "homelease_service"
  ON "public"."HomeLease"
  USING ("auth"."role"() = 'service_role'::"text");

-- ============================================================
-- 6. Row Level Security — HomeLeaseResident
-- ============================================================

ALTER TABLE "public"."HomeLeaseResident" ENABLE ROW LEVEL SECURITY;

-- The resident user can read their own record,
-- or any occupant of the associated home can read
CREATE POLICY "homeleaseresident_select"
  ON "public"."HomeLeaseResident"
  FOR SELECT
  USING (
    "user_id" = "auth"."uid"()
    OR EXISTS (
      SELECT 1 FROM "public"."HomeLease" "hl"
        JOIN "public"."HomeOccupancy" "ho" ON "ho"."home_id" = "hl"."home_id"
      WHERE "hl"."id" = "HomeLeaseResident"."lease_id"
        AND "ho"."user_id" = "auth"."uid"()
        AND "ho"."is_active" = true
    )
  );

-- service_role has full access
CREATE POLICY "homeleaseresident_service"
  ON "public"."HomeLeaseResident"
  USING ("auth"."role"() = 'service_role'::"text");

-- ============================================================
-- 7. Grant permissions
-- ============================================================

GRANT ALL ON TABLE "public"."HomeLease" TO "anon";
GRANT ALL ON TABLE "public"."HomeLease" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeLease" TO "service_role";

GRANT ALL ON TABLE "public"."HomeLeaseResident" TO "anon";
GRANT ALL ON TABLE "public"."HomeLeaseResident" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeLeaseResident" TO "service_role";
