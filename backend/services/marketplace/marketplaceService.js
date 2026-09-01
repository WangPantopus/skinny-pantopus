/**
 * marketplaceService.js — Unified marketplace query logic for browse, discover,
 * search, and autocomplete.
 *
 * Replaces the fragmented RPC-based listing queries (find_listings_nearby_v2,
 * find_listings_in_bounds_v2) with direct Supabase queries. Returns lat/lng
 * directly — no enrichWithCoordinates double-query.
 *
 * All queries use keyset (cursor) pagination instead of offset pagination.
 * The cursor is an opaque base64-encoded JSON string; the client passes it
 * back verbatim.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const s3 = require('../s3Service');
const { applyLocationPrivacyBatch } = require('./locationPrivacy');
const { LISTING_CATEGORIES } = require('../../constants/marketplace');
const { hydrateListingCreatorIdentities } = require('../../utils/listingCreatorIdentity');
const {
  SAFE_CREATOR_SELECT,
  serializeUserAsLocalIdentity,
} = require('../../serializers/identitySerializers');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// P0.3: legacy creator-select constant replaced by SAFE_CREATOR_SELECT.
// See Audience Profile design v2 §16 item 2.
const METERS_PER_MILE = 1609.34;
const DEFAULT_DISCOVERY_RADIUS_METERS = Math.round(100 * METERS_PER_MILE);
const GLOBAL_RADIUS_METERS = Math.round(25000 * METERS_PER_MILE);
const WORLD_BOUNDS = { south: -90, west: -180, north: 90, east: 180 };

const LISTING_BROWSE_SELECT = `
  id, user_id, title, description, price, is_free,
  category, subcategory, condition, quantity, status,
  media_urls, media_types, media_thumbnails, location_name,
  latitude, longitude, location_precision, visibility_scope,
  meetup_preference, delivery_available, tags,
  view_count, save_count, message_count,
  layer, listing_type, home_id, is_address_attached,
  quality_score, context_tags, is_wanted, budget_max, expires_at,
  created_at, updated_at,
  creator:user_id (${SAFE_CREATOR_SELECT})
`.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// In-memory caches
// ---------------------------------------------------------------------------

// Mute/block filter cache (60s TTL, same pattern as feedService)
const _filterCache = new Map();
const FILTER_CACHE_TTL = 60_000;

// Total-in-bounds count cache (30s TTL)
const _countCache = new Map();
const COUNT_CACHE_TTL = 30_000;

// ---------------------------------------------------------------------------
// Media URL helpers (same as feedService)
// ---------------------------------------------------------------------------

function resolveStoredMediaUrl(url) {
  const cleanUrl = typeof url === 'string' ? url.trim() : '';
  if (!cleanUrl) return '';
  if (/^(https?:)?\/\//i.test(cleanUrl)) return cleanUrl;
  if (/^(data:|blob:)/i.test(cleanUrl)) return cleanUrl;
  return s3.getPublicUrl(cleanUrl.replace(/^\/+/, ''));
}

function normalizeMediaUrls(mediaUrls) {
  if (!Array.isArray(mediaUrls)) return [];
  return mediaUrls.map(resolveStoredMediaUrl).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Row normalizer
// ---------------------------------------------------------------------------

function normalizeListingRow(row, savedIds = new Set(), refLat = null, refLng = null) {
  const mediaUrls = normalizeMediaUrls(row.media_urls);
  const firstImage = mediaUrls.length > 0 ? mediaUrls[0] : null;

  // Use DB-computed distance when available (nearest sort RPC), fall back to JS haversine
  let distanceMeters = row.distance_meters ?? null;
  if (distanceMeters == null && refLat != null && refLng != null && row.latitude != null && row.longitude != null) {
    distanceMeters = haversineDistance(refLat, refLng, row.latitude, row.longitude);
  }

  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    price: row.price,
    is_free: row.is_free,
    category: row.category,
    subcategory: row.subcategory || null,
    condition: row.condition,
    quantity: row.quantity,
    status: row.status,
    media_urls: mediaUrls,
    media_types: row.media_types || [],
    media_thumbnails: normalizeMediaUrls(row.media_thumbnails),
    first_image: firstImage,
    latitude: row.latitude || null,
    longitude: row.longitude || null,
    location_name: row.location_name || null,
    location_precision: row.location_precision || 'approx_area',
    visibility_scope: row.visibility_scope || 'city',
    meetup_preference: row.meetup_preference || null,
    delivery_available: row.delivery_available || false,
    tags: row.tags || [],
    view_count: row.view_count || 0,
    save_count: row.save_count || 0,
    message_count: row.message_count || 0,
    layer: row.layer || 'goods',
    listing_type: row.listing_type || 'sell_item',
    home_id: row.home_id || null,
    is_address_attached: row.is_address_attached || false,
    quality_score: row.quality_score || 0,
    context_tags: row.context_tags || [],
    is_wanted: row.is_wanted || false,
    budget_max: row.budget_max || null,
    expires_at: row.expires_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    distance_meters: distanceMeters,
    userHasSaved: savedIds.has(row.id),
    // Project the raw/enriched User row through the serializer wall so only
    // the public identity shape reaches clients.
    creator: row.creator ? serializeUserAsLocalIdentity(row.creator) : null,
  };
}

// ---------------------------------------------------------------------------
// Haversine distance (meters)
// ---------------------------------------------------------------------------

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Bounding box from center + radius
// ---------------------------------------------------------------------------

function boundingBoxFromCenter(lat, lng, radiusMeters) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return WORLD_BOUNDS;

  const radius = Number.isFinite(radiusMeters) && radiusMeters > 0
    ? radiusMeters
    : DEFAULT_DISCOVERY_RADIUS_METERS;
  if (radius >= GLOBAL_RADIUS_METERS) return WORLD_BOUNDS;

  const latDelta = radius / 111000;
  const cosLat = Math.max(Math.abs(Math.cos(lat * Math.PI / 180)), 0.01);
  const lngDelta = radius / (111000 * cosLat);
  const west = lng - lngDelta;
  const east = lng + lngDelta;

  return {
    south: Math.min(Math.max(lat - latDelta, -90), 90),
    north: Math.min(Math.max(lat + latDelta, -90), 90),
    west: west < -180 || east > 180 || lngDelta >= 180 ? -180 : west,
    east: west < -180 || east > 180 || lngDelta >= 180 ? 180 : east,
  };
}

// ---------------------------------------------------------------------------
// Mute / block filters (same pattern as feedService)
// ---------------------------------------------------------------------------

async function getMuteAndBlockFilters(userId) {
  if (!userId) return null;

  const cached = _filterCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  // ListingHide table may not exist yet — query it safely (Supabase builder is thenable but has no .catch)
  const hidesPromise = Promise.resolve(
    supabaseAdmin.from('ListingHide').select('listing_id').eq('user_id', userId)
  ).catch(err => {
    logger.warn('marketplace.hides_fetch.error', { error: err.message });
    return { data: [] };
  });

  const [{ data: mutes }, { data: blocks }, hidesResult] = await Promise.all([
    supabaseAdmin.from('PostMute').select('muted_entity_id, muted_entity_type').eq('user_id', userId),
    supabaseAdmin.from('Relationship')
      .select('requester_id, addressee_id')
      .eq('status', 'blocked')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    hidesPromise,
  ]);
  const hides = hidesResult.data;

  const blockedUserIds = new Set();
  if (blocks) {
    for (const b of blocks) {
      if (b.requester_id === userId) blockedUserIds.add(b.addressee_id);
      else blockedUserIds.add(b.requester_id);
    }
  }

  const result = {
    mutedUserIds: new Set(
      (mutes || []).filter(m => m.muted_entity_type === 'user').map(m => m.muted_entity_id)
    ),
    blockedUserIds,
    hiddenListingIds: new Set((hides || []).map(h => h.listing_id)),
  };

  _filterCache.set(userId, { data: result, expires: Date.now() + FILTER_CACHE_TTL });
  return result;
}

function applyListingExclusions(listings, filters) {
  if (!filters) return listings;
  return listings.filter(l => {
    if (filters.hiddenListingIds.has(l.id)) return false;
    if (filters.mutedUserIds.has(l.user_id)) return false;
    if (filters.blockedUserIds.has(l.user_id)) return false;
    return true;
  });
}

function invalidateFilterCache(userId) {
  _filterCache.delete(userId);
}

// ---------------------------------------------------------------------------
// Save status enrichment
// ---------------------------------------------------------------------------

async function getSavedListingIds(userId, listingIds) {
  if (!userId || !listingIds.length) return new Set();
  const { data: saves } = await supabaseAdmin
    .from('ListingSave')
    .select('listing_id')
    .eq('user_id', userId)
    .in('listing_id', listingIds);
  return new Set((saves || []).map(s => s.listing_id));
}

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

function decodeCursor(cursorStr) {
  if (!cursorStr) return null;
  try {
    return JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function buildNextCursor(lastItem, sort, refLat, refLng) {
  if (!lastItem) return null;

  switch (sort) {
    case 'price_low':
    case 'price_high':
      return encodeCursor({ price: lastItem.price, id: lastItem.id });
    case 'nearest':
      return encodeCursor({ distance_meters: lastItem.distance_meters, id: lastItem.id });
    case 'newest':
    default:
      return encodeCursor({ created_at: lastItem.created_at, id: lastItem.id });
  }
}

// ---------------------------------------------------------------------------
// Count cache helpers
// ---------------------------------------------------------------------------

function countCacheKey(south, west, north, east, filters) {
  return `${south},${west},${north},${east}|${JSON.stringify(filters || {})}`;
}

// ---------------------------------------------------------------------------
// browseListings — the core unified query
// ---------------------------------------------------------------------------

/**
 * Browse listings within a bounding box with filtering, sorting, and keyset
 * cursor pagination. This is the single source of truth for both map pins and
 * grid cards in Browse Mode.
 */
async function browseListings({
  south, west, north, east,
  category, listingType, isFree, isWanted, condition,
  minPrice, maxPrice, layer, trustOnly,
  search,
  sort = 'newest',
  cursor,
  limit = 30,
  userId,
  refLat, refLng,
  // Internal options
  _createdAfter, // ISO string — for "just listed" section
  // Remote listing control
  remoteOnly = false,    // true → only NULL-coordinate listings
  includeRemote = true,  // false → exclude NULL-coordinate listings
}) {
  const parsedLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

  // 1. Build base query
  let query = supabaseAdmin
    .from('Listing')
    .select(LISTING_BROWSE_SELECT)
    .eq('status', 'active')
    .is('archived_at', null);

  // 2. Location filtering
  if (remoteOnly) {
    // Only remote (NULL-coordinate) listings
    query = query.is('latitude', null);
  } else {
    // Bounding box for located listings
    query = query
      .gte('latitude', south)
      .lte('latitude', north)
      .gte('longitude', west)
      .lte('longitude', east);

    // Exclude remote listings when explicitly asked (e.g. "nearby" pill)
    query = query.not('latitude', 'is', null).not('longitude', 'is', null);
  }

  // 3. Optional filters
  if (category) query = query.eq('category', category);
  if (listingType) query = query.eq('listing_type', listingType);
  if (isFree === true || isFree === 'true') query = query.eq('is_free', true);
  if (isFree === false || isFree === 'false') query = query.eq('is_free', false);
  if (isWanted === true || isWanted === 'true') query = query.eq('is_wanted', true);
  if (condition) query = query.eq('condition', condition);
  if (layer) query = query.eq('layer', layer);
  if (trustOnly === true || trustOnly === 'true') query = query.eq('is_address_attached', true);

  if (minPrice != null) query = query.gte('price', parseFloat(minPrice));
  if (maxPrice != null) query = query.lte('price', parseFloat(maxPrice));

  // Filter out expired listings
  query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

  // Internal: created after (for "just listed" section)
  if (_createdAfter) query = query.gte('created_at', _createdAfter);

  // 4. Text search
  if (search && search.trim()) {
    query = query.textSearch('search_vector', search.trim(), { type: 'websearch' });
  }

  // 5. Keyset cursor pagination
  const decodedCursor = decodeCursor(cursor);

  if (sort === 'newest' || !sort) {
    // ORDER BY created_at DESC, id DESC
    if (decodedCursor) {
      query = query.or(
        `created_at.lt.${decodedCursor.created_at},and(created_at.eq.${decodedCursor.created_at},id.lt.${decodedCursor.id})`
      );
    }
    query = query.order('created_at', { ascending: false }).order('id', { ascending: false });
  } else if (sort === 'price_low') {
    // ORDER BY price ASC NULLS LAST, id ASC
    if (decodedCursor) {
      if (decodedCursor.price != null) {
        query = query.or(
          `price.gt.${decodedCursor.price},and(price.eq.${decodedCursor.price},id.gt.${decodedCursor.id}),price.is.null`
        );
      } else {
        // Cursor was at a null-price item, only advance by id
        query = query.filter('price', 'is', null).gt('id', decodedCursor.id);
      }
    }
    query = query.order('price', { ascending: true, nullsFirst: false }).order('id', { ascending: true });
  } else if (sort === 'price_high') {
    // ORDER BY price DESC NULLS LAST, id DESC
    if (decodedCursor) {
      if (decodedCursor.price != null) {
        query = query.or(
          `price.lt.${decodedCursor.price},and(price.eq.${decodedCursor.price},id.lt.${decodedCursor.id})`
        );
      } else {
        query = query.filter('price', 'is', null).lt('id', decodedCursor.id);
      }
    }
    query = query.order('price', { ascending: false, nullsFirst: false }).order('id', { ascending: false });
  } else if (sort === 'nearest') {
    // Nearest sort is handled via a dedicated PostGIS RPC — but if
    // no reference point is provided, fall back to newest ordering.
    if (refLat == null || refLng == null) {
      query = query.order('created_at', { ascending: false }).order('id', { ascending: false });
    }
  }

  // 6. Limit (fetch extra to determine hasMore)
  const fetchLimit = parsedLimit + 1;
  const useNearestRpc = sort === 'nearest' && refLat != null && refLng != null && !remoteOnly;
  if (!useNearestRpc) query = query.limit(fetchLimit);

  // Execute query
  let listings;
  let fuzzyMatch = false;
  if (useNearestRpc) {
    // Use PostGIS RPC for database-level distance sort + cursor pagination
    const rpcParams = {
      p_south: south,
      p_west: west,
      p_north: north,
      p_east: east,
      p_ref_lat: refLat,
      p_ref_lng: refLng,
      p_category: category || null,
      p_listing_type: listingType || null,
      p_is_free: isFree === true || isFree === 'true' ? true : (isFree === false || isFree === 'false' ? false : null),
      p_is_wanted: isWanted === true || isWanted === 'true' ? true : null,
      p_condition: condition || null,
      p_min_price: minPrice != null ? parseFloat(minPrice) : null,
      p_max_price: maxPrice != null ? parseFloat(maxPrice) : null,
      p_layer: layer || null,
      p_trust_only: trustOnly === true || trustOnly === 'true',
      p_search: (search && search.trim()) || null,
      p_created_after: _createdAfter || null,
      p_cursor_distance: decodedCursor?.distance_meters ?? null,
      p_cursor_id: decodedCursor?.id ?? null,
      p_limit: fetchLimit,
    };
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      'browse_listings_by_distance',
      rpcParams,
    );
    if (rpcError) {
      logger.error('marketplace.browse.rpc_error', { error: rpcError.message });
      throw new Error(`Nearest browse query failed: ${rpcError.message}`);
    }
    listings = rpcData || [];

  } else {
    const { data: rawListings, error } = await query;
    if (error) {
      logger.error('marketplace.browse.query_error', {
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        sort,
        search,
      });
      throw new Error(`Browse query failed: ${error.message}`);
    }
    listings = rawListings || [];

    // Fuzzy fallback: if full-text search returned 0 results, try ilike matching
    if (listings.length === 0 && search && search.trim()) {
      const trimmed = search.trim();
      let fuzzyQuery = supabaseAdmin
        .from('Listing')
        .select(LISTING_BROWSE_SELECT)
        .eq('status', 'active')
        .is('archived_at', null)
        .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%`);

      // Re-apply bounding box
      if (south != null) fuzzyQuery = fuzzyQuery.gte('latitude', south);
      if (north != null) fuzzyQuery = fuzzyQuery.lte('latitude', north);
      if (west != null) fuzzyQuery = fuzzyQuery.gte('longitude', west);
      if (east != null) fuzzyQuery = fuzzyQuery.lte('longitude', east);

      // Re-apply filters
      if (category) fuzzyQuery = fuzzyQuery.eq('category', category);
      if (listingType) fuzzyQuery = fuzzyQuery.eq('listing_type', listingType);
      if (isFree === true || isFree === 'true') fuzzyQuery = fuzzyQuery.eq('is_free', true);
      if (isFree === false || isFree === 'false') fuzzyQuery = fuzzyQuery.eq('is_free', false);
      if (isWanted === true || isWanted === 'true') fuzzyQuery = fuzzyQuery.eq('is_wanted', true);
      if (condition) fuzzyQuery = fuzzyQuery.eq('condition', condition);
      if (layer) fuzzyQuery = fuzzyQuery.eq('layer', layer);
      if (trustOnly === true || trustOnly === 'true') fuzzyQuery = fuzzyQuery.eq('is_address_attached', true);
      if (minPrice != null) fuzzyQuery = fuzzyQuery.gte('price', parseFloat(minPrice));
      if (maxPrice != null) fuzzyQuery = fuzzyQuery.lte('price', parseFloat(maxPrice));
      fuzzyQuery = fuzzyQuery.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

      fuzzyQuery = fuzzyQuery
        .order('created_at', { ascending: false })
        .limit(fetchLimit);

      const { data: fuzzyData } = await fuzzyQuery;
      if (fuzzyData && fuzzyData.length > 0) {
        listings = fuzzyData;
        fuzzyMatch = true;
      }
    }
  }

  // 6b. Fetch remote (NULL-coordinate) listings when includeRemote is true
  if (includeRemote && !remoteOnly) {
    let remoteQuery = supabaseAdmin
      .from('Listing')
      .select(LISTING_BROWSE_SELECT)
      .eq('status', 'active')
      .is('archived_at', null)
      .is('latitude', null);

    // Apply the same filters
    if (category) remoteQuery = remoteQuery.eq('category', category);
    if (listingType) remoteQuery = remoteQuery.eq('listing_type', listingType);
    if (isFree === true || isFree === 'true') remoteQuery = remoteQuery.eq('is_free', true);
    if (isFree === false || isFree === 'false') remoteQuery = remoteQuery.eq('is_free', false);
    if (isWanted === true || isWanted === 'true') remoteQuery = remoteQuery.eq('is_wanted', true);
    if (condition) remoteQuery = remoteQuery.eq('condition', condition);
    if (layer) remoteQuery = remoteQuery.eq('layer', layer);
    if (trustOnly === true || trustOnly === 'true') remoteQuery = remoteQuery.eq('is_address_attached', true);
    if (minPrice != null) remoteQuery = remoteQuery.gte('price', parseFloat(minPrice));
    if (maxPrice != null) remoteQuery = remoteQuery.lte('price', parseFloat(maxPrice));
    remoteQuery = remoteQuery.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    if (_createdAfter) remoteQuery = remoteQuery.gte('created_at', _createdAfter);
    if (search && search.trim()) {
      remoteQuery = remoteQuery.textSearch('search_vector', search.trim(), { type: 'websearch' });
    }

    remoteQuery = remoteQuery
      .order('created_at', { ascending: false })
      .limit(parsedLimit);

    const { data: remoteListings, error: remoteErr } = await remoteQuery;
    let remoteFinal = (!remoteErr && remoteListings) ? remoteListings : [];

    // Fuzzy fallback for remote query
    if (remoteFinal.length === 0 && search && search.trim()) {
      const trimmed = search.trim();
      let fuzzyRemote = supabaseAdmin
        .from('Listing')
        .select(LISTING_BROWSE_SELECT)
        .eq('status', 'active')
        .is('archived_at', null)
        .is('latitude', null)
        .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%`);

      if (category) fuzzyRemote = fuzzyRemote.eq('category', category);
      if (listingType) fuzzyRemote = fuzzyRemote.eq('listing_type', listingType);
      if (isFree === true || isFree === 'true') fuzzyRemote = fuzzyRemote.eq('is_free', true);
      if (isFree === false || isFree === 'false') fuzzyRemote = fuzzyRemote.eq('is_free', false);
      if (isWanted === true || isWanted === 'true') fuzzyRemote = fuzzyRemote.eq('is_wanted', true);
      if (condition) fuzzyRemote = fuzzyRemote.eq('condition', condition);
      if (layer) fuzzyRemote = fuzzyRemote.eq('layer', layer);
      if (trustOnly === true || trustOnly === 'true') fuzzyRemote = fuzzyRemote.eq('is_address_attached', true);
      if (minPrice != null) fuzzyRemote = fuzzyRemote.gte('price', parseFloat(minPrice));
      if (maxPrice != null) fuzzyRemote = fuzzyRemote.lte('price', parseFloat(maxPrice));
      fuzzyRemote = fuzzyRemote.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

      fuzzyRemote = fuzzyRemote
        .order('created_at', { ascending: false })
        .limit(parsedLimit);

      const { data: fuzzyRemoteData } = await fuzzyRemote;
      if (fuzzyRemoteData && fuzzyRemoteData.length > 0) {
        remoteFinal = fuzzyRemoteData;
        fuzzyMatch = true;
      }
    }

    if (remoteFinal.length > 0) {
      listings = listings.concat(remoteFinal);
    }
  }

  // 7. Apply mute/block exclusions
  const filters = userId ? await getMuteAndBlockFilters(userId) : null;
  listings = applyListingExclusions(listings, filters);
  await hydrateListingCreatorIdentities(listings);

  // 8. Get saved status
  const listingIds = listings.map(l => l.id);
  const savedIds = await getSavedListingIds(userId, listingIds);

  // 9. Normalize all rows
  listings = listings.map(row => normalizeListingRow(row, savedIds, refLat, refLng));

  // 10. (nearest sort is now handled by PostGIS RPC — no JS post-sort needed)

  // 11. Determine hasMore and trim
  const hasMore = listings.length > parsedLimit;
  if (hasMore) listings = listings.slice(0, parsedLimit);

  // 12. Build next cursor
  const lastItem = listings.length > 0 ? listings[listings.length - 1] : null;
  const nextCursor = hasMore ? buildNextCursor(lastItem, sort, refLat, refLng) : null;

  // 13. Count (cached, run in background for first request)
  const cKey = countCacheKey(south, west, north, east, {
    category, listingType, isFree, isWanted, condition, minPrice, maxPrice, layer, trustOnly, search,
  });
  let totalInBounds = 0;
  let freeCount = 0;

  const cachedCount = _countCache.get(cKey);
  if (cachedCount && cachedCount.expires > Date.now()) {
    totalInBounds = cachedCount.total;
    freeCount = cachedCount.free;
  } else {
    // Run count query asynchronously — don't block the response
    runCountQuery(south, west, north, east, {
      category, listingType, isFree, isWanted, condition, minPrice, maxPrice, layer, trustOnly, search,
    }, cKey).catch(err => logger.warn('marketplace.browse.count_error', { error: err.message }));

    // Use the number of items as a rough estimate for now
    totalInBounds = listings.length + (hasMore ? 1 : 0);
  }

  // 14. Apply location privacy transformation (after distance calc & cursor build)
  const privacySafeListings = await applyLocationPrivacyBatch(listings, userId);

  return {
    listings: privacySafeListings,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
    },
    meta: {
      total_in_bounds: totalInBounds,
      free_count: freeCount,
      bounds_used: { south, west, north, east },
      fuzzy_match: fuzzyMatch,
    },
  };
}

// Background count query
async function runCountQuery(south, west, north, east, filterOpts, cacheKey) {
  let query = supabaseAdmin
    .from('Listing')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .is('archived_at', null)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('latitude', south)
    .lte('latitude', north)
    .gte('longitude', west)
    .lte('longitude', east)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

  if (filterOpts.category) query = query.eq('category', filterOpts.category);
  if (filterOpts.listingType) query = query.eq('listing_type', filterOpts.listingType);
  if (filterOpts.isFree === true || filterOpts.isFree === 'true') query = query.eq('is_free', true);
  if (filterOpts.isFree === false || filterOpts.isFree === 'false') query = query.eq('is_free', false);
  if (filterOpts.isWanted === true || filterOpts.isWanted === 'true') query = query.eq('is_wanted', true);
  if (filterOpts.condition) query = query.eq('condition', filterOpts.condition);
  if (filterOpts.layer) query = query.eq('layer', filterOpts.layer);
  if (filterOpts.trustOnly === true || filterOpts.trustOnly === 'true') query = query.eq('is_address_attached', true);
  if (filterOpts.minPrice != null) query = query.gte('price', parseFloat(filterOpts.minPrice));
  if (filterOpts.maxPrice != null) query = query.lte('price', parseFloat(filterOpts.maxPrice));
  if (filterOpts.search && filterOpts.search.trim()) {
    query = query.textSearch('search_vector', filterOpts.search.trim(), { type: 'websearch' });
  }

  const { count: total, error: totalErr } = await query;
  if (totalErr) throw totalErr;

  // Free count
  let freeQuery = supabaseAdmin
    .from('Listing')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .is('archived_at', null)
    .eq('is_free', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('latitude', south)
    .lte('latitude', north)
    .gte('longitude', west)
    .lte('longitude', east)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

  const { count: free, error: freeErr } = await freeQuery;
  if (freeErr) throw freeErr;

  _countCache.set(cacheKey, {
    total: total || 0,
    free: free || 0,
    expires: Date.now() + COUNT_CACHE_TTL,
  });
}

// ---------------------------------------------------------------------------
// discoverListings — curated sections for Discovery Mode
// ---------------------------------------------------------------------------

/**
 * Returns curated sections for the marketplace landing experience.
 * Runs multiple targeted queries in parallel.
 */
async function discoverListings({ lat, lng, radius = DEFAULT_DISCOVERY_RADIUS_METERS, userId }) {
  if (lat == null || lng == null) {
    throw new Error('lat and lng are required for discover');
  }

  const bounds = boundingBoxFromCenter(parseFloat(lat), parseFloat(lng), radius);
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [freeNearby, justListed, nearbyDeals, byCategory, wantedNearby] = await Promise.all([
    // Free items nearby, sorted by distance — exclude remote
    browseListings({
      ...bounds,
      isFree: true,
      sort: 'nearest',
      limit: 8,
      userId,
      refLat: parseFloat(lat),
      refLng: parseFloat(lng),
      includeRemote: false,
    }),

    // Just listed (last 24h), sorted by newest — include remote
    browseListings({
      ...bounds,
      sort: 'newest',
      limit: 8,
      userId,
      refLat: parseFloat(lat),
      refLng: parseFloat(lng),
      _createdAfter: twentyFourHoursAgo,
      includeRemote: true,
    }),

    // Nearby deals (priced items, by distance) — exclude remote
    browseListings({
      ...bounds,
      isFree: false,
      sort: 'nearest',
      limit: 8,
      userId,
      refLat: parseFloat(lat),
      refLng: parseFloat(lng),
      includeRemote: false,
    }),

    // Category clusters
    buildCategoryClusters(bounds),

    // Wanted nearby — include remote
    browseListings({
      ...bounds,
      isWanted: true,
      sort: 'newest',
      limit: 5,
      userId,
      refLat: parseFloat(lat),
      refLng: parseFloat(lng),
      includeRemote: true,
    }),
  ]);

  // Get total active and free counts from the free query meta
  const totalActive = nearbyDeals.meta.total_in_bounds + freeNearby.meta.total_in_bounds;
  const freeCount = freeNearby.meta.free_count || freeNearby.listings.length;

  return {
    sections: {
      free_nearby: freeNearby.listings,
      just_listed: justListed.listings,
      nearby_deals: nearbyDeals.listings,
      by_category: byCategory,
      wanted_nearby: wantedNearby.listings,
    },
    total_active: totalActive,
    free_count: freeCount,
  };
}

/**
 * Build category cluster data: GROUP BY category with count, price range,
 * newest timestamp, and a representative image.
 */
async function buildCategoryClusters({ south, west, north, east }) {
  // Supabase JS client doesn't support GROUP BY, so we fetch a sample and
  // aggregate in JS. Fetch up to 200 recent active listings in bounds.
  const { data: listings, error } = await supabaseAdmin
    .from('Listing')
    .select('category, price, created_at, media_urls')
    .eq('status', 'active')
    .is('archived_at', null)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('latitude', south)
    .lte('latitude', north)
    .gte('longitude', west)
    .lte('longitude', east)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    logger.warn('marketplace.discover.cluster_error', { error: error.message });
    return [];
  }

  // Aggregate by category
  const catMap = {};
  for (const l of (listings || [])) {
    if (!l.category) continue;
    if (!catMap[l.category]) {
      catMap[l.category] = {
        category: l.category,
        count: 0,
        price_min: null,
        price_max: null,
        newest_at: l.created_at,
        representative_image: null,
      };
    }
    const c = catMap[l.category];
    c.count++;

    if (l.price != null) {
      if (c.price_min === null || l.price < c.price_min) c.price_min = l.price;
      if (c.price_max === null || l.price > c.price_max) c.price_max = l.price;
    }

    if (l.created_at > c.newest_at) c.newest_at = l.created_at;

    if (!c.representative_image && Array.isArray(l.media_urls) && l.media_urls.length > 0) {
      c.representative_image = resolveStoredMediaUrl(l.media_urls[0]);
    }
  }

  // Return sorted by count descending, top 6
  return Object.values(catMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

// ---------------------------------------------------------------------------
// searchListings — location-aware search with auto-expand
// ---------------------------------------------------------------------------

/**
 * Search listings within bounds. If 0 results, auto-expands bounds by 2x
 * and retries once.
 */
async function searchListings({
  query: searchQuery,
  south, west, north, east,
  category, listingType, isFree, isWanted, condition,
  minPrice, maxPrice, layer, trustOnly,
  sort = 'newest',
  cursor,
  limit = 30,
  userId,
  refLat, refLng,
}) {
  if (!searchQuery || searchQuery.trim().length < 2) {
    throw new Error('Search query must be at least 2 characters');
  }

  const result = await browseListings({
    south, west, north, east,
    category, listingType, isFree, isWanted, condition,
    minPrice, maxPrice, layer, trustOnly,
    search: searchQuery,
    sort, cursor, limit, userId, refLat, refLng,
  });

  // Auto-expand if zero results and no cursor (first page only)
  if (result.listings.length === 0 && !cursor) {
    const latCenter = (parseFloat(south) + parseFloat(north)) / 2;
    const lngCenter = (parseFloat(west) + parseFloat(east)) / 2;
    const latSpan = parseFloat(north) - parseFloat(south);
    const lngSpan = parseFloat(east) - parseFloat(west);

    const expandedResult = await browseListings({
      south: latCenter - latSpan,
      west: lngCenter - lngSpan,
      north: latCenter + latSpan,
      east: lngCenter + lngSpan,
      category, listingType, isFree, isWanted, condition,
      minPrice, maxPrice, layer, trustOnly,
      search: searchQuery,
      sort, cursor, limit, userId, refLat, refLng,
    });

    expandedResult.meta.expanded = true;
    return expandedResult;
  }

  return result;
}

// ---------------------------------------------------------------------------
// autocompleteListings — lightweight title + category matches
// ---------------------------------------------------------------------------

/**
 * Fast autocomplete for the search dropdown. Returns distinct matching titles
 * and matching categories.
 */
async function autocompleteListings({ query: searchQuery, lat, lng, limit = 5 }) {
  if (!searchQuery || searchQuery.trim().length < 1) {
    return { titles: [], categories: [] };
  }

  const cleanQuery = searchQuery.trim();
  const parsedLimit = Math.min(Number(limit) || 5, 10);

  // Title matches
  const titleQuery = supabaseAdmin
    .from('Listing')
    .select('title')
    .eq('status', 'active')
    .is('archived_at', null)
    .ilike('title', `%${cleanQuery}%`)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .limit(parsedLimit * 3); // Fetch extra for deduplication

  // If location provided, prefer nearby results
  if (lat != null && lng != null) {
    const bounds = boundingBoxFromCenter(parseFloat(lat), parseFloat(lng), 16000);
    titleQuery
      .gte('latitude', bounds.south)
      .lte('latitude', bounds.north)
      .gte('longitude', bounds.west)
      .lte('longitude', bounds.east);
  }

  const { data: titleRows, error: titleErr } = await titleQuery;

  if (titleErr) {
    logger.warn('marketplace.autocomplete.title_error', { error: titleErr.message });
  }

  // Deduplicate titles (case-insensitive)
  const seen = new Set();
  const titles = [];
  for (const row of (titleRows || [])) {
    const lower = row.title.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      titles.push(row.title);
      if (titles.length >= parsedLimit) break;
    }
  }

  // Category matches — uses shared LISTING_CATEGORIES from constants/marketplace
  const matchingCategories = LISTING_CATEGORIES.filter(cat =>
    cat.replace(/_/g, ' ').includes(cleanQuery.toLowerCase()) ||
    cleanQuery.toLowerCase().includes(cat.replace(/_/g, ' '))
  );

  return { titles, categories: matchingCategories };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  browseListings,
  discoverListings,
  searchListings,
  autocompleteListings,
  // Exported for testing / reuse
  normalizeListingRow,
  boundingBoxFromCenter,
  invalidateFilterCache,
  haversineDistance,
  getSavedListingIds,
  getMuteAndBlockFilters,
  applyListingExclusions,
};
