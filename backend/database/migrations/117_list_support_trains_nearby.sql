-- Nearby Support Trains for Tasks feed (same radius rules as gigs).
-- Only lists trains whose Activity.visibility is 'nearby' or 'public', with a resolvable Home location.

CREATE OR REPLACE FUNCTION public.list_support_trains_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters double precision,
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  support_train_id uuid,
  activity_id uuid,
  title text,
  status text,
  published_at timestamptz,
  distance_meters double precision,
  open_slots_count bigint,
  city text,
  state text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH home_points AS (
    SELECT
      st.id AS st_id,
      st.activity_id,
      st.status AS st_status,
      st.published_at,
      a.title,
      a.visibility,
      a.status AS act_status,
      COALESCE(st.recipient_home_id, a.home_id) AS resolved_home_id
    FROM public."SupportTrain" st
    INNER JOIN public."Activity" a ON a.id = st.activity_id
    WHERE st.status = ANY (ARRAY['published'::text, 'active'::text])
      AND a.activity_type = 'support_train'
      AND a.status = ANY (ARRAY['published'::text, 'active'::text])
      AND a.visibility = ANY (ARRAY['nearby'::text, 'public'::text])
      AND COALESCE(st.recipient_home_id, a.home_id) IS NOT NULL
  ),
  with_geo AS (
    SELECT
      hp.*,
      h.location,
      h.map_center_lat,
      h.map_center_lng,
      h.city,
      h.state
    FROM home_points hp
    INNER JOIN public."Home" h ON h.id = hp.resolved_home_id
  ),
  with_distance AS (
    SELECT
      wg.st_id,
      wg.activity_id,
      wg.title,
      wg.st_status,
      wg.published_at,
      wg.city,
      wg.state,
      (
        CASE
          WHEN wg.location IS NOT NULL THEN
            ST_Distance(
              wg.location::geography,
              ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
            )
          WHEN wg.map_center_lat IS NOT NULL AND wg.map_center_lng IS NOT NULL THEN
            ST_Distance(
              ST_SetSRID(ST_MakePoint(wg.map_center_lng, wg.map_center_lat), 4326)::geography,
              ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
            )
          ELSE NULL::double precision
        END
      ) AS dist
    FROM with_geo wg
  ),
  filtered AS (
    SELECT *
    FROM with_distance wd
    WHERE wd.dist IS NOT NULL AND wd.dist <= p_radius_meters
  ),
  with_slots AS (
    SELECT
      f.st_id,
      f.activity_id,
      f.title,
      f.st_status,
      f.published_at,
      f.dist,
      f.city,
      f.state,
      (
        SELECT COUNT(*)::bigint
        FROM public."SupportTrainSlot" s
        WHERE s.support_train_id = f.st_id
          AND s.status = 'open'
          AND s.filled_count < s.capacity
      ) AS open_cnt
    FROM filtered f
  )
  SELECT
    ws.st_id AS support_train_id,
    ws.activity_id,
    ws.title,
    ws.st_status AS status,
    ws.published_at,
    ws.dist AS distance_meters,
    ws.open_cnt AS open_slots_count,
    ws.city,
    ws.state
  FROM with_slots ws
  ORDER BY ws.dist ASC, ws.published_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
$$;

COMMENT ON FUNCTION public.list_support_trains_nearby IS
  'Support Trains eligible for neighborhood Tasks feed (visibility nearby/public, within radius).';

GRANT EXECUTE ON FUNCTION public.list_support_trains_nearby(double precision, double precision, double precision, integer) TO service_role;
