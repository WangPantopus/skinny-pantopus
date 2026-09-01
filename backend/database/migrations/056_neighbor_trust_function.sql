-- Phase 2: Neighbor Trust Count RPC function
-- Returns the count of distinct verified homes near the viewer that have hired
-- the given business, with all gaming protections applied.

CREATE OR REPLACE FUNCTION "public"."get_neighbor_trust_count"(
  "p_business_user_id" UUID,
  "p_viewer_home_id" UUID,
  "p_radius_meters" INTEGER DEFAULT 1609,
  "p_category" TEXT DEFAULT NULL
) RETURNS TABLE(
  "neighbor_count" BIGINT,
  "home_density" BIGINT
)
  LANGUAGE "plpgsql"
  SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_viewer_location geography;
BEGIN
  -- Resolve viewer home location
  SELECT h.location INTO v_viewer_location
  FROM "Home" h
  WHERE h.id = p_viewer_home_id;

  -- If viewer has no location, return zeros
  IF v_viewer_location IS NULL THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  RETURN QUERY
  WITH trust_gigs AS (
    SELECT DISTINCT g.origin_home_id
    FROM "Gig" g
    JOIN "Home" origin_home ON origin_home.id = g.origin_home_id
    JOIN "HomeOccupancy" ho
      ON ho.home_id = origin_home.id
      AND ho.is_active = true
      AND (ho.role_base IS NULL OR ho.role_base != 'guest')
    WHERE g.accepted_by = p_business_user_id
      AND g.status = 'completed'
      AND g.price >= 10                              -- price floor (anti-spam)
      AND g.payment_status IN ('captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred')  -- real payment only
      AND g.origin_home_id IS NOT NULL
      -- Verified address gate: home must have approved ownership or verified residency
      AND (
        EXISTS (
          SELECT 1 FROM "HomeOwnershipClaim" hoc
          WHERE hoc.home_id = origin_home.id
            AND hoc.state = 'approved'
        )
        OR EXISTS (
          SELECT 1 FROM "HomeResidencyClaim" hrc
          WHERE hrc.home_id = origin_home.id
            AND hrc.status = 'verified'
        )
      )
      -- Rate limit: 1 trust-counting completion per (home, provider, category) per 30 days
      -- Only count the earliest gig in each 30-day window
      AND NOT EXISTS (
        SELECT 1 FROM "Gig" g2
        WHERE g2.origin_home_id = g.origin_home_id
          AND g2.accepted_by = g.accepted_by
          AND g2.category = g.category
          AND g2.id != g.id
          AND g2.status = 'completed'
          AND g2.created_at > g.created_at - INTERVAL '30 days'
          AND g2.created_at < g.created_at
      )
      -- No disputed or refunded payments for this gig
      AND NOT EXISTS (
        SELECT 1 FROM "Payment" p
        WHERE p.gig_id = g.id
          AND p.payment_status IN ('disputed', 'refunded', 'refunded_full', 'refunded_partial')
      )
      -- Optional category filter
      AND (p_category IS NULL OR g.category = p_category)
      -- Proximity: origin home within radius of viewer home
      AND origin_home.location IS NOT NULL
      AND ST_DWithin(origin_home.location, v_viewer_location, p_radius_meters)
  )
  SELECT
    (SELECT COUNT(*) FROM trust_gigs)::BIGINT AS neighbor_count,
    (
      SELECT COUNT(DISTINCT ho2.home_id)
      FROM "HomeOccupancy" ho2
      JOIN "Home" h2 ON h2.id = ho2.home_id
      WHERE ho2.is_active = true
        AND h2.location IS NOT NULL
        AND ST_DWithin(h2.location, v_viewer_location, p_radius_meters)
    )::BIGINT AS home_density;
END;
$$;


-- Building-level aggregation: count units in the same building that hired this business
CREATE OR REPLACE FUNCTION "public"."get_building_trust_count"(
  "p_business_user_id" UUID,
  "p_parent_home_id" UUID,
  "p_category" TEXT DEFAULT NULL
) RETURNS BIGINT
  LANGUAGE "plpgsql"
  SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(DISTINCT g.origin_home_id) INTO v_count
  FROM "Gig" g
  JOIN "Home" origin_home ON origin_home.id = g.origin_home_id
  JOIN "HomeOccupancy" ho
    ON ho.home_id = origin_home.id
    AND ho.is_active = true
    AND (ho.role_base IS NULL OR ho.role_base != 'guest')
  WHERE g.accepted_by = p_business_user_id
    AND g.status = 'completed'
    AND g.price >= 10
    AND g.payment_status IN ('captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred')
    AND g.origin_home_id IS NOT NULL
    AND origin_home.parent_home_id = p_parent_home_id
    -- Same verified address gate
    AND (
      EXISTS (
        SELECT 1 FROM "HomeOwnershipClaim" hoc
        WHERE hoc.home_id = origin_home.id AND hoc.state = 'approved'
      )
      OR EXISTS (
        SELECT 1 FROM "HomeResidencyClaim" hrc
        WHERE hrc.home_id = origin_home.id AND hrc.status = 'verified'
      )
    )
    -- Same rate limit
    AND NOT EXISTS (
      SELECT 1 FROM "Gig" g2
      WHERE g2.origin_home_id = g.origin_home_id
        AND g2.accepted_by = g.accepted_by
        AND g2.category = g.category
        AND g2.id != g.id
        AND g2.status = 'completed'
        AND g2.created_at > g.created_at - INTERVAL '30 days'
        AND g2.created_at < g.created_at
    )
    -- Same payment check
    AND NOT EXISTS (
      SELECT 1 FROM "Payment" p
      WHERE p.gig_id = g.id
        AND p.payment_status IN ('disputed', 'refunded', 'refunded_full', 'refunded_partial')
    )
    AND (p_category IS NULL OR g.category = p_category);

  RETURN v_count;
END;
$$;
