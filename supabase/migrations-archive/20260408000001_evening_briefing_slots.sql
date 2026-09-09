-- ============================================================================
-- Migration: Evening briefing preferences and delivery slots
--
-- Adds an evening briefing preference/time, backfills defaults, and updates
-- DailyBriefingDelivery idempotency to be one row per user per local day per
-- briefing slot.
-- ============================================================================

ALTER TABLE IF EXISTS "public"."UserNotificationPreferences"
  ADD COLUMN IF NOT EXISTS "evening_briefing_enabled" boolean;

ALTER TABLE IF EXISTS "public"."UserNotificationPreferences"
  ADD COLUMN IF NOT EXISTS "evening_briefing_time_local" time without time zone;

UPDATE "public"."UserNotificationPreferences"
SET
  "evening_briefing_enabled" = COALESCE("evening_briefing_enabled", true),
  "evening_briefing_time_local" = COALESCE("evening_briefing_time_local", '18:00'::time);

ALTER TABLE IF EXISTS "public"."UserNotificationPreferences"
  ALTER COLUMN "evening_briefing_enabled" SET DEFAULT true;

ALTER TABLE IF EXISTS "public"."UserNotificationPreferences"
  ALTER COLUMN "evening_briefing_time_local" SET DEFAULT '18:00'::time;

ALTER TABLE IF EXISTS "public"."UserNotificationPreferences"
  ALTER COLUMN "evening_briefing_enabled" SET NOT NULL;

ALTER TABLE IF EXISTS "public"."UserNotificationPreferences"
  ALTER COLUMN "evening_briefing_time_local" SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unp_evening_schedule
  ON "public"."UserNotificationPreferences" ("evening_briefing_enabled", "daily_briefing_timezone");

WITH inferred_defaults AS (
  SELECT
    u."id" AS "user_id",
    CASE
      WHEN h."map_center_lat" IS NOT NULL AND h."map_center_lng" IS NOT NULL AND h."map_center_lat" < 23 AND h."map_center_lng" < -154 THEN 'Pacific/Honolulu'
      WHEN h."map_center_lat" IS NOT NULL AND h."map_center_lng" IS NOT NULL AND (h."map_center_lat" > 51 OR h."map_center_lng" < -130) THEN 'America/Anchorage'
      WHEN h."map_center_lng" IS NOT NULL AND h."map_center_lng" < -114.5 THEN 'America/Los_Angeles'
      WHEN h."map_center_lng" IS NOT NULL AND h."map_center_lng" < -102 THEN 'America/Denver'
      WHEN h."map_center_lng" IS NOT NULL AND h."map_center_lng" < -87 THEN 'America/Chicago'
      WHEN h."map_center_lng" IS NOT NULL THEN 'America/New_York'
      ELSE 'America/Los_Angeles'
    END AS "daily_briefing_timezone"
  FROM "public"."User" u
  LEFT JOIN LATERAL (
    SELECT hm."map_center_lat", hm."map_center_lng"
    FROM "public"."HomeOccupancy" ho
    JOIN "public"."Home" hm ON hm."id" = ho."home_id"
    WHERE ho."user_id" = u."id"
      AND ho."is_active" = true
    LIMIT 1
  ) h ON true
)
INSERT INTO "public"."UserNotificationPreferences" (
  "user_id",
  "daily_briefing_enabled",
  "daily_briefing_time_local",
  "daily_briefing_timezone",
  "evening_briefing_enabled",
  "evening_briefing_time_local",
  "weather_alerts_enabled",
  "aqi_alerts_enabled",
  "mail_summary_enabled",
  "gig_updates_enabled",
  "home_reminders_enabled",
  "quiet_hours_start_local",
  "quiet_hours_end_local",
  "location_mode",
  "custom_latitude",
  "custom_longitude",
  "custom_label",
  "created_at",
  "updated_at"
)
SELECT
  d."user_id",
  false,
  '07:30'::time,
  d."daily_briefing_timezone",
  true,
  '18:00'::time,
  true,
  true,
  true,
  true,
  true,
  null,
  null,
  'primary_home',
  null,
  null,
  null,
  now(),
  now()
FROM inferred_defaults d
WHERE NOT EXISTS (
  SELECT 1
  FROM "public"."UserNotificationPreferences" p
  WHERE p."user_id" = d."user_id"
);

ALTER TABLE IF EXISTS "public"."DailyBriefingDelivery"
  ADD COLUMN IF NOT EXISTS "briefing_kind" text;

UPDATE "public"."DailyBriefingDelivery"
SET "briefing_kind" = COALESCE("briefing_kind", 'morning');

ALTER TABLE IF EXISTS "public"."DailyBriefingDelivery"
  ALTER COLUMN "briefing_kind" SET DEFAULT 'morning';

ALTER TABLE IF EXISTS "public"."DailyBriefingDelivery"
  ALTER COLUMN "briefing_kind" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DailyBriefingDelivery_briefing_kind_check'
  ) THEN
    ALTER TABLE "public"."DailyBriefingDelivery"
      ADD CONSTRAINT "DailyBriefingDelivery_briefing_kind_check"
      CHECK ("briefing_kind" IN ('morning', 'evening'));
  END IF;
END $$;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public."DailyBriefingDelivery"'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%user_id%'
      AND pg_get_constraintdef(oid) ILIKE '%briefing_date_local%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%briefing_kind%'
  LOOP
    EXECUTE format('ALTER TABLE "public"."DailyBriefingDelivery" DROP CONSTRAINT IF EXISTS %I', rec.conname);
  END LOOP;
END $$;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'DailyBriefingDelivery'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
      AND indexdef ILIKE '%user_id%'
      AND indexdef ILIKE '%briefing_date_local%'
      AND indexdef NOT ILIKE '%briefing_kind%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS "public".%I', rec.indexname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DailyBriefingDelivery_user_date_kind_key"
  ON "public"."DailyBriefingDelivery" ("user_id", "briefing_date_local", "briefing_kind");
