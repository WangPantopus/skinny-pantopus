-- ============================================================================
-- Migration: Gig Saved Searches
-- P6 — saved search criteria + new-task alerts. A user saves the filter
-- set they're browsing with; when a freshly posted gig matches, they get
-- an in-app/push notification (type `gig_saved_search_match`, governed by
-- the gig_updates_enabled preference).
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."GigSavedSearch" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  -- Display label ("Cleaning under $100 · 5 mi"); derived client-side.
  "name"             varchar(120),
  -- Filter dimensions. NULL = dimension not constrained.
  "category"         varchar(100),
  "search"           varchar(200),
  "min_price"        numeric,
  "max_price"        numeric,
  "schedule_type"    varchar(20),
  "pay_type"         varchar(20),
  -- Alert center + radius (miles). Matching is haversine in the service.
  "latitude"         double precision NOT NULL,
  "longitude"        double precision NOT NULL,
  "radius_miles"     numeric NOT NULL DEFAULT 5,
  "notify"           boolean NOT NULL DEFAULT true,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  -- Per-search alert throttle marker.
  "last_notified_at" timestamptz,
  CONSTRAINT "GigSavedSearch_schedule_check"
    CHECK ("schedule_type" IS NULL OR "schedule_type" IN ('asap', 'today', 'scheduled', 'flexible')),
  CONSTRAINT "GigSavedSearch_pay_check"
    CHECK ("pay_type" IS NULL OR "pay_type" IN ('fixed', 'hourly', 'offers')),
  CONSTRAINT "GigSavedSearch_radius_check"
    CHECK ("radius_miles" > 0 AND "radius_miles" <= 100)
);

CREATE INDEX IF NOT EXISTS idx_gigsavedsearch_user
  ON "public"."GigSavedSearch" ("user_id");

-- Fan-out scans only notifiable rows; the lat/lng pair feeds a cheap
-- bounding-box prefilter before the precise haversine check.
CREATE INDEX IF NOT EXISTS idx_gigsavedsearch_notify_lat
  ON "public"."GigSavedSearch" ("latitude")
  WHERE "notify" = true;

-- Each user keeps a small set — guard against runaway duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_gigsavedsearch_dedupe
  ON "public"."GigSavedSearch" (
    "user_id",
    COALESCE("category", ''),
    COALESCE("search", ''),
    COALESCE("min_price", -1),
    COALESCE("max_price", -1),
    COALESCE("schedule_type", ''),
    COALESCE("pay_type", '')
  );
