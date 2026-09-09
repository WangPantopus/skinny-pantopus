-- 174_unlisted_removals.sql
-- Wave 4 — Unlisted: tracking a resident's removal requests.
--
-- Unlisted tells someone what their address exposes and exactly how to
-- remove it. The removal itself happens on the broker's own site — we
-- never act as the person — so what we store is only their PROGRESS:
-- which brokers they have written to, and what came back.
--
-- This table is unusually sensitive for how small it is. A row here says
-- "this person is actively trying to erase their home address from the
-- internet", which is very often true because someone is afraid of a
-- specific other person. Leaking it would identify exactly the people
-- who most need it not leaked, and would tell an attacker which
-- channels are still open. So:
--   * RLS on and anon/authenticated revoked from birth (the 086/169
--     precedent) — service_role only;
--   * no free-text field that could accumulate a narrative about WHY;
--   * scoped per (home, user): a household member cannot see another's
--     removal work, the same rule residency claims follow.
--
-- Deliberately NOT stored: whether a broker actually lists them. We do
-- not query brokers (doing so would disclose the address to the very
-- companies they are removing it from), so we never possess that fact
-- and must never imply we do.

CREATE TABLE IF NOT EXISTS "public"."UnlistedRemoval" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    -- Slug from backend/data/dataBrokers.js. Text, not an FK: the
    -- registry is code, and a broker leaving the registry must not
    -- delete a person's record of having written to them.
    "broker_id" "text" NOT NULL,
    -- todo      — surfaced, not yet acted on
    -- requested — the resident submitted the opt-out
    -- confirmed — the broker confirmed removal
    -- relisted  — it came back (common; the product must expect it)
    "status" "text" DEFAULT 'todo' NOT NULL,
    "requested_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "UnlistedRemoval_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UnlistedRemoval_status_check"
      CHECK ("status" IN ('todo', 'requested', 'confirmed', 'relisted'))
);

DO $$ BEGIN
  -- One row per resident per broker per home: re-submitting UPDATES.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UnlistedRemoval_home_user_broker_key') THEN
    ALTER TABLE "public"."UnlistedRemoval"
      ADD CONSTRAINT "UnlistedRemoval_home_user_broker_key" UNIQUE ("home_id", "user_id", "broker_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UnlistedRemoval_home_id_fkey') THEN
    ALTER TABLE "public"."UnlistedRemoval"
      ADD CONSTRAINT "UnlistedRemoval_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UnlistedRemoval_user_id_fkey') THEN
    ALTER TABLE "public"."UnlistedRemoval"
      ADD CONSTRAINT "UnlistedRemoval_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- The only read: one resident's progress on one home.
CREATE INDEX IF NOT EXISTS "UnlistedRemoval_home_user_idx"
  ON "public"."UnlistedRemoval" ("home_id", "user_id");
-- The User-delete sweep (migration 171's lesson: index the FK side).
CREATE INDEX IF NOT EXISTS "UnlistedRemoval_user_idx"
  ON "public"."UnlistedRemoval" ("user_id");

ALTER TABLE "public"."UnlistedRemoval" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."UnlistedRemoval" FROM "anon";
REVOKE ALL ON TABLE "public"."UnlistedRemoval" FROM "authenticated";
GRANT ALL ON TABLE "public"."UnlistedRemoval" TO "service_role";

COMMENT ON TABLE "public"."UnlistedRemoval" IS
  'Unlisted (Wave 4): one resident''s progress removing their home address from a data broker. A row means someone is actively trying to erase their address, which is often because they are afraid of a specific person — service_role only, never anon/authenticated.';
