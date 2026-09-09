-- 164_residency_claims.sql
-- Wave 1 (Residency Pass) — scoped, expiring, revocable residency claims.
--
-- The residency LETTER (migration 157) is a one-shot full-address PDF: it
-- freezes everything at issue time and always discloses the street address.
-- A residency CLAIM is the letter's live, minimal-disclosure sibling:
--   * SCOPED — it attests one derived fact ("a verified resident of Camas
--     School District") and never more; only the `address` scope prints the
--     street address. Scopes are coarser than the address by construction,
--     so a claim can never narrow a household below what the address
--     surfaces already show.
--   * LIVE — the public check re-verifies, at view time, that the issuer
--     STILL holds verified occupancy of the home. A letter attests a
--     moment; a claim attests now.
--   * EXPIRING — every claim carries a hard expires_at chosen at issue
--     (1/7/30/90 days). Expiry is derived at read time from the timestamp,
--     never flipped by a cron.
--   * AUDITED — every public view is logged (timestamp + user agent) so
--     the issuer can see exactly who checked, and revoke with one tap.

CREATE TABLE IF NOT EXISTS "public"."ResidencyClaim" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    -- Public verification code (same normalized alphabet as letters).
    "claim_code" "text" NOT NULL,
    -- What the claim attests. `statement` is the exact sentence a verifier
    -- sees, frozen at issue — re-deriving it later could silently change
    -- what the holder shared.
    "scope" "text" NOT NULL,
    "statement" "text" NOT NULL,
    "holder_name" "text" NOT NULL,
    -- active | revoked (expired is derived from expires_at, never stored).
    "status" "text" DEFAULT 'active' NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    -- Freshness snapshot: when the issuer's occupancy verification happened,
    -- as of issue time (informational; the live check is authoritative).
    "residency_verified_at" timestamp with time zone,
    -- Denormalized view telemetry (the row of record is ResidencyClaimAccess).
    "view_count" integer DEFAULT 0 NOT NULL,
    "last_viewed_at" timestamp with time zone,
    CONSTRAINT "ResidencyClaim_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResidencyClaim_status_check" CHECK ("status" IN ('active', 'revoked')),
    CONSTRAINT "ResidencyClaim_scope_check" CHECK ("scope" IN (
      'address', 'city', 'county', 'state', 'school_district', 'congressional_district'
    ))
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResidencyClaim_claim_code_key'
  ) THEN
    ALTER TABLE "public"."ResidencyClaim"
      ADD CONSTRAINT "ResidencyClaim_claim_code_key" UNIQUE ("claim_code");
  END IF;
END $$;

-- "My claims for this home" read path.
CREATE INDEX IF NOT EXISTS "ResidencyClaim_home_user_idx"
  ON "public"."ResidencyClaim" ("home_id", "user_id", "issued_at" DESC);

-- Claims die with the user account or the home (same stance as letters).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResidencyClaim_home_id_fkey'
  ) THEN
    ALTER TABLE "public"."ResidencyClaim"
      ADD CONSTRAINT "ResidencyClaim_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResidencyClaim_user_id_fkey'
  ) THEN
    ALTER TABLE "public"."ResidencyClaim"
      ADD CONSTRAINT "ResidencyClaim_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ── The audit log: one row per public view ───────────────────
-- Deliberately minimal: timestamp + a trimmed user agent. No IP, no geo —
-- the issuer needs "was it checked, when, roughly by what", not a tracking
-- profile of their verifier.

CREATE TABLE IF NOT EXISTS "public"."ResidencyClaimAccess" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_agent" "text",
    CONSTRAINT "ResidencyClaimAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ResidencyClaimAccess_claim_idx"
  ON "public"."ResidencyClaimAccess" ("claim_id", "viewed_at" DESC);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResidencyClaimAccess_claim_id_fkey'
  ) THEN
    ALTER TABLE "public"."ResidencyClaimAccess"
      ADD CONSTRAINT "ResidencyClaimAccess_claim_id_fkey"
      FOREIGN KEY ("claim_id") REFERENCES "public"."ResidencyClaim"("id") ON DELETE CASCADE;
  END IF;
END $$;
