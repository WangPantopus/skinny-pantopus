-- 156_place_section_cache.sql
-- W0.3 — Generic per-section TTL cache for PlaceIntelligence providers.
--
-- The Step-1 contract gives every dashboard section its own freshness
-- budget (environment ~10–30 min · density 15 min · benchmark 6 h ·
-- property 30 d · census/flood 90 d). The wired providers so far each
-- grew a bespoke cache (AttomPropertyCache, NeighborhoodProfileCache,
-- in-memory context cache); this table is the SHARED read-through store
-- the remaining section adapters (civic, EPA layers, HUD, DSIRE, …)
-- use via services/placeSectionCache.js, so a new provider gets TTL
-- caching without inventing another table.
--
-- Keying: `cache_key` is provider-granularity, prefixed by scope —
--   'home:<uuid>'   exact-home payloads
--   'geo:<geohash>' block/area payloads (geohash-6 etc.)
--   'zip:<zip>' / 'county:<fips>' / 'state:<abbr>' coarse payloads
-- so homes that share a block / ZIP / county share one cached row
-- instead of refetching per home.
--
-- Rows are upserted on refresh (ON CONFLICT (cache_key, section_id))
-- and read by the same pair; expired rows are kept until overwritten so
-- a failing provider can serve a `stale` envelope instead of nothing.

CREATE TABLE IF NOT EXISTS "public"."PlaceSectionCache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    -- Scope-prefixed provider key ('home:…' | 'geo:…' | 'zip:…' | …).
    "cache_key" "text" NOT NULL,
    -- A launch-set section id (weather, flood, civic_districts, …).
    "section_id" "text" NOT NULL,
    -- The provider's section payload, as composed (pre-envelope `data`).
    "payload" "jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "PlaceSectionCache_pkey" PRIMARY KEY ("id")
);

-- One row per (key, section) — drives upsert ON CONFLICT.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlaceSectionCache_key_section_key'
  ) THEN
    ALTER TABLE "public"."PlaceSectionCache"
      ADD CONSTRAINT "PlaceSectionCache_key_section_key" UNIQUE ("cache_key", "section_id");
  END IF;
END $$;

-- Sweep/eviction path (a future janitor job deletes long-expired rows).
CREATE INDEX IF NOT EXISTS "PlaceSectionCache_expires_idx"
  ON "public"."PlaceSectionCache" ("expires_at");
