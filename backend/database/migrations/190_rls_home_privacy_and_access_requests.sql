-- Migration 190: RLS for HomePrivacy and HomeHouseholdAccessRequest
--
-- Neither table was created with row level security (migrations 153 and 109),
-- so both were reachable directly by any role holding a table grant. Between
-- them they describe how a household wants to be seen and who has asked to
-- join it — both of which name a home, and the second of which names a person
-- alongside it (audit 2026-08-22, PRV).
--
-- All application access to these tables is through the service role. These
-- policies exist so that a direct client read cannot bypass the route layer.

BEGIN;

-- ── HomePrivacy ───────────────────────────────────────────────
ALTER TABLE "public"."HomePrivacy" ENABLE ROW LEVEL SECURITY;

-- Only an active occupant may read their household's privacy settings.
DROP POLICY IF EXISTS "home_privacy_select_household" ON "public"."HomePrivacy";
CREATE POLICY "home_privacy_select_household"
  ON "public"."HomePrivacy"
  FOR SELECT TO "authenticated"
  USING (EXISTS (
    SELECT 1 FROM "public"."HomeOccupancy" o
     WHERE o."home_id" = "HomePrivacy"."home_id"
       AND o."user_id" = "auth"."uid"()
       AND o."is_active" = true
  ));

DROP POLICY IF EXISTS "home_privacy_service" ON "public"."HomePrivacy";
CREATE POLICY "home_privacy_service"
  ON "public"."HomePrivacy"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE "public"."HomePrivacy" FROM "anon";
REVOKE ALL ON TABLE "public"."HomePrivacy" FROM "authenticated";
GRANT SELECT ON TABLE "public"."HomePrivacy" TO "authenticated";
GRANT ALL ON TABLE "public"."HomePrivacy" TO "service_role";

-- ── HomeHouseholdAccessRequest ────────────────────────────────
ALTER TABLE "public"."HomeHouseholdAccessRequest" ENABLE ROW LEVEL SECURITY;

-- The requester sees their own request; the household sees requests against
-- their home. Nobody else learns that a given person asked about a given home.
DROP POLICY IF EXISTS "household_access_request_select_own"
  ON "public"."HomeHouseholdAccessRequest";
CREATE POLICY "household_access_request_select_own"
  ON "public"."HomeHouseholdAccessRequest"
  FOR SELECT TO "authenticated"
  USING (
    "requester_user_id" = "auth"."uid"()
    OR EXISTS (
      SELECT 1 FROM "public"."HomeOccupancy" o
       WHERE o."home_id" = "HomeHouseholdAccessRequest"."home_id"
         AND o."user_id" = "auth"."uid"()
         AND o."is_active" = true
    )
  );

DROP POLICY IF EXISTS "household_access_request_service"
  ON "public"."HomeHouseholdAccessRequest";
CREATE POLICY "household_access_request_service"
  ON "public"."HomeHouseholdAccessRequest"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE "public"."HomeHouseholdAccessRequest" FROM "anon";
REVOKE ALL ON TABLE "public"."HomeHouseholdAccessRequest" FROM "authenticated";
GRANT SELECT ON TABLE "public"."HomeHouseholdAccessRequest" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeHouseholdAccessRequest" TO "service_role";

COMMIT;
