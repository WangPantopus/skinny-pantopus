-- ============================================================================
-- Migration: Gig Save & Gig Report
-- Supports saved tasks and moderation reports for gigs/tasks.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."GigSave" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "gig_id"     uuid NOT NULL REFERENCES "public"."Gig"("id") ON DELETE CASCADE,
  "user_id"    uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "GigSave_unique" UNIQUE ("gig_id", "user_id")
);

CREATE INDEX IF NOT EXISTS idx_gigsave_gig
  ON "public"."GigSave" ("gig_id");

CREATE INDEX IF NOT EXISTS idx_gigsave_user
  ON "public"."GigSave" ("user_id");

CREATE TABLE IF NOT EXISTS "public"."GigReport" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "gig_id"      uuid NOT NULL REFERENCES "public"."Gig"("id") ON DELETE CASCADE,
  "reported_by" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "reason"      varchar(100) NOT NULL,
  "details"     text,
  "status"      varchar(50) NOT NULL DEFAULT 'pending',
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "resolved_at" timestamptz,
  CONSTRAINT "GigReport_reason_check"
    CHECK ("reason" IN ('spam', 'harassment', 'inappropriate', 'misinformation', 'safety', 'other')),
  CONSTRAINT "GigReport_status_check"
    CHECK ("status" IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  CONSTRAINT "GigReport_unique" UNIQUE ("gig_id", "reported_by")
);

CREATE INDEX IF NOT EXISTS idx_gigreport_gig
  ON "public"."GigReport" ("gig_id");

CREATE INDEX IF NOT EXISTS idx_gigreport_status
  ON "public"."GigReport" ("status");

ALTER TABLE "public"."GigSave" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."GigReport" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gigsave_select_own" ON "public"."GigSave";
CREATE POLICY "gigsave_select_own"
  ON "public"."GigSave"
  FOR SELECT
  USING ("user_id" = auth.uid());

DROP POLICY IF EXISTS "gigsave_insert_own" ON "public"."GigSave";
CREATE POLICY "gigsave_insert_own"
  ON "public"."GigSave"
  FOR INSERT
  WITH CHECK ("user_id" = auth.uid());

DROP POLICY IF EXISTS "gigsave_delete_own" ON "public"."GigSave";
CREATE POLICY "gigsave_delete_own"
  ON "public"."GigSave"
  FOR DELETE
  USING ("user_id" = auth.uid());

DROP POLICY IF EXISTS "gigreport_insert_own" ON "public"."GigReport";
CREATE POLICY "gigreport_insert_own"
  ON "public"."GigReport"
  FOR INSERT
  WITH CHECK ("reported_by" = auth.uid());

DROP POLICY IF EXISTS "gigreport_select_own" ON "public"."GigReport";
CREATE POLICY "gigreport_select_own"
  ON "public"."GigReport"
  FOR SELECT
  USING ("reported_by" = auth.uid());
