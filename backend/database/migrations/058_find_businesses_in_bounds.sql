-- Phase 5: find_businesses_in_bounds SQL function
-- Returns published businesses within a bounding box for map display.
-- Lightweight query: no composite scoring, just map pin data.
-- Pin tier is derived from completed_gigs: small (0), medium (1-9), large (10+).

CREATE OR REPLACE FUNCTION "public"."find_businesses_in_bounds"(
  "p_south" DOUBLE PRECISION,
  "p_west" DOUBLE PRECISION,
  "p_north" DOUBLE PRECISION,
  "p_east" DOUBLE PRECISION,
  "p_categories" TEXT[] DEFAULT NULL,
  "p_open_now_only" BOOLEAN DEFAULT FALSE,
  "p_limit" INTEGER DEFAULT 500
) RETURNS TABLE(
  "business_user_id" UUID,
  "username" VARCHAR,
  "name" VARCHAR,
  "profile_picture_url" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "categories" TEXT[],
  "business_type" TEXT,
  "average_rating" NUMERIC,
  "review_count" INT,
  "completed_gigs" BIGINT,
  "is_open_now" BOOLEAN,
  "is_new_business" BOOLEAN
)
  LANGUAGE "plpgsql"
  SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_bounds geography;
BEGIN
  -- Build bounding box envelope for spatial query
  v_bounds := ST_SetSRID(
    ST_MakeEnvelope(p_west, p_south, p_east, p_north),
    4326
  )::geography;

  RETURN QUERY
  SELECT
    u.id AS business_user_id,
    u.username,
    u.name,
    u.profile_picture_url,
    ST_Y(bl.location::geometry) AS latitude,
    ST_X(bl.location::geometry) AS longitude,
    bp.categories,
    bp.business_type,
    u.average_rating,
    u.review_count,

    -- Completed gigs count (for pin tier: 0=small, 1-9=medium, 10+=large)
    (SELECT COUNT(*) FROM "Gig" g WHERE g.accepted_by = u.id AND g.status = 'completed') AS completed_gigs,

    -- Open-now check (timezone-aware with special hours override)
    CASE WHEN bl.timezone IS NOT NULL THEN
      COALESCE(
        -- Special hours override for today
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
        NULL
      )
    ELSE NULL
    END AS is_open_now,

    -- New business flag (< 3 completed gigs AND profile < 30 days old)
    (
      (SELECT COUNT(*) FROM "Gig" g WHERE g.accepted_by = u.id AND g.status = 'completed') < 3
      AND bp.created_at > NOW() - INTERVAL '30 days'
    ) AS is_new_business

  FROM "User" u
  JOIN "BusinessProfile" bp ON bp.business_user_id = u.id
  JOIN "BusinessLocation" bl ON bl.business_user_id = u.id
    AND bl.is_primary = true
    AND bl.is_active = true
  WHERE u.account_type = 'business'
    AND bp.is_published = true
    AND bl.location IS NOT NULL
    -- Bounding box filter
    AND ST_Intersects(bl.location, v_bounds)
    -- Category filter (optional)
    AND (p_categories IS NULL OR bp.categories && p_categories)
    -- Open-now filter (optional, applied in WHERE for perf)
    AND (
      NOT p_open_now_only
      OR bl.timezone IS NULL
      OR COALESCE(
        (
          SELECT
            CASE WHEN bsh2.is_closed THEN FALSE
              WHEN bsh2.open_time IS NULL OR bsh2.close_time IS NULL THEN TRUE
              WHEN bsh2.close_time < bsh2.open_time THEN
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bsh2.open_time
                OR (NOW() AT TIME ZONE bl.timezone)::TIME <= bsh2.close_time
              ELSE
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bsh2.open_time
                AND (NOW() AT TIME ZONE bl.timezone)::TIME <= bsh2.close_time
            END
          FROM "BusinessSpecialHours" bsh2
          WHERE bsh2.location_id = bl.id
            AND bsh2.date = (NOW() AT TIME ZONE bl.timezone)::DATE
          LIMIT 1
        ),
        (
          SELECT
            CASE WHEN bh2.is_closed THEN FALSE
              WHEN bh2.open_time IS NULL OR bh2.close_time IS NULL THEN TRUE
              WHEN bh2.close_time < bh2.open_time THEN
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bh2.open_time
                OR (NOW() AT TIME ZONE bl.timezone)::TIME <= bh2.close_time
              ELSE
                (NOW() AT TIME ZONE bl.timezone)::TIME >= bh2.open_time
                AND (NOW() AT TIME ZONE bl.timezone)::TIME <= bh2.close_time
            END
          FROM "BusinessHours" bh2
          WHERE bh2.location_id = bl.id
            AND bh2.day_of_week = EXTRACT(DOW FROM NOW() AT TIME ZONE bl.timezone)::INT
          LIMIT 1
        ),
        TRUE  -- If no hours data, treat as open (don't filter out)
      ) = TRUE
    )
  LIMIT p_limit;
END;
$$;
