-- ============================================================
-- Migration 083: Exclude Past-Deadline Gigs from Browse/Map
-- ============================================================
-- Adds a deadline filter to find_gigs_nearby_v2 and
-- find_gigs_in_bounds_v2 so that gigs whose deadline has
-- already passed are no longer returned in browse results.
--
-- Rule: deadline IS NULL (no deadline set) OR deadline > now()
-- ============================================================


-- ─── 1. RPC: find_gigs_nearby_v2 (updated) ──────────────────

CREATE OR REPLACE FUNCTION "public"."find_gigs_nearby_v2"(
  "user_lat" double precision,
  "user_lon" double precision,
  "p_radius_meters" integer DEFAULT 40234,
  "p_category" text DEFAULT NULL,
  "p_min_price" numeric DEFAULT NULL,
  "p_max_price" numeric DEFAULT NULL,
  "p_search" text DEFAULT NULL,
  "p_sort" text DEFAULT 'newest',
  "p_limit" integer DEFAULT 20,
  "p_offset" integer DEFAULT 0,
  "p_include_remote" boolean DEFAULT true,
  "gig_status" character varying DEFAULT 'open'::character varying
)
RETURNS TABLE(
  "id" uuid,
  "title" character varying,
  "description" text,
  "price" numeric,
  "category" character varying,
  "deadline" timestamptz,
  "estimated_duration" double precision,
  "user_id" uuid,
  "status" character varying,
  "accepted_by" uuid,
  "created_at" timestamptz,
  "distance_meters" integer,
  "creator_name" character varying,
  "creator_username" character varying,
  "profile_picture_url" text,
  "exact_city" text,
  "exact_state" text,
  "approx_latitude" double precision,
  "approx_longitude" double precision,
  "location_precision" "public"."location_precision",
  "visibility_scope" "public"."visibility_scope",
  "is_urgent" boolean,
  "tags" text[],
  "items" jsonb,
  "scheduled_start" timestamptz,
  "attachments" text[]
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_point geography;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography;

  RETURN QUERY
  SELECT
    g.id,
    g.title,
    g.description,
    g.price,
    g.category,
    g.deadline,
    g.estimated_duration,
    g.user_id,
    g.status,
    g.accepted_by,
    g.created_at,
    CASE
      WHEN g.exact_location IS NOT NULL THEN
        CAST(ST_Distance(g.exact_location, v_point) AS INT)
      ELSE NULL
    END AS distance_meters,
    u.name AS creator_name,
    u.username AS creator_username,
    u.profile_picture_url,
    g.exact_city,
    g.exact_state,
    CASE
      WHEN g.approx_location IS NOT NULL THEN ST_Y(g.approx_location::geometry)
      ELSE NULL
    END AS approx_latitude,
    CASE
      WHEN g.approx_location IS NOT NULL THEN ST_X(g.approx_location::geometry)
      ELSE NULL
    END AS approx_longitude,
    g.location_precision,
    g.visibility_scope,
    g.is_urgent,
    g.tags,
    g.items,
    g.scheduled_start,
    g.attachments
  FROM "Gig" g
  LEFT JOIN "User" u ON g.user_id = u.id
  WHERE
    g.status = gig_status
    -- Exclude gigs whose deadline has already passed
    AND (g.deadline IS NULL OR g.deadline > now())
    -- Location filter: include remote gigs (NULL location) OR gigs within radius
    AND (
      (p_include_remote IS TRUE AND g.exact_location IS NULL)
      OR ST_DWithin(g.exact_location, v_point, p_radius_meters)
    )
    -- Optional filters
    AND (p_category IS NULL OR g.category = p_category)
    AND (p_min_price IS NULL OR g.price >= p_min_price)
    AND (p_max_price IS NULL OR g.price <= p_max_price)
    AND (p_search IS NULL OR g.title ILIKE '%' || p_search || '%' OR g.description ILIKE '%' || p_search || '%')
  ORDER BY
    CASE WHEN p_sort = 'newest' THEN g.created_at END DESC,
    CASE WHEN p_sort = 'price_asc' THEN g.price END ASC,
    CASE WHEN p_sort = 'price_desc' THEN g.price END DESC,
    CASE WHEN p_sort = 'distance' AND g.exact_location IS NOT NULL THEN ST_Distance(g.exact_location, v_point) END ASC NULLS LAST,
    g.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

ALTER FUNCTION "public"."find_gigs_nearby_v2"(
  double precision, double precision, integer,
  text, numeric, numeric, text, text, integer, integer, boolean, character varying
) OWNER TO "postgres";


-- ─── 2. RPC: find_gigs_in_bounds_v2 (updated) ───────────────

CREATE OR REPLACE FUNCTION "public"."find_gigs_in_bounds_v2"(
  "min_lat" double precision,
  "min_lon" double precision,
  "max_lat" double precision,
  "max_lon" double precision,
  "gig_status" character varying DEFAULT 'open'::character varying,
  "p_include_remote" boolean DEFAULT true,
  "p_category" text DEFAULT NULL,
  "p_limit" integer DEFAULT 100
)
RETURNS TABLE(
  "id" uuid,
  "title" character varying,
  "description" text,
  "price" numeric,
  "category" character varying,
  "user_id" uuid,
  "status" character varying,
  "latitude" double precision,
  "longitude" double precision,
  "created_at" timestamptz,
  "creator_name" character varying,
  "creator_username" character varying,
  "profile_picture_url" text,
  "exact_city" text,
  "exact_state" text,
  "location_precision" "public"."location_precision",
  "visibility_scope" "public"."visibility_scope",
  "is_urgent" boolean,
  "tags" text[],
  "items" jsonb,
  "scheduled_start" timestamptz,
  "attachments" text[],
  "is_remote" boolean
)
LANGUAGE "plpgsql"
SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_bounds geometry;
BEGIN
  v_bounds := ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);

  RETURN QUERY
  -- Spatially bounded gigs (have approx_location within viewport)
  SELECT
    g.id,
    g.title,
    g.description,
    g.price,
    g.category,
    g.user_id,
    g.status,
    ST_Y(g.approx_location::geometry) AS latitude,
    ST_X(g.approx_location::geometry) AS longitude,
    g.created_at,
    u.name AS creator_name,
    u.username AS creator_username,
    u.profile_picture_url,
    g.exact_city,
    g.exact_state,
    g.location_precision,
    g.visibility_scope,
    g.is_urgent,
    g.tags,
    g.items,
    g.scheduled_start,
    g.attachments,
    false AS is_remote
  FROM "Gig" g
  LEFT JOIN "User" u ON g.user_id = u.id
  WHERE
    g.status = gig_status
    AND (g.deadline IS NULL OR g.deadline > now())
    AND g.approx_location IS NOT NULL
    AND ST_Intersects(g.approx_location::geometry, v_bounds)
    AND (p_category IS NULL OR g.category = p_category)

  UNION ALL

  -- Remote gigs (no location) — appear in side list only, no map pins
  SELECT
    g.id,
    g.title,
    g.description,
    g.price,
    g.category,
    g.user_id,
    g.status,
    NULL::double precision AS latitude,
    NULL::double precision AS longitude,
    g.created_at,
    u.name AS creator_name,
    u.username AS creator_username,
    u.profile_picture_url,
    g.exact_city,
    g.exact_state,
    g.location_precision,
    g.visibility_scope,
    g.is_urgent,
    g.tags,
    g.items,
    g.scheduled_start,
    g.attachments,
    true AS is_remote
  FROM "Gig" g
  LEFT JOIN "User" u ON g.user_id = u.id
  WHERE
    p_include_remote IS TRUE
    AND g.status = gig_status
    AND (g.deadline IS NULL OR g.deadline > now())
    AND g.approx_location IS NULL
    AND (p_category IS NULL OR g.category = p_category)

  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$;

ALTER FUNCTION "public"."find_gigs_in_bounds_v2"(
  double precision, double precision, double precision, double precision,
  character varying, boolean, text, integer
) OWNER TO "postgres";


-- ─── 3. GRANTS (re-grant after CREATE OR REPLACE) ───────────

GRANT EXECUTE ON FUNCTION "public"."find_gigs_nearby_v2"(
  double precision, double precision, integer,
  text, numeric, numeric, text, text, integer, integer, boolean, character varying
) TO "anon", "authenticated", "service_role";

GRANT EXECUTE ON FUNCTION "public"."find_gigs_in_bounds_v2"(
  double precision, double precision, double precision, double precision,
  character varying, boolean, text, integer
) TO "anon", "authenticated", "service_role";
