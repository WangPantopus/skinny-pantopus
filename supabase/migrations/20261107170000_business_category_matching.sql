-- Backwards compatible: yes. Adds a service-only helper and replaces the bodies of
-- find_businesses_in_bounds and find_businesses_nearby. Their signatures, return
-- columns and grants stay, so the running API and every client read the same
-- columns; only which businesses a category filter keeps changes.
-- The category filters compared exact strings, but the apps spell categories in
-- different ways. The phone chips send "pet-care", the phone filter sheet
-- "home-services", the web "pet_care"; businesses are saved as names ("Pet care",
-- "Plumbing", or what the owner typed) and, from earlier phone builds, as slugs
-- ("home_services"). So a filter missed businesses made in another app. A category
-- now matches whatever its case, with "_", "-" and spaces read alike, and the
-- slugs earlier phone builds saved read as their names.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- One spelling of a business category to compare by: lowercase, with "_", "-" and
-- runs of spaces read as one space, so "Pet care", "pet-care" and "pet_care" are
-- the same category. The slugs the phone wizards saved before they saved names
-- read as those names, the ones the apps show for them (iOS
-- BusinessCategory.label(forLegacySlug:), Android BusinessCategory.labelForLegacySlug).
CREATE FUNCTION public.business_category_key(p_category text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(
    CASE p_category
      WHEN 'home_services' THEN 'Home services'
      WHEN 'personal_services' THEN 'Personal services'
      WHEN 'tech_repair' THEN 'Tech & repair'
      WHEN 'delivery_errands' THEN 'Delivery & errands'
      WHEN 'goods_retail' THEN 'Goods & retail'
      WHEN 'rentals' THEN 'Rentals'
      WHEN 'vehicles_rideshare' THEN 'Vehicles & rideshare'
      WHEN 'other' THEN 'Other'
      ELSE p_category
    END
  ), '[[:space:]_-]+', ' ', 'g'))
$$;

REVOKE ALL ON FUNCTION public.business_category_key(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_category_key(text) TO service_role;

CREATE OR REPLACE FUNCTION public.find_businesses_in_bounds(p_south double precision, p_west double precision, p_north double precision, p_east double precision, p_categories text[] DEFAULT NULL::text[], p_open_now_only boolean DEFAULT false, p_limit integer DEFAULT 500) RETURNS TABLE(business_user_id uuid, username character varying, name character varying, profile_picture_url text, latitude double precision, longitude double precision, categories text[], business_type text, average_rating numeric, review_count integer, completed_gigs bigint, is_open_now boolean, is_new_business boolean)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
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
    public.business_location_open_now(bl.id, bl.timezone) AS is_open_now,

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
    -- Category filter (optional): a saved category matches a wanted one however
    -- either is spelled (business_category_key).
    AND (
      p_categories IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(bp.categories) AS saved(category)
        JOIN unnest(p_categories) AS wanted(category)
          ON public.business_category_key(saved.category) = public.business_category_key(wanted.category)
      )
    )
    -- Open-now filter (optional, applied in WHERE for perf). A null time zone
    -- or a day whose hours aren't set is unknown, and unknown isn't filtered out.
    AND (
      NOT p_open_now_only
      OR COALESCE(public.business_location_open_now(bl.id, bl.timezone), TRUE)
    )
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_businesses_nearby(p_center_lat double precision, p_center_lon double precision, p_radius_meters integer DEFAULT 8047, p_viewer_home_id uuid DEFAULT NULL::uuid, p_categories text[] DEFAULT NULL::text[], p_rating_min numeric DEFAULT NULL::numeric, p_limit integer DEFAULT 200, p_entity_types text[] DEFAULT NULL::text[]) RETURNS TABLE(business_user_id uuid, username character varying, name character varying, profile_picture_url text, average_rating numeric, review_count integer, categories text[], description text, business_type text, logo_file_id uuid, banner_file_id uuid, avg_response_minutes integer, profile_created_at timestamp with time zone, location_id uuid, primary_address text, primary_city text, primary_state text, location_timezone text, distance_meters integer, neighbor_count bigint, completed_gigs bigint, profile_completeness integer, last_activity_at timestamp with time zone, is_open_now boolean, accepts_gigs boolean, verification_status character varying, founding_badge boolean, founding_benefit_expires_at timestamp with time zone)
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
    public.business_location_open_now(bl.id, bl.timezone) AS is_open_now,

    -- Accepts gig requests: has active team member with gig-capable role
    EXISTS (
      SELECT 1 FROM "BusinessTeam" bt
      WHERE bt.business_user_id = u.id
        AND bt.is_active = true
        AND bt.role_base IN ('owner', 'admin', 'editor', 'staff')
    ) AS accepts_gigs,

    -- Verification status from stored column
    bp.verification_status,

    -- Founding badge fields
    bp.founding_badge,
    bp.founding_benefit_expires_at

  FROM "User" u
  JOIN "BusinessProfile" bp ON bp.business_user_id = u.id
  JOIN "BusinessLocation" bl ON bl.business_user_id = u.id
    AND bl.is_primary = true
    AND bl.is_active = true
  WHERE u.account_type = 'business'
    AND bp.is_published = true
    AND bl.location IS NOT NULL
    AND ST_DWithin(bl.location, v_center, p_radius_meters)
    -- Category filter (optional): a saved category matches a wanted one however
    -- either is spelled (business_category_key).
    AND (
      p_categories IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(bp.categories) AS saved(category)
        JOIN unnest(p_categories) AS wanted(category)
          ON public.business_category_key(saved.category) = public.business_category_key(wanted.category)
      )
    )
    -- Rating minimum filter
    AND (p_rating_min IS NULL OR COALESCE(u.average_rating, 0) >= p_rating_min)
    -- Entity type filter
    AND (p_entity_types IS NULL OR bp.business_type = ANY(p_entity_types))
  ORDER BY ST_Distance(bl.location, v_center) ASC
  LIMIT p_limit;
END;
$$;

COMMIT;
