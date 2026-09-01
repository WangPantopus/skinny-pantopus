-- Enable Beacon / audience-profile functionality as a normal shipped app
-- feature. Explicit env kill switches and admin flag updates can still
-- disable related surfaces after this migration.
--
-- Idempotent: safe to re-run.

INSERT INTO "public"."FeatureFlag" (
  "flag_name",
  "description",
  "enabled_globally"
)
VALUES (
  'audience_profile',
  'Beacon / audience profile feature.',
  true
)
ON CONFLICT ("flag_name") DO UPDATE
SET
  "enabled_globally" = true,
  "updated_at" = now();
