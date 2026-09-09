-- 168_block_founders.sql
-- Wave 3 (final slice) — Block Founders: the growth mechanic.
--
-- (Numbered 168 because the 159–166 range is forked between the Place
-- and Calendarly families and Calendarly holds 167; 168+ is unique
-- across both. Future migrations should move to timestamp prefixes.)
--
-- Three pieces:
--   BlockFounder      — the permanent, scarce claim: "verified home #N
--                       on this block" (geohash-6 cell). Rank is
--                       assigned once, first-come, by the service on a
--                       verified home's first read — the UNIQUE
--                       (geohash6, rank) constraint is the arbiter, so
--                       racing instances cannot mint the same rank.
--   BlockInvite       — one row per physical postcard invite a T4
--                       resident sends to a nearby address. Carries
--                       the safeguards' bookkeeping: sender weekly cap,
--                       per-recipient 90-day dedup (address_hash), and
--                       the recipient's opt-out code.
--   BlockInviteOptOut — the recipient-controlled kill switch, keyed by
--                       address_hash. Checked before EVERY send; a row
--                       here permanently silences invites to that
--                       address from all senders.
--
-- Every table ships with RLS enabled and anon/authenticated revoked
-- from birth (the 086_push_tokens precedent): all access is through
-- the backend's service_role, which bypasses RLS.

CREATE TABLE IF NOT EXISTS "public"."BlockFounder" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "geohash6" "text" NOT NULL,
    -- 1-based founding order within the cell, permanent once assigned.
    "rank" integer NOT NULL,
    "established_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BlockFounder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BlockFounder_rank_positive" CHECK ("rank" >= 1)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlockFounder_home_id_key') THEN
    ALTER TABLE "public"."BlockFounder" ADD CONSTRAINT "BlockFounder_home_id_key" UNIQUE ("home_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlockFounder_cell_rank_key') THEN
    ALTER TABLE "public"."BlockFounder" ADD CONSTRAINT "BlockFounder_cell_rank_key" UNIQUE ("geohash6", "rank");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlockFounder_home_id_fkey') THEN
    ALTER TABLE "public"."BlockFounder"
      ADD CONSTRAINT "BlockFounder_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlockFounder_user_id_fkey') THEN
    ALTER TABLE "public"."BlockFounder"
      ADD CONSTRAINT "BlockFounder_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BlockFounder_cell_idx"
  ON "public"."BlockFounder" ("geohash6", "rank");

-- ── Invites ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."BlockInvite" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_home_id" "uuid" NOT NULL,
    "sender_user_id" "uuid" NOT NULL,
    "geohash6" "text" NOT NULL,
    -- Canonical hash of the recipient address (utils/normalizeAddress)
    -- — the dedup + opt-out key. The printable address itself is
    -- frozen here for the Lob send and support questions.
    "recipient_address_hash" "text" NOT NULL,
    "recipient_address" "jsonb" NOT NULL,
    -- Printed on the card; redeeming it opts the address out.
    "opt_out_code" "text" NOT NULL,
    "lob_id" "text",
    -- created | failed
    "status" "text" DEFAULT 'created' NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BlockInvite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BlockInvite_status_check" CHECK ("status" IN ('created', 'failed'))
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlockInvite_opt_out_code_key') THEN
    ALTER TABLE "public"."BlockInvite" ADD CONSTRAINT "BlockInvite_opt_out_code_key" UNIQUE ("opt_out_code");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlockInvite_sender_home_fkey') THEN
    ALTER TABLE "public"."BlockInvite"
      ADD CONSTRAINT "BlockInvite_sender_home_fkey"
      FOREIGN KEY ("sender_home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlockInvite_sender_user_fkey') THEN
    ALTER TABLE "public"."BlockInvite"
      ADD CONSTRAINT "BlockInvite_sender_user_fkey"
      FOREIGN KEY ("sender_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- The sender weekly-cap read.
CREATE INDEX IF NOT EXISTS "BlockInvite_sender_week_idx"
  ON "public"."BlockInvite" ("sender_user_id", "created_at" DESC);
-- The per-recipient dedup read.
CREATE INDEX IF NOT EXISTS "BlockInvite_recipient_idx"
  ON "public"."BlockInvite" ("recipient_address_hash", "created_at" DESC);

-- ── Opt-out registry ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."BlockInviteOptOut" (
    "address_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BlockInviteOptOut_pkey" PRIMARY KEY ("address_hash")
);

-- ── RLS from birth (086 precedent; service_role bypasses) ────

ALTER TABLE "public"."BlockFounder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BlockInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BlockInviteOptOut" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."BlockFounder" FROM "anon";
REVOKE ALL ON TABLE "public"."BlockFounder" FROM "authenticated";
REVOKE ALL ON TABLE "public"."BlockInvite" FROM "anon";
REVOKE ALL ON TABLE "public"."BlockInvite" FROM "authenticated";
REVOKE ALL ON TABLE "public"."BlockInviteOptOut" FROM "anon";
REVOKE ALL ON TABLE "public"."BlockInviteOptOut" FROM "authenticated";
GRANT ALL ON TABLE "public"."BlockFounder" TO "service_role";
GRANT ALL ON TABLE "public"."BlockInvite" TO "service_role";
GRANT ALL ON TABLE "public"."BlockInviteOptOut" TO "service_role";
