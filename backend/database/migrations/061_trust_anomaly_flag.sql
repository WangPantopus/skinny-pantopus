-- ============================================================
-- M13: TrustAnomalyFlag table + detect_trust_anomalies function
-- Stores flagged providers for admin review when suspicious
-- neighbor_count growth is detected.
-- ============================================================

-- Anomaly flag table
CREATE TABLE IF NOT EXISTS "TrustAnomalyFlag" (
  "id"                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "business_user_id"  UUID NOT NULL REFERENCES "User"("id"),
  "reason"            TEXT NOT NULL DEFAULT 'rapid_growth_new_homes',
  "recent_growth"     INTEGER NOT NULL DEFAULT 0,
  "new_home_count"    INTEGER NOT NULL DEFAULT 0,
  "lookback_days"     INTEGER NOT NULL DEFAULT 7,
  "status"            TEXT NOT NULL DEFAULT 'pending_review',
  "reviewer_notes"    TEXT,
  "reviewed_by"       UUID REFERENCES "User"("id"),
  "reviewed_at"       TIMESTAMPTZ,
  "created_at"        TIMESTAMPTZ DEFAULT now() NOT NULL,
  "updated_at"        TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anomaly_flag_business
  ON "TrustAnomalyFlag"("business_user_id", "status");

CREATE INDEX IF NOT EXISTS idx_anomaly_flag_status
  ON "TrustAnomalyFlag"("status", "created_at" DESC);


-- Detection function: finds providers with suspicious growth
CREATE OR REPLACE FUNCTION detect_trust_anomalies(
  p_lookback_date   TIMESTAMPTZ,
  p_new_home_date   TIMESTAMPTZ,
  p_growth_threshold INTEGER DEFAULT 5,
  p_limit           INTEGER DEFAULT 100
)
RETURNS TABLE (
  business_user_id  UUID,
  growth_count      BIGINT,
  new_home_count    BIGINT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.accepted_by AS business_user_id,
    COUNT(DISTINCT g.id)::BIGINT AS growth_count,
    COUNT(DISTINCT CASE
      WHEN origin_home.created_at >= p_new_home_date THEN g.origin_home_id
    END)::BIGINT AS new_home_count
  FROM "Gig" g
  JOIN "Home" origin_home ON origin_home.id = g.origin_home_id
  WHERE g.completed_at >= p_lookback_date
    AND g.status IN ('completed', 'reviewed')
    AND g.payment_status IN ('captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred')
    AND g.price >= 1000  -- $10 minimum (cents)
    AND g.origin_home_id IS NOT NULL
    -- Only count from verified homes
    AND EXISTS (
      SELECT 1 FROM "HomeOccupancy" ho
      WHERE ho.home_id = g.origin_home_id
        AND ho.is_active = true
        AND ho.role_base NOT IN ('guest')
    )
  GROUP BY g.accepted_by
  HAVING COUNT(DISTINCT g.id) > p_growth_threshold
     AND COUNT(DISTINCT CASE
           WHEN origin_home.created_at >= p_new_home_date THEN g.origin_home_id
         END) >= 3  -- At least 3 from new homes
  ORDER BY growth_count DESC
  LIMIT p_limit;
END;
$$;
