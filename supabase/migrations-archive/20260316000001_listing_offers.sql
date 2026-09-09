-- ============================================================
-- LISTING OFFERS — Structured offer / counter-offer system
--
-- Enables buyers to make offers on marketplace listings with
-- support for counter-offers, expiry, and lifecycle tracking.
-- ============================================================

-- Offer status enum
DO $$ BEGIN
  CREATE TYPE "public"."listing_offer_status" AS ENUM (
    'pending',
    'accepted',
    'declined',
    'countered',
    'expired',
    'withdrawn',
    'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "public"."ListingOffer" (
  "id"               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "listing_id"       uuid NOT NULL REFERENCES "public"."Listing"("id") ON DELETE CASCADE,
  "buyer_id"         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "seller_id"        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Offer details
  "amount"           numeric(10,2),            -- NULL for free items (just "interested")
  "message"          text,
  "status"           "public"."listing_offer_status" NOT NULL DEFAULT 'pending',

  -- Counter-offer chain
  "parent_offer_id"  uuid REFERENCES "public"."ListingOffer"("id") ON DELETE SET NULL,
  "counter_amount"   numeric(10,2),
  "counter_message"  text,

  -- Lifecycle
  "expires_at"       timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  "responded_at"     timestamptz,
  "completed_at"     timestamptz,

  -- Timestamps
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT listing_offer_no_self CHECK ("buyer_id" != "seller_id"),
  CONSTRAINT listing_offer_amount_positive CHECK ("amount" IS NULL OR "amount" >= 0)
);

-- ─── Indexes ─────────────────────────────────────────────────

CREATE INDEX idx_listing_offer_listing
  ON "public"."ListingOffer" ("listing_id");

CREATE INDEX idx_listing_offer_buyer
  ON "public"."ListingOffer" ("buyer_id");

CREATE INDEX idx_listing_offer_seller
  ON "public"."ListingOffer" ("seller_id");

CREATE INDEX idx_listing_offer_status_pending
  ON "public"."ListingOffer" ("status")
  WHERE "status" = 'pending';

CREATE INDEX idx_listing_offer_expires_pending
  ON "public"."ListingOffer" ("expires_at")
  WHERE "status" = 'pending';

-- Prevent duplicate active offers per buyer per listing
CREATE UNIQUE INDEX idx_listing_offer_unique_pending
  ON "public"."ListingOffer" ("listing_id", "buyer_id")
  WHERE "status" IN ('pending', 'accepted');

-- ─── Row Level Security ──────────────────────────────────────

ALTER TABLE "public"."ListingOffer" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view their own offers"
  ON "public"."ListingOffer" FOR SELECT
  USING (auth.uid() = "buyer_id");

CREATE POLICY "Sellers can view offers on their listings"
  ON "public"."ListingOffer" FOR SELECT
  USING (auth.uid() = "seller_id");

CREATE POLICY "Buyers can create offers"
  ON "public"."ListingOffer" FOR INSERT
  WITH CHECK (auth.uid() = "buyer_id");

CREATE POLICY "Participants can update offers"
  ON "public"."ListingOffer" FOR UPDATE
  USING (auth.uid() IN ("buyer_id", "seller_id"));
