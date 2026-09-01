-- ============================================================
-- MIGRATION 081: Add missing safety_alert_kind enum values
--
-- The frontend uses: theft, vandalism, suspicious, hazard, scam, other
-- The DB enum only had the legacy set. Add the missing values.
-- ============================================================

ALTER TYPE "public"."safety_alert_kind" ADD VALUE IF NOT EXISTS 'theft';
ALTER TYPE "public"."safety_alert_kind" ADD VALUE IF NOT EXISTS 'vandalism';
ALTER TYPE "public"."safety_alert_kind" ADD VALUE IF NOT EXISTS 'suspicious';
ALTER TYPE "public"."safety_alert_kind" ADD VALUE IF NOT EXISTS 'hazard';
ALTER TYPE "public"."safety_alert_kind" ADD VALUE IF NOT EXISTS 'scam';
ALTER TYPE "public"."safety_alert_kind" ADD VALUE IF NOT EXISTS 'other';
