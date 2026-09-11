-- ============================================================================
-- Migration: Dismissed Gigs & Hidden Categories
-- Supports "Not Interested" dismiss and category suppression.
-- ============================================================================

-- Track individually dismissed gigs per user
CREATE TABLE IF NOT EXISTS "public"."dismissed_gigs" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"      uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "gig_id"       uuid NOT NULL REFERENCES "public"."Gig"("id") ON DELETE CASCADE,
  "reason"       text,
  "dismissed_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_dismissed_gig UNIQUE ("user_id", "gig_id")
);

CREATE INDEX IF NOT EXISTS idx_dismissed_gigs_user_id
  ON "public"."dismissed_gigs" ("user_id");

-- Track hidden categories per user
CREATE TABLE IF NOT EXISTS "public"."user_hidden_categories" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "category"   text NOT NULL,
  "hidden_at"  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_hidden_category UNIQUE ("user_id", "category")
);

CREATE INDEX IF NOT EXISTS idx_user_hidden_categories_user_id
  ON "public"."user_hidden_categories" ("user_id");
