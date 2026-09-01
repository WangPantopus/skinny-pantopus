-- ============================================================
-- Migration 075: Canonical Feed post_type values
--
-- Rewrites legacy post_type values to their canonical equivalents.
-- This is a forward-only migration — no dual-write period needed.
--
-- Mappings:
--   question       → ask_local
--   safety_alert   → alert
--   deals_promos   → deal
--   services_offers → service_offer
-- ============================================================

-- 1. Rewrite legacy post_type values in Post table
UPDATE "Post" SET post_type = 'ask_local'      WHERE post_type = 'question';
UPDATE "Post" SET post_type = 'alert'          WHERE post_type = 'safety_alert';
UPDATE "Post" SET post_type = 'deal'           WHERE post_type = 'deals_promos';
UPDATE "Post" SET post_type = 'service_offer'  WHERE post_type = 'services_offers';

-- 2. Drop and recreate the post_type CHECK constraint to enforce canonical values only.
--    The constraint name may vary by environment; use a conditional approach.
DO $$
BEGIN
  -- Try to drop existing constraint (name from migration 039)
  BEGIN
    ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_post_type_check";
  EXCEPTION WHEN undefined_object THEN
    NULL; -- constraint doesn't exist, continue
  END;

  -- Add canonical-only constraint
  ALTER TABLE "Post" ADD CONSTRAINT "Post_post_type_check" CHECK (
    post_type IN (
      -- Place types
      'ask_local', 'recommendation', 'event', 'lost_found',
      'alert', 'deal', 'local_update', 'neighborhood_win', 'visitor_guide',
      -- Non-Place Feed types
      'general', 'personal_update', 'announcement', 'service_offer',
      'resources_howto', 'progress_wins'
    )
  );
END $$;
