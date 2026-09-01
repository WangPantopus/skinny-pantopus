-- 166_home_record_watch.sql
-- Wave 2b — Home Record Watch, the free half: the refi-window rate
-- watch on Freddie Mac PMMS data.
--
-- The resident tells us ONE fact only they know reliably today — the
-- month their loan was recorded — and we hold it against the weekly
-- 30-year PMMS average: when the market average falls meaningfully
-- below their origination-era average, they hear about it before the
-- spam letters do. Strictly informational: the copy states averages
-- and deltas, never advice.
--
-- Design stance:
--   * PERSONAL, like letters/claims: the watch belongs to (home, user)
--     — a member's loan month is their own business; one watch per
--     pair (unique index);
--   * baseline_rate is FROZEN at set time from the PMMS monthly
--     history (historical averages never change; recomputed only when
--     the user edits the month);
--   * alert bookkeeping (last_alert_rate/at) lives on the row so the
--     weekly job is idempotent and re-alerts only on a further drop or
--     after a long quiet period.
--
-- The deed/lien half of Record Watch deliberately has NO tables yet —
-- it needs the ATTOM recorder dataset, whose trial-to-paid contract is
-- an open business decision. Nothing here presumes it.

CREATE TABLE IF NOT EXISTS "public"."HomeRecordWatch" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    -- 'YYYY-MM' — the month the loan was recorded, user-entered.
    "loan_recorded_month" "text" NOT NULL,
    -- PMMS 30-yr monthly average for that month, frozen at set time.
    "baseline_rate" numeric(5, 2) NOT NULL,
    -- Alert idempotence.
    "last_alert_rate" numeric(5, 2),
    "last_alert_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeRecordWatch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomeRecordWatch_month_check" CHECK ("loan_recorded_month" ~ '^\d{4}-\d{2}$')
);

-- One watch per resident per home.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HomeRecordWatch_home_user_key'
  ) THEN
    ALTER TABLE "public"."HomeRecordWatch"
      ADD CONSTRAINT "HomeRecordWatch_home_user_key" UNIQUE ("home_id", "user_id");
  END IF;
END $$;

-- The weekly evaluation scan.
CREATE INDEX IF NOT EXISTS "HomeRecordWatch_eval_idx"
  ON "public"."HomeRecordWatch" ("last_alert_at");

-- Watches die with the home or the user.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HomeRecordWatch_home_id_fkey'
  ) THEN
    ALTER TABLE "public"."HomeRecordWatch"
      ADD CONSTRAINT "HomeRecordWatch_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HomeRecordWatch_user_id_fkey'
  ) THEN
    ALTER TABLE "public"."HomeRecordWatch"
      ADD CONSTRAINT "HomeRecordWatch_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
END $$;
