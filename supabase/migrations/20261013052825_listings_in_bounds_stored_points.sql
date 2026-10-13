-- Backwards compatible: yes. Replaces find_listings_in_bounds_v2 with the same
-- arguments and result columns, and stops anon and authenticated from calling it.
--
-- The function used to add a new random offset to every approx_area point on
-- each call. It now returns the stored points of the active listings in the box,
-- and the API decides what each viewer is shown: it asks for a box widened by
-- the largest distance a shown point can be from the stored one, applies the one
-- stable approximate point per listing (backend/services/marketplace/
-- locationPrivacy.js), and keeps the listings whose shown point is in the
-- requested box. Because it now returns stored points, only the API's service
-- role may run it; no app calls it with the anon key or a user's token
-- (20260930181000, 20260930182000).
--
-- An API release from before this change still runs: it receives stored points
-- without the random offset and applies its own offset on top.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.find_listings_in_bounds_v2(p_south double precision, p_west double precision, p_north double precision, p_east double precision, p_layer text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_limit integer DEFAULT 100) RETURNS TABLE(id uuid, title text, price numeric, is_free boolean, category public.listing_category, media_urls text[], latitude double precision, longitude double precision, location_precision public.location_precision, created_at timestamp with time zone, layer public.listing_layer, listing_type public.listing_type, is_address_attached boolean, is_wanted boolean, context_tags text[])
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_bounds geometry;
BEGIN
  v_bounds := ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326);

  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.price,
    l.is_free,
    l.category,
    l.media_urls,
    -- Stored points: the API applies location privacy for each viewer
    l.latitude,
    l.longitude,
    l.location_precision,
    l.created_at,
    l.layer,
    l.listing_type,
    l.is_address_attached,
    l.is_wanted,
    l.context_tags
  FROM "Listing" l
  WHERE
    l.status = 'active'
    AND l.location IS NOT NULL
    AND l.location_precision != 'none'
    AND l.location_precision != 'neighborhood_only'
    AND ST_Intersects(l.location::geometry, v_bounds)
    AND (p_layer IS NULL OR l.layer::text = p_layer)
    AND (p_category IS NULL OR l.category::text = p_category)
    -- Exclude expired
    AND (l.expires_at IS NULL OR l.expires_at > now())
  ORDER BY l.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.find_listings_in_bounds_v2(double precision, double precision, double precision, double precision, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_listings_in_bounds_v2(double precision, double precision, double precision, double precision, text, text, integer) TO service_role;
