-- ============================================================
-- 196: FunnelEvent — two more client beacons (Wedge v2 metrics)
--
--   t0_aha_viewed     the aha card rendered (meta: section_id, tone, grade)
--   t0_share_clicked  "Share this address" tapped (meta: method)
--
-- The aha rate (non-calm aha cards / previews) and the share rate are
-- the two numbers D1 and D5 are judged by; both were unmeasurable.
-- ============================================================

ALTER TABLE "public"."FunnelEvent" DROP CONSTRAINT IF EXISTS "funnelevent_type_check";
ALTER TABLE "public"."FunnelEvent" ADD CONSTRAINT "funnelevent_type_check" CHECK (
  "event_type" IN (
    't0_preview_viewed',
    't0_aha_viewed',
    't0_share_clicked',
    't0_wall_viewed',
    'register_started',
    't1_account_created'
  )
);
