-- Phase 0 / P0.2: Fix LocalProfile.display_name default.
--
-- Background: ensureLocalProfile and the 128 backfill seeded
-- LocalProfile.display_name from User.name (legal name). The Audience Profile
-- design v2 §16 item 1 calls this out as the highest-impact privacy bug:
-- every existing user's legal name was being silently published as their
-- public display name on the Local Profile surface.
--
-- This migration:
--   1. Captures every affected LocalProfile row into a snapshot table.
--   2. Updates display_name to User.username in place.
--   3. Writes an IdentityAuditLog row per affected user with action
--      'display_name_migrated_p0_2' for traceability.
--
-- A separate node script (backend/scripts/p0-2-send-display-name-migration-emails.js)
-- consumes the snapshot table and sends the one-time notification email,
-- marking each row as `email_sent_at = now()` so re-runs are idempotent.
--
-- Idempotent: safe to re-run. The snapshot table uses ON CONFLICT DO NOTHING
-- on local_profile_id; the UPDATE is guarded by the same WHERE clause that
-- selected the snapshot rows; the audit log is filtered to only insert rows
-- not already present for this action+target.

-- ---------------------------------------------------------------------------
-- 1. Snapshot table — captures the audit trail and drives the email job.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."LocalProfileDisplayNameMigrationP02" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "local_profile_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "previous_display_name" text NOT NULL,
  "new_display_name" text NOT NULL,
  "user_email" text,
  "user_username" text,
  "matched_field" text NOT NULL CHECK ("matched_field" IN ('name', 'first_name')),
  "migrated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "email_sent_at" timestamp with time zone,
  "email_failed_at" timestamp with time zone,
  "email_failure_reason" text,
  CONSTRAINT "LocalProfileDisplayNameMigrationP02_local_profile_key" UNIQUE ("local_profile_id"),
  CONSTRAINT "LocalProfileDisplayNameMigrationP02_local_profile_fkey"
    FOREIGN KEY ("local_profile_id") REFERENCES "public"."LocalProfile"("id") ON DELETE CASCADE,
  CONSTRAINT "LocalProfileDisplayNameMigrationP02_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_p02_email_pending"
  ON "public"."LocalProfileDisplayNameMigrationP02" ("migrated_at")
  WHERE "email_sent_at" IS NULL;

REVOKE ALL ON TABLE "public"."LocalProfileDisplayNameMigrationP02" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."LocalProfileDisplayNameMigrationP02" TO "service_role";

-- ---------------------------------------------------------------------------
-- 2. Capture affected rows. The "bad default" is any LocalProfile.display_name
--    that equals User.name (or fell back to User.first_name) AND does not
--    equal User.username. Users who manually edited their display_name to
--    something else are unaffected (their display_name is no longer in this
--    set).
-- ---------------------------------------------------------------------------
INSERT INTO "public"."LocalProfileDisplayNameMigrationP02" (
  "local_profile_id",
  "user_id",
  "previous_display_name",
  "new_display_name",
  "user_email",
  "user_username",
  "matched_field"
)
SELECT
  lp."id",
  u."id",
  lp."display_name",
  u."username",
  u."email",
  u."username",
  CASE
    WHEN NULLIF(u."name", '') IS NOT NULL AND lp."display_name" = u."name" THEN 'name'
    ELSE 'first_name'
  END
FROM "public"."LocalProfile" lp
JOIN "public"."User" u ON u."id" = lp."user_id"
WHERE NULLIF(u."username", '') IS NOT NULL
  AND lp."display_name" <> u."username"
  AND (
    (NULLIF(u."name", '') IS NOT NULL AND lp."display_name" = u."name")
    OR (NULLIF(u."first_name", '') IS NOT NULL AND lp."display_name" = u."first_name")
  )
ON CONFLICT ("local_profile_id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Apply the fix in place.
-- ---------------------------------------------------------------------------
UPDATE "public"."LocalProfile" lp
SET
  "display_name" = mig."new_display_name",
  "updated_at" = now()
FROM "public"."LocalProfileDisplayNameMigrationP02" mig
WHERE mig."local_profile_id" = lp."id"
  AND lp."display_name" = mig."previous_display_name";

-- ---------------------------------------------------------------------------
-- 4. Audit each migrated row. The legal-name value is recorded internally
--    (metadata.previous_value) so we can answer "what was changed and when"
--    later. The legal name is NEVER sent to the user — only the audit log
--    holds it.
-- ---------------------------------------------------------------------------
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
  'display_name_migrated_p0_2',
  'LocalProfile',
  mig."local_profile_id"::text,
  jsonb_build_object(
    'previous_value', mig."previous_display_name",
    'new_value', mig."new_display_name",
    'matched_field', mig."matched_field",
    'migration', '133_local_profile_display_name_username_default'
  )
FROM "public"."LocalProfileDisplayNameMigrationP02" mig
WHERE NOT EXISTS (
  SELECT 1
  FROM "public"."IdentityAuditLog" al
  WHERE al."action" = 'display_name_migrated_p0_2'
    AND al."target_type" = 'LocalProfile'
    AND al."target_id" = mig."local_profile_id"::text
);
