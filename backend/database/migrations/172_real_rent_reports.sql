-- 172_real_rent_reports.sql
-- Wave 3 — Real Rent Benchmark: what neighbors ACTUALLY pay.
--
-- `rent_band` (shipped) is HUD's county-level Fair Market Rent — a
-- government estimate for a whole county. This is the other thing
-- entirely: real monthly rents reported by VERIFIED residents of one
-- geohash-6 block, aggregated behind a k-anonymity floor.
--
-- It is the flagship Block Founders unlock for a reason: the data does
-- not exist until neighbors verify and contribute, so the meter
-- ("4 of 10 homes have shared") is a true statement about the block,
-- not a gamification veneer over data we already had.
--
-- Privacy is the whole design:
--   * only a VERIFIED occupant may report (the route enforces T4) —
--     that is what makes the number real rather than scrapeable;
--   * one row per (home_id, user_id) — a household cannot stuff the
--     sample, and a mover's row follows their occupancy;
--   * `geohash6` is denormalized at write time (the BlockFounder
--     pattern) so aggregation never joins Home and never needs the
--     address;
--   * the aggregate is suppressed entirely below K=10 reports, and the
--     service returns quartiles + sample size ONLY — never a row, never
--     a count below the floor, never a per-home figure.
--
-- RLS enabled and anon/authenticated revoked from birth (the 086 /
-- 169 precedent): all access is through service_role, which bypasses
-- RLS. This table holds a household's exact monthly rent, which is
-- squarely financial PII.

CREATE TABLE IF NOT EXISTS "public"."HomeRentReport" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    -- Denormalized at write time so the aggregate scan is one indexed
    -- read and never touches the address.
    "geohash6" "text" NOT NULL,
    -- Cents, like HomeBill.amount — integer money, no float drift.
    "monthly_rent_cents" integer NOT NULL,
    -- Bedroom count the rent is FOR (0 = studio). Snapshot of the
    -- home's own value at report time; the aggregate groups on it so a
    -- studio is never averaged against a 4-bedroom.
    "bedrooms" smallint,
    "reported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeRentReport_pkey" PRIMARY KEY ("id"),
    -- A plausibility fence, not a judgement: $50/mo to $50,000/mo.
    -- Outside it the entry is a typo or a joke, and either would skew a
    -- ten-sample median hard.
    CONSTRAINT "HomeRentReport_amount_sane" CHECK ("monthly_rent_cents" BETWEEN 5000 AND 5000000),
    CONSTRAINT "HomeRentReport_bedrooms_sane" CHECK ("bedrooms" IS NULL OR ("bedrooms" >= 0 AND "bedrooms" <= 10))
);

DO $$ BEGIN
  -- One report per resident per home: re-reporting UPDATES, so a
  -- household can neither stuff the sample nor leave a stale figure.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HomeRentReport_home_user_key') THEN
    ALTER TABLE "public"."HomeRentReport"
      ADD CONSTRAINT "HomeRentReport_home_user_key" UNIQUE ("home_id", "user_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HomeRentReport_home_id_fkey') THEN
    ALTER TABLE "public"."HomeRentReport"
      ADD CONSTRAINT "HomeRentReport_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HomeRentReport_user_id_fkey') THEN
    ALTER TABLE "public"."HomeRentReport"
      ADD CONSTRAINT "HomeRentReport_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- The aggregate scan: every cell read is (geohash6, bedrooms).
CREATE INDEX IF NOT EXISTS "HomeRentReport_cell_idx"
  ON "public"."HomeRentReport" ("geohash6", "bedrooms");
-- The User-delete sweep (migration 171's lesson: index the FK side).
CREATE INDEX IF NOT EXISTS "HomeRentReport_user_idx"
  ON "public"."HomeRentReport" ("user_id");

ALTER TABLE "public"."HomeRentReport" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."HomeRentReport" FROM "anon";
REVOKE ALL ON TABLE "public"."HomeRentReport" FROM "authenticated";
GRANT ALL ON TABLE "public"."HomeRentReport" TO "service_role";

COMMENT ON TABLE "public"."HomeRentReport" IS
  'Real Rent Benchmark (Wave 3): a verified resident''s own monthly rent, contributed to their block''s aggregate. Read ONLY in aggregate behind a k>=10 floor — never per-home, never below the floor. Financial PII: service_role only.';
