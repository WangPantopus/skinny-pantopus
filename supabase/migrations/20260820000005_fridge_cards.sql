-- 165_fridge_cards.sql
-- Wave 1 (#2) — The Fridge Card: a 911-ready household card.
--
-- Everything a panicking babysitter or a first responder at the door
-- needs said out loud — starting with the EXACT verified address, the
-- first thing every dispatcher asks for — plus whatever the household
-- chose to put on it: members and allergies, meds, pets, gas/water
-- shutoffs, emergency contacts.
--
-- Design stance (mirrors letters and claims):
--   * content is FROZEN at issue — the household saw exactly what the
--     card shares before sharing it; edits mean issuing a fresh card;
--   * the address block is SERVER-derived from the verified home row,
--     never client input;
--   * the card lives behind an unguessable ~78-bit code; a revoked
--     card's page shows "no longer active" and NO content — this is
--     health-adjacent data, so revocation must actually pull it;
--   * cards are HOUSEHOLD documents (unlike personal letters/claims):
--     any member of the home can see them; issuing requires a verified
--     resident with home-manage permission.
--
-- Honest scope: this is what the caller reads aloud and what the
-- babysitter scans — it is NOT delivered to dispatch. Copy must never
-- imply PSAP integration (the Smart911 lesson).

CREATE TABLE IF NOT EXISTS "public"."FridgeCard" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    -- Nullable: the card is a HOUSEHOLD document and must outlive its
    -- creator's account (FK below is SET NULL, not CASCADE).
    "created_by" "uuid",
    -- Public card code (same normalized alphabet as letters/claims).
    "card_code" "text" NOT NULL,
    -- A short household-chosen label ("Sitter card", "Full card").
    "label" "text",
    -- The frozen card: { address: {...server-derived}, sections: [...] }.
    "content" "jsonb" NOT NULL,
    -- active | revoked
    "status" "text" DEFAULT 'active' NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    -- Denormalized view telemetry for the household.
    "view_count" integer DEFAULT 0 NOT NULL,
    "last_viewed_at" timestamp with time zone,
    CONSTRAINT "FridgeCard_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FridgeCard_status_check" CHECK ("status" IN ('active', 'revoked'))
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FridgeCard_card_code_key'
  ) THEN
    ALTER TABLE "public"."FridgeCard"
      ADD CONSTRAINT "FridgeCard_card_code_key" UNIQUE ("card_code");
  END IF;
END $$;

-- "This home's cards" read path.
CREATE INDEX IF NOT EXISTS "FridgeCard_home_idx"
  ON "public"."FridgeCard" ("home_id", "issued_at" DESC);

-- Cards die with the HOME only. The creator's account deletion must
-- not take the household's emergency card with it — the printout on
-- the fridge would silently stop resolving — so created_by goes to
-- NULL instead (attribution lost, card intact).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FridgeCard_home_id_fkey'
  ) THEN
    ALTER TABLE "public"."FridgeCard"
      ADD CONSTRAINT "FridgeCard_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FridgeCard_created_by_fkey'
  ) THEN
    ALTER TABLE "public"."FridgeCard"
      ADD CONSTRAINT "FridgeCard_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;
  END IF;
END $$;
