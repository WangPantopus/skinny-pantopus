-- ============================================================================
-- Migration: Community Content Seeder — Curator Account Type + Seeder Tables
--
-- Adds support for a "curator" account type (a branded platform account that
-- posts local news, events, and seasonal tips to The Pulse during cold-start).
--
-- Creates:
--   1. Adds 'curator' to User.account_type CHECK constraint
--   2. seeder_content_queue table (content pipeline state machine)
--   3. seeder_config table (per-region curator configuration)
--   4. get_seeder_tapering_metrics() RPC function (organic activity metrics)
-- ============================================================================

-- ============================================================================
-- 1. User.account_type — add 'curator' to allowed values
-- ============================================================================

-- Drop the existing CHECK constraint and re-create with 'curator' included.
-- Existing rows keep their current value ('individual' or 'business').
ALTER TABLE "public"."User"
  DROP CONSTRAINT IF EXISTS "User_account_type_check";

ALTER TABLE "public"."User"
  ADD CONSTRAINT "User_account_type_check"
  CHECK (("account_type")::text = ANY (
    ARRAY['individual', 'business', 'curator']::text[]
  ));

-- ============================================================================
-- 2. seeder_content_queue — content pipeline state machine
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."seeder_content_queue" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source"          text NOT NULL,                    -- e.g. 'rss:oregonlive', 'seasonal:engine'
  "source_url"      text,                             -- original URL for attribution
  "raw_title"       text NOT NULL,
  "raw_body"        text,
  "region"          text NOT NULL
                      CHECK ("region" IN ('clark_county', 'portland_metro', 'both')),
  "category"        text NOT NULL
                      CHECK ("category" IN ('local_news', 'event', 'weather', 'seasonal',
                                            'community_resource', 'safety')),
  "fetched_at"      timestamptz NOT NULL DEFAULT now(),
  "status"          text NOT NULL DEFAULT 'queued'
                      CHECK ("status" IN ('queued', 'filtered_out', 'humanized',
                                          'posted', 'skipped', 'failed')),
  "humanized_text"  text,
  "post_id"         uuid REFERENCES "public"."Post"("id") ON DELETE SET NULL,
  "scheduled_for"   timestamptz,
  "dedup_hash"      text NOT NULL,
  "parent_id"       uuid REFERENCES "public"."seeder_content_queue"("id") ON DELETE SET NULL,
  "failure_reason"  text,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."seeder_content_queue" OWNER TO "postgres";

-- Indexes
CREATE INDEX idx_seeder_queue_status
  ON "public"."seeder_content_queue" ("status");

CREATE INDEX idx_seeder_queue_region
  ON "public"."seeder_content_queue" ("region");

CREATE INDEX idx_seeder_queue_fetched
  ON "public"."seeder_content_queue" ("fetched_at" DESC);

-- Unique partial index: prevent duplicate content that is still active
CREATE UNIQUE INDEX idx_seeder_queue_dedup
  ON "public"."seeder_content_queue" ("dedup_hash")
  WHERE "status" NOT IN ('filtered_out', 'skipped');

-- RLS: service_role only (Lambda accesses via service role key)
ALTER TABLE "public"."seeder_content_queue" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seeder_queue_service"
  ON "public"."seeder_content_queue"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE "public"."seeder_content_queue" TO "service_role";

-- ============================================================================
-- 3. seeder_config — per-region curator configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."seeder_config" (
  "region"                text PRIMARY KEY,
  "curator_user_id"       uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE RESTRICT,
  "active"                boolean NOT NULL DEFAULT true,
  "max_posts_per_day"     integer NOT NULL DEFAULT 3,
  "tapering_thresholds"   jsonb NOT NULL DEFAULT '{
    "full":    {"organic_posts_per_day": 1,  "active_posters_7d": 5},
    "reduced": {"organic_posts_per_day": 2,  "active_posters_7d": 10},
    "minimal": {"organic_posts_per_day": 5,  "active_posters_7d": 15},
    "dormant": {"organic_posts_per_day": 10, "active_posters_7d": 20}
  }'::jsonb,
  "active_sources"        jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "updated_at"            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."seeder_config" OWNER TO "postgres";

-- RLS: service_role only
ALTER TABLE "public"."seeder_config" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seeder_config_service"
  ON "public"."seeder_config"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE "public"."seeder_config" TO "service_role";

-- ============================================================================
-- 4. get_seeder_tapering_metrics() — organic activity metrics for tapering
--
-- Uses the Post table's "location" geography(Point,4326) column with
-- ST_DWithin for geographic scoping (consistent with existing RPC functions
-- in the codebase like find_businesses_nearby).
-- Falls back to effective_latitude/effective_longitude for posts where
-- the geography column is NULL.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."get_seeder_tapering_metrics"(
  region_lat double precision,
  region_lng double precision,
  region_radius_meters integer
)
RETURNS TABLE (
  avg_daily_posts numeric,
  active_posters integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_center geography;
BEGIN
  v_center := ST_SetSRID(ST_MakePoint(region_lng, region_lat), 4326)::geography;

  RETURN QUERY
  SELECT
    -- Average organic posts per day over the last 7 days
    COALESCE(
      ROUND(COUNT(*)::numeric / 7, 2),
      0
    ) AS avg_daily_posts,
    -- Distinct non-curator users who posted in the last 7 days
    COALESCE(
      COUNT(DISTINCT p."user_id")::integer,
      0
    ) AS active_posters
  FROM "public"."Post" p
  JOIN "public"."User" u ON p."user_id" = u."id"
  WHERE u."account_type" != 'curator'
    AND p."created_at" > now() - interval '7 days'
    AND p."archived_at" IS NULL
    AND (
      -- Primary: use the geography column if available
      (p."location" IS NOT NULL AND ST_DWithin(p."location", v_center, region_radius_meters))
      OR
      -- Fallback: use effective_latitude/effective_longitude
      (p."location" IS NULL
       AND p."effective_latitude" IS NOT NULL
       AND p."effective_longitude" IS NOT NULL
       AND ST_DWithin(
         ST_SetSRID(ST_MakePoint(p."effective_longitude", p."effective_latitude"), 4326)::geography,
         v_center,
         region_radius_meters
       ))
    );
END;
$$;

-- Grant execute to service_role (Lambda calls this via Supabase RPC)
GRANT EXECUTE ON FUNCTION "public"."get_seeder_tapering_metrics"(double precision, double precision, integer)
  TO "service_role";

-- ============================================================================
-- ROLLBACK (run manually if you need to revert this migration)
-- ============================================================================
-- DROP FUNCTION IF EXISTS "public"."get_seeder_tapering_metrics"(double precision, double precision, integer);
-- DROP TABLE IF EXISTS "public"."seeder_config";
-- DROP TABLE IF EXISTS "public"."seeder_content_queue";
-- ALTER TABLE "public"."User" DROP CONSTRAINT IF EXISTS "User_account_type_check";
-- ALTER TABLE "public"."User" ADD CONSTRAINT "User_account_type_check"
--   CHECK (("account_type")::text = ANY (ARRAY['individual', 'business']::text[]));
