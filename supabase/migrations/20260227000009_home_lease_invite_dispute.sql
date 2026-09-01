-- Migration: HomeLeaseInvite and HomeDispute tables
--
-- HomeLeaseInvite  — landlord-to-tenant invite token (improves on HomeInvite for lease context)
-- HomeDispute      — dispute/challenge table for occupancy and authority conflicts

-- ============================================================
-- 1. HomeLeaseInvite
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."HomeLeaseInvite" (
  "id"                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "home_id"               uuid NOT NULL REFERENCES "public"."Home"("id") ON DELETE CASCADE,
  "landlord_subject_type" "public"."subject_type" NOT NULL,
  "landlord_subject_id"   uuid NOT NULL,
  "invitee_email"         text,
  "invitee_phone"         text,
  "invitee_user_id"       uuid REFERENCES "public"."User"("id") ON DELETE SET NULL,
  "token_hash"            text NOT NULL,
  "proposed_start"        timestamptz,
  "proposed_end"          timestamptz,
  "status"                text DEFAULT 'pending' NOT NULL
    CONSTRAINT "HomeLeaseInvite_status_chk"
    CHECK ("status" IN ('pending', 'accepted', 'revoked', 'expired')),
  "expires_at"            timestamptz NOT NULL,
  "created_at"            timestamptz DEFAULT now() NOT NULL,
  "updated_at"            timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."HomeLeaseInvite" OWNER TO "postgres";

-- ============================================================
-- 2. HomeDispute
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."HomeDispute" (
  "id"               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "home_id"          uuid NOT NULL REFERENCES "public"."Home"("id") ON DELETE CASCADE,
  "initiated_by"     uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "against_user_id"  uuid REFERENCES "public"."User"("id") ON DELETE SET NULL,
  "dispute_type"     text NOT NULL
    CONSTRAINT "HomeDispute_type_chk"
    CHECK ("dispute_type" IN ('wrong_unit', 'never_lived_here', 'stale_occupancy', 'unauthorized_authority', 'hostile_takeover')),
  "state"            text DEFAULT 'open' NOT NULL
    CONSTRAINT "HomeDispute_state_chk"
    CHECK ("state" IN ('open', 'investigating', 'resolved', 'dismissed')),
  "description"      text,
  "resolution_note"  text,
  "resolved_at"      timestamptz,
  "created_at"       timestamptz DEFAULT now() NOT NULL,
  "updated_at"       timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "public"."HomeDispute" OWNER TO "postgres";

-- ============================================================
-- 3. Indexes — HomeLeaseInvite
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_home_lease_invite_home
  ON "public"."HomeLeaseInvite" ("home_id");

CREATE INDEX IF NOT EXISTS idx_home_lease_invite_invitee_user
  ON "public"."HomeLeaseInvite" ("invitee_user_id")
  WHERE "invitee_user_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_home_lease_invite_pending
  ON "public"."HomeLeaseInvite" ("home_id")
  WHERE "status" = 'pending';

-- ============================================================
-- 4. Indexes — HomeDispute
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_home_dispute_home
  ON "public"."HomeDispute" ("home_id");

CREATE INDEX IF NOT EXISTS idx_home_dispute_initiated_by
  ON "public"."HomeDispute" ("initiated_by");

-- ============================================================
-- 5. RLS — HomeLeaseInvite
-- ============================================================

ALTER TABLE "public"."HomeLeaseInvite" ENABLE ROW LEVEL SECURITY;

-- Home members can view lease invites for their home
CREATE POLICY "home_lease_invite_select"
  ON "public"."HomeLeaseInvite"
  FOR SELECT TO "authenticated"
  USING ("public"."is_home_member"("home_id"));

-- service_role has full access
CREATE POLICY "home_lease_invite_service"
  ON "public"."HomeLeaseInvite"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 6. RLS — HomeDispute
-- ============================================================

ALTER TABLE "public"."HomeDispute" ENABLE ROW LEVEL SECURITY;

-- Users can read disputes they initiated or that are against them
CREATE POLICY "home_dispute_select_own"
  ON "public"."HomeDispute"
  FOR SELECT TO "authenticated"
  USING (
    "initiated_by" = "auth"."uid"()
    OR "against_user_id" = "auth"."uid"()
  );

-- Users can create disputes
CREATE POLICY "home_dispute_insert"
  ON "public"."HomeDispute"
  FOR INSERT TO "authenticated"
  WITH CHECK ("initiated_by" = "auth"."uid"());

-- service_role has full access
CREATE POLICY "home_dispute_service"
  ON "public"."HomeDispute"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 7. Grant permissions
-- ============================================================

GRANT ALL ON TABLE "public"."HomeLeaseInvite" TO "anon";
GRANT ALL ON TABLE "public"."HomeLeaseInvite" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeLeaseInvite" TO "service_role";

GRANT ALL ON TABLE "public"."HomeDispute" TO "anon";
GRANT ALL ON TABLE "public"."HomeDispute" TO "authenticated";
GRANT ALL ON TABLE "public"."HomeDispute" TO "service_role";
