-- Keep personal/local profile discovery governed by both profile-level and
-- account-level search privacy. LocalProfile.search_visibility is the RLS-safe
-- denormalized value; triggers keep it no broader than UserPrivacySettings.

CREATE OR REPLACE FUNCTION "public"."identity_search_visibility_rank"(visibility text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE visibility
    WHEN 'nobody' THEN 0
    WHEN 'mutuals' THEN 1
    WHEN 'everyone' THEN 2
    ELSE 2
  END;
$$;

REVOKE ALL ON FUNCTION "public"."identity_search_visibility_rank"(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION "public"."sync_local_profile_search_visibility_from_privacy"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE "public"."LocalProfile" lp
  SET
    "search_visibility" = NEW."search_visibility"::text,
    "updated_at" = now()
  WHERE lp."user_id" = NEW."user_id"
    AND lp."search_visibility" IS DISTINCT FROM NEW."search_visibility"::text;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION "public"."sync_local_profile_search_visibility_from_privacy"() FROM PUBLIC;

DROP TRIGGER IF EXISTS "sync_local_profile_search_visibility_from_privacy"
  ON "public"."UserPrivacySettings";
CREATE TRIGGER "sync_local_profile_search_visibility_from_privacy"
  AFTER INSERT OR UPDATE OF "search_visibility"
  ON "public"."UserPrivacySettings"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."sync_local_profile_search_visibility_from_privacy"();

CREATE OR REPLACE FUNCTION "public"."enforce_local_profile_account_search_visibility"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_visibility text;
BEGIN
  SELECT ups."search_visibility"::text
  INTO account_visibility
  FROM "public"."UserPrivacySettings" ups
  WHERE ups."user_id" = NEW."user_id";

  IF account_visibility IS NOT NULL
     AND "public"."identity_search_visibility_rank"(account_visibility)
       < "public"."identity_search_visibility_rank"(NEW."search_visibility") THEN
    NEW."search_visibility" = account_visibility;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION "public"."enforce_local_profile_account_search_visibility"() FROM PUBLIC;

DROP TRIGGER IF EXISTS "enforce_local_profile_account_search_visibility"
  ON "public"."LocalProfile";
CREATE TRIGGER "enforce_local_profile_account_search_visibility"
  BEFORE INSERT OR UPDATE OF "search_visibility", "user_id"
  ON "public"."LocalProfile"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."enforce_local_profile_account_search_visibility"();

UPDATE "public"."LocalProfile" lp
SET
  "search_visibility" = ups."search_visibility"::text,
  "updated_at" = now()
FROM "public"."UserPrivacySettings" ups
WHERE ups."user_id" = lp."user_id"
  AND "public"."identity_search_visibility_rank"(ups."search_visibility"::text)
    < "public"."identity_search_visibility_rank"(lp."search_visibility");

CREATE OR REPLACE VIEW "public"."PublicLocalProfileView" AS
SELECT
  lp."id",
  lp."handle",
  lp."handle_normalized",
  lp."display_name",
  lp."avatar_url",
  lp."bio",
  lp."tagline",
  CASE WHEN lp."show_neighborhood" IS TRUE THEN lp."public_city" ELSE NULL END AS "public_city",
  CASE WHEN lp."show_neighborhood" IS TRUE THEN lp."public_state" ELSE NULL END AS "public_state",
  CASE WHEN lp."show_neighborhood" IS TRUE THEN lp."public_neighborhood" ELSE NULL END AS "public_neighborhood",
  lp."show_verified_resident_badge",
  lp."show_home_affiliation",
  lp."show_neighborhood",
  lp."profile_visibility",
  lp."created_at",
  lp."updated_at"
FROM "public"."LocalProfile" lp
LEFT JOIN "public"."UserPrivacySettings" ups
  ON ups."user_id" = lp."user_id"
WHERE lp."profile_visibility" = 'public'
  AND lp."search_visibility" = 'everyone'
  AND COALESCE(ups."search_visibility"::text, 'everyone') = 'everyone';

GRANT SELECT ON TABLE "public"."PublicLocalProfileView" TO "anon", "authenticated", "service_role";

DROP POLICY IF EXISTS "LocalProfile_public_read" ON "public"."LocalProfile";
CREATE POLICY "LocalProfile_public_read"
  ON "public"."LocalProfile"
  FOR SELECT
  USING ("profile_visibility" = 'public' AND "search_visibility" = 'everyone');
