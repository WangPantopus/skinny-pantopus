-- Migration 087: Fix push_notifications default and enable for existing token holders
--
-- The push_notifications column previously defaulted to false, which meant
-- users who accepted push on their device still had push disabled at the
-- preference level. This migration:
--   1. Changes the column default to true for new rows.
--   2. Enables push for any user who already has a registered push token
--      but whose MailPreferences row has push_notifications = false.
--   3. Creates a MailPreferences row (with push enabled) for users who have
--      a push token but no MailPreferences row at all.

-- 1. Change the column default
ALTER TABLE "public"."MailPreferences"
  ALTER COLUMN "push_notifications" SET DEFAULT true;

-- 2. Enable push for existing users with tokens who have it disabled
UPDATE "public"."MailPreferences"
SET "push_notifications" = true,
    "updated_at" = now()
WHERE "push_notifications" = false
  AND "user_id" IN (
    SELECT DISTINCT "user_id" FROM "public"."PushToken"
  );

-- 3. Create preference rows for users who have tokens but no preferences
INSERT INTO "public"."MailPreferences" ("user_id", "push_notifications")
SELECT DISTINCT pt."user_id", true
FROM "public"."PushToken" pt
LEFT JOIN "public"."MailPreferences" mp ON mp."user_id" = pt."user_id"
WHERE mp."user_id" IS NULL;
