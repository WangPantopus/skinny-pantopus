-- Migration 152: Tag PushToken rows with platform + provider.
--
-- The native push migration (docs/push-native-migration.md) delivers
-- through APNs (iOS) and FCM (Android) directly instead of Expo. To route
-- a stored token to the right transport, every row records:
--   platform — 'ios' | 'android' (nullable for legacy Expo rows)
--   provider — 'apns' | 'fcm' | 'expo'
--
-- Columns are added nullable so the deploy is safe ahead of the code that
-- writes them; the send path falls back to token-format sniffing for any
-- row left without a provider.

ALTER TABLE "public"."PushToken"
  ADD COLUMN IF NOT EXISTS "platform" "text",
  ADD COLUMN IF NOT EXISTS "provider" "text";

-- Backfill: every existing token is an Expo token (ExponentPushToken[...]).
UPDATE "public"."PushToken"
SET "provider" = 'expo'
WHERE "provider" IS NULL
  AND ("token" LIKE 'ExponentPushToken[%' OR "token" LIKE 'ExpoPushToken[%');

-- Provider-filtered lookups (dual-write window + future Expo-row trimming).
CREATE INDEX IF NOT EXISTS "idx_push_token_provider" ON "public"."PushToken" ("provider");
