-- ============================================================
-- MIGRATION 039: Feed v1.1 — Post Type Expansion & Alert Kinds
--
-- Adds:
--   - New post_type values (CHECK constraint expansion)
--   - New safety_alert_kind enum values
--   - PostCategoryTTL entries for new types
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction.
--       Run this migration outside a transaction, or split into
--       two parts if your migration runner wraps in transactions.
-- ============================================================

-- ─── 1. EXPAND post_type CHECK CONSTRAINT ────────────────────
-- post_type is varchar(50) with a CHECK constraint

ALTER TABLE "public"."Post" DROP CONSTRAINT IF EXISTS "Post_post_type_check";

ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_post_type_check"
  CHECK (post_type IN (
    -- Legacy types
    'general', 'event', 'lost_found', 'recommendation',
    'question', 'complaint', 'announcement',
    'safety_alert', 'deals_promos', 'service_offer', 'poll',
    'services_offers', 'resources_howto', 'progress_wins',
    -- v1.1 Place types
    'ask_local', 'deal', 'alert', 'local_update',
    'neighborhood_win', 'visitor_guide',
    -- v1.1 Network type
    'personal_update'
  ));

-- ─── 2. EXPAND safety_alert_kind ENUM ────────────────────────
-- safety_alert_kind is a PostgreSQL enum (public.safety_alert_kind)
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS requires PG 12+
-- These CANNOT run inside a DO block / exception handler in a transaction

ALTER TYPE "public"."safety_alert_kind" ADD VALUE IF NOT EXISTS 'road_hazard';
ALTER TYPE "public"."safety_alert_kind" ADD VALUE IF NOT EXISTS 'power_outage';
ALTER TYPE "public"."safety_alert_kind" ADD VALUE IF NOT EXISTS 'weather_damage';
ALTER TYPE "public"."safety_alert_kind" ADD VALUE IF NOT EXISTS 'missing_pet';
ALTER TYPE "public"."safety_alert_kind" ADD VALUE IF NOT EXISTS 'official_notice';

-- ─── 3. PostCategoryTTL ENTRIES FOR NEW TYPES ────────────────
-- Original table has columns: post_type (varchar PK), ttl_days (integer)

INSERT INTO "public"."PostCategoryTTL" (post_type, ttl_days)
VALUES
  ('ask_local',         7),
  ('deal',              3),
  ('alert',             2),
  ('local_update',      7),
  ('neighborhood_win', 14),
  ('visitor_guide',    30),
  ('personal_update',   7)
ON CONFLICT (post_type) DO UPDATE SET ttl_days = EXCLUDED.ttl_days;

-- ─── 4. GRANTS ──────────────────────────────────────────────

GRANT ALL ON TABLE "public"."Post" TO "authenticated";
GRANT ALL ON TABLE "public"."Post" TO "service_role";
