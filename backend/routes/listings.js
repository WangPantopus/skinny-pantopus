// ============================================================
// LISTING ROUTES — Marketplace (Buy / Sell / Free)
// ============================================================

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { createNotification, notifyAddressRevealed } = require('../services/notificationService');
const savedSearchService = require('../services/marketplace/savedSearchService');
const { LISTING_LIST } = require('../utils/columns');
const { applyLocationPrecision } = require('../utils/locationPrivacy');
const { hydrateListingCreatorIdentities } = require('../utils/listingCreatorIdentity');
const {
  browseListings,
  discoverListings,
  searchListings,
  autocompleteListings,
} = require('../services/marketplace/marketplaceService');
const { applyLocationPrivacy, applyLocationPrivacyBatch } = require('../services/marketplace/locationPrivacy');
const { getReputation } = require('../services/marketplace/reputationService');
const discoveryCacheService = require('../services/marketplace/discoveryCacheService');
const {
  SAFE_CREATOR_SELECT,
  serializeListingAuthorForViewer,
  serializeUserAsLocalIdentity,
  serializeUserIdentityForViewer,
} = require('../serializers/identitySerializers');

// ============ CONSTANTS ============
// Imported from shared backend constants (canonical source).
// Keep in sync with frontend/packages/ui-utils/src/marketplace-contract.ts

const {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  LISTING_STATUSES,
  LOCATION_PRECISIONS,
  REVEAL_POLICIES,
  VISIBILITY_SCOPES,
  LISTING_LAYERS,
  LISTING_TYPES,
} = require('../constants/marketplace');

// P0.3: legacy creator-select constant replaced by SAFE_CREATOR_SELECT
// (imported above). Routes still need a Supabase nested select on the User
// table, but only audience-safe columns are pulled now; consumers project
// through serializeUserIdentityForViewer / serializeUserAsLocalIdentity
// before any row reaches the API response. See Audience Profile design
// v2 §16 item 2.
const LISTING_SEARCH_RPC_TIMEOUT_MS = 8000;
const METERS_PER_MILE = 1609.34;
const DEFAULT_LISTING_RADIUS_METERS = Math.round(100 * METERS_PER_MILE);
const MAX_LISTING_RADIUS_METERS = Math.round(25000 * METERS_PER_MILE);

function resolveListingRadiusMeters(rawRadius) {
  const parsed = parseInt(rawRadius, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LISTING_RADIUS_METERS;
  return Math.min(parsed, MAX_LISTING_RADIUS_METERS);
}

function resolveListingRadiusMilesToMeters(rawRadiusMiles) {
  const parsed = parseFloat(rawRadiusMiles);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LISTING_RADIUS_METERS;
  return Math.round(Math.min(parsed, 25000) * METERS_PER_MILE);
}

function resolveListingQueryRadiusMeters({ radius, radiusMiles }) {
  if (radius != null) return resolveListingRadiusMeters(radius);
  return resolveListingRadiusMilesToMeters(radiusMiles);
}

// Category → layer mapping (everything not listed defaults to 'goods')
const CATEGORY_LAYER_MAP = { vehicles: 'vehicles' };

// Default listing_type per layer
const LAYER_TYPE_DEFAULTS = {
  goods: 'sell_item',
  gigs: 'service_gig',
  rentals: 'rent_sublet',
  vehicles: 'vehicle_sale',
};

// Expiration rules per listing_type (hours)
const EXPIRATION_RULES = {
  free_item: 48,          // 2 days
  sell_item: 720,         // 30 days
  wanted_request: 168,    // 7 days
  service_gig: 720,       // 30 days
  rent_sublet: 720,       // 30 days
  vehicle_sale: 720,      // 30 days
  vehicle_rent: 720,      // 30 days
  pre_order: 168,         // 7 days
  recurring: 2160,        // 90 days
  trade_swap: 720,        // 30 days
  flash_sale: 4,          // 4 hours
};

// Inventory caps per layer (per address)
const INVENTORY_CAPS = { goods: 10, vehicles: 3, rentals: 1, gigs: 20 };

// Refresh cooldown (days)
const REFRESH_COOLDOWN_DAYS = 5;

// ============ VALIDATION SCHEMAS ============

const createListingSchema = Joi.object({
  title: Joi.string().min(3).max(255).required(),
  description: Joi.string().max(5000).optional(),
  price: Joi.number().min(0).allow(null).optional(),
  isFree: Joi.boolean().default(false),
  category: Joi.string().valid(...LISTING_CATEGORIES).required(),
  subcategory: Joi.string().max(100).optional(),
  condition: Joi.string().valid(...LISTING_CONDITIONS).optional(),
  quantity: Joi.number().integer().min(1).default(1),
  // Media
  mediaUrls: Joi.array().items(Joi.string().uri()).max(10).optional(),
  mediaTypes: Joi.array().items(Joi.string().valid('image', 'video')).optional(),
  // Location
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  locationName: Joi.string().max(255).optional(),
  locationAddress: Joi.string().max(500).optional(),
  locationPrecision: Joi.string().valid(...LOCATION_PRECISIONS).default('approx_area'),
  revealPolicy: Joi.string().valid(...REVEAL_POLICIES).default('after_interest'),
  // Visibility
  visibilityScope: Joi.string().valid(...VISIBILITY_SCOPES).default('city'),
  radiusMiles: Joi.number().min(1).max(25000).default(100),
  // Pickup / delivery
  meetupPreference: Joi.string().valid('porch_pickup', 'public_meetup', 'flexible').default('public_meetup'),
  deliveryAvailable: Joi.boolean().default(false),
  // Availability
  availableFrom: Joi.date().iso().optional(),
  availableUntil: Joi.date().iso().optional(),
  // Tags
  tags: Joi.array().items(Joi.string().max(50)).max(3).optional(),
  // Share to feed
  shareToFeed: Joi.boolean().default(false),
  // Marketplace redesign fields
  layer: Joi.string().valid(...LISTING_LAYERS).optional(),
  listingType: Joi.string().valid(...LISTING_TYPES).optional(),
  homeId: Joi.string().uuid().optional().allow(null),
  isAddressAttached: Joi.boolean().default(false),
  isWanted: Joi.boolean().default(false),
  budgetMax: Joi.number().min(0).optional().allow(null),
  // Geocode provenance (optional, threaded from geo.resolve)
  geocodeProvider: Joi.string().max(50).allow('', null).optional(),
  geocodeAccuracy: Joi.string().max(50).allow('', null).optional(),
  geocodePlaceId: Joi.string().max(255).allow('', null).optional(),
  // Trade fields
  openToTrades: Joi.boolean().default(false),
  tradePreferences: Joi.string().max(500).allow('', null),
  // Food & homemade fields
  ingredients: Joi.array().items(Joi.string().max(200)).max(50).allow(null),
  allergens: Joi.array().items(Joi.string().max(100)).max(20).allow(null),
  preparationDate: Joi.date().iso().allow(null),
  bestByDate: Joi.date().iso().allow(null),
  foodHandlerCertified: Joi.boolean().default(false),
  // Recurring listing
  isRecurring: Joi.boolean().default(false),
  recurrenceSchedule: Joi.object().allow(null),
  // Pre-order
  isPreorder: Joi.boolean().default(false),
  preorderDeadline: Joi.date().iso().allow(null),
  preorderFulfillmentDate: Joi.date().iso().allow(null),
}).custom((value, helpers) => {
  if ((value.latitude != null) !== (value.longitude != null)) {
    return helpers.error('any.custom', { message: 'latitude and longitude must both be provided together' });
  }
  // Food category validation: require ingredients and bestByDate
  if (value.category === 'food_baked_goods') {
    if (!value.ingredients || value.ingredients.length === 0) {
      return helpers.error('any.custom', { message: 'ingredients are required for food_baked_goods category' });
    }
    if (!value.bestByDate) {
      return helpers.error('any.custom', { message: 'bestByDate is required for food_baked_goods category' });
    }
  }
  // Auto-derive layer from category if not provided
  if (!value.layer) {
    value.layer = CATEGORY_LAYER_MAP[value.category] || 'goods';
  }
  // Auto-derive listing_type if not provided
  if (!value.listingType) {
    if (value.isWanted) {
      value.listingType = 'wanted_request';
    } else if (value.isFree) {
      value.listingType = 'free_item';
    } else {
      value.listingType = LAYER_TYPE_DEFAULTS[value.layer];
    }
  }
  // Trade/swap: no price, not free, not wanted
  if (value.listingType === 'trade_swap') {
    value.price = null;
    value.isFree = false;
    value.isWanted = false;
  }
  return value;
});

const updateListingSchema = Joi.object({
  title: Joi.string().min(3).max(255),
  description: Joi.string().max(5000).allow(null, ''),
  price: Joi.number().min(0).allow(null),
  isFree: Joi.boolean(),
  category: Joi.string().valid(...LISTING_CATEGORIES),
  subcategory: Joi.string().max(100).allow(null, ''),
  condition: Joi.string().valid(...LISTING_CONDITIONS),
  quantity: Joi.number().integer().min(1),
  mediaUrls: Joi.array().items(Joi.string().uri()).max(10),
  mediaTypes: Joi.array().items(Joi.string().valid('image', 'video')),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  locationName: Joi.string().max(255).allow(null, ''),
  locationAddress: Joi.string().max(500).allow(null, ''),
  locationPrecision: Joi.string().valid(...LOCATION_PRECISIONS),
  revealPolicy: Joi.string().valid(...REVEAL_POLICIES),
  visibilityScope: Joi.string().valid(...VISIBILITY_SCOPES),
  radiusMiles: Joi.number().min(1).max(25000),
  meetupPreference: Joi.string().valid('porch_pickup', 'public_meetup', 'flexible'),
  deliveryAvailable: Joi.boolean(),
  availableFrom: Joi.date().iso().allow(null),
  availableUntil: Joi.date().iso().allow(null),
  tags: Joi.array().items(Joi.string().max(50)).max(3),
}).min(1);

const reportListingSchema = Joi.object({
  reason: Joi.string().valid('scam', 'prohibited', 'counterfeit', 'harassment', 'spam', 'inappropriate', 'other').required(),
  details: Joi.string().max(1000).optional(),
});

const messageListingSchema = Joi.object({
  message: Joi.string().max(1000).optional(),
  offerAmount: Joi.number().min(0).optional(),
});

// ============ HELPERS ============

const FIELD_MAP = {
  title: 'title',
  description: 'description',
  price: 'price',
  isFree: 'is_free',
  category: 'category',
  subcategory: 'subcategory',
  condition: 'condition',
  quantity: 'quantity',
  mediaUrls: 'media_urls',
  mediaTypes: 'media_types',
  latitude: 'latitude',
  longitude: 'longitude',
  locationName: 'location_name',
  locationAddress: 'location_address',
  locationPrecision: 'location_precision',
  revealPolicy: 'reveal_policy',
  visibilityScope: 'visibility_scope',
  radiusMiles: 'radius_miles',
  meetupPreference: 'meetup_preference',
  deliveryAvailable: 'delivery_available',
  availableFrom: 'available_from',
  availableUntil: 'available_until',
  tags: 'tags',
  // Marketplace redesign
  layer: 'layer',
  listingType: 'listing_type',
  homeId: 'home_id',
  isAddressAttached: 'is_address_attached',
  isWanted: 'is_wanted',
  budgetMax: 'budget_max',
  geocodeProvider: 'geocode_provider',
  geocodeAccuracy: 'geocode_accuracy',
  geocodePlaceId: 'geocode_place_id',
  // Trade fields
  openToTrades: 'open_to_trades',
  tradePreferences: 'trade_preferences',
  // Food & homemade fields
  ingredients: 'ingredients',
  allergens: 'allergens',
  preparationDate: 'preparation_date',
  bestByDate: 'best_by_date',
  foodHandlerCertified: 'food_handler_certified',
  // Recurring listing
  isRecurring: 'is_recurring',
  recurrenceSchedule: 'recurrence_schedule',
  // Pre-order
  isPreorder: 'is_preorder',
  preorderDeadline: 'preorder_deadline',
  preorderFulfillmentDate: 'preorder_fulfillment_date',
};

function normalizeListing(row) {
  const creator = row.creator
    ? serializeUserIdentityForViewer(row.creator)
    : serializeListingAuthorForViewer({
        identity_context_type: 'local',
        creator: {
          id: row.user_id,
          username: row.username,
          name: row.user_name,
          profile_picture_url: row.user_profile_picture,
        },
      });

  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    price: row.price,
    is_free: row.is_free,
    category: row.category,
    subcategory: row.subcategory,
    condition: row.condition,
    quantity: row.quantity,
    status: row.status,
    media_urls: row.media_urls || [],
    media_types: row.media_types || [],
    latitude: row.latitude || null,
    longitude: row.longitude || null,
    location_name: row.location_name,
    location_precision: row.location_precision,
    visibility_scope: row.visibility_scope,
    tags: row.tags || [],
    view_count: row.view_count || 0,
    save_count: row.save_count || 0,
    message_count: row.message_count || 0,
    meetup_preference: row.meetup_preference,
    delivery_available: row.delivery_available,
    available_from: row.available_from,
    available_until: row.available_until,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sold_at: row.sold_at,
    distance_meters: row.distance_meters || null,
    creator,
    // Marketplace redesign fields
    layer: row.layer || 'goods',
    listing_type: row.listing_type || 'sell_item',
    home_id: row.home_id || null,
    is_address_attached: row.is_address_attached || false,
    quality_score: row.quality_score || 0,
    risk_score: row.risk_score || 0,
    context_tags: row.context_tags || [],
    is_wanted: row.is_wanted || false,
    budget_max: row.budget_max || null,
    expires_at: row.expires_at || null,
    carousel_score: row.carousel_score || null,
  };
}

async function normalizeListingWithHydratedCreator(row) {
  await hydrateListingCreatorIdentities(row);
  return normalizeListing(row);
}

async function normalizeListingsWithHydratedCreators(rows) {
  await hydrateListingCreatorIdentities(rows || []);
  return (rows || []).map(normalizeListing);
}

function serializeListingQuestionForViewer(question) {
  if (!question) return null;
  const { asker, answerer, ...safe } = question;
  return {
    ...safe,
    asker: serializeUserAsLocalIdentity(asker),
    answerer: serializeUserIdentityForViewer(answerer),
  };
}

function serializeListingMessageForViewer(message) {
  if (!message) return null;
  const { buyer, ...safe } = message;
  const buyerIdentity = serializeUserAsLocalIdentity(buyer);
  return {
    ...safe,
    buyer: buyerIdentity,
    buyer_identity: buyerIdentity,
  };
}

/**
 * Enrich RPC results with latitude/longitude from the Listing table.
 * The find_listings_nearby RPC doesn't return lat/lng columns,
 * so we fetch them separately and merge.
 */
async function enrichWithCoordinates(listings) {
  if (!listings || listings.length === 0) return listings;
  const ids = listings.map(l => l.id);
  const { data: coords } = await supabaseAdmin
    .from('Listing')
    .select('id, latitude, longitude')
    .in('id', ids);
  if (!coords || coords.length === 0) return listings;
  const coordMap = {};
  coords.forEach(c => { coordMap[c.id] = c; });
  return listings.map(l => {
    const c = coordMap[l.id];
    if (c) {
      l.latitude = c.latitude;
      l.longitude = c.longitude;
    }
    return l;
  });
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

// ============ ROUTES ============

/**
 * POST /api/listings
 * Create a new marketplace listing
 */
router.post('/', verifyToken, validate(createListingSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title, description, price, isFree, category, subcategory, condition, quantity,
      mediaUrls, mediaTypes,
      latitude, longitude, locationName, locationAddress, locationPrecision, revealPolicy,
      visibilityScope, radiusMiles,
      meetupPreference, deliveryAvailable,
      availableFrom, availableUntil,
      tags, shareToFeed,
      source_type, source_id,
      // Marketplace redesign fields
      layer, listingType, homeId, isAddressAttached, isWanted, budgetMax,
      // Trade fields
      openToTrades, tradePreferences,
      // Food & homemade fields
      ingredients, allergens, preparationDate, bestByDate, foodHandlerCertified,
      // Recurring & pre-order
      isRecurring, recurrenceSchedule, isPreorder, preorderDeadline, preorderFulfillmentDate,
    } = req.body;

    // Compute expiration from listing type
    const resolvedType = listingType || (isWanted ? 'wanted_request' : (isFree ? 'free_item' : LAYER_TYPE_DEFAULTS[layer || 'goods']));
    const expirationHours = EXPIRATION_RULES[resolvedType] || 720;
    const expiresAt = new Date(Date.now() + expirationHours * 3600000).toISOString();

    // Atomically claim an inventory slot BEFORE inserting the listing.
    // The RPC uses SELECT ... FOR UPDATE to prevent concurrent creates
    // from exceeding the cap.
    const resolvedLayer = layer || CATEGORY_LAYER_MAP[category] || 'goods';
    let slotClaimed = false;
    if (homeId && isAddressAttached) {
      const maxCount = INVENTORY_CAPS[resolvedLayer] || 10;
      const { data: claimed, error: claimErr } = await supabaseAdmin.rpc(
        'claim_inventory_slot',
        { p_home_id: homeId, p_layer: resolvedLayer, p_max_count: maxCount },
      );
      if (claimErr) {
        logger.error('marketplace.create.slot_claim_error', { error: claimErr.message });
        return res.status(500).json({ error: 'Failed to check inventory cap' });
      }
      if (!claimed) {
        return res.status(409).json({
          error: `Inventory cap reached: max ${maxCount} active ${resolvedLayer} listings per address`,
        });
      }
      slotClaimed = true;
    }

    const listingData = {
      user_id: userId,
      title,
      description: description || null,
      price: isFree ? 0 : (price || null),
      is_free: isFree || false,
      category,
      subcategory: subcategory || null,
      condition: condition || null,
      quantity: quantity || 1,
      status: 'active',
      media_urls: mediaUrls || [],
      media_types: mediaTypes || [],
      latitude: latitude || null,
      longitude: longitude || null,
      location_name: locationName || null,
      location_address: locationAddress || null,
      location_precision: locationPrecision || 'approx_area',
      reveal_policy: revealPolicy || 'after_interest',
      visibility_scope: visibilityScope || 'city',
      radius_miles: radiusMiles || 100,
      meetup_preference: meetupPreference || 'public_meetup',
      delivery_available: deliveryAvailable || false,
      available_from: availableFrom || null,
      available_until: availableUntil || null,
      tags: tags || [],
      source_type: source_type || null,
      source_id: source_id || null,
      // Marketplace redesign fields
      layer: resolvedLayer,
      listing_type: resolvedType,
      home_id: homeId || null,
      is_address_attached: isAddressAttached || false,
      is_wanted: isWanted || false,
      budget_max: budgetMax || null,
      expires_at: expiresAt,
      // Trade fields
      open_to_trades: openToTrades || false,
      trade_preferences: tradePreferences || null,
      // Food & homemade fields
      ingredients: ingredients || null,
      allergens: allergens || null,
      preparation_date: preparationDate || null,
      best_by_date: bestByDate || null,
      food_handler_certified: foodHandlerCertified || false,
      // Recurring & pre-order
      is_recurring: isRecurring || false,
      recurrence_schedule: recurrenceSchedule || null,
      is_preorder: isPreorder || false,
      preorder_deadline: preorderDeadline || null,
      preorder_fulfillment_date: preorderFulfillmentDate || null,
    };

    // Geocode provenance (when coordinates are provided)
    if (latitude != null && longitude != null) {
      listingData.geocode_provider = req.body.geocodeProvider || 'mapbox';
      listingData.geocode_mode = 'temporary';
      listingData.geocode_accuracy = req.body.geocodeAccuracy || 'address';
      listingData.geocode_place_id = req.body.geocodePlaceId || null;
      listingData.geocode_source_flow = 'listing_create';
      listingData.geocode_created_at = new Date().toISOString();
    }

    // Build PostGIS geography point if coordinates provided
    if (latitude != null && longitude != null) {
      // We rely on Supabase trigger or computed column for the geography type.
      // For now, insert raw lat/lng and the DB column `location` is populated.
    }

    let listing;
    try {
      const { data, error } = await supabaseAdmin
        .from('Listing')
        .insert(listingData)
        .select(`*, creator:user_id (${SAFE_CREATOR_SELECT})`)
        .single();

      if (error) throw error;
      listing = data;
    } catch (insertErr) {
      logger.error('marketplace.create.error', { error: insertErr.message, userId });
      // Release the inventory slot if we claimed one before the failed insert
      if (slotClaimed) {
        await supabaseAdmin.rpc('release_inventory_slot', {
          p_home_id: homeId,
          p_layer: resolvedLayer,
        }).catch(relErr => logger.warn('marketplace.create.slot_release_error', { error: relErr.message }));
      }
      return res.status(500).json({ error: 'Failed to create listing' });
    }

    // Optionally create a feed reference post
    if (shareToFeed) {
      try {
        await supabaseAdmin.from('Post').insert({
          user_id: userId,
          content: `New listing: ${title}`,
          post_type: 'deal',
          visibility: 'neighborhood',
          visibility_scope: 'neighborhood',
          location_precision: 'neighborhood_only',
          ref_listing_id: listing.id,
          latitude: latitude || null,
          longitude: longitude || null,
          location_name: locationName || null,
          tags: tags || [],
        });
      } catch (feedErr) {
        logger.warn('marketplace.create.share_feed_error', { error: feedErr.message });
      }
    }

    // Broadcast to all connected clients so browse pages can show "new listings" banner
    const io = req.app.get('io');
    if (io) {
      io.emit('listing:new', {
        id: listing.id,
        title: listing.title,
        category: listing.category,
        layer: listing.layer,
        listing_type: listing.listing_type,
        latitude: listing.latitude,
        longitude: listing.longitude,
        is_free: listing.is_free,
        is_wanted: listing.is_wanted,
        created_at: listing.created_at,
      });
    }

    // Fire-and-forget: match against saved searches
    savedSearchService.matchNewListing(listing).catch(err => {
      logger.warn('Saved search matching failed (non-blocking)', { error: err.message });
    });

    logger.info('marketplace.create', {
      listingId: listing.id, userId, category,
      layer: resolvedLayer, listingType: resolvedType,
      hasCoordinates: !!(latitude && longitude),
    });
    const responseListing = applyLocationPrivacy(await normalizeListingWithHydratedCreator(listing), userId);
    res.status(201).json({ message: 'Listing created successfully', listing: responseListing });
  } catch (err) {
    logger.error('marketplace.create.error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to create listing' });
  }
});


// ============ MARKETPLACE BROWSE REDESIGN ENDPOINTS ============

/**
 * GET /api/listings/browse
 * Unified browse endpoint — single source of truth for map + grid.
 * Uses direct queries with keyset cursor pagination. No RPCs.
 */
router.get('/browse', optionalAuth, async (req, res) => {
  const start = Date.now();
  try {
    const {
      south, west, north, east,
      category, listing_type, is_free, is_wanted, condition,
      min_price, max_price, layer, trust_only,
      search, sort, cursor, limit,
      ref_lat, ref_lng,
      remote_only, include_remote,
      created_after,
    } = req.query;

    if (!south || !west || !north || !east) {
      return res.status(400).json({ error: 'Bounding box required: south, west, north, east' });
    }

    // Extract user ID if authenticated (optional for browse)
    const userId = req.user?.id || null;

    const result = await browseListings({
      south: parseFloat(south),
      west: parseFloat(west),
      north: parseFloat(north),
      east: parseFloat(east),
      category: category || null,
      listingType: listing_type || null,
      isFree: is_free != null ? is_free : null,
      isWanted: is_wanted != null ? is_wanted : null,
      condition: condition || null,
      minPrice: min_price != null ? parseFloat(min_price) : null,
      maxPrice: max_price != null ? parseFloat(max_price) : null,
      layer: layer || null,
      trustOnly: trust_only || null,
      search: search || null,
      sort: sort || 'newest',
      cursor: cursor || null,
      limit: limit ? parseInt(limit) : 30,
      userId,
      refLat: ref_lat != null ? parseFloat(ref_lat) : null,
      refLng: ref_lng != null ? parseFloat(ref_lng) : null,
      remoteOnly: remote_only === 'true',
      includeRemote: include_remote !== 'false', // default true
      _createdAfter: created_after || null,
    });

    logger.info('marketplace.browse', {
      userId,
      sort: sort || 'newest',
      category: category || null,
      layer: layer || null,
      resultCount: result?.listings?.length || 0,
      hasMore: result?.pagination?.has_more || false,
      bounds: { south, west, north, east },
      latencyMs: Date.now() - start,
    });

    // When no listings found, find nearest activity center for snap-to prompts
    let nearest_activity_center = null;
    const items = result?.listings || [];
    if (items.length === 0) {
      const centerLat = (parseFloat(south) + parseFloat(north)) / 2;
      const centerLon = (parseFloat(west) + parseFloat(east)) / 2;
      const { data: nearestRows } = await supabaseAdmin.rpc('find_nearest_activity_center', {
        p_center_lat: centerLat,
        p_center_lon: centerLon,
        p_content_type: 'listing',
      });
      if (nearestRows && nearestRows.length > 0) {
        nearest_activity_center = {
          latitude: nearestRows[0].latitude,
          longitude: nearestRows[0].longitude,
        };
      }
    }

    res.json({ ...result, nearest_activity_center });
  } catch (err) {
    const errPayload = {
      error: err.message,
      latencyMs: Date.now() - start,
      stack: err.stack,
    };
    if (err.details) errPayload.details = err.details;
    if (err.hint) errPayload.hint = err.hint;
    if (err.code) errPayload.code = err.code;
    logger.error('marketplace.browse.error', errPayload);
    res.status(500).json({ error: 'Failed to browse listings' });
  }
});

/**
 * GET /api/listings/discover
 * Curated sections for Discovery Mode landing experience.
 */
router.get('/discover', optionalAuth, async (req, res) => {
  const start = Date.now();
  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const userId = req.user?.id || null;

    const result = await discoveryCacheService.getCachedDiscovery({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      userId,
      radius: resolveListingRadiusMeters(radius),
    });

    logger.info('marketplace.discover', {
      userId,
      lat, lng,
      sectionCounts: {
        justListed: result?.justListed?.length || 0,
        trending: result?.trending?.length || 0,
        freeFinds: result?.freeFinds?.length || 0,
        nearbyDeals: result?.nearbyDeals?.length || 0,
      },
      latencyMs: Date.now() - start,
    });

    res.json(result);
  } catch (err) {
    logger.error('marketplace.discover.error', { error: err.message, latencyMs: Date.now() - start });
    res.status(500).json({ error: 'Failed to load discovery feed' });
  }
});

/**
 * GET /api/listings/autocomplete
 * Lightweight autocomplete for search dropdown.
 */
router.get('/autocomplete', optionalAuth, async (req, res) => {
  try {
    const { q, lat, lng, limit } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json({ titles: [], categories: [] });
    }

    const result = await autocompleteListings({
      query: q.trim(),
      lat: lat != null ? parseFloat(lat) : null,
      lng: lng != null ? parseFloat(lng) : null,
      limit: limit ? parseInt(limit) : 5,
    });

    res.json(result);
  } catch (err) {
    logger.error('Autocomplete error', { error: err.message });
    res.status(500).json({ error: 'Failed to autocomplete' });
  }
});

// ============ LEGACY ENDPOINTS (kept for backward compatibility) ============

/**
 * GET /api/listings/nearby
 * Search listings near a location using the RPC function
 * @deprecated Use GET /api/listings/browse instead
 */
router.get('/nearby', optionalAuth, async (req, res) => {
  try {
    const {
      latitude, longitude, radius, radiusMiles, limit = 20, offset = 0,
      category, minPrice, maxPrice, isFree, condition, search, sort = 'newest',
      // Marketplace redesign filters
      layer, listingType, trustOnly, isWanted,
    } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const radiusMeters = resolveListingQueryRadiusMeters({ radius, radiusMiles });

    const { data: listings, error } = await supabaseAdmin.rpc('find_listings_nearby_v2', {
      p_latitude: parseFloat(latitude),
      p_longitude: parseFloat(longitude),
      p_radius_meters: radiusMeters,
      p_limit: parseInt(limit),
      p_offset: parseInt(offset),
      p_category: category || null,
      p_min_price: minPrice ? parseFloat(minPrice) : null,
      p_max_price: maxPrice ? parseFloat(maxPrice) : null,
      p_is_free: isFree === 'true' ? true : (isFree === 'false' ? false : null),
      p_condition: condition || null,
      p_search: search || null,
      p_sort: sort,
      // Marketplace redesign params
      p_layer: layer || null,
      p_listing_type: listingType || null,
      p_trust_only: trustOnly === 'true',
      p_is_wanted: isWanted === 'true' ? true : (isWanted === 'false' ? false : null),
    });

    if (error) {
      logger.error('Error finding nearby listings', { error: error.message });
      return res.status(500).json({ error: 'Failed to find nearby listings' });
    }

    // Enrich RPC results with lat/lng (RPC doesn't return these columns)
    const enriched = await enrichWithCoordinates(listings || []);

    // Apply location privacy with viewer context
    const viewerUserId = req.user?.id || null;
    const normalized = await normalizeListingsWithHydratedCreators(enriched);

    res.json({
      listings: await applyLocationPrivacyBatch(normalized, viewerUserId),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: listings && listings.length === parseInt(limit),
      },
    });
  } catch (err) {
    logger.error('Nearby listings error', { error: err.message });
    res.status(500).json({ error: 'Failed to find nearby listings' });
  }
});


/**
 * GET /api/listings/in-bounds
 * Listings within a map bounding box
 */
router.get('/in-bounds', optionalAuth, async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const { south, west, north, east, category, limit = 100, layer } = req.query;

    if (!south || !west || !north || !east) {
      return res.status(400).json({ error: 'Bounding box required: south, west, north, east' });
    }

    const s = parseFloat(south);
    const w = parseFloat(west);
    const n = parseFloat(north);
    const e = parseFloat(east);
    const boundsArea = Math.abs((n - s) * (e - w));
    const zoomLevel = req.query.zoom ? parseFloat(req.query.zoom) : null;
    logger.info('viewport_request', {
      endpoint: '/api/listings/in-bounds',
      bounds_area_sq_deg: Math.round(boundsArea * 10000) / 10000,
      zoom_level: zoomLevel,
    });

    const { data: listings, error } = await supabaseAdmin.rpc('find_listings_in_bounds_v2', {
      p_south: s,
      p_west: w,
      p_north: n,
      p_east: e,
      p_layer: layer || null,
      p_category: category || null,
      p_limit: parseInt(limit),
    });

    if (error) {
      const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
      logger.error('Error finding listings in bounds', {
        error: error.message,
        response_time_ms: Math.round(elapsed * 100) / 100,
      });
      return res.status(500).json({ error: 'Failed to find listings in bounds' });
    }

    const results = listings || [];
    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.info('viewport_response', {
      endpoint: '/api/listings/in-bounds',
      status: 200,
      result_count: results.length,
      response_time_ms: Math.round(elapsed * 100) / 100,
      bounds_area_sq_deg: Math.round(boundsArea * 10000) / 10000,
      zoom_level: zoomLevel,
    });

    // Apply location privacy for map view with viewer context
    const viewerUserId = req.user?.id || null;
    const privacyResults = await applyLocationPrivacyBatch(results, viewerUserId);

    // When viewport is empty, find the nearest activity center
    let nearest_activity_center = null;
    if (results.length === 0) {
      const centerLat = (s + n) / 2;
      const centerLon = (w + e) / 2;
      const { data: nearestRows } = await supabaseAdmin.rpc('find_nearest_activity_center', {
        p_center_lat: centerLat,
        p_center_lon: centerLon,
        p_content_type: 'listing',
      });
      if (nearestRows && nearestRows.length > 0) {
        nearest_activity_center = {
          latitude: nearestRows[0].latitude,
          longitude: nearestRows[0].longitude,
        };
      }
    }

    res.json({ listings: privacyResults, nearest_activity_center });
  } catch (err) {
    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.error('Listings in-bounds error', {
      error: err.message,
      response_time_ms: Math.round(elapsed * 100) / 100,
    });
    res.status(500).json({ error: 'Failed to find listings in bounds' });
  }
});


/**
 * GET /api/listings/search
 * Full-text search for listings
 */
router.get('/search', optionalAuth, async (req, res) => {
  const start = Date.now();
  try {
    const {
      q, latitude, longitude, radius, radiusMiles, limit = 20, offset = 0,
      category, sort = 'newest', layer, trustOnly, isWanted,
    } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    // If location provided, use the RPC with search param
    if (latitude && longitude) {
      try {
        const { data: listings, error } = await withTimeout(
          supabaseAdmin.rpc('find_listings_nearby_v2', {
            p_latitude: parseFloat(latitude),
            p_longitude: parseFloat(longitude),
            p_radius_meters: resolveListingQueryRadiusMeters({ radius, radiusMiles }),
            p_limit: parseInt(limit),
            p_offset: parseInt(offset),
            p_category: category || null,
            p_search: q.trim(),
            p_sort: sort,
            p_layer: layer || null,
            p_listing_type: null,
            p_trust_only: trustOnly === 'true',
            p_is_wanted: isWanted === 'true' ? true : (isWanted === 'false' ? false : null),
          }),
          LISTING_SEARCH_RPC_TIMEOUT_MS,
          'find_listings_nearby_v2'
        );

        if (!error) {
          // Enrich RPC results with lat/lng (RPC doesn't return these columns)
          const enriched = await enrichWithCoordinates(listings || []);
          const normalized = await normalizeListingsWithHydratedCreators(enriched);
          logger.info('marketplace.search', {
            query: q.trim(), category: category || null, source: 'rpc',
            resultCount: normalized.length, latencyMs: Date.now() - start,
          });
          return res.json({
            listings: await applyLocationPrivacyBatch(normalized, req.user?.id || null),
            pagination: {
              limit: parseInt(limit),
              offset: parseInt(offset),
              hasMore: listings && listings.length === parseInt(limit),
            },
          });
        }

        logger.warn('RPC listing search failed, using text-search fallback', {
          error: error.message,
          query: q.trim(),
          category: category || null,
        });
      } catch (rpcErr) {
        logger.warn('RPC listing search timed out, using text-search fallback', {
          error: rpcErr.message,
          timeoutMs: LISTING_SEARCH_RPC_TIMEOUT_MS,
          query: q.trim(),
        });
      }
    }

    // Fallback: no location OR location RPC failed/timed out
    let query = supabaseAdmin
      .from('Listing')
      .select(`*, creator:user_id (${SAFE_CREATOR_SELECT})`)
      .eq('status', 'active')
      .textSearch('search_vector', q.trim(), { type: 'websearch' })
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (category) query = query.eq('category', category);

    const { data: listings, error } = await query;

    if (error) {
      logger.error('Error searching listings', { error: error.message });
      return res.status(500).json({ error: 'Failed to search listings' });
    }

    logger.info('marketplace.search', {
      query: q.trim(), category: category || null, source: 'fallback',
      resultCount: listings?.length || 0, latencyMs: Date.now() - start,
    });

    res.json({
      listings: await applyLocationPrivacyBatch(
        await normalizeListingsWithHydratedCreators(listings || []),
        req.user?.id || null
      ),
      pagination: { limit: parseInt(limit), offset: parseInt(offset), hasMore: listings && listings.length === parseInt(limit) },
    });
  } catch (err) {
    logger.error('marketplace.search.error', { error: err.message, latencyMs: Date.now() - start });
    res.status(500).json({ error: 'Failed to search listings' });
  }
});


/**
 * GET /api/listings/me
 * Current user's listings
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabaseAdmin
      .from('Listing')
      // Include an exact count so clients can show accurate totals without
      // fetching all records (e.g. sidebar badges).
      .select(LISTING_LIST, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);

    const { data: listings, error, count } = await query;

    if (error) {
      logger.error('Error fetching user listings', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch your listings' });
    }

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    const total = typeof count === 'number' ? count : null;
    const hasMore = typeof total === 'number' ? offsetNum + limitNum < total : false;

    res.json({
      listings: await applyLocationPrivacyBatch(listings || [], userId),
      pagination: { limit: limitNum, offset: offsetNum, total, hasMore },
    });
  } catch (err) {
    logger.error('User listings fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch your listings' });
  }
});


/**
 * GET /api/listings/saved
 * Current user's saved/bookmarked listings
 */
router.get('/saved', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const { data: saves, error } = await supabaseAdmin
      .from('ListingSave')
      .select(`
        id, created_at,
        listing:listing_id (
          id, title, price, is_free, category, condition, status,
          media_urls, media_types, location_name, location_precision,
          created_at,
          creator:user_id (${SAFE_CREATOR_SELECT})
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      logger.error('Error fetching saved listings', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch saved listings' });
    }

    // Filter out saves where listing was deleted
    const validSaves = (saves || []).filter(s => s.listing);

    await hydrateListingCreatorIdentities(validSaves.map(s => s.listing));
    const savedListings = validSaves.map(s => ({ ...normalizeListing(s.listing), savedAt: s.created_at }));
    res.json({
      listings: await applyLocationPrivacyBatch(savedListings, userId),
      pagination: { limit: parseInt(limit), offset: parseInt(offset) },
    });
  } catch (err) {
    logger.error('Saved listings fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch saved listings' });
  }
});


/**
 * GET /api/listings/user/:userId
 * Get a specific user's active listings (public)
 */
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const { data: listings, error } = await supabaseAdmin
      .from('Listing')
      .select(LISTING_LIST)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      logger.error('Error fetching user listings', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch user listings' });
    }

    res.json({ listings: await applyLocationPrivacyBatch(listings || [], req.user?.id || null) });
  } catch (err) {
    logger.error('User listings fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch user listings' });
  }
});


/**
 * GET /api/listings/categories
 * Return available categories
 */
router.get('/categories', (req, res) => {
  res.json({ categories: LISTING_CATEGORIES, conditions: LISTING_CONDITIONS });
});


/**
 * GET /api/listings/carousel
 * Top-ranked listings for the carousel overlay on the map
 */
router.get('/carousel', optionalAuth, async (req, res) => {
  try {
    const { latitude, longitude, radius, layer } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const { data, error } = await supabaseAdmin.rpc('get_listing_carousel', {
      p_latitude: parseFloat(latitude),
      p_longitude: parseFloat(longitude),
      p_radius_meters: resolveListingRadiusMeters(radius),
      p_layer: layer || null,
      p_limit: 10,
    });

    if (error) {
      logger.error('Error loading carousel', { error: error.message });
      return res.status(500).json({ error: 'Failed to load carousel' });
    }

    const enriched = await enrichWithCoordinates(data || []);
    const normalized = await normalizeListingsWithHydratedCreators(enriched);
    res.json({ listings: await applyLocationPrivacyBatch(normalized, req.user?.id || null) });
  } catch (err) {
    logger.error('Carousel error', { error: err.message });
    res.status(500).json({ error: 'Failed to load carousel' });
  }
});


/**
 * POST /api/listings/:id/refresh
 * Refresh a listing (extend expiration, bump recency)
 */
router.post('/:id/refresh', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const listingId = req.params.id;

    // Fetch listing, verify ownership
    const { data: listing, error: fetchErr } = await supabaseAdmin
      .from('Listing')
      .select('id, user_id, listing_type, last_refreshed_at, refresh_count, status')
      .eq('id', listingId)
      .single();

    if (fetchErr || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.user_id !== userId) {
      return res.status(403).json({ error: 'You can only refresh your own listings' });
    }

    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'Only active listings can be refreshed' });
    }

    // Check cooldown
    if (listing.last_refreshed_at) {
      const cooldownMs = REFRESH_COOLDOWN_DAYS * 24 * 3600000;
      const lastRefresh = new Date(listing.last_refreshed_at).getTime();
      if (Date.now() - lastRefresh < cooldownMs) {
        const nextRefresh = new Date(lastRefresh + cooldownMs);
        return res.status(429).json({
          error: `Refresh cooldown active. Try again after ${nextRefresh.toISOString()}`,
          next_refresh_at: nextRefresh.toISOString(),
        });
      }
    }

    // Extend expiration based on listing type
    const expirationHours = EXPIRATION_RULES[listing.listing_type] || 720;
    const newExpiresAt = new Date(Date.now() + expirationHours * 3600000).toISOString();

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('Listing')
      .update({
        last_refreshed_at: new Date().toISOString(),
        refresh_count: (listing.refresh_count || 0) + 1,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId)
      .select(`*, creator:user_id (${SAFE_CREATOR_SELECT})`)
      .single();

    if (updateErr) {
      logger.error('Error refreshing listing', { error: updateErr.message, listingId });
      return res.status(500).json({ error: 'Failed to refresh listing' });
    }

    logger.info('Listing refreshed', { listingId, userId, refreshCount: updated.refresh_count });
    res.json({
      message: 'Listing refreshed successfully',
      listing: applyLocationPrivacy(await normalizeListingWithHydratedCreator(updated), userId),
    });
  } catch (err) {
    logger.error('Listing refresh error', { error: err.message });
    res.status(500).json({ error: 'Failed to refresh listing' });
  }
});


/**
 * GET /api/listings/:id/similar
 * Returns up to 8 similar listings in the same category with similar price.
 * Must be placed BEFORE /:id to avoid route param collision.
 */
router.get('/:id/similar', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const viewerUserId = req.user?.id || null;

    // Fetch the source listing's category and price
    const { data: listing, error: fetchErr } = await supabaseAdmin
      .from('Listing')
      .select('id, category, price, latitude, longitude')
      .eq('id', id)
      .single();

    if (fetchErr || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Build query: same category, active, not this listing, not archived
    let query = supabaseAdmin
      .from('Listing')
      .select(`*, creator:user_id (${SAFE_CREATOR_SELECT})`)
      .eq('category', listing.category)
      .eq('status', 'active')
      .neq('id', id)
      .is('archived_at', null);

    // If price exists and > 0, filter within 50% range
    if (listing.price && listing.price > 0) {
      query = query
        .gte('price', listing.price * 0.5)
        .lte('price', listing.price * 1.5);
    }

    query = query
      .order('created_at', { ascending: false })
      .limit(8);

    const { data: results, error } = await query;

    if (error) {
      logger.error('Similar listings query error', { error: error.message, listingId: id });
      return res.status(500).json({ error: 'Failed to fetch similar listings' });
    }

    // Apply save status enrichment
    let savedIds = new Set();
    if (viewerUserId && results && results.length > 0) {
      const listingIds = results.map(r => r.id);
      const { data: saves } = await supabaseAdmin
        .from('ListingSave')
        .select('listing_id')
        .eq('user_id', viewerUserId)
        .in('listing_id', listingIds);
      savedIds = new Set((saves || []).map(s => s.listing_id));
    }

    // Normalize and apply location privacy
    await hydrateListingCreatorIdentities(results || []);
    const normalized = (results || []).map(row => {
      const n = normalizeListing(row);
      n.userHasSaved = savedIds.has(row.id);
      return n;
    });

    const listings = await applyLocationPrivacyBatch(normalized, viewerUserId);

    res.json({ listings });
  } catch (err) {
    logger.error('Similar listings error', { error: err.message, listingId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch similar listings' });
  }
});


// Common bot user-agent patterns
const BOT_UA_PATTERN = /bot|crawl|spider|slurp|facebookexternal|whatsapp|telegram|preview|fetch|http|curl|wget|python|java\/|go-http|axios|node-fetch|postman/i;

/**
 * GET /api/listings/:id
 * Get a single listing with full detail
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const viewerUserId = req.user?.id || null;

    const { data: listing, error } = await supabaseAdmin
      .from('Listing')
      .select(`*, creator:user_id (${SAFE_CREATOR_SELECT})`)
      .eq('id', id)
      .single();

    if (error || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const isOwner = viewerUserId && listing.user_id === viewerUserId;

    // Check address grants for progressive disclosure
    let grantedUserIds = null;
    if (viewerUserId && !isOwner) {
      const { data: grant } = await supabaseAdmin
        .from('ListingAddressGrant')
        .select('grantee_user_id')
        .eq('listing_id', id)
        .eq('grantee_user_id', viewerUserId)
        .maybeSingle();
      if (grant) {
        grantedUserIds = new Set([String(viewerUserId)]);
      }
    }

    const visibleListing = applyLocationPrivacy(
      await normalizeListingWithHydratedCreator(listing),
      viewerUserId,
      { grantedUserIds }
    );

    // Check if current user has saved this listing
    let userHasSaved = false;
    if (viewerUserId) {
      const { data: save } = await supabaseAdmin
        .from('ListingSave')
        .select('id')
        .eq('listing_id', id)
        .eq('user_id', viewerUserId)
        .maybeSingle();
      userHasSaved = !!save;
    }

    // ---- Record unique view (non-blocking) ----
    // Rules: logged-in users only, exclude seller, exclude bots, one view per user
    const userAgent = req.get('user-agent') || '';
    const isBot = BOT_UA_PATTERN.test(userAgent);
    if (viewerUserId && !isOwner && !isBot) {
      // Upsert into ListingView — unique constraint prevents duplicates
      supabaseAdmin
        .from('ListingView')
        .upsert(
          { listing_id: id, user_id: viewerUserId },
          { onConflict: 'listing_id,user_id', ignoreDuplicates: true }
        )
        .then(async ({ error: viewError }) => {
          if (viewError) {
            // Table might not exist yet — fall back to old increment
            if (/relation.*does not exist|ListingView/i.test(String(viewError.message || ''))) {
              logger.warn('ListingView table missing, falling back to simple increment');
              await supabaseAdmin.from('Listing').update({ view_count: (listing.view_count || 0) + 1 }).eq('id', id);
              return;
            }
            logger.warn('ListingView upsert error', { error: viewError.message });
            return;
          }
          // Recount unique views and sync to Listing.view_count
          const { count } = await supabaseAdmin
            .from('ListingView')
            .select('id', { count: 'exact', head: true })
            .eq('listing_id', id);
          if (count != null) {
            await supabaseAdmin.from('Listing').update({ view_count: count }).eq('id', id);
          }
        })
        .catch(err => logger.warn('marketplace.view_count.error', { error: err.message, listingId: id }));
    }

    // Fetch creator reputation (lightweight cache lookup)
    const reputation = await getReputation(listing.user_id);

    res.json({
      listing: {
        ...visibleListing,
        userHasSaved,
        creator: visibleListing.creator ? { ...visibleListing.creator, reputation } : null,
      },
    });
  } catch (err) {
    logger.error('Listing fetch error', { error: err.message, listingId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

/**
 * PATCH /api/listings/:id
 * Update a listing (owner only)
 */
router.patch('/:id', verifyToken, validate(updateListingSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: existing, error: fetchErr } = await supabaseAdmin.from('Listing').select('user_id').eq('id', id).single();
    if (fetchErr) {
      logger.error('Error fetching listing for edit', { error: fetchErr.message, listingId: id });
      return res.status(500).json({ error: 'Failed to fetch listing' });
    }
    if (!existing) return res.status(404).json({ error: 'Listing not found' });
    if (existing.user_id !== userId) return res.status(403).json({ error: 'You can only edit your own listings' });

    const updates = { updated_at: new Date().toISOString() };
    for (const [camel, snake] of Object.entries(FIELD_MAP)) {
      if (req.body[camel] !== undefined) updates[snake] = req.body[camel];
    }

    // Set geocode provenance timestamps when coordinates change
    if (req.body.latitude !== undefined || req.body.longitude !== undefined) {
      updates.geocode_mode = 'temporary';
      updates.geocode_source_flow = 'listing_edit';
      updates.geocode_created_at = new Date().toISOString();
    }

    const { data: listing, error } = await supabaseAdmin
      .from('Listing')
      .update(updates)
      .eq('id', id)
      .select(`*, creator:user_id (${SAFE_CREATOR_SELECT})`)
      .single();

    if (error) {
      logger.error('Error updating listing', { error: error.message, listingId: id });
      return res.status(500).json({ error: 'Failed to update listing' });
    }

    const fieldsUpdated = Object.keys(updates).filter(k => k !== 'updated_at');
    logger.info('marketplace.edit', { listingId: id, userId, fieldsUpdated });

    res.json({
      message: 'Listing updated successfully',
      listing: applyLocationPrivacy(await normalizeListingWithHydratedCreator(listing), userId),
    });
  } catch (err) {
    logger.error('marketplace.edit.error', { error: err.message, listingId: req.params.id });
    res.status(500).json({ error: 'Failed to update listing' });
  }
});


/**
 * PATCH /api/listings/:id/status
 * Change listing status (mark sold, archive, reactivate, etc.)
 */
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { status } = req.body;

    if (!status || !LISTING_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${LISTING_STATUSES.join(', ')}` });
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin.from('Listing').select('user_id, status').eq('id', id).single();
    if (fetchErr) {
      logger.error('Error fetching listing for status change', { error: fetchErr.message, listingId: id });
      return res.status(500).json({ error: 'Failed to fetch listing' });
    }
    if (!existing) return res.status(404).json({ error: 'Listing not found' });
    if (existing.user_id !== userId) return res.status(403).json({ error: 'You can only change status of your own listings' });

    const updates = { status, updated_at: new Date().toISOString() };
    if (status === 'sold') updates.sold_at = new Date().toISOString();
    if (status === 'archived') updates.archived_at = new Date().toISOString();

    const { data: listing, error } = await supabaseAdmin
      .from('Listing')
      .update(updates)
      .eq('id', id)
      .select('id, status, sold_at, archived_at')
      .single();

    if (error) {
      logger.error('Error updating listing status', { error: error.message, listingId: id });
      return res.status(500).json({ error: 'Failed to update listing status' });
    }

    res.json({ message: `Listing marked as ${status}`, listing });
  } catch (err) {
    logger.error('Listing status update error', { error: err.message });
    res.status(500).json({ error: 'Failed to update listing status' });
  }
});


/**
 * DELETE /api/listings/:id
 * Delete a listing (owner only)
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: existing, error: fetchErr } = await supabaseAdmin.from('Listing').select('user_id').eq('id', id).single();
    if (fetchErr) {
      logger.error('Error fetching listing for deletion', { error: fetchErr.message, listingId: id });
      return res.status(500).json({ error: 'Failed to fetch listing' });
    }
    if (!existing) return res.status(404).json({ error: 'Listing not found' });
    if (existing.user_id !== userId) return res.status(403).json({ error: 'You can only delete your own listings' });

    const { error } = await supabaseAdmin.from('Listing').delete().eq('id', id);
    if (error) {
      logger.error('Error deleting listing', { error: error.message, listingId: id });
      return res.status(500).json({ error: 'Failed to delete listing' });
    }

    res.json({ message: 'Listing deleted successfully' });
  } catch (err) {
    logger.error('Listing delete error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});


/**
 * POST /api/listings/:id/save
 * Toggle save/bookmark on a listing
 */
router.post('/:id/save', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: saved, error } = await supabase.rpc('toggle_listing_save', {
      p_listing_id: id,
      p_user_id: userId,
    });

    if (error) {
      logger.error('Error toggling listing save', { error: error.message, listingId: id });
      return res.status(500).json({ error: 'Failed to toggle save' });
    }

    // Fetch current save_count so the client can reconcile
    const { data: listing, error: countErr } = await supabaseAdmin
      .from('Listing')
      .select('save_count')
      .eq('id', id)
      .single();

    const saveCount = countErr ? null : (listing?.save_count ?? 0);

    logger.info('marketplace.save', { listingId: id, userId, saved });

    res.json({ message: saved ? 'Listing saved' : 'Listing unsaved', saved, saveCount });
  } catch (err) {
    logger.error('marketplace.save.error', { error: err.message });
    res.status(500).json({ error: 'Failed to toggle save' });
  }
});


/**
 * POST /api/listings/:id/report
 * Report a listing
 */
router.post('/:id/report', verifyToken, validate(reportListingSchema), async (req, res) => {
  try {
    const { id: listingId } = req.params;
    const { reason, details } = req.body;
    const userId = req.user.id;

    const { data: listing, error: fetchErr } = await supabaseAdmin.from('Listing').select('id').eq('id', listingId).single();
    if (fetchErr) {
      logger.error('Error fetching listing for report', { error: fetchErr.message, listingId });
      return res.status(500).json({ error: 'Failed to fetch listing' });
    }
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const { error } = await supabaseAdmin.from('ListingReport').insert({
      listing_id: listingId,
      reported_by: userId,
      reason,
      details: details || null,
    });

    if (error) {
      logger.error('Error reporting listing', { error: error.message, listingId, userId });
      return res.status(500).json({ error: 'Failed to report listing' });
    }

    res.json({ message: 'Listing reported successfully. We will review it shortly.' });
  } catch (err) {
    logger.error('Listing report error', { error: err.message });
    res.status(500).json({ error: 'Failed to report listing' });
  }
});


/**
 * POST /api/listings/:id/message
 * Express interest / make offer on a listing
 */
router.post('/:id/message', verifyToken, validate(messageListingSchema), async (req, res) => {
  try {
    const { id: listingId } = req.params;
    const { message, offerAmount } = req.body;
    const buyerId = req.user.id;

    const { data: listing } = await supabaseAdmin
      .from('Listing')
      .select('id, user_id, title, status')
      .eq('id', listingId)
      .single();

    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== 'active') return res.status(400).json({ error: 'Listing is no longer active' });
    if (listing.user_id === buyerId) return res.status(400).json({ error: 'You cannot message your own listing' });

    // Check for existing pending message from this buyer
    const { data: existing } = await supabaseAdmin
      .from('ListingMessage')
      .select('id')
      .eq('listing_id', listingId)
      .eq('buyer_id', buyerId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'You already have a pending inquiry on this listing' });
    }

    const { data: msg, error } = await supabaseAdmin
      .from('ListingMessage')
      .insert({
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: listing.user_id,
        offer_amount: offerAmount || null,
        message: message || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating listing message', { error: error.message });
      return res.status(500).json({ error: 'Failed to send message' });
    }

    // Atomically sync message_count from actual ListingMessage rows
    const { count } = await supabaseAdmin
      .from('ListingMessage')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId);
    if (count != null) {
      await supabaseAdmin
        .from('Listing')
        .update({ message_count: count })
        .eq('id', listingId);
    }

    logger.info('marketplace.message', {
      listingId, buyerId, hasOffer: offerAmount != null,
    });

    res.status(201).json({ message: 'Interest sent successfully', inquiry: msg });
  } catch (err) {
    logger.error('marketplace.message.error', { error: err.message });
    res.status(500).json({ error: 'Failed to send message' });
  }
});


/**
 * GET /api/listings/:id/messages
 * Get messages/offers on a listing (seller only)
 */
router.get('/:id/messages', verifyToken, async (req, res) => {
  try {
    const { id: listingId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const { data: listing } = await supabaseAdmin.from('Listing').select('user_id').eq('id', listingId).single();
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.user_id !== userId) return res.status(403).json({ error: 'Only the seller can view messages' });

    const { data: messages, error } = await supabaseAdmin
      .from('ListingMessage')
      .select(`*, buyer:buyer_id (${SAFE_CREATOR_SELECT})`)
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching listing messages', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    res.json({ messages: (messages || []).map(serializeListingMessageForViewer) });
  } catch (err) {
    logger.error('Listing messages fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});


/**
 * POST /api/listings/:id/share-to-feed
 * Create a feed reference post for this listing
 */
router.post('/:id/share-to-feed', verifyToken, async (req, res) => {
  try {
    const { id: listingId } = req.params;
    const userId = req.user.id;

    const { data: listing } = await supabaseAdmin
      .from('Listing')
      .select('id, user_id, title, latitude, longitude, location_name, tags, status')
      .eq('id', listingId)
      .single();

    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.user_id !== userId) return res.status(403).json({ error: 'Only the seller can share their listing to feed' });
    if (listing.status !== 'active') return res.status(400).json({ error: 'Can only share active listings' });

    // Check if already shared
    const { data: existingPost } = await supabaseAdmin
      .from('Post')
      .select('id')
      .eq('ref_listing_id', listingId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingPost) {
      return res.status(400).json({ error: 'This listing has already been shared to feed' });
    }

    const { data: post, error } = await supabaseAdmin
      .from('Post')
      .insert({
        user_id: userId,
        content: `Check out my listing: ${listing.title}`,
        post_type: 'deal',
        visibility: 'neighborhood',
        visibility_scope: 'neighborhood',
        location_precision: 'neighborhood_only',
        ref_listing_id: listingId,
        latitude: listing.latitude || null,
        longitude: listing.longitude || null,
        location_name: listing.location_name || null,
        tags: listing.tags || [],
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Error sharing listing to feed', { error: error.message });
      return res.status(500).json({ error: 'Failed to share to feed' });
    }

    res.status(201).json({ message: 'Listing shared to feed', postId: post.id });
  } catch (err) {
    logger.error('Share to feed error', { error: err.message });
    res.status(500).json({ error: 'Failed to share to feed' });
  }
});


// ================================
// STRUCTURED Q&A FOR LISTINGS
// ================================

/**
 * GET /api/listings/:listingId/questions
 * List all questions for a listing (public).
 * Pinned first, then by upvote_count desc, then newest.
 */
router.get('/:listingId/questions', async (req, res) => {
  try {
    const { listingId } = req.params;
    const { data: listing } = await supabaseAdmin
      .from('Listing')
      .select(`
        id,
        user_id,
        owner:user_id (
          id,
          username,
          name,
          first_name,
          last_name,
          account_type
        )
      `)
      .eq('id', listingId)
      .maybeSingle();

    const { data: questions, error } = await supabaseAdmin
      .from('ListingQuestion')
      .select(`
        id, listing_id, question, answer, question_attachments, answer_attachments, answered_at, is_pinned, upvote_count, status, created_at, updated_at,
        asker:asked_by ( id, username, first_name, last_name, name, profile_picture_url ),
        answerer:answered_by ( id, username, name )
      `)
      .eq('listing_id', listingId)
      .order('is_pinned', { ascending: false })
      .order('upvote_count', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching listing questions', { error: error.message, listingId });
      return res.status(500).json({ error: 'Failed to fetch questions' });
    }

    const owner = listing?.owner || null;
    const ownerIsBusiness = owner?.account_type === 'business';
    const ownerDisplayName =
      owner?.name ||
      [owner?.first_name, owner?.last_name].filter(Boolean).join(' ') ||
      owner?.username ||
      'Seller';

    const normalized = (questions || []).map((q) => ({
      ...serializeListingQuestionForViewer(q),
      question_attachments: q.question_attachments || [],
      answer_attachments: q.answer_attachments || [],
      answerer_display_name: ownerIsBusiness && q.answer ? ownerDisplayName : null,
      answerer_display_id: ownerIsBusiness && q.answer ? owner?.id : null,
      answerer_display_username: ownerIsBusiness && q.answer ? owner?.username || null : null,
    }));

    res.json({ questions: normalized });
  } catch (err) {
    logger.error('Listing questions fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

/**
 * POST /api/listings/:listingId/questions
 * Ask a question on a listing.
 * Body: { question: string }
 */
router.post('/:listingId/questions', verifyToken, async (req, res) => {
  try {
    const { listingId } = req.params;
    const userId = req.user.id;
    const { question, attachments } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length < 5) {
      return res.status(400).json({ error: 'Question must be at least 5 characters' });
    }
    if (question.length > 1000) {
      return res.status(400).json({ error: 'Question must be under 1000 characters' });
    }
    const normalizedAttachments = Array.isArray(attachments)
      ? attachments.filter((url) => typeof url === 'string' && url.trim()).slice(0, 10)
      : [];

    // Verify listing exists
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('Listing')
      .select('id, user_id, title, status')
      .eq('id', listingId)
      .single();

    if (listingErr || !listing) return res.status(404).json({ error: 'Listing not found' });

    // Rate limit: max 5 questions per user per listing
    const { count } = await supabaseAdmin
      .from('ListingQuestion')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .eq('asked_by', userId);

    if ((count || 0) >= 5) {
      return res.status(429).json({ error: 'You can ask up to 5 questions per listing' });
    }

    const { data: q, error: insertErr } = await supabaseAdmin
      .from('ListingQuestion')
      .insert({
        listing_id: listingId,
        asked_by: userId,
        question: question.trim(),
        question_attachments: normalizedAttachments,
      })
      .select(`
        id, listing_id, question, answer, question_attachments, answer_attachments, answered_at, is_pinned, upvote_count, status, created_at, updated_at,
        asker:asked_by ( id, username, first_name, last_name, name, profile_picture_url )
      `)
      .single();

    if (insertErr) {
      logger.error('Error creating listing question', { error: insertErr.message });
      return res.status(500).json({ error: 'Failed to post question' });
    }

    // Notify listing seller
    if (String(listing.user_id) !== String(userId)) {
      const { data: asker } = await supabaseAdmin
        .from('User')
        .select('name, username')
        .eq('id', userId)
        .single();
      const askerName = asker?.name || asker?.username || 'Someone';

      createNotification({
        userId: listing.user_id,
        type: 'listing_question',
        title: `New question on "${listing.title || 'your listing'}"`,
        body: `${askerName} asked: "${question.trim().slice(0, 80)}${question.length > 80 ? '…' : ''}"`,
        icon: '❓',
        link: `/listings/${listingId}`,
        metadata: { listing_id: listingId, question_id: q?.id },
      });
    }

    res.status(201).json({ question: serializeListingQuestionForViewer(q) });
  } catch (err) {
    logger.error('Listing question create error', { error: err.message });
    res.status(500).json({ error: 'Failed to post question' });
  }
});

/**
 * POST /api/listings/:listingId/questions/:questionId/answer
 * Answer a question (seller only).
 * Body: { answer: string }
 */
router.post('/:listingId/questions/:questionId/answer', verifyToken, async (req, res) => {
  try {
    const { listingId, questionId } = req.params;
    const userId = req.user.id;
    const { answer, attachments } = req.body;

    if (!answer || typeof answer !== 'string' || answer.trim().length < 1) {
      return res.status(400).json({ error: 'Answer is required' });
    }
    if (answer.length > 2000) {
      return res.status(400).json({ error: 'Answer must be under 2000 characters' });
    }
    const normalizedAttachments = Array.isArray(attachments)
      ? attachments.filter((url) => typeof url === 'string' && url.trim()).slice(0, 10)
      : [];

    // Verify seller
    const { data: listing } = await supabaseAdmin
      .from('Listing')
      .select('id, user_id, title, owner:user_id(id, username, name, first_name, last_name, account_type)')
      .eq('id', listingId)
      .single();

    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (String(listing.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Only the seller can answer questions' });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error } = await supabaseAdmin
      .from('ListingQuestion')
      .update({
        answer: answer.trim(),
        answered_by: userId,
        answer_attachments: normalizedAttachments,
        answered_at: nowIso,
        status: 'answered',
        updated_at: nowIso,
      })
      .eq('id', questionId)
      .eq('listing_id', listingId)
      .select(`
        id, listing_id, question, answer, question_attachments, answer_attachments, answered_at, is_pinned, upvote_count, status, created_at, updated_at,
        asker:asked_by ( id, username, name ),
        answerer:answered_by ( id, username, name )
      `)
      .single();

    if (error) {
      logger.error('Error answering listing question', { error: error.message });
      return res.status(500).json({ error: 'Failed to answer question' });
    }

    // Notify the asker
    if (updated?.asker && String(updated.asker.id) !== String(userId)) {
      createNotification({
        userId: updated.asker.id,
        type: 'listing_question_answered',
        title: `Your question was answered`,
        body: `The seller answered your question on "${listing.title || 'a listing'}": "${answer.trim().slice(0, 80)}${answer.length > 80 ? '…' : ''}"`,
        icon: '✅',
        link: `/listings/${listingId}`,
        metadata: { listing_id: listingId, question_id: questionId },
      });
    }

    const owner = listing.owner || null;
    const ownerIsBusiness = owner?.account_type === 'business';
    const ownerDisplayName =
      owner?.name ||
      [owner?.first_name, owner?.last_name].filter(Boolean).join(' ') ||
      owner?.username ||
      'Seller';

    res.json({
      question: {
        ...serializeListingQuestionForViewer(updated),
        answerer_display_name: ownerIsBusiness ? ownerDisplayName : null,
        answerer_display_id: ownerIsBusiness ? owner?.id : null,
        answerer_display_username: ownerIsBusiness ? owner?.username || null : null,
      }
    });
  } catch (err) {
    logger.error('Answer listing question error', { error: err.message });
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

/**
 * POST /api/listings/:listingId/questions/:questionId/pin
 * Toggle pin on a question (seller only).
 */
router.post('/:listingId/questions/:questionId/pin', verifyToken, async (req, res) => {
  try {
    const { listingId, questionId } = req.params;
    const userId = req.user.id;

    const { data: listing } = await supabaseAdmin
      .from('Listing')
      .select('id, user_id')
      .eq('id', listingId)
      .single();

    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (String(listing.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Only the seller can pin questions' });
    }

    const { data: q } = await supabaseAdmin
      .from('ListingQuestion')
      .select('id, is_pinned')
      .eq('id', questionId)
      .eq('listing_id', listingId)
      .single();

    if (!q) return res.status(404).json({ error: 'Question not found' });

    const { data: updated, error } = await supabaseAdmin
      .from('ListingQuestion')
      .update({ is_pinned: !q.is_pinned, updated_at: new Date().toISOString() })
      .eq('id', questionId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to toggle pin' });
    }

    res.json({ question: updated });
  } catch (err) {
    logger.error('Pin listing question error', { error: err.message });
    res.status(500).json({ error: 'Failed to toggle pin' });
  }
});

/**
 * POST /api/listings/:listingId/questions/:questionId/upvote
 * Toggle upvote on a question.
 */
router.post('/:listingId/questions/:questionId/upvote', verifyToken, async (req, res) => {
  try {
    const { listingId, questionId } = req.params;
    const userId = req.user.id;

    // Check if already upvoted
    const { data: existing } = await supabaseAdmin
      .from('ListingQuestionUpvote')
      .select('id')
      .eq('question_id', questionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Remove upvote
      await supabaseAdmin
        .from('ListingQuestionUpvote')
        .delete()
        .eq('id', existing.id);

      // Recount actual upvotes (race-safe: always reflects true state)
      const { count: upvoteCount } = await supabaseAdmin
        .from('ListingQuestionUpvote')
        .select('id', { count: 'exact', head: true })
        .eq('question_id', questionId);

      await supabaseAdmin
        .from('ListingQuestion')
        .update({ upvote_count: upvoteCount || 0 })
        .eq('id', questionId);

      return res.json({ upvoted: false });
    } else {
      // Add upvote
      const { error: insertErr } = await supabaseAdmin
        .from('ListingQuestionUpvote')
        .insert({ question_id: questionId, user_id: userId });

      if (insertErr) {
        logger.error('Listing upvote insert error', { error: insertErr.message });
        return res.status(500).json({ error: 'Failed to upvote' });
      }

      // Recount actual upvotes (race-safe: always reflects true state)
      const { count: upvoteCount } = await supabaseAdmin
        .from('ListingQuestionUpvote')
        .select('id', { count: 'exact', head: true })
        .eq('question_id', questionId);

      await supabaseAdmin
        .from('ListingQuestion')
        .update({ upvote_count: upvoteCount || 0 })
        .eq('id', questionId);

      return res.json({ upvoted: true });
    }
  } catch (err) {
    logger.error('Listing upvote toggle error', { error: err.message });
    res.status(500).json({ error: 'Failed to toggle upvote' });
  }
});

/**
 * DELETE /api/listings/:listingId/questions/:questionId
 * Delete own question (or seller can delete any).
 */
router.delete('/:listingId/questions/:questionId', verifyToken, async (req, res) => {
  try {
    const { listingId, questionId } = req.params;
    const userId = req.user.id;

    const { data: q } = await supabaseAdmin
      .from('ListingQuestion')
      .select('id, asked_by')
      .eq('id', questionId)
      .eq('listing_id', listingId)
      .single();

    if (!q) return res.status(404).json({ error: 'Question not found' });

    const { data: listing } = await supabaseAdmin
      .from('Listing')
      .select('user_id')
      .eq('id', listingId)
      .single();

    const isAsker = String(q.asked_by) === String(userId);
    const isSeller = listing && String(listing.user_id) === String(userId);

    if (!isAsker && !isSeller) {
      return res.status(403).json({ error: 'Only the question author or seller can delete' });
    }

    await supabaseAdmin
      .from('ListingQuestion')
      .delete()
      .eq('id', questionId);

    res.json({ deleted: true });
  } catch (err) {
    logger.error('Delete listing question error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete question' });
  }
});


// ============================================================
//  ADDRESS REVEAL (Progressive Location Disclosure)
// ============================================================

/**
 * POST /api/listings/:id/reveal-address
 * Listing author reveals exact address to a specific buyer.
 * Body: { userId: string }
 */
router.post('/:id/reveal-address', verifyToken, async (req, res) => {
  try {
    const listingId = req.params.id;
    const authorId = req.user.id;
    const { userId: granteeUserId } = req.body;

    if (!granteeUserId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (String(granteeUserId) === String(authorId)) {
      return res.status(400).json({ error: 'Cannot reveal address to yourself' });
    }

    // Verify listing exists and requester is the author
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('Listing')
      .select('id, user_id, title, location_address, exact_address')
      .eq('id', listingId)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (String(listing.user_id) !== String(authorId)) {
      return res.status(403).json({ error: 'Only the listing author can reveal the address' });
    }

    const { data: existingGrant, error: existingGrantErr } = await supabaseAdmin
      .from('ListingAddressGrant')
      .select('id')
      .eq('listing_id', listingId)
      .eq('grantee_user_id', granteeUserId)
      .maybeSingle();

    if (existingGrantErr) {
      logger.error('Error checking existing address grant', {
        error: existingGrantErr.message,
        listingId,
        granteeUserId,
      });
      return res.status(500).json({ error: 'Failed to reveal address' });
    }

    let grantCreated = false;
    if (!existingGrant) {
      const { error: grantErr } = await supabaseAdmin
        .from('ListingAddressGrant')
        .insert({
          listing_id: listingId,
          grantee_user_id: granteeUserId,
          granted_by: authorId,
        });

      if (grantErr) {
        const isDuplicateGrant =
          grantErr.code === '23505' ||
          /duplicate key|unique constraint/i.test(String(grantErr.message || ''));

        if (!isDuplicateGrant) {
          logger.error('Error creating address grant', { error: grantErr.message, listingId, granteeUserId });
          return res.status(500).json({ error: 'Failed to reveal address' });
        }
      } else {
        grantCreated = true;
      }
    }

    if (grantCreated) {
      // Send system message in the listing-topic chat thread (or first shared room as fallback)
      try {
        const address = listing.location_address || listing.exact_address || 'the exact address';
        const u1 = authorId < granteeUserId ? authorId : granteeUserId;
        const u2 = authorId < granteeUserId ? granteeUserId : authorId;

        // Prefer the listing topic so the message appears in the right thread
        const { data: topic } = await supabaseAdmin
          .from('ConversationTopic')
          .select('id')
          .eq('conversation_user_id_1', u1)
          .eq('conversation_user_id_2', u2)
          .eq('topic_type', 'listing')
          .eq('topic_ref_id', listingId)
          .eq('status', 'active')
          .maybeSingle();

        let sharedRoomId = null;
        const { data: granteeRooms } = await supabaseAdmin
          .from('ChatParticipant')
          .select('room_id')
          .eq('user_id', granteeUserId);
        if (granteeRooms && granteeRooms.length > 0) {
          const roomIds = granteeRooms.map(r => r.room_id);
          const { data: authorRooms } = await supabaseAdmin
            .from('ChatParticipant')
            .select('room_id')
            .eq('user_id', authorId)
            .in('room_id', roomIds);
          if (authorRooms && authorRooms.length > 0) sharedRoomId = authorRooms[0].room_id;
        }

        if (sharedRoomId) {
          await supabaseAdmin.from('ChatMessage').insert({
            room_id: sharedRoomId,
            user_id: authorId,
            type: 'system',
            message: `Seller shared their pickup address: ${address}`,
            topic_id: topic?.id || null,
          });
        }
      } catch (chatErr) {
        // Non-blocking — address is still revealed even if chat message fails
        logger.warn('Failed to post address reveal chat message', { error: chatErr.message });
      }

      notifyAddressRevealed({
        granteeUserId,
        listingId,
        listingTitle: listing.title,
      }).catch(err => logger.warn('Address reveal notification failed', { error: err.message }));
    }

    logger.info('Address revealed', { listingId, authorId, granteeUserId, grantCreated });
    res.json({
      success: true,
      message: grantCreated ? 'Address revealed to buyer' : 'Address was already available to buyer',
    });
  } catch (err) {
    logger.error('Reveal address error', { error: err.message });
    res.status(500).json({ error: 'Failed to reveal address' });
  }
});


/**
 * GET /api/listings/:id/address-grants
 * Listing author fetches list of buyers they've revealed address to.
 */
router.get('/:id/address-grants', verifyToken, async (req, res) => {
  try {
    const listingId = req.params.id;
    const userId = req.user.id;

    // Verify listing ownership
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('Listing')
      .select('id, user_id')
      .eq('id', listingId)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (String(listing.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Only the listing author can view address grants' });
    }

    const { data: grants, error: grantsErr } = await supabaseAdmin
      .from('ListingAddressGrant')
      .select(`
        id, grantee_user_id, granted_at,
        grantee:grantee_user_id (id, username, name, profile_picture_url)
      `)
      .eq('listing_id', listingId)
      .order('granted_at', { ascending: false });

    if (grantsErr) {
      logger.error('Error fetching address grants', { error: grantsErr.message, listingId });
      return res.status(500).json({ error: 'Failed to fetch address grants' });
    }

    res.json({ grants: grants || [] });
  } catch (err) {
    logger.error('Fetch address grants error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch address grants' });
  }
});


/**
 * DELETE /api/listings/:id/address-grants/:userId
 * Listing author revokes address access for a specific buyer.
 */
router.delete('/:id/address-grants/:userId', verifyToken, async (req, res) => {
  try {
    const listingId = req.params.id;
    const granteeUserId = req.params.userId;
    const authorId = req.user.id;

    // Verify listing ownership
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('Listing')
      .select('id, user_id')
      .eq('id', listingId)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (String(listing.user_id) !== String(authorId)) {
      return res.status(403).json({ error: 'Only the listing author can revoke address grants' });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('ListingAddressGrant')
      .delete()
      .eq('listing_id', listingId)
      .eq('grantee_user_id', granteeUserId);

    if (deleteErr) {
      logger.error('Error revoking address grant', { error: deleteErr.message, listingId, granteeUserId });
      return res.status(500).json({ error: 'Failed to revoke address access' });
    }

    logger.info('Address grant revoked', { listingId, authorId, granteeUserId });
    res.json({ success: true, message: 'Address access revoked' });
  } catch (err) {
    logger.error('Revoke address grant error', { error: err.message });
    res.status(500).json({ error: 'Failed to revoke address access' });
  }
});


module.exports = router;
