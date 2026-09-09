-- Add explicit opt-in for searching private account name fields.
--
-- LocalProfile.display_name remains searchable through the local profile. This
-- flag controls whether User.name / first_name / middle_name / last_name can be
-- used as internal match keys for people who already pass search visibility.

ALTER TABLE "public"."UserPrivacySettings"
  ADD COLUMN IF NOT EXISTS "findable_by_name" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_userprivacysettings_findable_by_name"
  ON "public"."UserPrivacySettings" USING btree ("findable_by_name");
