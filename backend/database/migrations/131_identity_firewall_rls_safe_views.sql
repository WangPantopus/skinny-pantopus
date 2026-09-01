-- Identity Firewall: RLS policies, safe public views, and locality backfill repair.
--
-- Additive/idempotent so environments that already ran the MVP migrations can
-- apply this safely.

UPDATE "public"."LocalProfile" lp
SET
  "public_city" = NULL,
  "public_state" = NULL,
  "show_neighborhood" = false,
  "updated_at" = now()
FROM "public"."UserPrivacySettings" ups
WHERE ups."user_id" = lp."user_id"
  AND ups."show_neighborhood" <> 'public'
  AND (
    lp."public_city" IS NOT NULL
    OR lp."public_state" IS NOT NULL
    OR lp."show_neighborhood" IS TRUE
  );

CREATE OR REPLACE VIEW "public"."PublicLocalProfileView" AS
SELECT
  "id",
  "handle",
  "handle_normalized",
  "display_name",
  "avatar_url",
  "bio",
  "tagline",
  CASE WHEN "show_neighborhood" IS TRUE THEN "public_city" ELSE NULL END AS "public_city",
  CASE WHEN "show_neighborhood" IS TRUE THEN "public_state" ELSE NULL END AS "public_state",
  CASE WHEN "show_neighborhood" IS TRUE THEN "public_neighborhood" ELSE NULL END AS "public_neighborhood",
  "show_verified_resident_badge",
  "show_home_affiliation",
  "show_neighborhood",
  "profile_visibility",
  "created_at",
  "updated_at"
FROM "public"."LocalProfile"
WHERE "profile_visibility" = 'public'
  AND "search_visibility" = 'everyone';

CREATE OR REPLACE VIEW "public"."PublicAudienceProfileView" AS
SELECT
  "id",
  "handle",
  "handle_normalized",
  "display_name",
  "avatar_url",
  "banner_url",
  "bio",
  "public_links",
  "category",
  "audience_label",
  "audience_mode",
  "professional_category",
  "credential_status",
  "organization_name",
  "organization_affiliation_status",
  "follower_count",
  "post_count",
  "broadcast_enabled",
  "created_at",
  "updated_at"
FROM "public"."PublicPersona"
WHERE "status" = 'active'
  AND "is_searchable" IS TRUE;

CREATE OR REPLACE VIEW "public"."PublicBroadcastMessageView" AS
SELECT
  "id",
  "channel_id",
  "persona_id",
  "body",
  "media",
  "visibility",
  "status",
  "published_at",
  "created_at",
  "updated_at"
FROM "public"."BroadcastMessage"
WHERE "status" = 'published'
  AND "visibility" = 'public';

ALTER TABLE "public"."LocalProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PublicPersona" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PersonaFollow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."IdentityBridgeSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BroadcastChannel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BroadcastMessage" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LocalProfile_public_read" ON "public"."LocalProfile";
CREATE POLICY "LocalProfile_public_read"
  ON "public"."LocalProfile"
  FOR SELECT
  USING ("profile_visibility" = 'public' AND "search_visibility" = 'everyone');

DROP POLICY IF EXISTS "LocalProfile_owner_all" ON "public"."LocalProfile";
CREATE POLICY "LocalProfile_owner_all"
  ON "public"."LocalProfile"
  FOR ALL
  USING (NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "user_id")
  WITH CHECK (NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "user_id");

DROP POLICY IF EXISTS "PublicPersona_public_read" ON "public"."PublicPersona";
CREATE POLICY "PublicPersona_public_read"
  ON "public"."PublicPersona"
  FOR SELECT
  USING ("status" = 'active' AND "is_searchable" IS TRUE);

DROP POLICY IF EXISTS "PublicPersona_owner_all" ON "public"."PublicPersona";
CREATE POLICY "PublicPersona_owner_all"
  ON "public"."PublicPersona"
  FOR ALL
  USING (NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "user_id")
  WITH CHECK (NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "user_id");

DROP POLICY IF EXISTS "PersonaFollow_participant_read" ON "public"."PersonaFollow";
CREATE POLICY "PersonaFollow_participant_read"
  ON "public"."PersonaFollow"
  FOR SELECT
  USING (
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "follower_user_id"
    OR EXISTS (
      SELECT 1
      FROM "public"."PublicPersona" pp
      WHERE pp."id" = "persona_id"
        AND pp."user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS "PersonaFollow_participant_write" ON "public"."PersonaFollow";
CREATE POLICY "PersonaFollow_participant_write"
  ON "public"."PersonaFollow"
  FOR ALL
  USING (
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "follower_user_id"
    OR EXISTS (
      SELECT 1
      FROM "public"."PublicPersona" pp
      WHERE pp."id" = "persona_id"
        AND pp."user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  )
  WITH CHECK (
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "follower_user_id"
    OR EXISTS (
      SELECT 1
      FROM "public"."PublicPersona" pp
      WHERE pp."id" = "persona_id"
        AND pp."user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS "IdentityBridgeSetting_owner_all" ON "public"."IdentityBridgeSetting";
CREATE POLICY "IdentityBridgeSetting_owner_all"
  ON "public"."IdentityBridgeSetting"
  FOR ALL
  USING (NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "user_id")
  WITH CHECK (NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "user_id");

DROP POLICY IF EXISTS "BroadcastChannel_public_read" ON "public"."BroadcastChannel";
CREATE POLICY "BroadcastChannel_public_read"
  ON "public"."BroadcastChannel"
  FOR SELECT
  USING (
    "status" = 'active'
    AND EXISTS (
      SELECT 1
      FROM "public"."PublicPersona" pp
      WHERE pp."id" = "persona_id"
        AND pp."status" = 'active'
    )
  );

DROP POLICY IF EXISTS "BroadcastChannel_owner_all" ON "public"."BroadcastChannel";
CREATE POLICY "BroadcastChannel_owner_all"
  ON "public"."BroadcastChannel"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."PublicPersona" pp
      WHERE pp."id" = "persona_id"
        AND pp."user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."PublicPersona" pp
      WHERE pp."id" = "persona_id"
        AND pp."user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS "BroadcastMessage_visibility_read" ON "public"."BroadcastMessage";
CREATE POLICY "BroadcastMessage_visibility_read"
  ON "public"."BroadcastMessage"
  FOR SELECT
  USING (
    "status" = 'published'
    AND (
      "visibility" = 'public'
      OR EXISTS (
        SELECT 1
        FROM "public"."PublicPersona" pp
        WHERE pp."id" = "persona_id"
          AND pp."user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      )
      OR (
        "visibility" = 'followers'
        AND EXISTS (
          SELECT 1
          FROM "public"."PersonaFollow" pf
          WHERE pf."persona_id" = "BroadcastMessage"."persona_id"
            AND pf."follower_user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
            AND pf."status" = 'active'
        )
      )
      OR (
        "visibility" = 'subscribers'
        AND EXISTS (
          SELECT 1
          FROM "public"."PersonaFollow" pf
          WHERE pf."persona_id" = "BroadcastMessage"."persona_id"
            AND pf."follower_user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
            AND pf."status" = 'active'
            AND pf."relationship_type" = 'subscriber'
        )
      )
    )
  );

DROP POLICY IF EXISTS "BroadcastMessage_owner_all" ON "public"."BroadcastMessage";
CREATE POLICY "BroadcastMessage_owner_all"
  ON "public"."BroadcastMessage"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."PublicPersona" pp
      WHERE pp."id" = "persona_id"
        AND pp."user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "public"."PublicPersona" pp
      WHERE pp."id" = "persona_id"
        AND pp."user_id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    )
  );

REVOKE ALL ON TABLE "public"."LocalProfile" FROM "anon", "authenticated";
REVOKE ALL ON TABLE "public"."PublicPersona" FROM "anon", "authenticated";
REVOKE ALL ON TABLE "public"."PersonaFollow" FROM "anon", "authenticated";
REVOKE ALL ON TABLE "public"."IdentityBridgeSetting" FROM "anon", "authenticated";
REVOKE ALL ON TABLE "public"."BroadcastChannel" FROM "anon", "authenticated";
REVOKE ALL ON TABLE "public"."BroadcastMessage" FROM "anon", "authenticated";

DO $$
DECLARE
  legacy_feed_rpc text;
BEGIN
  FOREACH legacy_feed_rpc IN ARRAY ARRAY[
    'public.get_neighborhood_feed(uuid,integer,integer)',
    'public.get_neighborhood_feed(uuid,integer,integer,text,integer)',
    'public.get_neighborhood_feed_at(uuid,double precision,double precision,integer,integer,text,integer)',
    'public.get_neighborhood_feed_v2(uuid,double precision,double precision,integer,integer,text,integer,text[])',
    'public.get_posts_in_bounds(uuid,double precision,double precision,double precision,double precision,integer,text)'
  ] LOOP
    IF to_regprocedure(legacy_feed_rpc) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM "anon", "authenticated"', legacy_feed_rpc);
    END IF;
  END LOOP;
END $$;

GRANT SELECT ON TABLE "public"."PublicLocalProfileView" TO "anon", "authenticated", "service_role";
GRANT SELECT ON TABLE "public"."PublicAudienceProfileView" TO "anon", "authenticated", "service_role";
GRANT SELECT ON TABLE "public"."PublicBroadcastMessageView" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."LocalProfile" TO "service_role";
GRANT ALL ON TABLE "public"."PublicPersona" TO "service_role";
GRANT ALL ON TABLE "public"."PersonaFollow" TO "service_role";
GRANT ALL ON TABLE "public"."IdentityBridgeSetting" TO "service_role";
GRANT ALL ON TABLE "public"."BroadcastChannel" TO "service_role";
GRANT ALL ON TABLE "public"."BroadcastMessage" TO "service_role";
