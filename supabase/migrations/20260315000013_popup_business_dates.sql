-- Add active_from/active_until to BusinessProfile for pop-up/temporary businesses
ALTER TABLE "public"."BusinessProfile"
  ADD COLUMN IF NOT EXISTS "active_from" timestamptz,
  ADD COLUMN IF NOT EXISTS "active_until" timestamptz;

CREATE INDEX IF NOT EXISTS "idx_bp_popup_active"
  ON "public"."BusinessProfile" ("active_until")
  WHERE "active_until" IS NOT NULL;
