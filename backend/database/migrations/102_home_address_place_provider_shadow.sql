-- Migration 102: HomeAddress place-provider shadow fields
--
-- Phase 1 foundation for provider-backed place classification.
-- These columns are additive and remain shadow-only until a later rollout
-- activates provider-backed classification for live decisioning.

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "google_place_id" text;

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "google_place_primary_type" text;

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "google_business_status" text;

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "google_place_name" text;

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "verification_level" text;

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "risk_flags" text[] DEFAULT ARRAY[]::text[];

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "provider_versions" jsonb DEFAULT '{}'::jsonb;

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "last_place_validated_at" timestamptz;

CREATE INDEX IF NOT EXISTS idx_home_address_google_place_id
  ON "HomeAddress" ("google_place_id")
  WHERE "google_place_id" IS NOT NULL;
