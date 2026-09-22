-- Backwards compatible: yes. Restore nullable fields required by existing clients.
-- Restore the existing migration149/archive20260516000000 contract omitted
-- by canonical replay. Existing Gig list/boost code already requires it.
-- Do not rewrite historical boosts or the applied migration history.
SET LOCAL lock_timeout='5s';
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "boosted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "boost_expires_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_gig_boost_active"
  ON "public"."Gig" ("boost_expires_at")
  WHERE "boost_expires_at" IS NOT NULL;
