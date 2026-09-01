-- Migration 036: Postcard verification codes
-- Allows users who can't get household approval to verify
-- via a code mailed to the physical address.

CREATE TABLE IF NOT EXISTS "public"."HomePostcardCode" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "home_id" uuid NOT NULL REFERENCES "public"."Home"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending'
    CHECK ("status" IN ('pending', 'verified', 'expired', 'cancelled')),
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "verified_at" timestamptz,
  "expires_at" timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  "attempts" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_postcard_code_home_user
  ON "public"."HomePostcardCode" ("home_id", "user_id");

CREATE INDEX IF NOT EXISTS idx_postcard_code_status
  ON "public"."HomePostcardCode" ("status")
  WHERE "status" = 'pending';

-- One active (pending) code per user per home
CREATE UNIQUE INDEX IF NOT EXISTS idx_postcard_code_active
  ON "public"."HomePostcardCode" ("home_id", "user_id")
  WHERE "status" = 'pending';
