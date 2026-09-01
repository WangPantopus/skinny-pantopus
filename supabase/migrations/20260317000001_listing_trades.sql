-- ============================================================
-- LISTING TRADES — Trade / swap proposal system
--
-- Enables users to propose trades by offering one or more of
-- their own listings against a target listing. Supports cash
-- supplements and full lifecycle tracking.
-- ============================================================

-- Trade status enum
DO $$ BEGIN
  CREATE TYPE "public"."trade_status" AS ENUM (
    'proposed',
    'accepted',
    'declined',
    'completed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "public"."ListingTrade" (
  "id"                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "target_listing_id"   uuid NOT NULL REFERENCES "public"."Listing"("id") ON DELETE CASCADE,
  "target_user_id"      uuid NOT NULL REFERENCES auth.users(id),
  "offered_listing_ids" uuid[] NOT NULL DEFAULT '{}',
  "proposer_id"         uuid NOT NULL REFERENCES auth.users(id),
  "message"             text,
  "status"              "public"."trade_status" NOT NULL DEFAULT 'proposed',
  "cash_supplement"     numeric(10,2) DEFAULT 0,
  "responded_at"        timestamptz,
  "completed_at"        timestamptz,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT listing_trade_no_self CHECK ("proposer_id" != "target_user_id")
);

-- ─── Indexes ─────────────────────────────────────────────────

CREATE INDEX idx_listing_trade_target_listing
  ON "public"."ListingTrade" ("target_listing_id");

CREATE INDEX idx_listing_trade_proposer
  ON "public"."ListingTrade" ("proposer_id");

CREATE INDEX idx_listing_trade_target_user
  ON "public"."ListingTrade" ("target_user_id");

CREATE INDEX idx_listing_trade_status_proposed
  ON "public"."ListingTrade" ("status")
  WHERE "status" = 'proposed';

-- ─── Row Level Security ──────────────────────────────────────

ALTER TABLE "public"."ListingTrade" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proposers can view their own trades"
  ON "public"."ListingTrade" FOR SELECT
  USING (auth.uid() = "proposer_id");

CREATE POLICY "Target users can view trades on their listings"
  ON "public"."ListingTrade" FOR SELECT
  USING (auth.uid() = "target_user_id");

CREATE POLICY "Proposers can create trades"
  ON "public"."ListingTrade" FOR INSERT
  WITH CHECK (auth.uid() = "proposer_id");

CREATE POLICY "Participants can update trades"
  ON "public"."ListingTrade" FOR UPDATE
  USING (auth.uid() IN ("proposer_id", "target_user_id"));
