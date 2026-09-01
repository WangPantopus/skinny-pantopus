/**
 * Business Discovery Routes
 *
 * Neighbor trust signals, combined trust scores, and discovery search.
 * Mount at: app.use('/api/businesses', require('./routes/businessDiscovery'));
 *
 * IMPORTANT: This router MUST be mounted BEFORE the main businesses.js router
 * so that the static /search route is not captured by /:businessId.
 *
 * Endpoints:
 *   GET  /search                          — Discovery search with composite ranking
 *   GET  /:businessId/neighbor-count      — Neighbor trust count (personalized)
 *   GET  /:businessId/combined-trust      — Combined trust score (transactions + endorsements)
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const { VERIFICATION_MULTIPLIERS } = require('../utils/businessConstants');
const {
  isNewBusiness,
  computeCompositeScore,
  NEW_BUSINESS_GIG_THRESHOLD,
  NEW_BUSINESS_MAX_AGE_DAYS,
  NEW_BUSINESS_PHANTOM_COUNT,
  MILES_TO_METERS,
  NEIGHBOR_LOG_CAP,
} = require('../utils/discoveryScoring');


// ============ CONSTANTS ============

const DEFAULT_RADIUS_MILES = 1;
const MAX_RADIUS_MILES = 5;
const SEARCH_DEFAULT_RADIUS_MILES = 5;
const SEARCH_MAX_RADIUS_MILES = 25;
const RURAL_FALLBACK_MILES = 3;

// k-Anonymity thresholds
const DEFAULT_K_THRESHOLD = 3;
const HIGH_DENSITY_K_THRESHOLD = 2;
const SENSITIVE_K_THRESHOLD = 5;
const HIGH_DENSITY_HOME_FLOOR = 50;

// Sensitive categories: raised privacy threshold
const SENSITIVE_CATEGORIES = new Set([
  'mental_health', 'medical', 'addiction_support', 'legal',
]);

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;


// ============ HELPERS ============

/**
 * Resolve the authenticated user's primary home ID from HomeOccupancy or verified HomeOwner / legacy owner_id.
 */
async function resolveViewerHomeId(userId) {
  // 1. Owner/admin residence (highest priority)
  const { data: ownerOcc } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id')
    .eq('user_id', userId)
    .in('role_base', ['owner', 'admin'])
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ownerOcc?.home_id) return ownerOcc.home_id;

  // 2. Resident (tenant, household member)
  const { data: residentOcc } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id')
    .eq('user_id', userId)
    .in('role_base', ['lease_resident', 'member'])
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (residentOcc?.home_id) return residentOcc.home_id;

  // 3. Verified owner (no occupancy row yet)
  const { data: ownerRow } = await supabaseAdmin
    .from('HomeOwner')
    .select('home_id')
    .eq('subject_id', userId)
    .eq('owner_status', 'verified')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ownerRow?.home_id) return ownerRow.home_id;

  // 4. Manager (managed property — lower priority than residence)
  const { data: mgrOcc } = await supabaseAdmin
    .from('HomeOccupancy')
    .select('home_id')
    .eq('user_id', userId)
    .eq('role_base', 'manager')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (mgrOcc?.home_id) return mgrOcc.home_id;

  // 5. Legacy fallback: Home where user is owner_id
  const { data: owned } = await supabaseAdmin
    .from('Home')
    .select('id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return owned?.id || null;
}

/**
 * Resolve viewer home location (lat/lon) from home_id.
 */
async function resolveHomeLocation(homeId) {
  const { data } = await supabaseAdmin
    .from('Home')
    .select('id, parent_home_id, location, latitude, longitude')
    .eq('id', homeId)
    .maybeSingle();

  if (!data) return null;

  // Parse geography column (GeoJSON or WKT)
  let lat = null, lon = null;
  if (data.location) {
    if (typeof data.location === 'object' && data.location.coordinates) {
      lon = data.location.coordinates[0];
      lat = data.location.coordinates[1];
    } else if (typeof data.location === 'string') {
      const m = data.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
      if (m) {
        lon = parseFloat(m[1]);
        lat = parseFloat(m[2]);
      }
    }
  }
  // Fallback to latitude/longitude columns if location not parsed
  if ((lat == null || lon == null) && data.latitude != null && data.longitude != null) {
    lat = Number(data.latitude);
    lon = Number(data.longitude);
  }

  return { lat, lon, parent_home_id: data.parent_home_id };
}

/**
 * Fetch viewer home metadata needed for k-anonymity logic.
 */
async function getViewerHome(homeId) {
  const { data } = await supabaseAdmin
    .from('Home')
    .select('id, parent_home_id, location')
    .eq('id', homeId)
    .maybeSingle();

  return data || null;
}

/**
 * Determine if a business is "New on Pantopus" based on completed gigs and age.
 * Used for individual lookups. For search results, use inline fields from SQL.
 */
async function getNewBusinessStatus(businessUserId) {
  const { count: completedGigs, error: countErr } = await supabaseAdmin
    .from('Gig')
    .select('id', { count: 'exact', head: true })
    .eq('accepted_by', businessUserId)
    .eq('status', 'completed');

  if (countErr) {
    logger.warn('Error counting completed gigs for new-business check', { error: countErr.message });
  }

  const gigCount = completedGigs || 0;

  const { data: profile } = await supabaseAdmin
    .from('BusinessProfile')
    .select('created_at')
    .eq('business_user_id', businessUserId)
    .maybeSingle();

  const profileCreatedAt = profile?.created_at ? new Date(profile.created_at) : null;
  const daysSinceCreation = profileCreatedAt
    ? (Date.now() - profileCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  const isNew = gigCount < NEW_BUSINESS_GIG_THRESHOLD
    && daysSinceCreation <= NEW_BUSINESS_MAX_AGE_DAYS;

  return { is_new_business: isNew, completed_gigs: gigCount, profile_created_at: profileCreatedAt };
}

/**
 * Calculate the k-anonymity threshold.
 */
function calculateKThreshold(homeDensity, category) {
  if (category && SENSITIVE_CATEGORIES.has(category)) return SENSITIVE_K_THRESHOLD;
  if (homeDensity >= HIGH_DENSITY_HOME_FLOOR) return HIGH_DENSITY_K_THRESHOLD;
  return DEFAULT_K_THRESHOLD;
}

/**
 * Generate a human-readable label for the neighbor count.
 */
function buildCountLabel(count, radiusMiles, isBuildingLevel) {
  if (isBuildingLevel) {
    return `${count} unit${count !== 1 ? 's' : ''} in your building hired them`;
  }
  let distanceLabel;
  if (radiusMiles <= 0.5) distanceLabel = 'within 0.5 miles';
  else if (radiusMiles <= 1) distanceLabel = 'within 1 mile';
  else if (radiusMiles <= 2) distanceLabel = 'within 2 miles';
  else if (radiusMiles <= 3) distanceLabel = 'within 3 miles';
  else distanceLabel = `within ${radiusMiles} miles`;
  return `${count} home${count !== 1 ? 's' : ''} ${distanceLabel} hired them`;
}

/**
 * Format a search result row into the API response shape.
 */
function formatSearchResult(row) {
  const nc = parseInt(row.neighbor_count, 10) || 0;
  const isNew = isNewBusiness(row.completed_gigs, row.profile_created_at);
  const distMiles = Math.round(((parseInt(row.distance_meters, 10) || 0) / MILES_TO_METERS) * 10) / 10;

  return {
    business_user_id: row.business_user_id,
    username: row.username,
    name: row.name,
    profile_picture_url: row.profile_picture_url,
    categories: row.categories || [],
    description: row.description,
    business_type: row.business_type,
    logo_file_id: row.logo_file_id,
    // Trust row
    average_rating: parseFloat(row.average_rating) || null,
    review_count: parseInt(row.review_count, 10) || 0,
    distance_miles: distMiles,
    distance_meters: parseInt(row.distance_meters, 10) || 0,
    neighbor_count: nc,
    endorsement_count: 0, // stub until Phase 7
    is_new_business: isNew,
    // Hours
    is_open_now: row.is_open_now,
    // Location
    city: row.primary_city,
    state: row.primary_state,
    // Response time
    avg_response_minutes: row.avg_response_minutes || null,
    // Meta
    profile_completeness: parseInt(row.profile_completeness, 10) || 0,
    accepts_gigs: row.accepts_gigs || false,
    // Verification
    verification_status: row.verification_status || 'unverified',
    verification_badge: row.verification_status === 'government_verified'
      ? 'gov_verified'
      : (row.verification_status === 'document_verified' ? 'verified' : null),
    // Founding
    founding_badge: row.founding_badge || false,
  };
}


// ============ ROUTES ============
// IMPORTANT: Static routes MUST come before param routes.

/**
 * GET /map
 *
 * Returns business markers for a map viewport (bounding box query).
 * Lightweight — returns pin data only, no composite scoring.
 * Pin tier derived from completed_gigs: small (0), medium (1-9), large (10+).
 *
 * Query params:
 *   south, west, north, east — bounding box (required)
 *   categories               — comma-separated filter
 *   open_now                 — boolean
 *   limit                    — max results (default 500)
 */
router.get('/map', async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const south = parseFloat(req.query.south);
    const west = parseFloat(req.query.west);
    const north = parseFloat(req.query.north);
    const east = parseFloat(req.query.east);

    if ([south, west, north, east].some(v => isNaN(v))) {
      return res.status(400).json({ error: 'south, west, north, east bounds are required' });
    }

    const boundsArea = Math.abs((north - south) * (east - west));
    const zoomLevel = req.query.zoom ? parseFloat(req.query.zoom) : null;
    logger.info('viewport_request', {
      endpoint: '/api/businesses/map',
      bounds_area_sq_deg: Math.round(boundsArea * 10000) / 10000,
      zoom_level: zoomLevel,
    });

    const categories = req.query.categories
      ? req.query.categories.split(',').map(c => c.trim()).filter(Boolean)
      : null;
    const openNow = req.query.open_now === 'true';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 1000);

    const { data: rows, error: rpcErr } = await supabaseAdmin.rpc(
      'find_businesses_in_bounds',
      {
        p_south: south,
        p_west: west,
        p_north: north,
        p_east: east,
        p_categories: categories,
        p_open_now_only: openNow,
        p_limit: limit,
      },
    );

    if (rpcErr) {
      logger.error('find_businesses_in_bounds error', { error: rpcErr.message });
      return res.status(500).json({ error: 'Map query failed' });
    }

    // Batch-fetch verified address status for returned businesses
    const businessIds = (rows || []).map(r => r.business_user_id);
    let verifiedSet = new Set();
    if (businessIds.length > 0) {
      const { data: verifiedRows } = await supabaseAdmin
        .from('BusinessLocation')
        .select('business_user_id')
        .in('business_user_id', businessIds)
        .eq('is_primary', true)
        .eq('decision_status', 'ok');
      if (verifiedRows) {
        verifiedSet = new Set(verifiedRows.map(r => r.business_user_id));
      }
    }

    // Compute pin tier and verified flag for each marker
    const markers = (rows || []).map(row => {
      const gigs = parseInt(row.completed_gigs, 10) || 0;
      let pinTier = 'small';
      if (gigs >= 10) pinTier = 'large';
      else if (gigs >= 1) pinTier = 'medium';

      return {
        business_user_id: row.business_user_id,
        username: row.username,
        name: row.name,
        profile_picture_url: row.profile_picture_url,
        latitude: row.latitude,
        longitude: row.longitude,
        categories: row.categories || [],
        business_type: row.business_type,
        average_rating: parseFloat(row.average_rating) || null,
        review_count: parseInt(row.review_count, 10) || 0,
        completed_gigs: gigs,
        is_open_now: row.is_open_now,
        is_new_business: row.is_new_business || false,
        pin_tier: pinTier, // small | medium | large
        verified: verifiedSet.has(row.business_user_id),
      };
    });

    // When viewport is empty, find the nearest activity center
    let nearest_activity_center = null;
    if (markers.length === 0) {
      const centerLat = (south + north) / 2;
      const centerLon = (west + east) / 2;
      const { data: nearestRows } = await supabaseAdmin.rpc('find_nearest_activity_center', {
        p_center_lat: centerLat,
        p_center_lon: centerLon,
        p_content_type: 'business',
      });
      if (nearestRows && nearestRows.length > 0) {
        nearest_activity_center = {
          latitude: nearestRows[0].latitude,
          longitude: nearestRows[0].longitude,
        };
      }
    }

    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.info('viewport_response', {
      endpoint: '/api/businesses/map',
      status: 200,
      result_count: markers.length,
      response_time_ms: Math.round(elapsed * 100) / 100,
      bounds_area_sq_deg: Math.round(boundsArea * 10000) / 10000,
      zoom_level: zoomLevel,
    });

    res.json({ markers, count: markers.length, nearest_activity_center });
  } catch (err) {
    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.error('Map endpoint error', {
      error: err.message,
      stack: err.stack,
      response_time_ms: Math.round(elapsed * 100) / 100,
    });
    res.status(500).json({ error: 'Map query failed' });
  }
});


/**
 * GET /search
 *
 * Discovery search for businesses with composite ranking.
 *
 * Query params:
 *   q                      — text search (name, username, description, categories)
 *   lat / longitude        — center point (required if no home)
 *   lon / latitude         — center point
 *   radius_miles           — search radius (default 5, max 25)
 *   categories             — comma-separated category filter (array overlap)
 *   sort                   — Trust Lens: relevance | distance | rating | fastest_response
 *   rating_min             — minimum average rating (1-5)
 *   open_now               — boolean, filter to currently open businesses
 *   worked_nearby          — boolean, only businesses with verified local work
 *   accepts_gigs           — boolean, only businesses that accept gig requests
 *   new_on_pantopus        — boolean, only new businesses
 *   page                   — page number (1-based, default 1)
 *   page_size              — results per page (default 20, max 50)
 */
router.get('/search', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Parse params
    let radiusMiles = parseFloat(req.query.radius_miles) || SEARCH_DEFAULT_RADIUS_MILES;
    radiusMiles = Math.min(Math.max(radiusMiles, 0.5), SEARCH_MAX_RADIUS_MILES);
    const radiusMeters = Math.round(radiusMiles * MILES_TO_METERS);

    const sort = req.query.sort || 'relevance';
    const q = (req.query.q || '').toString().trim().toLowerCase();
    const ratingMin = req.query.rating_min ? parseFloat(req.query.rating_min) : null;
    const openNow = req.query.open_now === 'true';
    const workedNearby = req.query.worked_nearby === 'true';
    const acceptsGigs = req.query.accepts_gigs === 'true';
    const newOnly = req.query.new_on_pantopus === 'true';

    const categories = req.query.categories
      ? req.query.categories.split(',').map(c => c.trim()).filter(Boolean)
      : null;

    const entityTypes = req.query.entity_type
      ? req.query.entity_type.split(',').map(t => t.trim()).filter(Boolean)
      : null;

    const foundingOnly = req.query.founding_only === 'true';

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    // 2. Resolve center point and viewer home
    let viewerHomeId = await resolveViewerHomeId(userId);
    let centerLat = parseFloat(req.query.lat) || parseFloat(req.query.latitude) || null;
    let centerLon = parseFloat(req.query.lon) || parseFloat(req.query.longitude) || parseFloat(req.query.lng) || null;

    // If no explicit center, resolve from viewer's home
    if (centerLat == null || centerLon == null) {
      if (viewerHomeId) {
        const homeLocation = await resolveHomeLocation(viewerHomeId);
        if (homeLocation?.lat && homeLocation?.lon) {
          centerLat = homeLocation.lat;
          centerLon = homeLocation.lon;
        }
      }
    }

    if (centerLat == null || centerLon == null) {
      return res.status(400).json({
        error: 'Location required. Provide lat/lon or set up your home address.',
      });
    }

    // 3. Call SQL function to get candidates
    const { data: candidates, error: searchErr } = await supabaseAdmin.rpc(
      'find_businesses_nearby',
      {
        p_center_lat: centerLat,
        p_center_lon: centerLon,
        p_radius_meters: radiusMeters,
        p_viewer_home_id: viewerHomeId,
        p_categories: categories,
        p_rating_min: ratingMin,
        p_limit: 200,
        p_entity_types: entityTypes,
      },
    );

    if (searchErr) {
      logger.error('Error calling find_businesses_nearby', { error: searchErr.message });
      return res.status(500).json({ error: 'Search failed' });
    }

    let results = candidates || [];

    // 3b. Apply text-search filter (JS-side, case-insensitive match on name, username, description, categories)
    if (q) {
      results = results.filter(r => {
        const haystack = [
          r.name,
          r.username,
          r.description,
          ...(Array.isArray(r.categories) ? r.categories : []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return q.split(/\s+/).every(word => haystack.includes(word));
      });
    }

    // 4. Apply JS-side filters
    if (openNow) {
      results = results.filter(r => r.is_open_now === true);
    }
    if (workedNearby) {
      results = results.filter(r => (parseInt(r.neighbor_count, 10) || 0) > 0);
    }
    if (acceptsGigs) {
      results = results.filter(r => r.accepts_gigs === true);
    }
    if (newOnly) {
      results = results.filter(r => isNewBusiness(r.completed_gigs, r.profile_created_at));
    }
    const verifiedOnly = req.query.verified_only === 'true';
    if (verifiedOnly) {
      results = results.filter(r => ['document_verified', 'government_verified'].includes(r.verification_status));
    }
    if (foundingOnly) {
      results = results.filter(r => r.founding_badge === true);
    }

    // Filter out pop-up businesses outside their active window
    const now = new Date();
    results = results.filter(r => {
      if (r.business_type !== 'pop_up_temporary') return true;
      if (r.active_from && new Date(r.active_from) > now) return false;
      if (r.active_until && new Date(r.active_until) < now) return false;
      return true;
    });

    // 5. Compute scores and sort by Trust Lens
    results = results.map(r => ({
      ...r,
      _compositeScore: computeCompositeScore(r),
      _isNew: isNewBusiness(r.completed_gigs, r.profile_created_at),
    }));

    switch (sort) {
      case 'distance':
        results.sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0));
        break;
      case 'rating':
        results.sort((a, b) => {
          const ra = (parseFloat(b.average_rating) || 0) * Math.min((b.review_count || 0), 20) / 20;
          const rb = (parseFloat(a.average_rating) || 0) * Math.min((a.review_count || 0), 20) / 20;
          return ra - rb; // desc
        });
        break;
      case 'fastest_response':
        results.sort((a, b) => {
          const aMin = a.avg_response_minutes;
          const bMin = b.avg_response_minutes;
          if (aMin == null && bMin == null) return 0;
          if (aMin == null) return 1; // nulls last
          if (bMin == null) return -1;
          return aMin - bMin;
        });
        break;
      case 'relevance':
      default:
        results.sort((a, b) => b._compositeScore - a._compositeScore);
        break;
    }

    // 6. Reserved new-business slot: insert one new business per page if available
    if (sort === 'relevance' && !newOnly) {
      const newBizPool = results.filter(r => r._isNew);
      const nonNew = results.filter(r => !r._isNew);

      if (newBizPool.length > 0 && nonNew.length > 0) {
        // Pick the best new business not already in the first page
        const insertIdx = Math.min(3, nonNew.length); // Position 4 (0-indexed 3)
        const bestNew = newBizPool[0];
        // Remove it from its current position and insert at reserved slot
        results = nonNew.filter(r => r.business_user_id !== bestNew.business_user_id);
        results.splice(insertIdx, 0, bestNew);
      }
    }

    // 7. Paginate
    const totalCount = results.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIdx = (page - 1) * pageSize;
    const pageResults = results.slice(startIdx, startIdx + pageSize);

    // 8. Format response
    const formattedResults = pageResults.map(formatSearchResult);

    // 9. Fetch top 2 catalog items for each result (batch)
    const businessIds = pageResults.map(r => r.business_user_id);
    let catalogMap = {};
    if (businessIds.length > 0) {
      const { data: catalogItems } = await supabaseAdmin
        .from('BusinessCatalogItem')
        .select('business_user_id, name, price_cents, price_unit, currency, kind')
        .in('business_user_id', businessIds)
        .eq('status', 'active')
        .eq('is_featured', true)
        .order('sort_order')
        .limit(businessIds.length * 2);

      for (const item of (catalogItems || [])) {
        if (!catalogMap[item.business_user_id]) {
          catalogMap[item.business_user_id] = [];
        }
        if (catalogMap[item.business_user_id].length < 2) {
          catalogMap[item.business_user_id].push({
            name: item.name,
            price_cents: item.price_cents,
            price_unit: item.price_unit,
            currency: item.currency,
            kind: item.kind,
          });
        }
      }
    }

    // Batch-fetch verified address status for search results
    let searchVerifiedSet = new Set();
    if (businessIds.length > 0) {
      const { data: verifiedLocs } = await supabaseAdmin
        .from('BusinessLocation')
        .select('business_user_id')
        .in('business_user_id', businessIds)
        .eq('is_primary', true)
        .eq('decision_status', 'ok');
      if (verifiedLocs) {
        searchVerifiedSet = new Set(verifiedLocs.map(r => r.business_user_id));
      }
    }

    // Attach catalog previews and verified address flag
    for (const result of formattedResults) {
      result.catalog_preview = catalogMap[result.business_user_id] || [];
      result.address_verified = searchVerifiedSet.has(result.business_user_id);
    }

    // 10. Batch-fetch endorsement counts for search results (Phase 7)
    if (businessIds.length > 0 && viewerHomeId) {
      try {
        // Batch query: count endorsements per business within viewer radius
        const endorseRadiusMeters = Math.round(radiusMiles * MILES_TO_METERS);
        const { data: endorseRows } = await supabaseAdmin.rpc(
          'batch_endorsement_counts',
          {
            p_business_user_ids: businessIds,
            p_viewer_home_id: viewerHomeId,
            p_radius_meters: endorseRadiusMeters,
          },
        );

        if (endorseRows) {
          const endorseMap = {};
          for (const row of (Array.isArray(endorseRows) ? endorseRows : [])) {
            endorseMap[row.business_user_id] = parseInt(row.endorsement_count, 10) || 0;
          }
          for (const result of formattedResults) {
            result.endorsement_count = endorseMap[result.business_user_id] || 0;
          }
        }
      } catch (endorseErr) {
        logger.warn('Batch endorsement count failed (non-critical)', { error: endorseErr.message });
        // Leave endorsement_count at 0 — non-critical
      }
    }

    const sortLabel = {
      relevance: 'Most hired nearby',
      distance: 'Closest',
      rating: 'Best rated',
      fastest_response: 'Fastest response',
    }[sort] || 'Most hired nearby';

    res.json({
      results: formattedResults,
      pagination: {
        page,
        page_size: pageSize,
        total_count: totalCount,
        total_pages: totalPages,
        has_more: page < totalPages,
      },
      sort,
      sort_label: sortLabel,
      filters_active: {
        categories: categories || [],
        radius_miles: radiusMiles,
        open_now: openNow,
        worked_nearby: workedNearby,
        accepts_gigs: acceptsGigs,
        new_on_pantopus: newOnly,
        verified_only: verifiedOnly,
        rating_min: ratingMin,
        entity_type: entityTypes || [],
        founding_only: foundingOnly,
      },
      banner: workedNearby ? 'Showing businesses with verified local work history' : null,
    });
  } catch (err) {
    logger.error('Business search error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Search failed' });
  }
});


/**
 * GET /:businessId/neighbor-count
 *
 * Returns the personalized neighbor trust count for a business.
 */
router.get('/:businessId/neighbor-count', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;
    const category = req.query.category || null;

    let radiusMiles = parseFloat(req.query.radius_miles) || DEFAULT_RADIUS_MILES;
    radiusMiles = Math.min(Math.max(radiusMiles, 0.25), MAX_RADIUS_MILES);

    let viewerHomeId = req.query.viewer_home_id || null;
    if (!viewerHomeId) {
      viewerHomeId = await resolveViewerHomeId(userId);
    }

    if (!viewerHomeId) {
      return res.json({
        count: 0, radius_miles: radiusMiles, label: null,
        show: false, is_new_business: false, category, reason: 'no_viewer_home',
      });
    }

    const { data: businessUser } = await supabaseAdmin
      .from('User')
      .select('id, account_type')
      .eq('id', businessId)
      .eq('account_type', 'business')
      .maybeSingle();

    if (!businessUser) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const viewerHome = await getViewerHome(viewerHomeId);
    const newBizStatus = await getNewBusinessStatus(businessId);
    const radiusMeters = Math.round(radiusMiles * MILES_TO_METERS);

    const { data: trustResult, error: trustErr } = await supabaseAdmin.rpc(
      'get_neighbor_trust_count',
      {
        p_business_user_id: businessId,
        p_viewer_home_id: viewerHomeId,
        p_radius_meters: radiusMeters,
        p_category: category,
      },
    );

    if (trustErr) {
      logger.error('Error calling get_neighbor_trust_count', { error: trustErr.message });
      return res.status(500).json({ error: 'Failed to compute neighbor trust count' });
    }

    const row = Array.isArray(trustResult) ? trustResult[0] : trustResult;
    let neighborCount = parseInt(row?.neighbor_count, 10) || 0;
    const homeDensity = parseInt(row?.home_density, 10) || 0;
    const kThreshold = calculateKThreshold(homeDensity, category);
    let show = neighborCount >= kThreshold;
    let actualRadius = radiusMiles;
    let isBuildingLevel = false;

    // Building-level aggregation
    if (viewerHome?.parent_home_id) {
      const { data: buildingCount, error: bldgErr } = await supabaseAdmin.rpc(
        'get_building_trust_count',
        { p_business_user_id: businessId, p_parent_home_id: viewerHome.parent_home_id, p_category: category },
      );
      if (!bldgErr && buildingCount > 0) {
        const bldgVal = typeof buildingCount === 'number' ? buildingCount : parseInt(buildingCount, 10) || 0;
        if (bldgVal >= kThreshold) {
          neighborCount = bldgVal;
          isBuildingLevel = true;
          show = true;
        }
      }
    }

    // Rural fallback
    if (!show && radiusMiles <= 1) {
      const fallbackMeters = Math.round(RURAL_FALLBACK_MILES * MILES_TO_METERS);
      const { data: fbResult, error: fbErr } = await supabaseAdmin.rpc(
        'get_neighbor_trust_count',
        { p_business_user_id: businessId, p_viewer_home_id: viewerHomeId, p_radius_meters: fallbackMeters, p_category: category },
      );
      if (!fbErr) {
        const fbRow = Array.isArray(fbResult) ? fbResult[0] : fbResult;
        const fbCount = parseInt(fbRow?.neighbor_count, 10) || 0;
        const fbDensity = parseInt(fbRow?.home_density, 10) || 0;
        if (fbCount >= calculateKThreshold(fbDensity, category)) {
          neighborCount = fbCount;
          actualRadius = RURAL_FALLBACK_MILES;
          show = true;
        }
      }
    }

    const safeCategory = neighborCount >= 5 ? category : null;
    const label = show ? buildCountLabel(neighborCount, actualRadius, isBuildingLevel) : null;

    res.json({
      count: show ? neighborCount : 0,
      radius_miles: actualRadius,
      label, show,
      is_new_business: newBizStatus.is_new_business,
      category: safeCategory,
    });
  } catch (err) {
    logger.error('neighbor-count error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to compute neighbor count' });
  }
});


/**
 * GET /:businessId/combined-trust
 *
 * Returns the combined trust score for a business.
 */
router.get('/:businessId/combined-trust', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    let radiusMiles = parseFloat(req.query.radius_miles) || DEFAULT_RADIUS_MILES;
    radiusMiles = Math.min(Math.max(radiusMiles, 0.25), MAX_RADIUS_MILES);

    let viewerHomeId = req.query.viewer_home_id || null;
    if (!viewerHomeId) {
      viewerHomeId = await resolveViewerHomeId(userId);
    }

    if (!viewerHomeId) {
      return res.json({
        transaction_count: 0, endorsement_count: 0,
        combined_trust_score: 0, display_label: null, is_new_business: false,
      });
    }

    const { data: businessUser } = await supabaseAdmin
      .from('User')
      .select('id, account_type')
      .eq('id', businessId)
      .eq('account_type', 'business')
      .maybeSingle();

    if (!businessUser) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const radiusMeters = Math.round(radiusMiles * MILES_TO_METERS);

    const { data: trustResult, error: trustErr } = await supabaseAdmin.rpc(
      'get_neighbor_trust_count',
      { p_business_user_id: businessId, p_viewer_home_id: viewerHomeId, p_radius_meters: radiusMeters, p_category: null },
    );

    if (trustErr) {
      logger.error('Error fetching trust count for combined-trust', { error: trustErr.message });
      return res.status(500).json({ error: 'Failed to compute combined trust' });
    }

    const row = Array.isArray(trustResult) ? trustResult[0] : trustResult;
    const transactionCount = parseInt(row?.neighbor_count, 10) || 0;

    // Fetch real endorsement count (Phase 7)
    let endorsementCount = 0;
    try {
      const { data: endorseResult, error: endorseErr } = await supabaseAdmin.rpc(
        'get_endorsement_count',
        {
          p_business_user_id: businessId,
          p_viewer_home_id: viewerHomeId,
          p_radius_meters: radiusMeters,
          p_category: null,
        },
      );
      if (!endorseErr) {
        const eRow = Array.isArray(endorseResult) ? endorseResult[0] : endorseResult;
        endorsementCount = parseInt(eRow?.endorsement_count, 10) || 0;
      }
    } catch (endorseEx) {
      logger.warn('Endorsement count failed in combined-trust', { error: endorseEx.message });
    }

    const newBizStatus = await getNewBusinessStatus(businessId);
    const hasPlatformHistory = transactionCount > 0;

    const endorsementWeight = hasPlatformHistory ? 0.4 : 0.8;
    const combinedTrustScore =
      Math.log(1 + transactionCount) * 1.0
      + Math.log(1 + endorsementCount) * endorsementWeight;

    let displayLabel = null;
    if (transactionCount > 0 && endorsementCount > 0) {
      displayLabel = `${transactionCount} hired · ${endorsementCount} endorsed`;
    } else if (transactionCount > 0) {
      displayLabel = `Hired by ${transactionCount} verified neighbor${transactionCount !== 1 ? 's' : ''}`;
    } else if (endorsementCount > 0) {
      displayLabel = `Endorsed by ${endorsementCount} verified neighbor${endorsementCount !== 1 ? 's' : ''}`;
    } else if (newBizStatus.is_new_business) {
      displayLabel = 'New on Pantopus';
    }

    res.json({
      transaction_count: transactionCount,
      endorsement_count: endorsementCount,
      combined_trust_score: Math.round(combinedTrustScore * 1000) / 1000,
      display_label: displayLabel,
      is_new_business: newBizStatus.is_new_business,
    });
  } catch (err) {
    logger.error('combined-trust error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to compute combined trust' });
  }
});


// ============ ENDORSEMENTS (Phase 7) ============

/**
 * GET /:businessId/endorsements
 *
 * Returns endorsement count and breakdown by category for a business.
 * Proximity-filtered to the viewer's neighborhood.
 */
router.get('/:businessId/endorsements', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    let radiusMiles = parseFloat(req.query.radius_miles) || DEFAULT_RADIUS_MILES;
    radiusMiles = Math.min(Math.max(radiusMiles, 0.25), MAX_RADIUS_MILES);

    let viewerHomeId = req.query.viewer_home_id || null;
    if (!viewerHomeId) {
      viewerHomeId = await resolveViewerHomeId(userId);
    }

    if (!viewerHomeId) {
      return res.json({ count: 0, by_category: [], show: false });
    }

    const radiusMeters = Math.round(radiusMiles * MILES_TO_METERS);
    const category = req.query.category || null;

    const { data: result, error } = await supabaseAdmin.rpc(
      'get_endorsement_count',
      {
        p_business_user_id: businessId,
        p_viewer_home_id: viewerHomeId,
        p_radius_meters: radiusMeters,
        p_category: category,
      },
    );

    if (error) {
      logger.error('Error fetching endorsement count', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch endorsements' });
    }

    const row = Array.isArray(result) ? result[0] : result;
    const count = parseInt(row?.endorsement_count, 10) || 0;
    const byCategory = row?.by_category || [];

    res.json({
      count,
      by_category: byCategory,
      show: count >= 2, // Only display if >= 2 endorsements (meaningful signal)
    });
  } catch (err) {
    logger.error('endorsements error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to fetch endorsements' });
  }
});


/**
 * POST /:businessId/endorsements
 *
 * Create a neighbor endorsement for a business.
 * Requires verified home address + active non-guest occupancy.
 */
router.post('/:businessId/endorsements', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;
    const { category } = req.body;

    if (!category || typeof category !== 'string') {
      return res.status(400).json({ error: 'category is required' });
    }

    // Verify the business exists
    const { data: businessUser } = await supabaseAdmin
      .from('User')
      .select('id, account_type')
      .eq('id', businessId)
      .eq('account_type', 'business')
      .maybeSingle();

    if (!businessUser) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Cannot endorse yourself
    if (businessId === userId) {
      return res.status(400).json({ error: 'Cannot endorse your own business' });
    }

    // Get endorser's active home (verified address, non-guest)
    const { data: occupancy, error: occErr } = await supabaseAdmin
      .from('HomeOccupancy')
      .select(`
        home_id,
        role_base,
        home:home_id (
          id,
          created_at,
          ownership_status
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (occErr || !occupancy) {
      return res.status(403).json({
        error: 'You need a verified home address to endorse businesses',
      });
    }

    // Must not be guest
    if (occupancy.role_base === 'guest') {
      return res.status(403).json({
        error: 'Guests cannot endorse businesses. Ask a household member.',
      });
    }

    // Home must be at least 14 days old (anti-gaming)
    const home = occupancy.home;
    const homeAgeDays = (Date.now() - new Date(home.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (homeAgeDays < 14) {
      return res.status(403).json({
        error: 'Your home address must be verified for at least 14 days before endorsing',
      });
    }

    // Insert endorsement (unique constraint handles duplicates)
    const { data: endorsement, error: insertErr } = await supabaseAdmin
      .from('NeighborEndorsement')
      .insert({
        endorser_home_id: occupancy.home_id,
        endorser_user_id: userId,
        business_user_id: businessId,
        category: category.trim().toLowerCase(),
      })
      .select('id, category, created_at')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        // Unique constraint violation — already endorsed
        return res.status(409).json({
          error: 'You have already endorsed this business for this category',
        });
      }
      logger.error('Error creating endorsement', { error: insertErr.message });
      return res.status(500).json({ error: 'Failed to create endorsement' });
    }

    res.status(201).json({
      message: 'Endorsement created',
      endorsement,
    });
  } catch (err) {
    logger.error('create endorsement error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to create endorsement' });
  }
});


/**
 * DELETE /:businessId/endorsements/:category
 *
 * Retract an endorsement for a specific business + category.
 */
router.delete('/:businessId/endorsements/:category', verifyToken, async (req, res) => {
  try {
    const { businessId, category } = req.params;
    const userId = req.user.id;

    // Find the endorser's home
    const { data: occupancy } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('home_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!occupancy) {
      return res.status(404).json({ error: 'No active home found' });
    }

    const { error: delErr, count } = await supabaseAdmin
      .from('NeighborEndorsement')
      .delete({ count: 'exact' })
      .eq('endorser_home_id', occupancy.home_id)
      .eq('business_user_id', businessId)
      .eq('category', category.toLowerCase());

    if (delErr) {
      logger.error('Error deleting endorsement', { error: delErr.message });
      return res.status(500).json({ error: 'Failed to retract endorsement' });
    }

    if (count === 0) {
      return res.status(404).json({ error: 'Endorsement not found' });
    }

    res.json({ message: 'Endorsement retracted' });
  } catch (err) {
    logger.error('delete endorsement error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to retract endorsement' });
  }
});


/**
 * GET /:businessId/endorsements/mine
 *
 * Check which categories the current user has endorsed for this business.
 */
router.get('/:businessId/endorsements/mine', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const { data: occupancy } = await supabaseAdmin
      .from('HomeOccupancy')
      .select('home_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!occupancy) {
      return res.json({ endorsed_categories: [] });
    }

    const { data: endorsements, error } = await supabaseAdmin
      .from('NeighborEndorsement')
      .select('category')
      .eq('endorser_home_id', occupancy.home_id)
      .eq('business_user_id', businessId);

    if (error) {
      logger.error('Error fetching user endorsements', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch endorsements' });
    }

    res.json({
      endorsed_categories: (endorsements || []).map(e => e.category),
    });
  } catch (err) {
    logger.error('my endorsements error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to fetch endorsements' });
  }
});


module.exports = router;
