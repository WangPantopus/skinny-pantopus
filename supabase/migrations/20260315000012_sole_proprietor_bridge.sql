-- Add personal_user_id FK to BusinessProfile for sole_proprietor bridging
ALTER TABLE "public"."BusinessProfile"
  ADD COLUMN IF NOT EXISTS "personal_user_id" uuid REFERENCES "public"."User"("id");

CREATE INDEX IF NOT EXISTS "idx_bp_personal_user_id"
  ON "public"."BusinessProfile" ("personal_user_id")
  WHERE "personal_user_id" IS NOT NULL;
