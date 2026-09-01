-- 157_residency_letters.sql
-- Phase 1 (#11) — Server-attested verified residency letters.
--
-- Until now the web "residency letter" was a browser-rendered printable —
-- nothing a landlord/school could check. This table makes the letter a
-- server-issued artifact:
--   * issued ONLY to a T4 resident (verified occupancy) of the home;
--   * everything printed (name, address, purpose) is FROZEN on the row at
--     issue time — the letter attests a moment, later edits don't rewrite it;
--   * the exact issued PDF is stored (base64) with its sha256, so a download
--     is always byte-identical to what was issued;
--   * `letter_code` is an unguessable public verification code printed on
--     the letter; GET /api/public/residency-letters/:code lets any third
--     party confirm the letter is genuine and not revoked;
--   * letters are PERSONAL documents: they belong to the issuing user, not
--     the household — members never see each other's letters.

CREATE TABLE IF NOT EXISTS "public"."ResidencyLetter" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    -- Public verification code (normalized: A–Z/2–9, no ambiguous chars).
    "letter_code" "text" NOT NULL,
    -- Frozen as printed on the letter.
    "resident_name" "text" NOT NULL,
    "address_line1" "text" NOT NULL,
    "city" "text",
    "state" "text",
    "zipcode" "text",
    "purpose" "text",
    -- issued | revoked
    "status" "text" DEFAULT 'issued' NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    -- The exact issued artifact + its digest (auditability).
    "pdf_sha256" "text" NOT NULL,
    "pdf_base64" "text" NOT NULL,
    -- Public-verification telemetry.
    "verify_count" integer DEFAULT 0 NOT NULL,
    "last_verified_at" timestamp with time zone,
    CONSTRAINT "ResidencyLetter_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResidencyLetter_status_check" CHECK ("status" IN ('issued', 'revoked'))
);

-- The public verify lookup.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResidencyLetter_letter_code_key'
  ) THEN
    ALTER TABLE "public"."ResidencyLetter"
      ADD CONSTRAINT "ResidencyLetter_letter_code_key" UNIQUE ("letter_code");
  END IF;
END $$;

-- "My letters for this home" read path.
CREATE INDEX IF NOT EXISTS "ResidencyLetter_home_user_idx"
  ON "public"."ResidencyLetter" ("home_id", "user_id", "issued_at" DESC);

-- FKs: a letter dies with the user account or the home.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResidencyLetter_home_id_fkey'
  ) THEN
    ALTER TABLE "public"."ResidencyLetter"
      ADD CONSTRAINT "ResidencyLetter_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ResidencyLetter_user_id_fkey'
  ) THEN
    ALTER TABLE "public"."ResidencyLetter"
      ADD CONSTRAINT "ResidencyLetter_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
END $$;
