-- ============================================================
-- TRANSACTION REVIEWS & REPUTATION SCORES
--
-- Extends the review system beyond gigs to cover marketplace
-- sales and trades. Adds a materialized reputation cache for
-- fast trust-signal lookups on listing cards and detail views.
-- ============================================================

-- Review context enum
DO $$ BEGIN
  CREATE TYPE "public"."review_context" AS ENUM (
    'listing_sale',
    'listing_trade',
    'gig'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── TransactionReview ───────────────────────────────────────

CREATE TABLE "public"."TransactionReview" (
  "id"                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "reviewer_id"           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "reviewed_id"           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What was reviewed
  "context"               "public"."review_context" NOT NULL,
  "listing_id"            uuid REFERENCES "public"."Listing"("id") ON DELETE SET NULL,
  "offer_id"              uuid REFERENCES "public"."ListingOffer"("id") ON DELETE SET NULL,
  "gig_id"                uuid REFERENCES "public"."Gig"("id") ON DELETE SET NULL,

  -- Review content
  "rating"                smallint NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment"               text,

  -- Sub-ratings (optional)
  "communication_rating"  smallint CHECK ("communication_rating" BETWEEN 1 AND 5),
  "accuracy_rating"       smallint CHECK ("accuracy_rating" BETWEEN 1 AND 5),
  "punctuality_rating"    smallint CHECK ("punctuality_rating" BETWEEN 1 AND 5),

  -- Metadata
  "is_buyer"              boolean NOT NULL DEFAULT true,

  -- Timestamps
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "updated_at"            timestamptz NOT NULL DEFAULT now(),

  -- No self-reviews
  CONSTRAINT review_no_self CHECK ("reviewer_id" != "reviewed_id")
);

-- Unique per reviewer + transaction reference (prevents duplicate reviews)
CREATE UNIQUE INDEX idx_review_unique_per_transaction
  ON "public"."TransactionReview" (
    "reviewer_id",
    COALESCE("offer_id",  '00000000-0000-0000-0000-000000000000'),
    COALESCE("gig_id",    '00000000-0000-0000-0000-000000000000')
  );

CREATE INDEX idx_review_reviewed
  ON "public"."TransactionReview" ("reviewed_id");

CREATE INDEX idx_review_listing
  ON "public"."TransactionReview" ("listing_id");

-- ─── RLS — TransactionReview ─────────────────────────────────

ALTER TABLE "public"."TransactionReview" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON "public"."TransactionReview" FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reviews"
  ON "public"."TransactionReview" FOR INSERT
  WITH CHECK (auth.uid() = "reviewer_id");

-- ─── ReputationScore (materialized cache) ────────────────────

CREATE TABLE "public"."ReputationScore" (
  "user_id"                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "avg_rating"             numeric(3,2) DEFAULT 0,
  "total_ratings"          integer DEFAULT 0,
  "total_sales"            integer DEFAULT 0,
  "total_purchases"        integer DEFAULT 0,
  "total_trades"           integer DEFAULT 0,
  "total_gigs_completed"   integer DEFAULT 0,
  "completion_rate"        numeric(5,4) DEFAULT 1.0,
  "avg_response_time_min"  integer,
  "is_fast_responder"      boolean DEFAULT false,
  "is_top_seller"          boolean DEFAULT false,
  "member_since"           timestamptz,
  "last_computed_at"       timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS — ReputationScore ───────────────────────────────────

ALTER TABLE "public"."ReputationScore" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reputation scores"
  ON "public"."ReputationScore" FOR SELECT
  USING (true);
