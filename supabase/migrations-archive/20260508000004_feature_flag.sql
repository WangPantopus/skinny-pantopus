-- Phase 0 / P0.8: Feature flag table for gating audience-profile rollout.
--
-- Audience Profile design v2 §19 acceptance criterion 15: the feature
-- ships behind a flag, default OFF in production for the first 30 days,
-- with a beta cohort and an internal-team escape hatch. This migration
-- creates the table; the flag value itself starts off-by-default so a
-- production deploy of this migration is invisible.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "public"."FeatureFlag" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "flag_name" text NOT NULL UNIQUE,
  "enabled_globally" boolean NOT NULL DEFAULT false,
  "enabled_for_internal_team" boolean NOT NULL DEFAULT false,
  "beta_user_ids" uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  "description" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_feature_flag_name"
  ON "public"."FeatureFlag" ("flag_name");

-- Seed the audience-profile flag in its safe default state. enabled_globally
-- and enabled_for_internal_team are false; beta_user_ids is empty. Phase 1
-- enables enabled_for_internal_team after the implementation is in place
-- and adds beta users via the admin route.
INSERT INTO "public"."FeatureFlag" ("flag_name", "description")
VALUES (
  'audience_profile',
  'Public Profile + paid tier feature; see docs/audience-profile-tier-ladder-design-2026-05-08-v2.md.'
)
ON CONFLICT ("flag_name") DO NOTHING;

-- Tighten access. anon / authenticated never need to read the full flag
-- row (the public endpoint returns a boolean only); service_role does.
ALTER TABLE "public"."FeatureFlag" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."FeatureFlag" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."FeatureFlag" TO "service_role";
