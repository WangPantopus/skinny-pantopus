-- ============================================================
-- M11: Endorsement count proximity function
-- Returns the number of neighbor endorsements for a business
-- within a given radius of the viewer's home.
-- Used by the combined-trust endpoint (Phase 7).
-- ============================================================

CREATE OR REPLACE FUNCTION get_endorsement_count(
  p_business_user_id UUID,
  p_viewer_home_id   UUID,
  p_radius_meters    INTEGER DEFAULT 8047,  -- ~5 miles
  p_category         TEXT    DEFAULT NULL
)
RETURNS TABLE (
  endorsement_count  BIGINT,
  by_category        JSONB
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_viewer_location  geography;
BEGIN
  -- Get viewer home location
  SELECT h.location INTO v_viewer_location
  FROM "Home" h
  WHERE h.id = p_viewer_home_id;

  IF v_viewer_location IS NULL THEN
    RETURN QUERY SELECT 0::BIGINT, '[]'::JSONB;
    RETURN;
  END IF;

  RETURN QUERY
  WITH eligible_endorsements AS (
    SELECT
      e.id,
      e.category
    FROM "NeighborEndorsement" e
    JOIN "Home" endorser_home ON endorser_home.id = e.endorser_home_id
    -- Only endorsements from within radius
    WHERE e.business_user_id = p_business_user_id
      AND (p_category IS NULL OR e.category = p_category)
      AND ST_DWithin(endorser_home.location, v_viewer_location, p_radius_meters)
      -- Verified occupancy gate: endorser must have active, non-guest occupancy
      AND EXISTS (
        SELECT 1 FROM "HomeOccupancy" ho
        WHERE ho.home_id = e.endorser_home_id
          AND ho.user_id = e.endorser_user_id
          AND ho.is_active = true
          AND ho.role_base NOT IN ('guest')
      )
      -- Minimum home age: 14 days (anti-gaming)
      AND endorser_home.created_at <= (now() - INTERVAL '14 days')
  )
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('category', cat, 'count', cnt))
       FROM (
         SELECT category AS cat, COUNT(*) AS cnt
         FROM eligible_endorsements
         GROUP BY category
         ORDER BY cnt DESC
       ) sub),
      '[]'::JSONB
    )
  FROM eligible_endorsements;
END;
$$;
