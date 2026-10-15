-- Backwards compatible: yes. Service-only candidate query over existing tables;
-- existing browse functions, rows, permissions and API response fields remain intact.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- This is a candidate superset. The server applies the existing public location
-- transform BEFORE the final radius check. No raw point is returned to clients.
CREATE FUNCTION public.local_price_comparables(
  p_kind text, p_category text, p_lat double precision, p_lng double precision,
  p_radius_meters double precision, p_condition text DEFAULT NULL
) RETURNS TABLE (
  price numeric, status text, latitude double precision, longitude double precision,
  location_precision text, reveal_policy text, visibility_scope text, radius_miles numeric
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE center geography;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL OR NOT (p_lat BETWEEN -90 AND 90)
     OR NOT (p_lng BETWEEN -180 AND 180) OR p_radius_meters IS NULL
     OR NOT (p_radius_meters > 0 AND p_radius_meters <= 165000) THEN RETURN; END IF;
  center := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  IF p_kind = 'gig' THEN
    RETURN QUERY SELECT g.price, g.status::text,
      ST_Y(g.exact_location::geometry), ST_X(g.exact_location::geometry),
      g.location_precision::text, g.reveal_policy::text, g.visibility_scope::text, g.radius_miles
    FROM public."Gig" g
    WHERE g.category = p_category AND g.status = 'completed'
      AND g.owner_confirmed_at >= now() - interval '180 days' AND g.price > 0
      AND g.pay_type = 'fixed' AND (g.pricing_mode IS NULL OR g.pricing_mode = 'fixed_total')
      AND g.visibility_scope IN ('city', 'radius', 'global')
      AND g.location_precision IN ('exact_place', 'approx_area')
      AND ST_DWithin(g.exact_location, center, p_radius_meters)
    ORDER BY g.owner_confirmed_at DESC, g.id LIMIT 1000;
  ELSIF p_kind = 'listing' THEN
    RETURN QUERY SELECT l.price, l.status::text, l.latitude, l.longitude,
      l.location_precision::text, l.reveal_policy::text, l.visibility_scope::text, l.radius_miles
    FROM public."Listing" l
    WHERE l.category::text = p_category AND l.price > 0 AND l.is_free = false
      AND l.archived_at IS NULL
      AND l.is_wanted = false AND l.listing_type IN ('sell_item', 'vehicle_sale')
      AND (p_condition IS NULL OR l.condition::text = p_condition)
      AND (l.status = 'sold' AND l.sold_at >= now() - interval '90 days'
        OR l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > now()))
      AND l.visibility_scope IN ('city', 'radius', 'global')
      AND l.location_precision IN ('exact_place', 'approx_area')
      AND l.latitude BETWEEN -90 AND 90 AND l.longitude BETWEEN -180 AND 180
      AND ST_DWithin(l.location, center, p_radius_meters)
    ORDER BY COALESCE(l.sold_at, l.created_at) DESC, l.id LIMIT 1000;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.local_price_comparables(text,text,double precision,double precision,double precision,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.local_price_comparables(text,text,double precision,double precision,double precision,text) TO service_role;
COMMIT;
