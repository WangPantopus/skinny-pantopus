-- ============================================================================
-- Migration: AttomPropertyCache — stores exact raw ATTOM endpoint responses
-- per Home so future property-detail lookups can be served from the DB.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."AttomPropertyCache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "home_id" uuid NOT NULL REFERENCES "public"."Home"("id") ON DELETE CASCADE,
  "raw_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "fetched_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_attom_property_cache_home UNIQUE ("home_id")
);

CREATE INDEX IF NOT EXISTS idx_attom_property_cache_home
  ON "public"."AttomPropertyCache" ("home_id");

CREATE INDEX IF NOT EXISTS idx_attom_property_cache_expires
  ON "public"."AttomPropertyCache" ("expires_at");

ALTER TABLE "public"."AttomPropertyCache" ENABLE ROW LEVEL SECURITY;
