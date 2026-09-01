-- ============================================================
-- M12: Batch endorsement count function
-- Efficiently counts endorsements for multiple businesses at once.
-- Used by the discovery search endpoint (Phase 7).
-- ============================================================

CREATE OR REPLACE FUNCTION batch_endorsement_counts(
  p_business_user_ids UUID[],
  p_viewer_home_id    UUID,
  p_radius_meters     INTEGER DEFAULT 8047
)
RETURNS TABLE (
  business_user_id   UUID,
  endorsement_count  BIGINT
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
    -- Return zero counts for all requested businesses
    RETURN QUERY
    SELECT unnest(p_business_user_ids), 0::BIGINT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.business_user_id,
    COUNT(*)::BIGINT AS endorsement_count
  FROM "NeighborEndorsement" e
  JOIN "Home" endorser_home ON endorser_home.id = e.endorser_home_id
  WHERE e.business_user_id = ANY(p_business_user_ids)
    AND ST_DWithin(endorser_home.location, v_viewer_location, p_radius_meters)
    -- Verified occupancy gate
    AND EXISTS (
      SELECT 1 FROM "HomeOccupancy" ho
      WHERE ho.home_id = e.endorser_home_id
        AND ho.user_id = e.endorser_user_id
        AND ho.is_active = true
        AND ho.role_base NOT IN ('guest')
    )
    -- Minimum home age: 14 days
    AND endorser_home.created_at <= (now() - INTERVAL '14 days')
  GROUP BY e.business_user_id;
END;
$$;
