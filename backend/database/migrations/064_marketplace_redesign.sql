-- ============================================================
-- MIGRATION 064: Marketplace Redesign — Layers, Types, Trust,
--                Inventory Caps, Expiration & Carousel Ranking
--
-- Adds:
--   - listing_layer enum (goods, gigs, rentals, vehicles)
--   - listing_type enum (sell_item, free_item, wanted_request, ...)
--   - layer/type/trust/expiration columns on Listing
--   - ListingInventorySlot table (per-home slot caps)
--   - Backfill layer + listing_type from existing category/is_free
--   - find_listings_nearby_v2 (layer/trust/wanted filtering)
--   - find_listings_in_bounds_v2 (layer filtering + new columns)
--   - get_listing_carousel (ranked carousel with diversity)
--   - Indexes for layer, trust, expiration, wanted queries
-- ============================================================


-- ─── 1. NEW ENUMS ─────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_layer') THEN
    CREATE TYPE "public"."listing_layer" AS ENUM (
      'goods', 'gigs', 'rentals', 'vehicles'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_type') THEN
    CREATE TYPE "public"."listing_type" AS ENUM (
      'sell_item', 'free_item', 'wanted_request',
      'rent_sublet', 'vehicle_sale', 'vehicle_rent',
      'service_gig'
    );
  END IF;
END $$;


-- ─── 2. NEW COLUMNS ON LISTING ────────────────────────────────

ALTER TABLE "public"."Listing"
  -- Layer & type classification
  ADD COLUMN IF NOT EXISTS "layer" "public"."listing_layer" DEFAULT 'goods',
  ADD COLUMN IF NOT EXISTS "listing_type" "public"."listing_type" DEFAULT 'sell_item',

  -- Trust: link listing to a verified home
  ADD COLUMN IF NOT EXISTS "home_id" uuid,
  ADD COLUMN IF NOT EXISTS "is_address_attached" boolean DEFAULT false,

  -- Expiration & refresh controls
  ADD COLUMN IF NOT EXISTS "expires_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "last_refreshed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "refresh_count" integer DEFAULT 0,

  -- Ranking signals (computed by background jobs)
  ADD COLUMN IF NOT EXISTS "quality_score" numeric(4,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS "risk_score" numeric(4,2) DEFAULT 0.00,

  -- Context tags (server-computed, stored for fast reads)
  ADD COLUMN IF NOT EXISTS "context_tags" text[] DEFAULT '{}',

  -- Wanted listing (reverse marketplace)
  ADD COLUMN IF NOT EXISTS "is_wanted" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "budget_max" numeric(10,2);


-- ─── 3. FOREIGN KEY: Listing.home_id → Home.id ───────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Listing_home_id_fkey'
  ) THEN
    ALTER TABLE "public"."Listing"
      ADD CONSTRAINT "Listing_home_id_fkey"
        FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id")
        ON DELETE SET NULL;
  END IF;
END $$;


-- ─── 4. CHECK CONSTRAINTS ─────────────────────────────────────

-- Enforce valid layer ↔ listing_type combos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listing_layer_type_check'
  ) THEN
    ALTER TABLE "public"."Listing"
      ADD CONSTRAINT "listing_layer_type_check"
        CHECK (
          (layer = 'goods'    AND listing_type IN ('sell_item', 'free_item', 'wanted_request'))
          OR (layer = 'gigs'     AND listing_type = 'service_gig')
          OR (layer = 'rentals'  AND listing_type = 'rent_sublet')
          OR (layer = 'vehicles' AND listing_type IN ('vehicle_sale', 'vehicle_rent'))
        );
  END IF;
END $$;

-- quality_score range 0.00–10.00
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Listing_quality_score_check'
  ) THEN
    ALTER TABLE "public"."Listing"
      ADD CONSTRAINT "Listing_quality_score_check"
        CHECK (quality_score >= 0 AND quality_score <= 10);
  END IF;
END $$;

-- risk_score range 0.00–10.00
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Listing_risk_score_check'
  ) THEN
    ALTER TABLE "public"."Listing"
      ADD CONSTRAINT "Listing_risk_score_check"
        CHECK (risk_score >= 0 AND risk_score <= 10);
  END IF;
END $$;

-- budget_max must be positive when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Listing_budget_max_check'
  ) THEN
    ALTER TABLE "public"."Listing"
      ADD CONSTRAINT "Listing_budget_max_check"
        CHECK (budget_max IS NULL OR budget_max >= 0);
  END IF;
END $$;


-- ─── 5. LISTING INVENTORY SLOT TABLE ──────────────────────────

CREATE TABLE IF NOT EXISTS "public"."ListingInventorySlot" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "home_id" uuid NOT NULL,
  "layer" "public"."listing_layer" NOT NULL,
  "active_count" integer DEFAULT 0,
  "max_count" integer NOT NULL,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  UNIQUE ("home_id", "layer"),
  FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."ListingInventorySlot" OWNER TO "postgres";

-- Enable RLS (rows managed by backend service_role)
ALTER TABLE "public"."ListingInventorySlot" ENABLE ROW LEVEL SECURITY;


-- ─── 6. BACKFILL: layer + listing_type FROM category/is_free ──

-- Map existing listings: vehicles → vehicles layer, everything else → goods
UPDATE "public"."Listing"
SET
  layer = CASE
    WHEN category = 'vehicles' THEN 'vehicles'::"public"."listing_layer"
    ELSE 'goods'::"public"."listing_layer"
  END,
  listing_type = CASE
    WHEN is_free = true THEN 'free_item'::"public"."listing_type"
    WHEN category = 'vehicles' THEN 'vehicle_sale'::"public"."listing_type"
    ELSE 'sell_item'::"public"."listing_type"
  END
WHERE layer = 'goods' AND listing_type = 'sell_item'
  AND (
    (category = 'vehicles')
    OR (is_free = true)
  );

-- Backfill expires_at for active listings that don't have one
UPDATE "public"."Listing"
SET expires_at = CASE
  WHEN is_free = true THEN created_at + INTERVAL '48 hours'
  ELSE created_at + INTERVAL '30 days'
END
WHERE expires_at IS NULL AND status = 'active';


-- ─── 7. INDEXES ───────────────────────────────────────────────

-- Layer-based queries (most common filter path)
CREATE INDEX IF NOT EXISTS "idx_listing_layer"
  ON "public"."Listing" ("layer", "status", "created_at" DESC)
  WHERE status = 'active';

-- Trust-attached listings (for "Attach to My Address" toggle)
CREATE INDEX IF NOT EXISTS "idx_listing_home_attached"
  ON "public"."Listing" ("home_id", "layer", "status")
  WHERE "is_address_attached" = true AND "status" = 'active';

-- Expiration sweep (for background job)
CREATE INDEX IF NOT EXISTS "idx_listing_expires"
  ON "public"."Listing" ("expires_at")
  WHERE status = 'active' AND expires_at IS NOT NULL;

-- Wanted listings
CREATE INDEX IF NOT EXISTS "idx_listing_wanted"
  ON "public"."Listing" ("is_wanted", "layer", "created_at" DESC)
  WHERE status = 'active' AND is_wanted = true;

-- Quality score for carousel ranking
CREATE INDEX IF NOT EXISTS "idx_listing_quality_score"
  ON "public"."Listing" ("quality_score" DESC, "created_at" DESC)
  WHERE status = 'active';


-- ─── 8. RPC: find_listings_nearby_v2 ──────────────────────────
-- Extends find_listings_nearby with layer, type, trust, wanted filtering
-- and returns new columns.

CREATE OR REPLACE FUNCTION "public"."find_listings_nearby_v2"(
  "p_latitude" double precision,
  "p_longitude" double precision,
  "p_radius_meters" integer DEFAULT 16000,
  "p_limit" integer DEFAULT 20,
  "p_offset" integer DEFAULT 0,
  "p_layer" text DEFAULT NULL,
  "p_listing_type" text DEFAULT NULL,
  "p_category" text DEFAULT NULL,
  "p_min_price" numeric DEFAULT NULL,
  "p_max_price" numeric DEFAULT NULL,
  "p_is_free" boolean DEFAULT NULL,
  "p_condition" text DEFAULT NULL,
  "p_search" text DEFAULT NULL,
  "p_sort" text DEFAULT 'newest',
  "p_trust_only" boolean DEFAULT false,
  "p_is_wanted" boolean DEFAULT NULL
)
RETURNS TABLE(
  "id" uuid,
  "user_id" uuid,
  "username" character varying,
  "user_name" character varying,
  "user_profile_picture" text,
  "title" text,
  "description" text,
  "price" numeric,
  "is_free" boolean,
  "category" "public"."listing_category",
  "subcategory" text,
  "condition" "public"."listing_condition",
  "status" "public"."listing_status",
  "media_urls" text[],
  "media_types" text[],
  "location_name" text,
  "location_precision" "public"."location_precision",
  "tags" text[],
  "view_count" integer,
  "save_count" integer,
  "created_at" timestamptz,
  "distance_meters" integer,
  -- New columns
  "layer" "public"."listing_layer",
  "listing_type" "public"."listing_type",
  "home_id" uuid,
  "is_address_attached" boolean,
  "quality_score" numeric,
  "context_tags" text[],
  "is_wanted" boolean,
  "budget_max" numeric,
  "expires_at" timestamptz
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_point geography;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

  RETURN QUERY
  SELECT
    l.id,
    l.user_id,
    u.username,
    u.name AS user_name,
    u.profile_picture_url AS user_profile_picture,
    l.title,
    l.description,
    l.price,
    l.is_free,
    l.category,
    l.subcategory,
    l.condition,
    l.status,
    l.media_urls,
    l.media_types,
    l.location_name,
    l.location_precision,
    l.tags,
    l.view_count,
    l.save_count,
    l.created_at,
    CASE
      WHEN l.location IS NOT NULL THEN
        CAST(ST_Distance(l.location, v_point) AS INT)
      ELSE NULL
    END AS distance_meters,
    -- New columns
    l.layer,
    l.listing_type,
    l.home_id,
    l.is_address_attached,
    l.quality_score,
    l.context_tags,
    l.is_wanted,
    l.budget_max,
    l.expires_at
  FROM "Listing" l
  JOIN "User" u ON l.user_id = u.id
  WHERE
    l.status = 'active'
    AND (l.location IS NULL OR ST_DWithin(l.location, v_point, p_radius_meters))
    AND (p_layer IS NULL OR l.layer::text = p_layer)
    AND (p_listing_type IS NULL OR l.listing_type::text = p_listing_type)
    AND (p_category IS NULL OR l.category::text = p_category)
    AND (p_min_price IS NULL OR l.price >= p_min_price)
    AND (p_max_price IS NULL OR l.price <= p_max_price)
    AND (p_is_free IS NULL OR l.is_free = p_is_free)
    AND (p_condition IS NULL OR l.condition::text = p_condition)
    AND (p_search IS NULL OR l.search_vector @@ plainto_tsquery('english', p_search))
    AND (NOT p_trust_only OR l.is_address_attached = true)
    AND (p_is_wanted IS NULL OR l.is_wanted = p_is_wanted)
    -- Exclude expired listings
    AND (l.expires_at IS NULL OR l.expires_at > now())
  ORDER BY
    CASE WHEN p_sort = 'newest' THEN l.created_at END DESC,
    CASE WHEN p_sort = 'price_asc' THEN l.price END ASC,
    CASE WHEN p_sort = 'price_desc' THEN l.price END DESC,
    CASE WHEN p_sort = 'distance' AND l.location IS NOT NULL THEN ST_Distance(l.location, v_point) END ASC,
    l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

ALTER FUNCTION "public"."find_listings_nearby_v2"(
  double precision, double precision, integer, integer, integer,
  text, text, text, numeric, numeric, boolean, text, text, text, boolean, boolean
) OWNER TO "postgres";


-- ─── 9. RPC: find_listings_in_bounds_v2 ───────────────────────
-- Extends find_listings_in_bounds with layer filtering + new columns.

CREATE OR REPLACE FUNCTION "public"."find_listings_in_bounds_v2"(
  "p_south" double precision,
  "p_west" double precision,
  "p_north" double precision,
  "p_east" double precision,
  "p_layer" text DEFAULT NULL,
  "p_category" text DEFAULT NULL,
  "p_limit" integer DEFAULT 100
)
RETURNS TABLE(
  "id" uuid,
  "title" text,
  "price" numeric,
  "is_free" boolean,
  "category" "public"."listing_category",
  "media_urls" text[],
  "latitude" double precision,
  "longitude" double precision,
  "location_precision" "public"."location_precision",
  "created_at" timestamptz,
  -- New columns
  "layer" "public"."listing_layer",
  "listing_type" "public"."listing_type",
  "is_address_attached" boolean,
  "is_wanted" boolean,
  "context_tags" text[]
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_bounds geometry;
BEGIN
  v_bounds := ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326);

  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.price,
    l.is_free,
    l.category,
    l.media_urls,
    -- Privacy blur for approx_area locations
    CASE
      WHEN l.location_precision = 'exact_place' THEN l.latitude
      WHEN l.location_precision = 'approx_area' THEN l.latitude + (random() - 0.5) * 0.005
      ELSE NULL
    END,
    CASE
      WHEN l.location_precision = 'exact_place' THEN l.longitude
      WHEN l.location_precision = 'approx_area' THEN l.longitude + (random() - 0.5) * 0.005
      ELSE NULL
    END,
    l.location_precision,
    l.created_at,
    -- New columns
    l.layer,
    l.listing_type,
    l.is_address_attached,
    l.is_wanted,
    l.context_tags
  FROM "Listing" l
  WHERE
    l.status = 'active'
    AND l.location IS NOT NULL
    AND l.location_precision != 'none'
    AND l.location_precision != 'neighborhood_only'
    AND ST_Intersects(l.location::geometry, v_bounds)
    AND (p_layer IS NULL OR l.layer::text = p_layer)
    AND (p_category IS NULL OR l.category::text = p_category)
    -- Exclude expired
    AND (l.expires_at IS NULL OR l.expires_at > now())
  ORDER BY l.created_at DESC
  LIMIT p_limit;
END;
$$;

ALTER FUNCTION "public"."find_listings_in_bounds_v2"(
  double precision, double precision, double precision, double precision,
  text, text, integer
) OWNER TO "postgres";


-- ─── 10. RPC: get_listing_carousel ────────────────────────────
-- Returns top-ranked listings for the carousel overlay.
-- Ranking: 0.30*Distance + 0.20*Recency + 0.20*Trust + 0.15*Quality + 0.15*Reputation
-- Diversity: max 1 per seller, max 3 per category

CREATE OR REPLACE FUNCTION "public"."get_listing_carousel"(
  "p_latitude" double precision,
  "p_longitude" double precision,
  "p_radius_meters" integer DEFAULT 8047,
  "p_layer" text DEFAULT NULL,
  "p_limit" integer DEFAULT 10
)
RETURNS TABLE(
  "id" uuid,
  "user_id" uuid,
  "username" character varying,
  "user_name" character varying,
  "user_profile_picture" text,
  "title" text,
  "price" numeric,
  "is_free" boolean,
  "category" "public"."listing_category",
  "condition" "public"."listing_condition",
  "media_urls" text[],
  "location_name" text,
  "location_precision" "public"."location_precision",
  "created_at" timestamptz,
  "distance_meters" integer,
  "layer" "public"."listing_layer",
  "listing_type" "public"."listing_type",
  "home_id" uuid,
  "is_address_attached" boolean,
  "quality_score" numeric,
  "context_tags" text[],
  "is_wanted" boolean,
  "budget_max" numeric,
  "expires_at" timestamptz,
  "carousel_score" numeric
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_point geography;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

  RETURN QUERY
  WITH scored AS (
    SELECT
      l.id,
      l.user_id,
      u.username,
      u.name AS user_name,
      u.profile_picture_url AS user_profile_picture,
      l.title,
      l.price,
      l.is_free,
      l.category,
      l.condition,
      l.media_urls,
      l.location_name,
      l.location_precision,
      l.created_at,
      CASE
        WHEN l.location IS NOT NULL THEN CAST(ST_Distance(l.location, v_point) AS INT)
        ELSE NULL
      END AS distance_meters,
      l.layer,
      l.listing_type,
      l.home_id,
      l.is_address_attached,
      l.quality_score,
      l.context_tags,
      l.is_wanted,
      l.budget_max,
      l.expires_at,
      -- Composite ranking score
      (
        -- DistanceScore (0-1): closer = higher, exponential decay
        0.30 * CASE
          WHEN l.location IS NOT NULL THEN
            GREATEST(1.0 - (ST_Distance(l.location, v_point)::numeric / p_radius_meters::numeric), 0.0)
          ELSE 0.5
        END
        -- RecencyScore (0-1): newer = higher, 30-day decay
        + 0.20 * (1.0 - LEAST(EXTRACT(EPOCH FROM (now() - l.created_at)) / 2592000.0, 1.0))
        -- TrustScore (0-1): attached = 1.0
        + 0.20 * CASE WHEN l.is_address_attached = true THEN 1.0 ELSE 0.0 END
        -- QualityScore (0-1): from stored quality_score (0-10 scale)
        + 0.15 * COALESCE(l.quality_score, 0) / 10.0
        -- ReputationScore (0-1): placeholder until review aggregation exists per user
        + 0.15 * 0.5
      )::numeric AS carousel_score,
      -- For diversity: row_number per seller
      ROW_NUMBER() OVER (PARTITION BY l.user_id ORDER BY l.created_at DESC) AS seller_rank,
      -- For diversity: row_number per category
      ROW_NUMBER() OVER (PARTITION BY l.category ORDER BY l.created_at DESC) AS category_rank
    FROM "Listing" l
    JOIN "User" u ON l.user_id = u.id
    WHERE
      l.status = 'active'
      AND l.location IS NOT NULL
      AND ST_DWithin(l.location, v_point, p_radius_meters)
      AND (p_layer IS NULL OR l.layer::text = p_layer)
      AND (l.expires_at IS NULL OR l.expires_at > now())
  ),
  -- Apply diversity: max 1 per seller, max 3 per category
  diverse AS (
    SELECT *
    FROM scored
    WHERE seller_rank <= 1 AND category_rank <= 3
  )
  SELECT
    d.id,
    d.user_id,
    d.username,
    d.user_name,
    d.user_profile_picture,
    d.title,
    d.price,
    d.is_free,
    d.category,
    d.condition,
    d.media_urls,
    d.location_name,
    d.location_precision,
    d.created_at,
    d.distance_meters,
    d.layer,
    d.listing_type,
    d.home_id,
    d.is_address_attached,
    d.quality_score,
    d.context_tags,
    d.is_wanted,
    d.budget_max,
    d.expires_at,
    d.carousel_score
  FROM diverse d
  ORDER BY d.carousel_score DESC
  LIMIT p_limit;
END;
$$;

ALTER FUNCTION "public"."get_listing_carousel"(
  double precision, double precision, integer, text, integer
) OWNER TO "postgres";


-- ─── 11. GRANTS ───────────────────────────────────────────────

-- Enum types
GRANT USAGE ON TYPE "public"."listing_layer" TO "authenticated", "service_role";
GRANT USAGE ON TYPE "public"."listing_type" TO "authenticated", "service_role";

-- ListingInventorySlot table
GRANT ALL ON TABLE "public"."ListingInventorySlot" TO "authenticated";
GRANT ALL ON TABLE "public"."ListingInventorySlot" TO "service_role";

-- New RPC functions
GRANT EXECUTE ON FUNCTION "public"."find_listings_nearby_v2"(
  double precision, double precision, integer, integer, integer,
  text, text, text, numeric, numeric, boolean, text, text, text, boolean, boolean
) TO "authenticated", "service_role";

GRANT EXECUTE ON FUNCTION "public"."find_listings_in_bounds_v2"(
  double precision, double precision, double precision, double precision,
  text, text, integer
) TO "authenticated", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_listing_carousel"(
  double precision, double precision, integer, text, integer
) TO "authenticated", "service_role";
