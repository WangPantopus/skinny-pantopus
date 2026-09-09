-- ============================================================================
-- Migration: Hub Briefing Delivery Log + Context Cache
--
-- DailyBriefingDelivery: idempotent delivery log for the daily briefing
-- scheduler. One row per user per local day ensures no duplicate sends.
--
-- ContextCache: provider-aware, geohash-keyed cache for normalized weather,
-- AQI, and alert data. Complements ExternalFeedCache (which is keyed by
-- provider + place_key) with geohash-based lookups for briefing fan-out.
-- ============================================================================

-- ============================================================================
-- 1. DailyBriefingDelivery
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."DailyBriefingDelivery" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"             uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "briefing_date_local" date NOT NULL,
  "scheduled_for_utc"   timestamptz NOT NULL,
  "delivered_at"        timestamptz DEFAULT NULL,
  "status"              text NOT NULL DEFAULT 'queued'
                        CHECK ("status" IN (
                          'queued', 'composing', 'sent', 'skipped', 'failed'
                        )),
  "skip_reason"         text DEFAULT NULL,
  "summary_text"        text DEFAULT NULL,
  "signals_snapshot"    jsonb DEFAULT NULL,
  "location_geohash"    text DEFAULT NULL,
  "composition_mode"    text DEFAULT NULL
                        CHECK ("composition_mode" IN ('template', 'ai_polished')),
  "ai_tokens_used"      integer DEFAULT 0,
  "notification_id"     uuid DEFAULT NULL,
  "error_message"       text DEFAULT NULL,
  "created_at"          timestamptz NOT NULL DEFAULT now(),

  -- Idempotency: one briefing per user per local calendar day
  CONSTRAINT "DailyBriefingDelivery_user_date_key"
    UNIQUE ("user_id", "briefing_date_local")
);

ALTER TABLE "public"."DailyBriefingDelivery" OWNER TO "postgres";

-- Scheduler retry: find queued/failed deliveries within a time window
CREATE INDEX idx_dbd_status_scheduled
  ON "public"."DailyBriefingDelivery" ("status", "scheduled_for_utc");

-- User delivery history (profile / debugging)
CREATE INDEX idx_dbd_user_history
  ON "public"."DailyBriefingDelivery" ("user_id", "created_at" DESC);

-- ============================================================================
-- 2. ContextCache
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."ContextCache" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider"        text NOT NULL,
  "context_type"    text NOT NULL
                    CHECK ("context_type" IN (
                      'weather_current', 'weather_hourly', 'weather_daily',
                      'aqi', 'alerts'
                    )),
  "geohash"         text NOT NULL,
  "timezone"        text DEFAULT NULL,
  "fetched_at"      timestamptz NOT NULL DEFAULT now(),
  "expires_at"      timestamptz NOT NULL,
  "payload_json"    jsonb NOT NULL,
  "provider_status" text NOT NULL DEFAULT 'ok'
                    CHECK ("provider_status" IN (
                      'ok', 'partial', 'error', 'fallback'
                    )),
  "error_code"      text DEFAULT NULL,
  "created_at"      timestamptz NOT NULL DEFAULT now(),

  -- Upsert key: one entry per provider + type + geohash
  CONSTRAINT "ContextCache_provider_type_geohash_key"
    UNIQUE ("provider", "context_type", "geohash")
);

ALTER TABLE "public"."ContextCache" OWNER TO "postgres";

-- Cleanup: find expired entries
CREATE INDEX idx_cc_expires
  ON "public"."ContextCache" ("expires_at");

-- Cache lookup: find valid entry by provider + type + geohash
CREATE INDEX idx_cc_lookup
  ON "public"."ContextCache" ("provider", "context_type", "geohash", "expires_at");

-- ============================================================================
-- 3. Row Level Security
-- ============================================================================

-- DailyBriefingDelivery: users can read their own delivery history
ALTER TABLE "public"."DailyBriefingDelivery" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own briefing deliveries"
  ON "public"."DailyBriefingDelivery"
  FOR SELECT
  USING (auth.uid() = "user_id");

CREATE POLICY "Service role full access on briefing deliveries"
  ON "public"."DailyBriefingDelivery"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE "public"."DailyBriefingDelivery" TO "service_role";

-- ContextCache: service role only (no user-facing access)
ALTER TABLE "public"."ContextCache" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on context cache"
  ON "public"."ContextCache"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE "public"."ContextCache" TO "service_role";
