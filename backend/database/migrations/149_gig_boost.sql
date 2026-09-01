-- 149_gig_boost.sql
-- Adds boost-related columns to the Gig table so posters can promote a
-- gig in the feed via `POST /api/gigs/:gigId/boost` (T5.3.2 My tasks V2
-- "Boost in feed" action). `boosted_at` records the first time the gig
-- was boosted; `boost_expires_at` is set 24h forward and read by feed
-- ranking + the My tasks V2 status chip to surface a "Boosted" hint.

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "boosted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "boost_expires_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_gig_boost_active"
  ON "public"."Gig" ("boost_expires_at")
  WHERE "boost_expires_at" IS NOT NULL;
