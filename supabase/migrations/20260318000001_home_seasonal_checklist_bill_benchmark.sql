-- ============================================================================
-- Migration: Home Seasonal Checklist + Bill Benchmark tables
-- Supports Home Intelligence features: Seasonal Checklist (Feature 2) and
-- Utility Bill Trends (Feature 3).
-- ============================================================================

-- ── HomeSeasonalChecklistItem ───────────────────────────────────────────────
-- Tracks per-home, per-season checklist items generated from the seasonal
-- engine. Each row is one actionable item (e.g. "Clean gutters") that a
-- household member can complete, skip, or hire help for.

CREATE TABLE IF NOT EXISTS "public"."HomeSeasonalChecklistItem" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "home_id"              uuid NOT NULL REFERENCES "public"."Home"("id") ON DELETE CASCADE,
  "season_key"           text NOT NULL,
  "year"                 integer NOT NULL,
  "item_key"             text NOT NULL,
  "title"                text NOT NULL,
  "description"          text,
  "gig_category"         text,
  "gig_title_suggestion" text,
  "status"               text NOT NULL DEFAULT 'pending'
                           CHECK ("status" IN ('pending', 'completed', 'skipped', 'hired')),
  "completed_at"         timestamptz,
  "completed_by"         uuid REFERENCES "public"."User"("id"),
  "gig_id"               uuid,
  "sort_order"           integer DEFAULT 0,
  "created_at"           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_seasonal_checklist_item UNIQUE ("home_id", "season_key", "year", "item_key")
);

CREATE INDEX IF NOT EXISTS idx_seasonal_checklist_home
  ON "public"."HomeSeasonalChecklistItem" ("home_id");

CREATE INDEX IF NOT EXISTS idx_seasonal_checklist_season
  ON "public"."HomeSeasonalChecklistItem" ("home_id", "season_key", "year");

-- RLS: service role only (backend uses supabaseAdmin which bypasses RLS)
ALTER TABLE "public"."HomeSeasonalChecklistItem" ENABLE ROW LEVEL SECURITY;

-- ── BillBenchmark ───────────────────────────────────────────────────────────
-- Pre-computed anonymous neighborhood bill averages. Keyed by geohash-6 so
-- individual homes are never identifiable. Only displayed when
-- household_count >= 10.

CREATE TABLE IF NOT EXISTS "public"."BillBenchmark" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "geohash"              text NOT NULL,
  "bill_type"            text NOT NULL,
  "month"                integer NOT NULL,
  "year"                 integer NOT NULL,
  "avg_amount_cents"     integer DEFAULT 0,
  "median_amount_cents"  integer DEFAULT 0,
  "household_count"      integer DEFAULT 0,
  "computed_at"          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_bill_benchmark UNIQUE ("geohash", "bill_type", "month", "year")
);

CREATE INDEX IF NOT EXISTS idx_bill_benchmark_lookup
  ON "public"."BillBenchmark" ("geohash", "bill_type");

-- RLS: service role only (same pattern as PropertyIntelligenceCache)
ALTER TABLE "public"."BillBenchmark" ENABLE ROW LEVEL SECURITY;
