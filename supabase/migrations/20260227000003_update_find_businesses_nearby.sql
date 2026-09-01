-- Migration: Update find_businesses_nearby to use stored profile_completeness
-- and add verification_status to return columns.
--
-- Split from 000002 because that migration was already partially applied,
-- so the DROP + CREATE never ran. This new migration file ensures execution.

-- Must DROP first because the return type is changing (adding verification_status column).
-- CREATE OR REPLACE cannot change return types of existing functions.
DROP FUNCTION IF EXISTS "public"."find_businesses_nearby"(double precision, double precision, integer, uuid, text[], numeric, integer);

CREATE OR REPLACE FUNCTION "public"."find_businesses_nearby"(
  "p_center_lat" double precision,
  "p_center_lon" double precision,
  "p_radius_meters" integer DEFAULT 8047,
  "p_viewer_home_id" uuid DEFAULT NULL,
  "p_categories" text[] DEFAULT NULL,
  "p_rating_min" numeric DEFAULT NULL,
  "p_limit" integer DEFAULT 200
) RETURNS TABLE(
  "business_user_id" uuid,
  "username" character varying,
  "name" character varying,
  "profile_picture_url" text,
  "average_rating" numeric,
  "review_count" integer,
  "categories" text[],
  "description" text,
  "business_type" text,
  "logo_file_id" uuid,
  "banner_file_id" uuid,
  "avg_response_minutes" integer,
  "profile_created_at" timestamp with time zone,
  "location_id" uuid,
  "primary_address" text,
  "primary_city" text,
  "primary_state" text,
  "location_timezone" text,
  "distance_meters" integer,
  "neighbor_count" bigint,
  "completed_gigs" bigint,
  "profile_completeness" integer,
  "last_activity_at" timestamp with time zone,
  "is_open_now" boolean,
  "accepts_gigs" boolean,
  "verification_status" varchar(30)
)
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_center geography;
  v_viewer_location geography;
BEGIN
  -- Build center point for distance calculation
  v_center := ST_SetSRID(ST_MakePoint(p_center_lon, p_center_lat), 4326)::geography;

  -- Resolve viewer home location for neighbor trust count
  IF p_viewer_home_id IS NOT NULL THEN
    SELECT h.location INTO v_viewer_location
    FROM "Home" h
    WHERE h.id = p_viewer_home_id;
  END IF;

  RETURN QUERY
  SELECT
    u.id AS business_user_id,
    u.username,
    u.name,
    u.profile_picture_url,
    u.average_rating,
    u.review_count,
    bp.categories,
    bp.description,
    bp.business_type,
    bp.logo_file_id,
    bp.banner_file_id,
    bp.avg_response_minutes,
    bp.created_at AS profile_created_at,
    bl.id AS location_id,
    bl.address AS primary_address,
    bl.city AS primary_city,
    bl.state AS primary_state,
    bl.timezone AS location_timezone,
    CAST(ST_Distance(bl.location, v_center) AS INT) AS distance_meters,

    -- Neighbor trust count (with gaming protections)
    CASE WHEN v_viewer_location IS NOT NULL THEN
      (
        SELECT COUNT(DISTINCT g.origin_home_id)
        FROM "Gig" g
        JOIN "Home" oh ON oh.id = g.origin_home_id
        JOIN "HomeOccupancy" ho ON ho.home_id = oh.id
          AND ho.is_active = true
          AND (ho.role_base IS NULL OR ho.role_base != 'guest')
        WHERE g.accepted_by = u.id
          AND g.status = 'completed'
          AND g.price >= 10
          AND g.payment_status IN ('captured_hold','transfer_scheduled','transfer_pending','transferred')
          AND g.origin_home_id IS NOT NULL
          AND oh.location IS NOT NULL
          AND ST_DWithin(oh.location, v_viewer_location, p_radius_meters)
          AND (
            EXISTS (SELECT 1 FROM "HomeOwnershipClaim" hoc WHERE hoc.home_id = oh.id AND hoc.state = 'approved')
            OR EXISTS (SELECT 1 FROM "HomeResidencyClaim" hrc WHERE hrc.home_id = oh.id AND hrc.status = 'verified')
          )
          AND NOT EXISTS (
            SELECT 1 FROM "Payment" p
            WHERE p.gig_id = g.id
              AND p.payment_status IN ('disputed','refunded','refunded_full','refunded_partial')
          )
      )
    ELSE 0
    END AS neighbor_count,

    -- Completed gigs (for new-business check)
    (SELECT COUNT(*) FROM "Gig" g WHERE g.accepted_by = u.id AND g.status = 'completed') AS completed_gigs,

    -- Profile completeness: read from stored column instead of computing inline
    bp.profile_completeness,

    -- Last activity: most recent completed gig or post
    GREATEST(
      (SELECT MAX(g2.created_at) FROM "Gig" g2 WHERE g2.accepted_by = u.id AND g2.status = 'completed'),
      (SELECT MAX(po.created_at) FROM "Post" po WHERE po.user_id = u.id)
    ) AS last_activity_at,

    -- Open-now: checks special hours override, then regular hours, handles overnight
    CASE WHEN bl.timezone IS NOT NULL THEN
      COALESCE(
        -- Special hours for today (override)
        (
          SELECT
            CASE WHEN bsh.is_closed THEN FALSE
              WHEN bsh.open_time IS NULL OR bsh.close_time IS NULL THEN TRUE
              WHEN bsh.close_time < bsh.open_time THEN
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bsh.open_time
                OR (NOW() AT TIME ZONE bl.timezone)::TIME <= bsh.close_time
              ELSE
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bsh.open_time
                AND (NOW() AT TIME ZONE bl.timezone)::TIME <= bsh.close_time
            END
          FROM "BusinessSpecialHours" bsh
          WHERE bsh.location_id = bl.id
            AND bsh.date = (NOW() AT TIME ZONE bl.timezone)::DATE
          LIMIT 1
        ),
        -- Regular hours for today
        (
          SELECT
            CASE WHEN bh.is_closed THEN FALSE
              WHEN bh.open_time IS NULL OR bh.close_time IS NULL THEN TRUE
              WHEN bh.close_time < bh.open_time THEN
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bh.open_time
                OR (NOW() AT TIME ZONE bl.timezone)::TIME <= bh.close_time
              ELSE
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bh.open_time
                AND (NOW() AT TIME ZONE bl.timezone)::TIME <= bh.close_time
            END
          FROM "BusinessHours" bh
          WHERE bh.location_id = bl.id
            AND bh.day_of_week = EXTRACT(DOW FROM NOW() AT TIME ZONE bl.timezone)::INT
          LIMIT 1
        ),
        NULL  -- no hours data
      )
    ELSE NULL
    END AS is_open_now,

    -- Accepts gig requests: has active team member with gig-capable role
    EXISTS (
      SELECT 1 FROM "BusinessTeam" bt
      WHERE bt.business_user_id = u.id
        AND bt.is_active = true
        AND bt.role_base IN ('owner', 'admin', 'editor', 'staff')
    ) AS accepts_gigs,

    -- Verification status from stored column
    bp.verification_status

  FROM "User" u
  JOIN "BusinessProfile" bp ON bp.business_user_id = u.id
  JOIN "BusinessLocation" bl ON bl.business_user_id = u.id
    AND bl.is_primary = true
    AND bl.is_active = true
  WHERE u.account_type = 'business'
    AND bp.is_published = true
    AND bl.location IS NOT NULL
    AND ST_DWithin(bl.location, v_center, p_radius_meters)
    -- Category filter (array overlap)
    AND (p_categories IS NULL OR bp.categories && p_categories)
    -- Rating minimum filter
    AND (p_rating_min IS NULL OR COALESCE(u.average_rating, 0) >= p_rating_min)
  ORDER BY ST_Distance(bl.location, v_center) ASC
  LIMIT p_limit;
END;
$$;

ALTER FUNCTION "public"."find_businesses_nearby"(
  double precision, double precision, integer, uuid, text[], numeric, integer
) OWNER TO "postgres";

-- Re-grant permissions after DROP + CREATE
GRANT ALL ON FUNCTION "public"."find_businesses_nearby"(double precision, double precision, integer, uuid, text[], numeric, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_businesses_nearby"(double precision, double precision, integer, uuid, text[], numeric, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_businesses_nearby"(double precision, double precision, integer, uuid, text[], numeric, integer) TO "service_role";
