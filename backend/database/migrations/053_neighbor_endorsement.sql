-- M8: NeighborEndorsement table
-- Lightweight binary trust signals from verified neighbors
CREATE TABLE IF NOT EXISTS "NeighborEndorsement" (
  "id"                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "endorser_home_id"  UUID NOT NULL REFERENCES "Home"("id"),
  "endorser_user_id"  UUID NOT NULL REFERENCES "User"("id"),
  "business_user_id"  UUID NOT NULL REFERENCES "User"("id"),
  "category"          TEXT NOT NULL,
  "created_at"        TIMESTAMPTZ DEFAULT now() NOT NULL,
  "updated_at"        TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- One endorsement per (home, provider, category)
  CONSTRAINT "uq_endorsement" UNIQUE ("endorser_home_id", "business_user_id", "category")
);
