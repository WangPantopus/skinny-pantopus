-- ============================================================
-- browse_listings_by_distance
--
-- Returns listings within a bounding box sorted by distance from
-- a reference point using PostGIS ST_Distance.  Supports keyset
-- cursor pagination on (distance_meters, id).
--
-- NULL-coordinate (remote) listings are excluded — the caller
-- appends them separately per Prompt 0C-4.
-- ============================================================

CREATE OR REPLACE FUNCTION browse_listings_by_distance(
  -- Bounding box
  p_south       double precision,
  p_west        double precision,
  p_north       double precision,
  p_east        double precision,
  -- Reference point for distance calc
  p_ref_lat     double precision,
  p_ref_lng     double precision,
  -- Filters (all nullable = no filter)
  p_category    text        DEFAULT NULL,
  p_listing_type text       DEFAULT NULL,
  p_is_free     boolean     DEFAULT NULL,
  p_is_wanted   boolean     DEFAULT NULL,
  p_condition   text        DEFAULT NULL,
  p_min_price   numeric     DEFAULT NULL,
  p_max_price   numeric     DEFAULT NULL,
  p_layer       text        DEFAULT NULL,
  p_trust_only  boolean     DEFAULT false,
  p_search      text        DEFAULT NULL,
  p_created_after timestamptz DEFAULT NULL,
  -- Cursor
  p_cursor_distance double precision DEFAULT NULL,
  p_cursor_id       uuid             DEFAULT NULL,
  -- Pagination
  p_limit       int         DEFAULT 31
)
RETURNS TABLE (
  id              uuid,
  user_id         uuid,
  title           text,
  description     text,
  price           numeric,
  is_free         boolean,
  category        text,
  subcategory     text,
  condition       text,
  quantity        int,
  status          text,
  media_urls      text[],
  media_types     text[],
  location_name   text,
  latitude        double precision,
  longitude       double precision,
  location_precision text,
  visibility_scope   text,
  meetup_preference  text,
  delivery_available boolean,
  tags            text[],
  view_count      int,
  save_count      int,
  message_count   int,
  layer           text,
  listing_type    text,
  home_id         uuid,
  is_address_attached boolean,
  quality_score   int,
  context_tags    text[],
  is_wanted       boolean,
  budget_max      numeric,
  expires_at      timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz,
  distance_meters double precision
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_ref geography;
BEGIN
  v_ref := ST_SetSRID(ST_MakePoint(p_ref_lng, p_ref_lat), 4326)::geography;

  RETURN QUERY
  SELECT
    l.id,
    l.user_id,
    l.title,
    l.description,
    l.price,
    l.is_free,
    l.category,
    l.subcategory,
    l.condition,
    l.quantity,
    l.status,
    l.media_urls,
    l.media_types,
    l.location_name,
    l.latitude,
    l.longitude,
    l.location_precision,
    l.visibility_scope,
    l.meetup_preference,
    l.delivery_available,
    l.tags,
    l.view_count,
    l.save_count,
    l.message_count,
    l.layer,
    l.listing_type,
    l.home_id,
    l.is_address_attached,
    l.quality_score,
    l.context_tags,
    l.is_wanted,
    l.budget_max,
    l.expires_at,
    l.created_at,
    l.updated_at,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
      v_ref
    ) AS distance_meters
  FROM "Listing" l
  WHERE l.status = 'active'
    AND l.archived_at IS NULL
    AND l.latitude  IS NOT NULL
    AND l.longitude IS NOT NULL
    -- Bounding box
    AND l.latitude  >= p_south
    AND l.latitude  <= p_north
    AND l.longitude >= p_west
    AND l.longitude <= p_east
    -- Expiry
    AND (l.expires_at IS NULL OR l.expires_at > now())
    -- Optional filters (cast enum columns to text — params are text)
    AND (p_category     IS NULL OR l.category::text     = p_category)
    AND (p_listing_type IS NULL OR l.listing_type::text = p_listing_type)
    AND (p_is_free      IS NULL OR l.is_free      = p_is_free)
    AND (p_is_wanted    IS NULL OR l.is_wanted    = p_is_wanted)
    AND (p_condition    IS NULL OR l.condition::text    = p_condition)
    AND (p_min_price    IS NULL OR l.price        >= p_min_price)
    AND (p_max_price    IS NULL OR l.price        <= p_max_price)
    AND (p_layer        IS NULL OR l.layer::text       = p_layer)
    AND (NOT p_trust_only       OR l.is_address_attached = true)
    AND (p_created_after IS NULL OR l.created_at >= p_created_after)
    -- Full-text search
    AND (p_search IS NULL OR l.search_vector @@ websearch_to_tsquery('english', p_search))
    -- Keyset cursor: (distance_meters, id) ascending
    AND (
      p_cursor_distance IS NULL
      OR ST_Distance(
           ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
           v_ref
         ) > p_cursor_distance
      OR (
           ST_Distance(
             ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
             v_ref
           ) = p_cursor_distance
           AND l.id > p_cursor_id
         )
    )
  ORDER BY distance_meters ASC, l.id ASC
  LIMIT p_limit;
END;
$$;
