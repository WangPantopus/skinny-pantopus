-- Migration 092: RPC for batch counting category completions per bidder.
-- Used by GET /api/gigs/:gigId/bids to enrich bids with bidder expertise.

CREATE OR REPLACE FUNCTION "public"."count_category_completions"(
  "p_bidder_ids" "uuid"[],
  "p_category" "text"
)
RETURNS TABLE("user_id" "uuid", "cnt" bigint)
LANGUAGE "sql" STABLE
AS $$
  SELECT g.accepted_by AS user_id, COUNT(*) AS cnt
  FROM "Gig" g
  WHERE g.accepted_by = ANY(p_bidder_ids)
    AND g.category = p_category
    AND g.status = 'completed'
  GROUP BY g.accepted_by;
$$;
