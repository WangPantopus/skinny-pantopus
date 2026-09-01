-- ============================================================================
-- Migration: Alert Notification History
--
-- Tracks which weather alerts and AQI spikes have already been sent as
-- push notifications per geohash, preventing duplicate notifications.
-- Used by the real-time alert checker Lambda.
-- ============================================================================

-- ============================================================================
-- 1. AlertNotificationHistory — dedup table for real-time alert pushes
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."AlertNotificationHistory" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "alert_type"      text NOT NULL CHECK ("alert_type" IN ('weather', 'aqi', 'reminder', 'mail')),
  "alert_id"        text NOT NULL,
  "geohash"         text NOT NULL,
  "severity"        text DEFAULT NULL,
  "headline"        text DEFAULT NULL,
  "users_notified"  integer NOT NULL DEFAULT 0,
  "payload_json"    jsonb DEFAULT NULL,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "expires_at"      timestamptz DEFAULT NULL,

  -- One notification per alert per geohash
  CONSTRAINT "AlertNotificationHistory_alert_geohash_key"
    UNIQUE ("alert_type", "alert_id", "geohash")
);

ALTER TABLE "public"."AlertNotificationHistory" OWNER TO "postgres";

-- Lookup: find if an alert has already been sent for a geohash
CREATE INDEX idx_anh_lookup
  ON "public"."AlertNotificationHistory" ("alert_type", "alert_id", "geohash");

-- Cleanup: purge expired entries
CREATE INDEX idx_anh_expires
  ON "public"."AlertNotificationHistory" ("expires_at");

-- ============================================================================
-- 2. Row Level Security — service role only
-- ============================================================================
ALTER TABLE "public"."AlertNotificationHistory" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on alert history"
  ON "public"."AlertNotificationHistory"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE "public"."AlertNotificationHistory" TO "service_role";
