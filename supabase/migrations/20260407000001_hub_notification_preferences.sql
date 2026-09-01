-- ============================================================================
-- Migration: Hub Notification Preferences
--
-- Creates UserNotificationPreferences table for granular per-topic push
-- notification controls, daily briefing scheduling, quiet hours, and
-- location overrides. Supports the Hub context engine and daily briefing
-- Lambda scheduler.
-- ============================================================================

-- ============================================================================
-- 1. Trigger function for auto-updating updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. UserNotificationPreferences table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."UserNotificationPreferences" (
  "id"                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"                   uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "daily_briefing_enabled"    boolean NOT NULL DEFAULT false,
  "daily_briefing_time_local" time NOT NULL DEFAULT '07:30',
  "daily_briefing_timezone"   text NOT NULL DEFAULT 'America/Los_Angeles',
  "weather_alerts_enabled"    boolean NOT NULL DEFAULT true,
  "aqi_alerts_enabled"        boolean NOT NULL DEFAULT true,
  "mail_summary_enabled"      boolean NOT NULL DEFAULT true,
  "gig_updates_enabled"       boolean NOT NULL DEFAULT true,
  "home_reminders_enabled"    boolean NOT NULL DEFAULT true,
  "quiet_hours_start_local"   time DEFAULT NULL,
  "quiet_hours_end_local"     time DEFAULT NULL,
  "location_mode"             text NOT NULL DEFAULT 'primary_home'
                              CHECK ("location_mode" IN (
                                'viewing_location', 'primary_home',
                                'device_location', 'custom'
                              )),
  "custom_latitude"           numeric(10,7) DEFAULT NULL,
  "custom_longitude"          numeric(10,7) DEFAULT NULL,
  "custom_label"              text DEFAULT NULL,
  "created_at"                timestamptz NOT NULL DEFAULT now(),
  "updated_at"                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "UserNotificationPreferences_user_id_key" UNIQUE ("user_id")
);

ALTER TABLE "public"."UserNotificationPreferences" OWNER TO "postgres";

-- ============================================================================
-- 3. Indexes
-- ============================================================================

-- Scheduler lookup: find all users with briefing enabled in a given timezone
CREATE INDEX idx_unp_briefing_schedule
  ON "public"."UserNotificationPreferences" ("daily_briefing_enabled", "daily_briefing_timezone");

-- Explicit user_id index (unique constraint creates one, but named for clarity)
CREATE INDEX idx_unp_user_id
  ON "public"."UserNotificationPreferences" ("user_id");

-- ============================================================================
-- 4. Auto-update updated_at trigger
-- ============================================================================
CREATE TRIGGER "trg_unp_set_updated_at"
  BEFORE UPDATE ON "public"."UserNotificationPreferences"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."set_updated_at"();

-- ============================================================================
-- 5. Row Level Security
-- ============================================================================
ALTER TABLE "public"."UserNotificationPreferences" ENABLE ROW LEVEL SECURITY;

-- Users can read and manage their own preference row
CREATE POLICY "Users can manage own preferences"
  ON "public"."UserNotificationPreferences"
  FOR ALL
  USING (auth.uid() = "user_id")
  WITH CHECK (auth.uid() = "user_id");

-- Service role bypass for Lambda scheduler (queries all users by timezone)
CREATE POLICY "Service role full access"
  ON "public"."UserNotificationPreferences"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE "public"."UserNotificationPreferences" TO "service_role";
