-- 161_home_systems.sql
-- Systems Ledger — the six major building systems, with provenance.
--
-- This is the record that compounds. Everything else on the Place
-- dashboard is a reading anyone can buy: ATTOM sells the property facts,
-- NOAA gives away the weather, FEMA publishes the flood zone. What no one
-- can sell is what the RESIDENT confirmed about this specific building,
-- accumulated over years and attached to an address that outlives them.
--
-- Distinct from the tables that already exist:
--   HomeDevice  smart-home devices (camera, thermostat, lock)
--   HomeAsset   possessions and appliances, with brand/model/serial
-- Neither models a building system with an install year and a remaining-
-- life estimate, which is what drives "your water heater is past its
-- expected life" and the gig that follows from it.
--
-- The design decision that matters most is `source`. Every row is seeded
-- at n=1 from the home's build year so the ledger is never blank — a
-- flagship feature that renders six empty tiles is how a flagship dies —
-- and each row carries how we know, so an estimate is never dressed up as
-- a fact. Confidence only ever moves up: a resident's correction
-- permanently outranks anything we derived, because the person standing
-- in the building is the better source and telling them otherwise is how
-- you lose their trust in the whole dashboard.

CREATE TABLE IF NOT EXISTS "public"."HomeSystem" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    -- One of the six systems the ledger tracks.
    "system_key" "text" NOT NULL,
    -- Year the system was installed or last replaced. Null when unknown
    -- and the home has no build year to estimate from.
    "installed_year" integer,
    -- How we know. Drives the provenance chip in the UI.
    --   estimated   derived from Home.year_built plus a typical-life prior
    --   resident    the household told us (outranks everything else)
    --   permit      from a permit record
    --   marketplace from a paid, completed Pantopus job at this address
    "source" "text" DEFAULT 'estimated'::"text" NOT NULL,
    -- Free-text pointer to the evidence: a permit number, a gig id.
    "source_ref" "text",
    "notes" "text",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomeSystem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomeSystem_key_chk" CHECK (("system_key" = ANY (ARRAY[
        'roof'::"text", 'hvac'::"text", 'water_heater'::"text",
        'electrical_panel'::"text", 'sewer_septic'::"text", 'windows'::"text"]))),
    CONSTRAINT "HomeSystem_source_chk" CHECK (("source" = ANY (ARRAY[
        'estimated'::"text", 'resident'::"text", 'permit'::"text", 'marketplace'::"text"]))),
    -- A plausible building year. Rejects typos that would otherwise render
    -- as a 900-year-old roof.
    CONSTRAINT "HomeSystem_year_chk" CHECK (
        "installed_year" IS NULL OR ("installed_year" >= 1700 AND "installed_year" <= 2200))
);

ALTER TABLE "public"."HomeSystem" OWNER TO "postgres";

-- One row per system per home — the ledger is a fixed six, not a list.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HomeSystem_home_key_key'
  ) THEN
    ALTER TABLE "public"."HomeSystem"
      ADD CONSTRAINT "HomeSystem_home_key_key" UNIQUE ("home_id", "system_key");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "HomeSystem_home_idx" ON "public"."HomeSystem" ("home_id");
