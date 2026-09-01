-- ============================================================================
-- Migration: Identity Firewall — Business Seat Model
-- ============================================================================
-- Creates BusinessSeat, SeatBinding, UserPrivacySettings, UserProfileBlock.
-- Adds context_type/context_id to Notification for business/personal separation.
-- Migrates existing BusinessTeam data into the new seat model.
--
-- BusinessTeam remains untouched until all application code references are
-- migrated (see subsequent prompts). During transition both tables stay in sync.
-- ============================================================================

-- ============================================================================
-- 1. Create ENUM types
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "public"."seat_invite_status" AS ENUM (
    'pending',
    'accepted',
    'declined',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."seat_binding_method" AS ENUM (
    'invite_accept',
    'owner_bootstrap',
    'migration'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."search_visibility_level" AS ENUM (
    'everyone',
    'mutuals',
    'nobody'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."profile_visibility_level" AS ENUM (
    'public',
    'followers',
    'private'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."block_scope_type" AS ENUM (
    'full',
    'search_only',
    'business_context'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."notification_context_type" AS ENUM (
    'personal',
    'business'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. BusinessSeat — opaque operational identity scoped to a single business
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."BusinessSeat" (
    "id"                     "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id"       "uuid" NOT NULL,
    "display_name"           "text" NOT NULL,
    "display_avatar_file_id" "uuid",
    "role_base"              "public"."business_role_base" DEFAULT 'staff'::"public"."business_role_base" NOT NULL,
    "contact_method"         "text",
    "is_active"              boolean DEFAULT true NOT NULL,
    "invited_by_seat_id"     "uuid",
    "invite_token_hash"      "text",
    "invite_email"           "text",
    "invite_status"          "public"."seat_invite_status" DEFAULT 'pending'::"public"."seat_invite_status" NOT NULL,
    "accepted_at"            timestamp with time zone,
    "deactivated_at"         timestamp with time zone,
    "deactivated_reason"     "text",
    "notes"                  "text",
    "created_at"             timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"             timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BusinessSeat_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BusinessSeat_business_user_id_fkey" FOREIGN KEY ("business_user_id")
        REFERENCES "public"."User"("id") ON DELETE CASCADE,
    CONSTRAINT "BusinessSeat_display_avatar_file_id_fkey" FOREIGN KEY ("display_avatar_file_id")
        REFERENCES "public"."File"("id") ON DELETE SET NULL,
    CONSTRAINT "BusinessSeat_invited_by_seat_id_fkey" FOREIGN KEY ("invited_by_seat_id")
        REFERENCES "public"."BusinessSeat"("id") ON DELETE SET NULL
);

ALTER TABLE "public"."BusinessSeat" OWNER TO "postgres";

-- ============================================================================
-- 3. SeatBinding — THE IDENTITY FIREWALL VAULT
--    Links a seat to a real user. Locked down by RLS so only the bound user
--    (and service_role) can read their own bindings.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."SeatBinding" (
    "seat_id"        "uuid" NOT NULL,
    "user_id"        "uuid" NOT NULL,
    "bound_at"       timestamp with time zone DEFAULT "now"() NOT NULL,
    "binding_method" "public"."seat_binding_method" NOT NULL,
    CONSTRAINT "SeatBinding_pkey" PRIMARY KEY ("seat_id"),
    CONSTRAINT "SeatBinding_seat_id_unique" UNIQUE ("seat_id"),
    CONSTRAINT "SeatBinding_seat_id_fkey" FOREIGN KEY ("seat_id")
        REFERENCES "public"."BusinessSeat"("id") ON DELETE CASCADE,
    CONSTRAINT "SeatBinding_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "public"."User"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."SeatBinding" OWNER TO "postgres";

-- ============================================================================
-- 4. UserPrivacySettings — personal discoverability controls
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."UserPrivacySettings" (
    "user_id"                    "uuid" NOT NULL,
    "search_visibility"          "public"."search_visibility_level" DEFAULT 'everyone'::"public"."search_visibility_level" NOT NULL,
    "findable_by_email"          boolean DEFAULT false NOT NULL,
    "findable_by_phone"          boolean DEFAULT false NOT NULL,
    "profile_default_visibility" "public"."profile_visibility_level" DEFAULT 'public'::"public"."profile_visibility_level" NOT NULL,
    "show_gig_history"           "public"."profile_visibility_level" DEFAULT 'followers'::"public"."profile_visibility_level" NOT NULL,
    "show_neighborhood"          "public"."profile_visibility_level" DEFAULT 'followers'::"public"."profile_visibility_level" NOT NULL,
    "show_home_affiliation"      "public"."profile_visibility_level" DEFAULT 'private'::"public"."profile_visibility_level" NOT NULL,
    "created_at"                 timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"                 timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "UserPrivacySettings_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "UserPrivacySettings_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "public"."User"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."UserPrivacySettings" OWNER TO "postgres";

-- ============================================================================
-- 5. UserProfileBlock — targeted scoped blocks
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."UserProfileBlock" (
    "id"              "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id"         "uuid" NOT NULL,
    "blocked_user_id" "uuid" NOT NULL,
    "block_scope"     "public"."block_scope_type" DEFAULT 'full'::"public"."block_scope_type" NOT NULL,
    "reason"          "text",
    "created_at"      timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "UserProfileBlock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserProfileBlock_pair_unique" UNIQUE ("user_id", "blocked_user_id"),
    CONSTRAINT "UserProfileBlock_not_self" CHECK ("user_id" <> "blocked_user_id"),
    CONSTRAINT "UserProfileBlock_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "public"."User"("id") ON DELETE CASCADE,
    CONSTRAINT "UserProfileBlock_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id")
        REFERENCES "public"."User"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."UserProfileBlock" OWNER TO "postgres";

-- ============================================================================
-- 6. Notification — add context_type and context_id columns
-- ============================================================================

ALTER TABLE "public"."Notification"
  ADD COLUMN IF NOT EXISTS "context_type" "public"."notification_context_type"
    DEFAULT 'personal'::"public"."notification_context_type";

ALTER TABLE "public"."Notification"
  ADD COLUMN IF NOT EXISTS "context_id" "uuid";

-- ============================================================================
-- 7. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_seat_business"
  ON "public"."BusinessSeat" USING btree ("business_user_id")
  WHERE ("is_active" = true);

CREATE INDEX IF NOT EXISTS "idx_seat_invite_status"
  ON "public"."BusinessSeat" USING btree ("invite_status")
  WHERE ("invite_status" = 'pending'::"public"."seat_invite_status");

CREATE INDEX IF NOT EXISTS "idx_seat_invite_email"
  ON "public"."BusinessSeat" USING btree ("invite_email")
  WHERE ("invite_email" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "idx_seat_binding_user"
  ON "public"."SeatBinding" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "idx_privacy_search"
  ON "public"."UserPrivacySettings" USING btree ("search_visibility");

CREATE INDEX IF NOT EXISTS "idx_profile_block_user"
  ON "public"."UserProfileBlock" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "idx_profile_block_blocked"
  ON "public"."UserProfileBlock" USING btree ("blocked_user_id");

CREATE INDEX IF NOT EXISTS "idx_profile_block_pair"
  ON "public"."UserProfileBlock" USING btree ("user_id", "blocked_user_id");

CREATE INDEX IF NOT EXISTS "idx_notification_context"
  ON "public"."Notification" USING btree ("user_id", "context_type")
  WHERE ("is_read" = false);

-- ============================================================================
-- 8. Row Level Security
-- ============================================================================

-- 8a. BusinessSeat — authenticated users can read seats for any business
--     (the API layer restricts which businesses you can query; RLS is a safety net).
--     Only service_role can write.

ALTER TABLE "public"."BusinessSeat" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "businessseat_select_authenticated"
  ON "public"."BusinessSeat"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "businessseat_service"
  ON "public"."BusinessSeat"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 8b. SeatBinding — THIS IS THE IDENTITY FIREWALL
--     Only the bound user can read their own bindings.
--     service_role has full access for auth resolution in the backend.
--     NO policy for authenticated users to read other users' bindings.

ALTER TABLE "public"."SeatBinding" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seatbinding_select_own"
  ON "public"."SeatBinding"
  FOR SELECT
  TO authenticated
  USING ("user_id" = "auth"."uid"());

CREATE POLICY "seatbinding_service"
  ON "public"."SeatBinding"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 8c. UserPrivacySettings — users can read/write their own settings.
--     service_role has full access for privacy checks in the backend.

ALTER TABLE "public"."UserPrivacySettings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "userprivacysettings_select_own"
  ON "public"."UserPrivacySettings"
  FOR SELECT
  TO authenticated
  USING ("user_id" = "auth"."uid"());

CREATE POLICY "userprivacysettings_update_own"
  ON "public"."UserPrivacySettings"
  FOR UPDATE
  TO authenticated
  USING ("user_id" = "auth"."uid"())
  WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "userprivacysettings_insert_own"
  ON "public"."UserPrivacySettings"
  FOR INSERT
  TO authenticated
  WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "userprivacysettings_service"
  ON "public"."UserPrivacySettings"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 8d. UserProfileBlock — users can manage their own blocks.
--     service_role has full access for block checks in the backend.

ALTER TABLE "public"."UserProfileBlock" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "userprofileblock_select_own"
  ON "public"."UserProfileBlock"
  FOR SELECT
  TO authenticated
  USING ("user_id" = "auth"."uid"());

CREATE POLICY "userprofileblock_insert_own"
  ON "public"."UserProfileBlock"
  FOR INSERT
  TO authenticated
  WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "userprofileblock_delete_own"
  ON "public"."UserProfileBlock"
  FOR DELETE
  TO authenticated
  USING ("user_id" = "auth"."uid"());

CREATE POLICY "userprofileblock_service"
  ON "public"."UserProfileBlock"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 9. Grants
-- ============================================================================

GRANT ALL ON TABLE "public"."BusinessSeat" TO "anon";
GRANT ALL ON TABLE "public"."BusinessSeat" TO "authenticated";
GRANT ALL ON TABLE "public"."BusinessSeat" TO "service_role";

GRANT ALL ON TABLE "public"."SeatBinding" TO "anon";
GRANT ALL ON TABLE "public"."SeatBinding" TO "authenticated";
GRANT ALL ON TABLE "public"."SeatBinding" TO "service_role";

GRANT ALL ON TABLE "public"."UserPrivacySettings" TO "anon";
GRANT ALL ON TABLE "public"."UserPrivacySettings" TO "authenticated";
GRANT ALL ON TABLE "public"."UserPrivacySettings" TO "service_role";

GRANT ALL ON TABLE "public"."UserProfileBlock" TO "anon";
GRANT ALL ON TABLE "public"."UserProfileBlock" TO "authenticated";
GRANT ALL ON TABLE "public"."UserProfileBlock" TO "service_role";

-- ============================================================================
-- 10. Data Migration — BusinessTeam → BusinessSeat + SeatBinding
-- ============================================================================

-- 10a. Create BusinessSeat rows from BusinessTeam
--      display_name = first_name + optional title suffix

INSERT INTO "public"."BusinessSeat" (
  "id",
  "business_user_id",
  "display_name",
  "role_base",
  "is_active",
  "invite_email",
  "invite_status",
  "accepted_at",
  "deactivated_at",
  "notes",
  "created_at",
  "updated_at"
)
SELECT
  bt."id",                               -- reuse BusinessTeam id for easy FK mapping
  bt."business_user_id",
  COALESCE(u."first_name", split_part(u."name", ' ', 1), 'Team Member')
    || CASE
         WHEN bt."title" IS NOT NULL AND bt."title" <> ''
         THEN ' (' || bt."title" || ')'
         ELSE ''
       END,
  bt."role_base",
  bt."is_active",
  u."email",                             -- store the user's email as invite_email for reference
  CASE
    WHEN bt."joined_at" IS NOT NULL THEN 'accepted'::"public"."seat_invite_status"
    WHEN bt."invited_at" IS NOT NULL THEN 'pending'::"public"."seat_invite_status"
    ELSE 'accepted'::"public"."seat_invite_status"
  END,
  bt."joined_at",                        -- accepted_at = joined_at
  CASE WHEN bt."is_active" = false THEN bt."left_at" ELSE NULL END,
  bt."notes",
  bt."created_at",
  bt."updated_at"
FROM "public"."BusinessTeam" bt
JOIN "public"."User" u ON u."id" = bt."user_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."BusinessSeat" bs WHERE bs."id" = bt."id"
);

-- 10b. Map invited_by (user_id) → invited_by_seat_id
--      For each seat, look up the inviter's seat at the same business.

UPDATE "public"."BusinessSeat" bs
SET "invited_by_seat_id" = inviter_seat."id"
FROM "public"."BusinessTeam" bt
JOIN "public"."BusinessTeam" inviter_bt
  ON inviter_bt."user_id" = bt."invited_by"
  AND inviter_bt."business_user_id" = bt."business_user_id"
JOIN "public"."BusinessSeat" inviter_seat
  ON inviter_seat."id" = inviter_bt."id"
WHERE bs."id" = bt."id"
  AND bt."invited_by" IS NOT NULL
  AND bs."invited_by_seat_id" IS NULL;

-- 10c. Create SeatBinding rows

INSERT INTO "public"."SeatBinding" ("seat_id", "user_id", "bound_at", "binding_method")
SELECT
  bt."id",                               -- seat_id = reused BusinessTeam id
  bt."user_id",
  COALESCE(bt."joined_at", bt."created_at"),
  'migration'::"public"."seat_binding_method"
FROM "public"."BusinessTeam" bt
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."SeatBinding" sb WHERE sb."seat_id" = bt."id"
);

-- 10d. Create UserPrivacySettings with defaults for every user that doesn't have one

INSERT INTO "public"."UserPrivacySettings" ("user_id")
SELECT u."id"
FROM "public"."User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."UserPrivacySettings" ups WHERE ups."user_id" = u."id"
);
