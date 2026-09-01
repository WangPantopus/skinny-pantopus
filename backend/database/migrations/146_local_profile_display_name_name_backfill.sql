-- Revert the local-profile default away from usernames.
--
-- Migration 133 moved LocalProfile.display_name to User.username for rows that
-- looked like they had inherited legal names. Product now wants local people
-- surfaces to show readable names again, while keeping username as the handle.
--
-- This migration updates only rows that still look like generated handle
-- defaults: blank display_name, display_name == User.username, or
-- display_name == LocalProfile.handle. Custom display names are preserved.

CREATE TABLE IF NOT EXISTS "public"."LocalProfileDisplayNameBackfillP146" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "local_profile_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "previous_display_name" text,
  "new_display_name" text NOT NULL,
  "matched_default" text NOT NULL CHECK ("matched_default" IN ('blank', 'username', 'handle')),
  "source_field" text NOT NULL CHECK ("source_field" IN ('name', 'full_name', 'first_name', 'username')),
  "migrated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "LocalProfileDisplayNameBackfillP146_local_profile_key" UNIQUE ("local_profile_id"),
  CONSTRAINT "LocalProfileDisplayNameBackfillP146_local_profile_fkey"
    FOREIGN KEY ("local_profile_id") REFERENCES "public"."LocalProfile"("id") ON DELETE CASCADE,
  CONSTRAINT "LocalProfileDisplayNameBackfillP146_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE
);

REVOKE ALL ON TABLE "public"."LocalProfileDisplayNameBackfillP146" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."LocalProfileDisplayNameBackfillP146" TO "service_role";

WITH candidates AS (
  SELECT
    lp."id" AS local_profile_id,
    u."id" AS user_id,
    lp."display_name" AS previous_display_name,
    candidate."new_display_name",
    CASE
      WHEN lp."display_name" IS NULL OR NULLIF(BTRIM(lp."display_name"), '') IS NULL THEN 'blank'
      WHEN NULLIF(BTRIM(u."username"), '') IS NOT NULL
        AND LOWER(BTRIM(lp."display_name")) = LOWER(BTRIM(u."username")) THEN 'username'
      ELSE 'handle'
    END AS matched_default,
    CASE
      WHEN NULLIF(BTRIM(u."name"), '') IS NOT NULL THEN 'name'
      WHEN NULLIF(BTRIM(CONCAT_WS(' ',
        NULLIF(BTRIM(u."first_name"), ''),
        NULLIF(BTRIM(u."middle_name"), ''),
        NULLIF(BTRIM(u."last_name"), '')
      )), '') IS NOT NULL THEN 'full_name'
      ELSE 'username'
    END AS source_field
  FROM "public"."LocalProfile" lp
  JOIN "public"."User" u ON u."id" = lp."user_id"
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      NULLIF(BTRIM(u."name"), ''),
      NULLIF(BTRIM(CONCAT_WS(' ',
        NULLIF(BTRIM(u."first_name"), ''),
        NULLIF(BTRIM(u."middle_name"), ''),
        NULLIF(BTRIM(u."last_name"), '')
      )), ''),
      NULLIF(BTRIM(u."first_name"), ''),
      NULLIF(BTRIM(u."username"), '')
    ) AS "new_display_name"
  ) candidate
  WHERE candidate."new_display_name" IS NOT NULL
    AND COALESCE(BTRIM(lp."display_name"), '') <> candidate."new_display_name"
    AND (
      lp."display_name" IS NULL
      OR NULLIF(BTRIM(lp."display_name"), '') IS NULL
      OR (
        NULLIF(BTRIM(u."username"), '') IS NOT NULL
        AND LOWER(BTRIM(lp."display_name")) = LOWER(BTRIM(u."username"))
      )
      OR (
        NULLIF(BTRIM(lp."handle"), '') IS NOT NULL
        AND LOWER(BTRIM(lp."display_name")) = LOWER(BTRIM(lp."handle"))
      )
    )
)
INSERT INTO "public"."LocalProfileDisplayNameBackfillP146" (
  "local_profile_id",
  "user_id",
  "previous_display_name",
  "new_display_name",
  "matched_default",
  "source_field"
)
SELECT
  "local_profile_id",
  "user_id",
  "previous_display_name",
  "new_display_name",
  "matched_default",
  "source_field"
FROM candidates
ON CONFLICT ("local_profile_id") DO NOTHING;

UPDATE "public"."LocalProfile" lp
SET
  "display_name" = mig."new_display_name",
  "updated_at" = now()
FROM "public"."LocalProfileDisplayNameBackfillP146" mig
WHERE mig."local_profile_id" = lp."id"
  AND lp."display_name" IS NOT DISTINCT FROM mig."previous_display_name";

INSERT INTO "public"."IdentityAuditLog" (
  "actor_user_id",
  "target_user_id",
  "action",
  "target_type",
  "target_id",
  "metadata"
)
SELECT
  NULL,
  mig."user_id",
  'display_name_name_backfill_p146',
  'LocalProfile',
  mig."local_profile_id"::text,
  jsonb_build_object(
    'previous_value', mig."previous_display_name",
    'new_value', mig."new_display_name",
    'matched_default', mig."matched_default",
    'source_field', mig."source_field",
    'migration', '146_local_profile_display_name_name_backfill'
  )
FROM "public"."LocalProfileDisplayNameBackfillP146" mig
WHERE NOT EXISTS (
  SELECT 1
  FROM "public"."IdentityAuditLog" al
  WHERE al."action" = 'display_name_name_backfill_p146'
    AND al."target_type" = 'LocalProfile'
    AND al."target_id" = mig."local_profile_id"::text
);
