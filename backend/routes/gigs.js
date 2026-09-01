const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const {
  createNotification,
  createBulkNotifications,
  notifyBidReceived,
  notifyBidAccepted,
} = require('../services/notificationService');
const {
  hasPermission,
  getBusinessIdsWithPermissions,
  getTeamMembersWithPermissions,
} = require('../utils/businessPermissions');
const { GIG_LIST } = require('../utils/columns');
const {
  careDetailsSchema,
  logisticsDetailsSchema,
  remoteDetailsSchema,
  urgentDetailsSchema,
  eventDetailsSchema,
} = require('../utils/moduleSchemas');
const stripeService = require('../stripe/stripeService');
const { PAYMENT_STATES, getPaymentStateInfo } = require('../stripe/paymentStateMachine');
const browseCache = require('../services/gig/browseCacheService');
const affinityService = require('../services/gig/affinityService');
const rankingService = require('../services/gig/rankingService');
const optionalAuth = require('../middleware/optionalAuth');
const gigPricingService = require('../services/gig/gigPricingService');
const { alertMatchingSavedSearches } = require('../services/savedSearchAlertService');
const { haversineMiles } = require('../utils/geo');
const {
  serializeGigAuthorForViewer,
  serializeUserAsLocalIdentity,
  serializeUserIdentityForViewer,
} = require('../serializers/identitySerializers');

// ============ HELPERS ============

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)(\?.*)?$/i;
const unavailableGigFeatureTables = new Set();
const GIG_START_REMINDER_TYPE = 'gig_start_reminder';
const GIG_START_REMINDER_COOLDOWN_MS = 15 * 60 * 1000;
const METERS_PER_MILE = 1609.34;
const DEFAULT_BROWSE_RADIUS_MILES = 100;
const MAX_BROWSE_RADIUS_MILES = 25000;
const DEFAULT_BROWSE_RADIUS_METERS = Math.round(DEFAULT_BROWSE_RADIUS_MILES * METERS_PER_MILE);
const MIN_BROWSE_RADIUS_METERS = 500;
const MAX_BROWSE_RADIUS_METERS = Math.round(MAX_BROWSE_RADIUS_MILES * METERS_PER_MILE);

/**
 * Extract the first image URL from an attachments array.
 * Returns a single URL string or null.
 */
function extractFirstImage(attachments) {
  if (!Array.isArray(attachments)) return null;
  for (const url of attachments) {
    if (typeof url === 'string' && IMAGE_EXT_RE.test(url)) return url;
  }
  return null;
}

function isMissingTableError(error, tableName) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === 'PGRST205' ||
    message.includes(`relation "${String(tableName).toLowerCase()}" does not exist`) ||
    message.includes('could not find the table')
  );
}

function logMissingGigFeatureTableOnce(tableName, feature) {
  const key = `${tableName}:${feature}`;
  if (unavailableGigFeatureTables.has(key)) return;
  unavailableGigFeatureTables.add(key);

  logger.warn('Gig feature table unavailable; database migration likely not applied', {
    tableName,
    feature,
  });
}

/**
 * Try to extract userId from an optional Authorization header.
 * Returns userId string or null. Never throws, never blocks on failure.
 */
async function extractOptionalUserId(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const supabaseClient = require('../config/supabase');
    const { data } = await supabaseClient.auth.getUser(token);
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Fetch a user's dismissed gig IDs and hidden categories.
 * Returns { dismissedGigIds: Set<string>, hiddenCategories: Set<string> }.
 */
async function getUserExclusions(userId) {
  if (!userId) return { dismissedGigIds: new Set(), hiddenCategories: new Set() };

  const [dismissedResult, hiddenResult] = await Promise.all([
    supabaseAdmin.from('dismissed_gigs').select('gig_id').eq('user_id', userId),
    supabaseAdmin.from('user_hidden_categories').select('category').eq('user_id', userId),
  ]);

  const dismissedGigIds = new Set((dismissedResult.data || []).map((r) => String(r.gig_id)));
  const hiddenCategories = new Set((hiddenResult.data || []).map((r) => r.category));

  return { dismissedGigIds, hiddenCategories };
}

/**
 * Filter an array of gigs, removing dismissed and hidden-category items.
 */
function applyUserExclusions(gigs, exclusions) {
  const { dismissedGigIds, hiddenCategories } = exclusions;
  if (dismissedGigIds.size === 0 && hiddenCategories.size === 0) return gigs;
  return gigs.filter((g) => {
    if (dismissedGigIds.has(String(g.id))) return false;
    if (g.category && hiddenCategories.has(g.category)) return false;
    return true;
  });
}

function excludeUserOwnedGigs(gigs, userId) {
  if (!userId) return gigs;
  return gigs.filter((gig) => String(gig?.user_id || '') !== String(userId));
}

function summarizeGigBids(bids) {
  const byGigId = {};

  for (const bid of bids || []) {
    const gigId = String(bid?.gig_id || '');
    if (!gigId) continue;

    if (!byGigId[gigId]) {
      byGigId[gigId] = {
        bid_count: 0,
        top_bid_amount: null,
      };
    }

    byGigId[gigId].bid_count += 1;

    const amount = Number(bid?.bid_amount);
    if (Number.isFinite(amount)) {
      byGigId[gigId].top_bid_amount =
        byGigId[gigId].top_bid_amount == null
          ? amount
          : Math.max(byGigId[gigId].top_bid_amount, amount);
    }
  }

  return byGigId;
}

// ─── Bidder-stack helpers (T5.3.2 My tasks V2) ────────────────────────
//
// The My tasks V2 row design renders a 3-avatar "bidder stack" with a
// `+N` overflow tile next to the status chip. To avoid an N+1 fetch
// from the client, the `/api/gigs/my-gigs` handler inlines the top-3
// bidders per gig as a `top_bidders[≤3]: {id, initials, color}` array
// derived from the GigBid → User join. Initials and tone are computed
// server-side so iOS, Android, and web all render identical avatars
// without each platform reinventing the derivation.

const BIDDER_TONES = ['sky', 'teal', 'amber', 'rose', 'violet', 'slate'];

function bidderInitialsFromUser(user) {
  if (!user) return '?';
  const first = (user.first_name || '').trim();
  const last = (user.last_name || '').trim();
  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  const name = (user.name || '').trim();
  if (name) {
    const parts = name.split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  const username = (user.username || '').trim();
  if (username) {
    return username.slice(0, 2).toUpperCase();
  }
  return '?';
}

function bidderToneFromId(userId) {
  if (!userId) return BIDDER_TONES[0];
  const raw = String(userId);
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % BIDDER_TONES.length;
  return BIDDER_TONES[idx];
}

/**
 * Fetch up to 3 most-recent unique bidders per gig and return them in
 * `{ gigId: [{ id, initials, color }] }` shape. Sequencing the user
 * join inside this helper keeps the my-gigs handler to a single extra
 * round-trip regardless of list size.
 */
async function topBiddersByGig(gigIds) {
  if (!Array.isArray(gigIds) || gigIds.length === 0) return {};

  // Pull every bid for these gigs (typically <10s per task; capped by
  // the bid limit on the backend). We need `created_at` to order
  // before truncating to 3 per gig.
  const { data: bidRows, error: bidsError } = await supabaseAdmin
    .from('GigBid')
    .select('gig_id, user_id, created_at, User:user_id(id, first_name, last_name, name, username)')
    .in('gig_id', gigIds)
    .order('created_at', { ascending: false });

  if (bidsError) {
    logger.warn('Failed to load top bidders for my gigs', {
      error: bidsError.message,
      gigCount: gigIds.length,
    });
    return {};
  }

  const byGigId = {};
  for (const row of bidRows || []) {
    const gigId = String(row?.gig_id || '');
    if (!gigId) continue;
    if (!byGigId[gigId]) byGigId[gigId] = [];
    if (byGigId[gigId].length >= 3) continue;
    // De-dupe by user_id — a single bidder can re-bid via counters,
    // and the avatar stack should reflect distinct people.
    const userId = String(row?.user_id || '');
    if (!userId) continue;
    if (byGigId[gigId].some((b) => b.id === userId)) continue;
    const user = row.User || {};
    byGigId[gigId].push({
      id: userId,
      initials: bidderInitialsFromUser(user),
      color: bidderToneFromId(userId),
    });
  }
  return byGigId;
}

function serializeGigForViewer(gig) {
  if (!gig) return null;
  const { creator, acceptedBy, ...safe } = gig;
  return {
    ...safe,
    creator: creator
      ? serializeUserIdentityForViewer(creator)
      : serializeGigAuthorForViewer({
          identity_context_type: 'local',
          creator: {
            id: gig.user_id,
            username: gig.creator_username,
            name: gig.creator_name,
            profile_picture_url: gig.profile_picture_url,
          },
        }),
    acceptedBy: serializeUserAsLocalIdentity(acceptedBy),
  };
}

function serializeGigQuestionForViewer(question) {
  if (!question) return null;
  const { asker, answerer, ...safe } = question;
  return {
    ...safe,
    asker: serializeUserAsLocalIdentity(asker),
    answerer: serializeUserIdentityForViewer(answerer),
  };
}

function serializeGigBidForViewer(bid) {
  if (!bid) return null;
  const { bidder, ...safe } = bid;
  const bidderIdentity = serializeUserAsLocalIdentity(bidder);
  return {
    ...safe,
    bidder: bidderIdentity ? {
      ...bidderIdentity,
      average_rating: bidder?.average_rating ?? null,
      review_count: bidder?.review_count ?? null,
      reliability_score: bidder?.reliability_score ?? null,
      no_show_count: bidder?.no_show_count ?? null,
      gigs_completed: bidder?.gigs_completed ?? null,
    } : null,
  };
}

function normalizeArrayQueryParam(rawValue) {
  if (rawValue == null) return [];

  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  const normalized = [];

  for (const rawEntry of values) {
    if (rawEntry == null) continue;

    const entry = String(rawEntry).trim();
    if (!entry) continue;

    const unwrapped =
      entry.startsWith('[') && entry.endsWith(']') ? entry.slice(1, -1) : entry;
    const parts = unwrapped
      .split(',')
      .map((part) => part.trim().replace(/^['"]+|['"]+$/g, ''))
      .filter(Boolean);

    if (parts.length > 0) {
      normalized.push(...parts);
    } else {
      normalized.push(unwrapped.replace(/^['"]+|['"]+$/g, '').trim());
    }
  }

  return normalized.filter(Boolean);
}

function parseBooleanQuery(value, defaultValue = true) {
  if (value == null) return defaultValue;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return defaultValue;
}

function resolvePublicStatusFilter(query, defaultStatus = 'open') {
  const rawStatus = query.status ?? query['status[]'];
  const normalized = normalizeArrayQueryParam(rawStatus);
  const uniqueStatuses = Array.from(new Set(normalized));

  if (uniqueStatuses.length === 0) {
    return { status: defaultStatus, error: null };
  }

  if (uniqueStatuses.length > 1) {
    return {
      status: null,
      error: 'Public browse currently supports only one status at a time',
    };
  }

  return { status: uniqueStatuses[0], error: null };
}

function resolveBrowseRadiusMeters(maxDistanceRaw, radiusMilesRaw) {
  const rawMaxDistance = parseInt(maxDistanceRaw, 10);
  if (Number.isFinite(rawMaxDistance) && rawMaxDistance > 0) {
    return Math.min(rawMaxDistance, MAX_BROWSE_RADIUS_METERS);
  }

  const rawRadius = parseFloat(radiusMilesRaw);
  const miles = Number.isFinite(rawRadius)
    ? Math.max(1, Math.min(MAX_BROWSE_RADIUS_MILES, rawRadius))
    : DEFAULT_BROWSE_RADIUS_MILES;
  return Math.round(miles * METERS_PER_MILE);
}

async function getViewerSavedGigIds(userId, gigIds) {
  if (!userId || !Array.isArray(gigIds) || gigIds.length === 0) return new Set();

  const normalizedGigIds = Array.from(
    new Set(gigIds.map((gigId) => String(gigId)).filter(Boolean))
  );

  if (normalizedGigIds.length === 0) return new Set();

  const { data, error } = await supabaseAdmin
    .from('GigSave')
    .select('gig_id')
    .eq('user_id', userId)
    .in('gig_id', normalizedGigIds);

  if (error) {
    if (isMissingTableError(error, 'GigSave')) {
      logMissingGigFeatureTableOnce('GigSave', 'viewer_has_saved');
      return new Set();
    }
    logger.warn('Failed to load saved gig ids', {
      userId,
      gigCount: normalizedGigIds.length,
      error: error.message,
    });
    return new Set();
  }

  return new Set((data || []).map((row) => String(row.gig_id)));
}

// ============ GIG REAL-TIME HELPER ============

/**
 * Emit a real-time event to all clients viewing a gig detail page.
 * Payload is lightweight — clients refetch what they need.
 */
function emitGigUpdate(req, gigId, eventType) {
  const io = req.app.get('io');
  if (!io) return;
  io.to(`gig:${gigId}`).emit(`gig:${eventType}`, {
    gigId,
    eventType,
    timestamp: Date.now(),
  });
}

// ============ VALIDATION SCHEMAS ============

const createGigSchema = Joi.object({
  title: Joi.string().min(5).max(255).required(),
  description: Joi.string().min(10).required(),
  price: Joi.number().min(0).required(),
  category: Joi.string().max(100).optional(),
  deadline: Joi.date().iso().min('now').optional(),
  estimated_duration: Joi.number().positive().optional(), // hours
  attachments: Joi.array().items(Joi.string().uri()).max(10).optional(),

  // Proxy posting: post a gig on behalf of a business account
  beneficiary_user_id: Joi.string().uuid().allow(null).optional(),

  // Cancellation policy: flexible (free cancel), standard (grace window), strict (fee after accept)
  cancellation_policy: Joi.string()
    .valid('flexible', 'standard', 'strict')
    .default('standard')
    .optional(),

  // Scheduled start time (used for grace window calculations)
  scheduled_start: Joi.date().iso().optional(),

  // Tasks surface: new fields
  location_precision: Joi.string()
    .valid('exact_place', 'approx_area', 'neighborhood_only', 'none')
    .default('approx_area')
    .optional(),
  reveal_policy: Joi.string()
    .valid('public', 'after_interest', 'after_assignment', 'never_public')
    .default('after_assignment')
    .optional(),
  visibility_scope: Joi.string()
    .valid('neighborhood', 'city', 'radius', 'global')
    .default('city')
    .optional(),
  radius_miles: Joi.number().min(1).max(25000).default(100).optional(),
  is_urgent: Joi.boolean().default(false).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(5).optional(),
  ref_listing_id: Joi.string().uuid().allow(null).optional(),

  // Magic Task fields (accepted on classic create too for consistency)
  schedule_type: Joi.string().valid('asap', 'today', 'scheduled', 'flexible').optional(),
  pay_type: Joi.string().valid('fixed', 'hourly', 'offers').optional(),
  time_window_start: Joi.date().iso().allow(null).optional(),
  time_window_end: Joi.date().iso().allow(null).optional(),
  source_flow: Joi.string().valid('magic', 'classic', 'template', 'context_shortcut').optional(),
  engagement_mode: Joi.string().valid('instant_accept', 'curated_offers', 'quotes').optional(),
  // T6.0b — helper-engagement format (orthogonal to engagement_mode).
  task_format: Joi.string().valid('in_person', 'drop_off', 'remote', 'hybrid').optional(),
  special_instructions: Joi.string().max(2000).allow('', null).optional(),
  access_notes: Joi.string().max(1000).allow('', null).optional(),
  required_tools: Joi.array().items(Joi.string().max(100)).max(10).optional(),
  language_preference: Joi.string().max(50).allow('', null).optional(),
  preferred_helper_id: Joi.string().uuid().allow(null).optional(),

  // Delivery module fields
  pickup_address: Joi.string().max(500).allow('', null).optional(),
  pickup_notes: Joi.string().max(1000).allow('', null).optional(),
  dropoff_address: Joi.string().max(500).allow('', null).optional(),
  dropoff_notes: Joi.string().max(1000).allow('', null).optional(),
  delivery_proof_required: Joi.boolean().optional(),

  // Task items for errand/pickup tasks
  items: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    notes: Joi.string().allow('', null).optional(),
    budgetCap: Joi.alternatives().try(Joi.number(), Joi.string()).allow('', null).optional(),
    preferredStore: Joi.string().allow('', null).optional(),
  })).max(20).optional(),

  // Source link for conversions
  source_type: Joi.string().valid('listing', 'post', 'event').allow(null).optional(),
  source_id: Joi.string().uuid().allow(null).optional(),

  // Pro services module fields
  requires_license: Joi.boolean().optional(),
  license_type: Joi.string().max(200).allow('', null).optional(),
  requires_insurance: Joi.boolean().optional(),
  deposit_required: Joi.boolean().optional(),
  deposit_amount: Joi.number().min(0).allow(null).optional(),
  scope_description: Joi.string().max(5000).allow('', null).optional(),

  // Task archetype + module fields
  task_archetype: Joi.string().valid(
    'quick_help', 'delivery_errand', 'home_service', 'pro_service_quote',
    'care_task', 'event_shift', 'remote_task', 'recurring_service', 'general'
  ).optional(),
  starts_asap: Joi.boolean().optional(),
  response_window_minutes: Joi.number().integer().min(5).max(120).optional(),
  care_details: careDetailsSchema,
  logistics_details: logisticsDetailsSchema,
  remote_details: remoteDetailsSchema,
  urgent_details: urgentDetailsSchema,
  event_details: eventDetailsSchema,

  // For MVP we require an exact-ish location so the map can work.
  // Home posting is supported via origin_home_id.
  location: Joi.object({
    mode: Joi.string().valid('home', 'address', 'current', 'custom').required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),

    // Human-readable address bits (required for 'home'/'address'/'current')
    address: Joi.string().min(3).max(500).required(),
    city: Joi.string().allow('', null).optional(),
    state: Joi.string().allow('', null).optional(),
    zip: Joi.string().allow('', null).optional(),

    homeId: Joi.string().uuid().allow(null).optional(),
    place_id: Joi.string().allow('', null).optional(),
    geocode_provider: Joi.string().max(50).allow('', null).optional(),
    geocode_accuracy: Joi.string().max(50).allow('', null).optional(),
    geocode_place_id: Joi.string().max(255).allow('', null).optional(),
  }).required(),
});

// ============ CANCELLATION POLICY CONFIG ============
const CANCELLATION_POLICIES = {
  flexible: {
    label: 'Flexible',
    description: 'Free cancellation anytime before work starts.',
    grace_minutes_after_accept: null, // infinite grace
    fee_zone1_pct: 0, // no fee before start
    fee_zone2_pct: 0.1, // 10% after start
  },
  standard: {
    label: 'Standard',
    description: 'Free within 1 hour of acceptance. After that, 5% fee.',
    grace_minutes_after_accept: 60,
    fee_zone1_pct: 0.05, // 5% after grace
    fee_zone2_pct: 0.25, // 25% after start
  },
  strict: {
    label: 'Strict',
    description: '10% fee after acceptance. 50% after work starts.',
    grace_minutes_after_accept: 10,
    fee_zone1_pct: 0.1, // 10% after grace
    fee_zone2_pct: 0.5, // 50% after start
  },
};

/**
 * Compute cancellation zone, fee, and grace status for a gig.
 * Returns { zone, zone_label, fee, in_grace, fee_pct }
 */
function computeCancellationInfo(gig, cancellingUserId) {
  const policyKey = gig.cancellation_policy || 'standard';
  const policy = CANCELLATION_POLICIES[policyKey] || CANCELLATION_POLICIES.standard;
  const isPoster = String(gig.user_id) === String(cancellingUserId);
  const gigPrice = parseFloat(gig.price) || 0;

  // Zone 0: Before any bid accepted (gig is 'open')
  if (gig.status === 'open') {
    return {
      zone: 0,
      zone_label: 'Before acceptance',
      fee: 0,
      fee_pct: 0,
      in_grace: true,
    };
  }

  // Zone 2: After work started (gig is 'in_progress')
  if (gig.status === 'in_progress') {
    const fee = Math.round(gigPrice * policy.fee_zone2_pct * 100) / 100;
    return {
      zone: 2,
      zone_label: 'After work started',
      fee,
      fee_pct: policy.fee_zone2_pct * 100,
      in_grace: false,
    };
  }

  // Zone 1: After acceptance, before start (gig is 'assigned')
  if (gig.status === 'assigned') {
    // Check grace window
    const acceptedAt = gig.accepted_at ? new Date(gig.accepted_at) : null;
    const graceMins = policy.grace_minutes_after_accept;

    if (graceMins === null) {
      // Flexible: always in grace before start
      return {
        zone: 1,
        zone_label: 'After acceptance, before start',
        fee: 0,
        fee_pct: 0,
        in_grace: true,
      };
    }

    const inGrace = acceptedAt ? Date.now() - acceptedAt.getTime() < graceMins * 60 * 1000 : true;

    if (inGrace) {
      return {
        zone: 1,
        zone_label: 'After acceptance (within grace period)',
        fee: 0,
        fee_pct: 0,
        in_grace: true,
      };
    }

    const fee = Math.round(gigPrice * policy.fee_zone1_pct * 100) / 100;
    return {
      zone: 1,
      zone_label: 'After acceptance (grace period expired)',
      fee,
      fee_pct: policy.fee_zone1_pct * 100,
      in_grace: false,
    };
  }

  // Fallback
  return { zone: 0, zone_label: 'Unknown', fee: 0, fee_pct: 0, in_grace: true };
}

const updateGigSchema = Joi.object({
  title: Joi.string().min(5).max(255),
  description: Joi.string().min(10),
  price: Joi.number().min(0),
  category: Joi.string().max(100),
  deadline: Joi.date().iso().min('now'),
  estimated_duration: Joi.number().positive(),
  attachments: Joi.array().items(Joi.string().uri()).max(10),
  cancellation_policy: Joi.string().valid('flexible', 'standard', 'strict'),
  is_urgent: Joi.boolean(),
  tags: Joi.array().items(Joi.string().max(50)).max(5),
  items: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().allow('', null).optional(),
        notes: Joi.string().allow('', null).optional(),
        budgetCap: Joi.string().allow('', null).optional(),
        preferredStore: Joi.string().allow('', null).optional(),
      }).unknown(true)
    )
    .max(50),
  schedule_type: Joi.string().valid('asap', 'today', 'scheduled', 'flexible'),
  pay_type: Joi.string().valid('fixed', 'hourly', 'offers'),
  // P4 — V1 edit mode reschedules one-time gigs; mirrors createGigSchema.
  scheduled_start: Joi.date().iso().allow(null),
  time_window_start: Joi.date().iso().allow(null),
  time_window_end: Joi.date().iso().allow(null),
  special_instructions: Joi.string().max(2000).allow('', null),
  access_notes: Joi.string().max(1000).allow('', null),
  required_tools: Joi.array().items(Joi.string().max(100)).max(10),
  language_preference: Joi.string().max(50).allow('', null),
  preferred_helper_id: Joi.string().uuid().allow(null),
  location_precision: Joi.string().valid('exact_place', 'approx_area', 'neighborhood_only', 'none'),
  reveal_policy: Joi.string().valid('public', 'after_interest', 'after_assignment', 'never_public'),
  visibility_scope: Joi.string().valid('neighborhood', 'city', 'radius', 'global'),
  radius_miles: Joi.number().min(1).max(25000),
  location: Joi.object({
    mode: Joi.string().valid('home', 'address', 'current', 'custom').optional(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().allow('', null).optional(),
    city: Joi.string().allow('', null).optional(),
    state: Joi.string().allow('', null).optional(),
    zip: Joi.string().allow('', null).optional(),
    homeId: Joi.string().uuid().allow(null).optional(),
    place_id: Joi.string().allow('', null).optional(),
  }),
}).min(1); // At least one field required

const reportGigSchema = Joi.object({
  reason: Joi.string()
    .valid('spam', 'harassment', 'inappropriate', 'misinformation', 'safety', 'other')
    .required(),
  details: Joi.string().max(1000).optional(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid('open', 'assigned', 'in_progress', 'completed', 'cancelled')
    .required(),
});

// ============ HELPER FUNCTIONS ============

/**
 * Calculate approximate location for privacy (rounds to ~11km accuracy)
 */
const calculateApproxLocation = (latitude, longitude) => {
  return {
    latitude: Math.round(latitude * 10) / 10,
    longitude: Math.round(longitude * 10) / 10,
  };
};

/**
 * Format location for PostGIS GEOGRAPHY type
 */
const formatLocationForDB = (latitude, longitude) => {
  return `POINT(${longitude} ${latitude})`;
};

/**
 * Parse PostGIS point to coordinates.
 * Handles GeoJSON objects, WKT strings, and WKB hex strings (as returned by Supabase).
 */
const parsePostGISPoint = (point) => {
  if (!point) return null;
  // GeoJSON: { type: "Point", coordinates: [lng, lat] }
  if (typeof point === 'object' && point.coordinates) {
    return { longitude: point.coordinates[0], latitude: point.coordinates[1] };
  }
  const str = String(point);
  // WKT: POINT(longitude latitude)
  const wktMatch = str.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (wktMatch) {
    return { longitude: parseFloat(wktMatch[1]), latitude: parseFloat(wktMatch[2]) };
  }
  // WKB hex: Supabase returns geography/geometry columns as hex-encoded WKB.
  // A Point with SRID is 21 bytes = 42 hex chars; without SRID is 21 bytes = 42 hex chars.
  // With SRID flag: 01 01000020 E6100000 <16 hex lng> <16 hex lat> (total 50 hex chars)
  // Without SRID:   01 01000000 <16 hex lng> <16 hex lat> (total 42 hex chars)
  if (/^[0-9a-fA-F]+$/.test(str) && (str.length === 42 || str.length === 50)) {
    try {
      const buf = Buffer.from(str, 'hex');
      // byte 0: endianness (01 = little-endian, 00 = big-endian)
      const le = buf[0] === 1;
      // bytes 1-4: type (with possible SRID flag at bit 0x20000000)
      const wkbType = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
      const hasSRID = (wkbType & 0x20000000) !== 0;
      const geomType = wkbType & 0xFF;
      if (geomType !== 1) return null; // not a Point
      const coordOffset = hasSRID ? 9 : 5; // skip 4-byte SRID if present
      const lng = le ? buf.readDoubleLE(coordOffset) : buf.readDoubleBE(coordOffset);
      const lat = le ? buf.readDoubleLE(coordOffset + 8) : buf.readDoubleBE(coordOffset + 8);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        return { longitude: lng, latitude: lat };
      }
    } catch (_) {
      return null;
    }
  }
  return null;
};

/**
 * Check whether actor can operate as gig owner.
 * Supports direct owner access and business team delegation.
 */
async function getGigOwnerAccess(ownerUserId, actorUserId, permission = 'gigs.manage') {
  if (String(ownerUserId) === String(actorUserId)) {
    return { allowed: true, viaBusiness: false, ownerUserId };
  }

  const { data: owner } = await supabaseAdmin
    .from('User')
    .select('id, account_type')
    .eq('id', ownerUserId)
    .maybeSingle();

  if (!owner || owner.account_type !== 'business') {
    return { allowed: false, viaBusiness: false, ownerUserId };
  }

  let allowed = await hasPermission(ownerUserId, actorUserId, permission);
  // For gig ownership actions, allow posting teams to act when manage isn't explicitly granted.
  if (!allowed && permission === 'gigs.manage') {
    allowed = await hasPermission(ownerUserId, actorUserId, 'gigs.post');
  }

  return { allowed, viaBusiness: allowed, ownerUserId };
}

/**
 * Resolve which user IDs should receive gig-owner notifications.
 * For business-owned gigs, include active team members who can manage/post gigs.
 */
async function getGigOwnerNotificationRecipients(ownerUserId, excludeUserId = null) {
  const recipients = new Set([String(ownerUserId)]);

  const { data: owner } = await supabaseAdmin
    .from('User')
    .select('id, account_type')
    .eq('id', ownerUserId)
    .maybeSingle();

  if (owner?.account_type === 'business') {
    const memberIds = await getTeamMembersWithPermissions(
      ownerUserId,
      ['gigs.manage', 'gigs.post'],
      excludeUserId
    );
    for (const uid of memberIds) recipients.add(uid);
  }

  if (excludeUserId) recipients.delete(String(excludeUserId));
  return Array.from(recipients);
}

// ============ ROUTES ============
// IMPORTANT: Static routes MUST come before param routes like "/:id"

// -------------------- CANCELLATION POLICIES (static) --------------------

/**
 * GET /api/gigs/cancellation-policies
 * Returns available cancellation policy options for the gig creation form.
 */
router.get('/cancellation-policies', (req, res) => {
  const policies = Object.entries(CANCELLATION_POLICIES).map(([key, val]) => ({
    value: key,
    label: val.label,
    description: val.description,
  }));
  res.json({ policies });
});

// -------------------- CREATE --------------------

/**
 * POST /api/gigs
 * Create a new gig
 */
router.post('/', verifyToken, validate(createGigSchema), async (req, res) => {
  const {
    title,
    description,
    price,
    category,
    deadline,
    estimated_duration,
    attachments,
    location,
    beneficiary_user_id,
    cancellation_policy,
    scheduled_start,
    location_precision,
    reveal_policy,
    visibility_scope,
    radius_miles,
    is_urgent,
    tags,
    ref_listing_id,
    items,
    source_type,
    source_id,
    schedule_type,
    pay_type,
    time_window_start,
    time_window_end,
    source_flow,
    engagement_mode,
    task_format,
    special_instructions,
    access_notes,
    required_tools,
    language_preference,
    preferred_helper_id,
    pickup_address,
    pickup_notes,
    dropoff_address,
    dropoff_notes,
    delivery_proof_required,
    requires_license,
    license_type,
    requires_insurance,
    deposit_required,
    deposit_amount,
    scope_description,
    task_archetype,
    starts_asap,
    response_window_minutes,
    care_details,
    logistics_details,
    remote_details,
    urgent_details,
    event_details,
  } = req.body;
  const userId = req.user.id;

  logger.info('Creating gig', { userId, title, beneficiary_user_id });

  try {
    // ─── Proxy posting (post as business) ───
    let effectiveUserId = userId; // who the gig belongs to
    let createdBy = userId; // who actually created it

    if (beneficiary_user_id && beneficiary_user_id !== userId) {
      // Verify beneficiary is a business and user has gigs.post permission
      const { data: beneficiary } = await supabaseAdmin
        .from('User')
        .select('id, account_type')
        .eq('id', beneficiary_user_id)
        .single();

      if (!beneficiary || beneficiary.account_type !== 'business') {
        return res.status(400).json({ error: 'Beneficiary must be a business account' });
      }

      // Check permission: user must be a team member with gigs.post
      const canPost = await hasPermission(beneficiary_user_id, userId, 'gigs.post');
      if (!canPost) {
        return res
          .status(403)
          .json({ error: 'You do not have permission to post gigs for this business' });
      }

      effectiveUserId = beneficiary_user_id;
    }

    const gigData = {
      title,
      description,
      price,
      category: category || null,
      deadline: deadline || null,
      estimated_duration: estimated_duration || null,
      attachments: attachments || [],
      user_id: effectiveUserId,
      created_by: createdBy,
      beneficiary_user_id: beneficiary_user_id || null,
      status: 'open',
      cancellation_policy: cancellation_policy || 'standard',
      scheduled_start: scheduled_start || null,
      // Tasks surface fields
      location_precision: location_precision || 'approx_area',
      reveal_policy: reveal_policy || 'after_assignment',
      visibility_scope: visibility_scope || 'city',
      radius_miles: radius_miles || 100,
      is_urgent: is_urgent || false,
      tags: tags || [],
      ref_listing_id: ref_listing_id || null,
      items: items && items.length > 0 ? JSON.stringify(items) : '[]',
      source_type: source_type || null,
      source_id: source_id || null,
      // Magic Task fields
      schedule_type: schedule_type || null,
      pay_type: pay_type || null,
      time_window_start: time_window_start || null,
      time_window_end: time_window_end || null,
      source_flow: source_flow || 'classic',
      engagement_mode: engagement_mode || null, // DB default 'curated_offers' applies when null
      // T6.0b — helper-engagement format. DB default 'in_person' applies when null.
      task_format: task_format || null,
      special_instructions: special_instructions || null,
      access_notes: access_notes || null,
      required_tools: required_tools || [],
      language_preference: language_preference || null,
      preferred_helper_id: preferred_helper_id || null,
      // Delivery module fields
      pickup_address: pickup_address || null,
      pickup_notes: pickup_notes || null,
      dropoff_address: dropoff_address || null,
      dropoff_notes: dropoff_notes || null,
      delivery_proof_required: delivery_proof_required ?? false,
      // Pro services module fields
      requires_license: requires_license ?? false,
      license_type: license_type || null,
      requires_insurance: requires_insurance ?? false,
      deposit_required: deposit_required ?? false,
      deposit_amount: deposit_amount || null,
      scope_description: scope_description || null,
      // Task archetype + module fields
      task_archetype: task_archetype || null,
      starts_asap: starts_asap ?? false,
      response_window_minutes: response_window_minutes || null,
      care_details: care_details || null,
      logistics_details: logistics_details || null,
      remote_details: remote_details || null,
      urgent_details: urgent_details || null,
      event_details: event_details || null,
    };

    // Handle location (required)
    const { mode, latitude, longitude, address, city, state, zip, homeId, place_id,
      geocode_provider, geocode_accuracy, geocode_place_id } = location;

    const approx = calculateApproxLocation(latitude, longitude);

    gigData.origin_mode = (mode === 'custom' ? 'address' : mode) || 'address';
    gigData.origin_home_id = homeId || null;
    gigData.origin_place_id = place_id || null;

    gigData.exact_address = address || null;
    gigData.exact_city = city || null;
    gigData.exact_state = state || null;
    gigData.exact_zip = zip || null;

    gigData.exact_location = formatLocationForDB(latitude, longitude);
    gigData.approx_location = formatLocationForDB(approx.latitude, approx.longitude);

    // Geocode provenance
    gigData.geocode_provider = geocode_provider || 'mapbox';
    gigData.geocode_mode = 'temporary';
    gigData.geocode_accuracy = geocode_accuracy || 'address';
    gigData.geocode_place_id = geocode_place_id || place_id || null;
    gigData.geocode_source_flow = 'gig_create';
    gigData.geocode_created_at = new Date().toISOString();

    // Insert gig using admin client (bypasses RLS)
    const { data: gig, error } = await supabaseAdmin
      .from('Gig')
      .insert(gigData)
      .select(
        `
        id,
        title,
        description,
        price,
        category,
        deadline,
        attachments,
        exact_location,
        approx_location,
        user_id,
        created_by,
        beneficiary_user_id,
        status,
        accepted_by,
        accepted_at,
        created_at,
        updated_at,
        estimated_duration,
        task_archetype,
        starts_asap,
        response_window_minutes,
        engagement_mode,
        schedule_type,
        pay_type,
        pickup_address,
        dropoff_address,
        requires_license,
        scope_description,
        care_details,
        logistics_details,
        remote_details,
        urgent_details,
        event_details
      `
      )
      .single();

    if (error) {
      logger.error('Error creating gig', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to create gig' });
    }

    // Parse location back to coordinates
    const response = {
      ...gig,
      location: location ? { latitude: location.latitude, longitude: location.longitude } : null,
    };

    // Remove PostGIS raw strings from response
    delete response.exact_location;
    delete response.approx_location;

    logger.info('Gig created', { gigId: gig.id, userId });

    // Broadcast to all connected clients so browse pages can show "new tasks" banner
    const io = req.app.get('io');
    if (io) {
      io.emit('gig:new', {
        id: gig.id,
        title: gig.title,
        category: gig.category,
        price: gig.price,
        created_at: gig.created_at,
        userId: effectiveUserId,
      });
    }

    // Invalidate browse cache near this gig's location
    if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
      browseCache.invalidateNear(location.latitude, location.longitude);
      // P6 — saved-search alerts. Fire-and-forget: a fan-out failure
      // must never fail the post.
      alertMatchingSavedSearches(gig, location).catch(() => {});
    }

    res.status(201).json({
      message: 'Gig created successfully',
      gig: response,
    });
  } catch (err) {
    logger.error('Gig creation error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to create gig' });
  }
});

// -------------------- LIST / SEARCH (STATIC) --------------------

/**
 * GET /api/gigs/nearby
 * Get gigs near a location (geospatial query)
 */
router.get('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000, limit = 20, status = 'open' } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const radiusMeters = parseInt(radius);
    const resultLimit = parseInt(limit);

    const { data: gigs, error } = await supabase.rpc('find_gigs_nearby', {
      user_lat: lat,
      user_lon: lon,
      radius_meters: radiusMeters,
      gig_status: status,
    });

    if (error) {
      logger.error('Error finding nearby gigs', { error: error.message });
      return res.status(500).json({ error: 'Failed to find nearby gigs' });
    }

    const limitedGigs = (gigs || []).slice(0, resultLimit);

    // Apply location privacy per viewer
    const viewerId = req.user?.id || null;
    const { resolveGigPrecision: _resolveNearby, applyLocationPrecision: _applyNearby } = require('../utils/locationPrivacy');

    // Batch-fetch exact coordinates for unlocked gigs (exact pin on map)
    const unlockedNearbyIds = limitedGigs.filter((g) => _resolveNearby(g, viewerId).locationUnlocked).map((g) => g.id).filter(Boolean);
    const exactCoordsByGigIdNearby = new Map();
    if (unlockedNearbyIds.length > 0) {
      const { data: exactNearbyRows } = await supabaseAdmin.from('Gig').select('id, exact_location').in('id', unlockedNearbyIds);
      for (const row of exactNearbyRows || []) {
        const coords = parsePostGISPoint(row.exact_location);
        if (coords) exactCoordsByGigIdNearby.set(String(row.id), coords);
      }
    }

    for (const g of limitedGigs) {
      const { precision, isOwner, locationUnlocked } = _resolveNearby(g, viewerId);
      _applyNearby(g, precision, isOwner);
      g.locationUnlocked = locationUnlocked;
      const exactCoords = locationUnlocked ? exactCoordsByGigIdNearby.get(String(g.id)) : null;
      if (exactCoords) {
        g.latitude = exactCoords.latitude;
        g.longitude = exactCoords.longitude;
        if (g.approx_latitude != null) g.approx_latitude = exactCoords.latitude;
        if (g.approx_longitude != null) g.approx_longitude = exactCoords.longitude;
      }
    }

    res.json({
      gigs: limitedGigs,
      total: limitedGigs.length,
      searchCenter: { latitude: lat, longitude: lon },
      radiusMeters,
    });
  } catch (err) {
    logger.error('Nearby gigs error', { error: err.message });
    res.status(500).json({ error: 'Failed to find nearby gigs' });
  }
});

/**
 * GET /api/gigs/user/me
 * Get current user's gigs
 */
router.get('/user/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = supabase
      .from('Gig')
      .select(GIG_LIST)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: gigs, error } = await query;

    if (error) {
      logger.error('Error fetching user gigs', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch your gigs' });
    }

    res.json({ gigs: gigs || [] });
  } catch (err) {
    logger.error('User gigs fetch error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch your gigs' });
  }
});

/**
 * GET /api/gigs/assignments/me
 * Get current user's accepted gigs (assignments)
 */
router.get('/assignments/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: assignments, error } = await supabase
      .from('Assignment')
      .select(
        `
        *,
        gig:gig_id (
          id,
          title,
          description,
          price,
          category,
          deadline,
          status,
          user_id,
          creator:user_id (
            username,
            name
          )
        )
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching user assignments', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch your assignments' });
    }

    res.json({
      assignments: (assignments || []).map((assignment) => ({
        ...assignment,
        gig: serializeGigForViewer(assignment.gig),
      })),
    });
  } catch (err) {
    logger.error('User assignments fetch error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch your assignments' });
  }
});

/**
 * GET /api/gigs/my-gigs
 * Get current user's posted gigs
 */
router.get('/my-gigs', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 100, status } = req.query;

    logger.info('Fetching user gigs', { userId, limit, status });

    // Include personal gigs and gigs posted under businesses this user can manage.
    const managedBusinessIds = await getBusinessIdsWithPermissions(userId, [
      'gigs.manage',
      'gigs.post',
    ]);
    const ownerIds = Array.from(new Set([userId, ...managedBusinessIds]));
    let query = supabaseAdmin
      .from('Gig')
      .select(`${GIG_LIST}, attachments`)
      .in('user_id', ownerIds)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    // Filter by status if provided
    if (status && Array.isArray(status)) {
      query = query.in('status', status);
    } else if (status) {
      query = query.eq('status', status);
    }

    const { data: gigs, error } = await query;

    if (error) {
      logger.error('Error fetching user gigs', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch your gigs' });
    }

    const safeGigs = gigs || [];
    const gigIds = safeGigs.map((gig) => gig.id).filter(Boolean);
    let bidStatsByGigId = {};
    let topBiddersByGigId = {};

    if (gigIds.length > 0) {
      const { data: bidRows, error: bidsError } = await supabaseAdmin
        .from('GigBid')
        .select('gig_id, bid_amount')
        .in('gig_id', gigIds);

      if (bidsError) {
        logger.warn('Failed to load bid stats for my gigs', {
          userId,
          error: bidsError.message,
          gigCount: gigIds.length,
        });
      } else {
        bidStatsByGigId = summarizeGigBids(bidRows);
      }

      // T5.3.2 — inline the top-3 bidder identities per gig so the
      // mobile My tasks V2 BidderStack renders without an N+1 fetch.
      topBiddersByGigId = await topBiddersByGig(gigIds);
    }

    const enrichedGigs = safeGigs.map((gig) => {
      const bidStats = bidStatsByGigId[String(gig.id)] || {
        bid_count: 0,
        top_bid_amount: null,
      };
      const topBidders = topBiddersByGigId[String(gig.id)] || [];

      return {
        ...gig,
        bid_count: bidStats.bid_count,
        bidsCount: bidStats.bid_count,
        top_bid_amount: bidStats.top_bid_amount,
        top_bidders: topBidders,
        first_image: extractFirstImage(gig.attachments),
      };
    });

    res.json({
      gigs: enrichedGigs,
      total: enrichedGigs.length,
    });
  } catch (err) {
    logger.error('My gigs fetch error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch your gigs' });
  }
});

/**
 * POST /api/gigs/:gigId/boost
 * T5.3.2 My tasks V2 — poster promotes their gig in the feed.
 *
 * Sets `boosted_at = now()` and `boost_expires_at = now() + 24h`.
 * Re-boosting an already-boosted gig simply extends the window. Only
 * the gig poster (or a teammate with `gigs.manage` on the owning
 * business) can call this; open gigs only — once a gig is assigned,
 * boosting it would mislead bidders.
 */
router.post('/:gigId/boost', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });

    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig poster can boost this task' });
    }

    if (gig.status !== 'open') {
      return res
        .status(400)
        .json({ error: `Only open gigs can be boosted (current: ${gig.status})` });
    }

    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('Gig')
      .update({
        boosted_at: now.toISOString(),
        boost_expires_at: expires.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', gigId)
      .select('id, boosted_at, boost_expires_at')
      .single();

    if (updateError) {
      logger.error('Boost gig update failed', { gigId, userId, error: updateError.message });
      return res.status(500).json({ error: 'Failed to boost gig' });
    }

    logger.info('Gig boosted', { gigId, userId });
    return res.json({
      gig: updated,
      boost_expires_at: updated.boost_expires_at,
    });
  } catch (err) {
    logger.error('Boost gig error', { error: err.message, gigId: req.params.gigId });
    return res.status(500).json({ error: 'Failed to boost gig' });
  }
});

/**
 * GET /api/gigs/my-bids
 * Get current user's placed bids
 */
router.get('/my-bids', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // Support BOTH:
    //   ?status=pending
    //   ?status[]=pending&status[]=accepted
    const rawStatus = req.query.status ?? req.query['status[]'];
    const { limit = 100 } = req.query;

    const statusFilter =
      rawStatus === undefined ? null : Array.isArray(rawStatus) ? rawStatus : [rawStatus];

    logger.info('Fetching user bids (no join)', { userId, limit, statusFilter });

    // Auto-expire user's bids that have passed their expiry time
    await supabaseAdmin
      .from('GigBid')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date().toISOString());

    // 1) Fetch bids (NO nested relation)
    let q = supabaseAdmin
      .from('GigBid')
      .select(
        `
        id,
        gig_id,
        user_id,
        bid_amount,
        message,
        proposed_time,
        status,
        created_at,
        updated_at,
        expires_at,
        counter_amount,
        counter_message,
        countered_at,
        counter_status,
        withdrawal_reason,
        withdrawn_at
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit, 10));

    if (statusFilter && statusFilter.length > 0) {
      q = q.in('status', statusFilter);
    }

    const { data: bids, error: bidsErr } = await q;

    if (bidsErr) {
      logger.error('Error fetching bids', {
        userId,
        message: bidsErr.message,
        details: bidsErr.details,
        hint: bidsErr.hint,
        code: bidsErr.code,
      });
      return res.status(500).json({ error: 'Failed to fetch your bids' });
    }

    const safeBids = bids || [];
    const gigIds = [...new Set(safeBids.map((b) => b.gig_id).filter(Boolean))];

    // 2) Fetch related gigs (separate query)
    let gigsById = {};
    if (gigIds.length > 0) {
      const { data: gigs, error: gigsErr } = await supabaseAdmin
        .from('Gig')
        .select('id, title, description, price, category, status, user_id')
        .in('id', gigIds);

      if (gigsErr) {
        logger.error('Error fetching gigs for bids', {
          userId,
          message: gigsErr.message,
          details: gigsErr.details,
          hint: gigsErr.hint,
          code: gigsErr.code,
        });
        // Still return bids even if gig fetch fails
        gigsById = {};
      } else {
        for (const g of gigs || []) gigsById[g.id] = g;
      }
    }

    // 3) Attach gig object to each bid for frontend compatibility
    //    Normalize 'assigned' → 'accepted' for backwards compat
    const merged = safeBids.map((b) => ({
      ...b,
      status: b.status === 'assigned' ? 'accepted' : b.status,
      gig: gigsById[b.gig_id] || null,
    }));

    return res.json({
      bids: merged,
      total: merged.length,
    });
  } catch (err) {
    logger.error('My bids fetch error', { userId, error: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to fetch your bids' });
  }
});

/**
 * GET /api/gigs/bid-stats
 * Get bidding metrics for the current user
 */
router.get('/bid-stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: allBids, error } = await supabaseAdmin
      .from('GigBid')
      .select('status')
      .eq('user_id', userId);

    if (error) {
      logger.error('Error fetching bid stats', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch bid stats' });
    }

    const bids = allBids || [];
    const stats = {
      bids_submitted: bids.length,
      bids_pending: bids.filter((b) => b.status === 'pending').length,
      bids_accepted: bids.filter((b) => b.status === 'accepted' || b.status === 'assigned').length,
      bids_rejected: bids.filter((b) => b.status === 'rejected').length,
      bids_withdrawn: bids.filter((b) => b.status === 'withdrawn').length,
      bids_expired: bids.filter((b) => b.status === 'expired').length,
      accept_rate:
        bids.length > 0
          ? Math.round(
              (bids.filter((b) => b.status === 'accepted' || b.status === 'assigned').length /
                bids.length) *
                100
            )
          : 0,
    };

    res.json(stats);
  } catch (err) {
    logger.error('Bid stats error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch bid stats' });
  }
});

/**
 * GET /api/gigs/reliability/:userId
 * Get public reliability stats for a user (for profile badges).
 */
router.get('/reliability/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user, error } = await supabaseAdmin
      .from('User')
      .select(
        'id, no_show_count, late_cancel_count, gigs_completed, gigs_posted, reliability_score, average_rating, review_count'
      )
      .eq('id', userId)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });

    // Compute completion rate from gig data
    const totalAttempted =
      (user.gigs_completed || 0) + (user.no_show_count || 0) + (user.late_cancel_count || 0);
    const completionRate =
      totalAttempted > 0 ? Math.round(((user.gigs_completed || 0) / totalAttempted) * 100) : 100;

    // Determine badge
    let badge = null;
    const score = user.reliability_score || 100;
    if (totalAttempted >= 5 && score >= 95) badge = 'gold';
    else if (totalAttempted >= 3 && score >= 85) badge = 'silver';
    else if (totalAttempted >= 1 && score >= 70) badge = 'bronze';

    res.json({
      user_id: user.id,
      reliability_score: score,
      completion_rate: completionRate,
      no_show_count: user.no_show_count || 0,
      late_cancel_count: user.late_cancel_count || 0,
      gigs_completed: user.gigs_completed || 0,
      gigs_posted: user.gigs_posted || 0,
      average_rating: user.average_rating || 0,
      review_count: user.review_count || 0,
      badge,
      badge_label: badge
        ? {
            gold: '⭐ Top Rated — 95%+ completion',
            silver: '🥈 Reliable — 85%+ completion',
            bronze: '🥉 Active — 70%+ completion',
          }[badge]
        : null,
    });
  } catch (err) {
    logger.error('Reliability fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch reliability stats' });
  }
});

/**
 * GET /api/gigs/received-offers
 * Get bids/offers placed on gigs the current user posted.
 * Basically "offers I received from other people".
 */
router.get('/received-offers', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const rawStatus = req.query.status ?? req.query['status[]'];
    const { limit = 100 } = req.query;

    const statusFilter =
      rawStatus === undefined ? null : Array.isArray(rawStatus) ? rawStatus : [rawStatus];

    // 1) Resolve all owner IDs user can act for (self + managed businesses)
    const managedBusinessIds = await getBusinessIdsWithPermissions(userId, [
      'gigs.manage',
      'gigs.post',
    ]);
    const ownerIds = Array.from(new Set([userId, ...managedBusinessIds]));

    // 2) Get gig IDs owned by any allowed owner profile
    const { data: myGigs, error: gigsErr } = await supabaseAdmin
      .from('Gig')
      .select('id, title, description, price, category, status, user_id')
      .in('user_id', ownerIds);

    if (gigsErr) {
      logger.error('Error fetching user gigs for received offers', { error: gigsErr.message });
      return res.status(500).json({ error: 'Failed to fetch your gigs' });
    }

    const gigIds = (myGigs || []).map((g) => g.id);
    if (gigIds.length === 0) {
      return res.json({ offers: [], total: 0 });
    }

    // 3) Get all bids on those gigs
    let q = supabaseAdmin
      .from('GigBid')
      .select(
        'id, gig_id, user_id, bid_amount, message, proposed_time, status, created_at, updated_at'
      )
      .in('gig_id', gigIds)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit, 10));

    if (statusFilter && statusFilter.length > 0) {
      q = q.in('status', statusFilter);
    }

    const { data: bids, error: bidsErr } = await q;

    if (bidsErr) {
      logger.error('Error fetching received offers', { error: bidsErr.message });
      return res.status(500).json({ error: 'Failed to fetch offers' });
    }

    const safeBids = bids || [];

    // 4) Get bidder user info
    const bidderIds = [...new Set(safeBids.map((b) => b.user_id).filter(Boolean))];
    let usersById = {};
    if (bidderIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('User')
        .select('id, username, name, first_name, profile_picture_url, city, state')
        .in('id', bidderIds);
      for (const u of users || []) usersById[u.id] = u;
    }

    // 5) Build gigs lookup
    const gigsById = {};
    for (const g of myGigs) gigsById[g.id] = g;

    // 6) Merge
    const merged = safeBids.map((b) => ({
      ...b,
      gig: gigsById[b.gig_id] || null,
      bidder: usersById[b.user_id] || null,
    }));

    return res.json({ offers: merged, total: merged.length });
  } catch (err) {
    logger.error('Received offers error', { error: err?.message });
    return res.status(500).json({ error: 'Failed to fetch received offers' });
  }
});

/**
 * GET /api/gigs/autocomplete
 * Lightweight autocomplete for the search bar.
 * Returns matching gig titles and categories.
 *
 * Query:
 *   q     (required, min 1 char) — search prefix
 *   limit (default 5, max 10)
 */
const autocompleteCache = new Map();
const AUTOCOMPLETE_TTL = 30000; // 30 seconds

router.get('/autocomplete', async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.json({ titles: [], categories: [] });

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 5, 1), 10);

    // Check cache
    const cacheKey = `${q}:${limit}`;
    const cached = autocompleteCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < AUTOCOMPLETE_TTL) {
      return res.json(cached.data);
    }

    // Query distinct titles
    const { data: titleRows } = await supabaseAdmin
      .from('gigs')
      .select('title')
      .eq('status', 'open')
      .ilike('title', `%${q}%`)
      .limit(limit);

    // Deduplicate titles (case-insensitive)
    const seenTitles = new Set();
    const titles = [];
    for (const row of titleRows || []) {
      const lower = row.title.toLowerCase();
      if (!seenTitles.has(lower)) {
        seenTitles.add(lower);
        titles.push(row.title);
      }
      if (titles.length >= limit) break;
    }

    // Match categories from the fixed list
    const allCategories = [
      'Handyman',
      'Cleaning',
      'Moving',
      'Pet Care',
      'Child Care',
      'Tutoring',
      'Photography',
      'Cooking',
      'Delivery',
      'Tech Support',
      'Gardening',
      'Event Help',
      'Other',
    ];
    const categories = allCategories.filter((c) => c.toLowerCase().includes(q));

    const result = { titles, categories };

    // Cache result
    autocompleteCache.set(cacheKey, { data: result, ts: Date.now() });

    // Evict old cache entries periodically
    if (autocompleteCache.size > 500) {
      const now = Date.now();
      for (const [key, val] of autocompleteCache) {
        if (now - val.ts > AUTOCOMPLETE_TTL) autocompleteCache.delete(key);
      }
    }

    return res.json(result);
  } catch (err) {
    logger.error('Autocomplete error', { error: err?.message });
    return res.status(500).json({ error: 'Autocomplete failed' });
  }
});

/**
 * GET /api/gigs/search
 * Search gigs by keyword with relevance scoring.
 * Searches title, description, and category fields.
 *
 * Query:
 *   q        (required, min 2 chars) — search query
 *   limit    (default 20, max 50)
 *   offset   (default 0)
 *   category (optional) — filter by category
 *   status   (default 'open')
 */
router.get('/search', verifyToken, async (req, res) => {
  try {
    const {
      q = '',
      limit = 20,
      offset = 0,
      category,
      status = 'open',
      latitude,
      longitude,
      radiusMiles,
    } = req.query;
    const queryText = String(q || '').trim();
    const safeLimit = Math.min(parseInt(limit) || 20, 50);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);

    if (queryText.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    // ── Spatial search path: when location is provided, delegate to find_gigs_nearby_v2 ──
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const hasLocation =
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180;

    if (hasLocation) {
      const rawRadius = parseFloat(radiusMiles);
      const miles = Number.isFinite(rawRadius) ? Math.max(1, Math.min(100, rawRadius)) : 25;
      const radiusMeters = Math.round(miles * 1609.34);

      const { data, error } = await supabaseAdmin.rpc('find_gigs_nearby_v2', {
        user_lat: lat,
        user_lon: lon,
        p_radius_meters: radiusMeters,
        p_category: category || null,
        p_min_price: null,
        p_max_price: null,
        p_search: queryText,
        p_sort: 'newest',
        p_limit: safeLimit,
        p_offset: safeOffset,
        p_include_remote: true,
        gig_status: status || 'open',
      });

      if (error) {
        logger.error('Gig spatial search error', { error: error.message });
        return res.status(500).json({ error: 'Failed to search gigs' });
      }

      const rows = data || [];

      // Enrich with bid counts
      const gigIds = rows.map((g) => g.id).filter(Boolean);
      let bidCountsByGigId = {};
      if (gigIds.length > 0) {
        const { data: bidRows, error: bidErr } = await supabaseAdmin
          .from('GigBid')
          .select('gig_id')
          .in('gig_id', gigIds);

        if (!bidErr) {
          for (const r of bidRows || []) {
            const k = String(r.gig_id);
            bidCountsByGigId[k] = (bidCountsByGigId[k] || 0) + 1;
          }
        }
      }

      const result = rows.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        price: g.price,
        category: g.category,
        deadline: g.deadline,
        estimated_duration: g.estimated_duration,
        user_id: g.user_id,
        status: g.status,
        accepted_by: g.accepted_by,
        created_at: g.created_at,
        poster_display_name: g.creator_name || g.creator_username || 'Anonymous',
        poster_username: g.creator_username || null,
        poster_profile_picture_url: g.profile_picture_url || null,
        bidsCount: bidCountsByGigId[String(g.id)] || 0,
        distance_meters: g.distance_meters,
        exact_city: g.exact_city,
        exact_state: g.exact_state,
        is_urgent: g.is_urgent,
        tags: g.tags,
      }));

      return res.json({ gigs: result, total: result.length });
    }

    // ── Non-spatial search path: existing ilike-based logic ──
    const normalizedQuery = queryText.toLowerCase();
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean).slice(0, 6);
    const primaryToken = tokens[0] || normalizedQuery;

    const fullSearchTerm = `%${queryText}%`;
    const broadSearchTerm = `%${primaryToken}%`;
    const candidateLimit = Math.min(Math.max((safeOffset + safeLimit) * 8, 80), 400);

    // Build base query
    let query = supabaseAdmin.from('Gig').select(
      `
        id,
        title,
        description,
        price,
        category,
        deadline,
        estimated_duration,
        user_id,
        status,
        accepted_by,
        created_at,
        engagement_mode,
        schedule_type,
        pay_type,
        task_archetype,
        starts_asap,
        response_window_minutes,
        pickup_address,
        dropoff_address,
        requires_license,
        scope_description,
        care_details,
        logistics_details,
        remote_details,
        urgent_details,
        event_details,
        User:user_id (
          id,
          username,
          name,
          first_name,
          last_name,
          profile_picture_url,
          city,
          state,
          account_type
        )
      `
    );

    // Status filter
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);

    // Search across title, description, category
    query = query.or(
      `title.ilike.${fullSearchTerm},description.ilike.${fullSearchTerm},category.ilike.${fullSearchTerm},title.ilike.${broadSearchTerm},description.ilike.${broadSearchTerm},category.ilike.${broadSearchTerm}`
    );

    query = query.order('created_at', { ascending: false }).range(0, candidateLimit - 1);

    const { data: gigs, error } = await query;

    if (error) {
      logger.error('Gig search error', { error: error.message });
      return res.status(500).json({ error: 'Failed to search gigs' });
    }

    const rows = gigs || [];
    if (rows.length === 0) {
      return res.json({ gigs: [], total: 0 });
    }

    // Enrich with bid counts
    const gigIds = rows.map((g) => g.id).filter(Boolean);
    let bidCountsByGigId = {};
    if (gigIds.length > 0) {
      const { data: bidRows, error: bidErr } = await supabaseAdmin
        .from('GigBid')
        .select('gig_id')
        .in('gig_id', gigIds);

      if (!bidErr) {
        for (const r of bidRows || []) {
          const k = String(r.gig_id);
          bidCountsByGigId[k] = (bidCountsByGigId[k] || 0) + 1;
        }
      }
    }

    // Score and rank results
    const ranked = rows
      .map((g) => {
        const poster = g.User || null;
        const posterDisplayName =
          poster?.name ||
          [poster?.first_name, poster?.last_name].filter(Boolean).join(' ') ||
          poster?.username ||
          'Anonymous';

        const title = String(g.title || '').toLowerCase();
        const description = String(g.description || '').toLowerCase();
        const cat = String(g.category || '').toLowerCase();
        const searchable = [title, description, cat].join(' ');

        let score = 4;
        if (title === normalizedQuery) {
          score = 0; // exact title match
        } else if (title.startsWith(normalizedQuery)) {
          score = 1; // title starts with query
        } else if (title.includes(normalizedQuery) || cat.includes(normalizedQuery)) {
          score = 2; // title or category contains query
        } else if (tokens.every((token) => searchable.includes(token))) {
          score = 3; // all tokens found somewhere
        }

        return {
          id: g.id,
          title: g.title,
          description: g.description,
          price: g.price,
          category: g.category,
          deadline: g.deadline,
          estimated_duration: g.estimated_duration,
          user_id: g.user_id,
          status: g.status,
          accepted_by: g.accepted_by,
          created_at: g.created_at,
          poster_display_name: posterDisplayName,
          poster_username: poster?.username || null,
          poster_profile_picture_url: poster?.profile_picture_url || null,
          poster_account_type: poster?.account_type || null,
          bidsCount: bidCountsByGigId[String(g.id)] || 0,
          _score: score,
          _searchable: searchable,
        };
      })
      .filter((g) => tokens.every((token) => g._searchable.includes(token)))
      .sort((a, b) => {
        if (a._score !== b._score) return a._score - b._score;
        return new Date(b.created_at) - new Date(a.created_at);
      });

    const total = ranked.length;
    const result = ranked
      .slice(safeOffset, safeOffset + safeLimit)
      .map(({ _score, _searchable, ...rest }) => rest);

    return res.json({ gigs: result, total });
  } catch (err) {
    logger.error('Gig search error', { error: err.message });
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Failed to search gigs' });
  }
});

/**
 * GET /api/gigs
 * Get all gigs with filtering, sorting, and pagination
 *
 * NOTE:
 * This endpoint is intentionally public (no verifyToken) because it powers the main browsing feed.
 * We enrich each gig with bidsCount (number of bids/offers).
 */
router.get('/', async (req, res) => {
  try {
    const {
      limit = 20,
      offset,
      page,
      category,
      minPrice,
      maxPrice,
      price_min,
      price_max,
      sort,
      sortBy,
      sortOrder,
      userId,
      user_id, // accept both naming conventions
      latitude,
      longitude,
      radiusMiles,
      includeRemote,
      engagement_mode,
      schedule_type,
      pay_type,
      max_distance, // meters — alternative to radiusMiles
      deadline, // 'today' | 'tomorrow' | 'this_week'
      search, // search query (forwarded to RPC)
      task_archetype, // archetype filter
    } = req.query;

    const { status, error: statusError } = resolvePublicStatusFilter(req.query, 'open');
    if (statusError) {
      return res.status(400).json({ error: statusError });
    }

    const requestedUserId = userId || user_id;
    const currentUserId = req.user?.id || (await extractOptionalUserId(req));
    const shouldExcludeOwnGigs = Boolean(currentUserId && !requestedUserId);

    // Resolve pagination: support both page (1-based) and offset
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit) || 20));
    let parsedOffset = 0;
    if (offset != null) {
      parsedOffset = Math.max(0, parseInt(offset) || 0);
    } else if (page != null) {
      parsedOffset = Math.max(0, parseInt(page) - 1) * parsedLimit;
    }

    // Resolve price filters: accept both naming conventions (dollars)
    const resolvedMinPrice = price_min || minPrice;
    const resolvedMaxPrice = price_max || maxPrice;

    // ── Spatial path: when latitude & longitude are provided, use find_gigs_nearby_v2 ──
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const hasLocation =
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180;

    if (hasLocation) {
      const radiusMeters = resolveBrowseRadiusMeters(max_distance, radiusMiles);
      const includeRemoteFlag = parseBooleanQuery(includeRemote, true);

      // Resolve search query
      const searchQuery = (search || '').trim() || null;

      // Map convenience sort names to the RPC's p_sort values
      const RPC_SORT_MAP = {
        newest: 'newest',
        oldest: 'newest', // RPC only supports newest; we'll keep newest as default
        price_low: 'price_asc',
        price_high: 'price_desc',
        distance: 'distance',
        price_asc: 'price_asc',
        price_desc: 'price_desc',
        best_match: 'newest', // fetch broadly, re-rank client-side
        urgency: 'newest', // urgency sort: newest as proxy (deadline filter handles the rest)
        quick: 'price_asc', // quick jobs: cheapest first
      };
      const isBestMatchSort = sort === 'best_match';
      const rpcSort = RPC_SORT_MAP[sort] || 'newest';

      // For best_match, fetch a larger window to re-rank properly
      const rpcLimit = isBestMatchSort ? Math.max(200, parsedLimit + parsedOffset) : parsedLimit;
      const rpcOffset = isBestMatchSort ? 0 : parsedOffset;

      const { data, error } = await supabaseAdmin.rpc('find_gigs_nearby_v2', {
        user_lat: lat,
        user_lon: lon,
        p_radius_meters: radiusMeters,
        p_category: category || null,
        p_min_price: resolvedMinPrice ? parseFloat(resolvedMinPrice) : null,
        p_max_price: resolvedMaxPrice ? parseFloat(resolvedMaxPrice) : null,
        p_search: searchQuery,
        p_sort: rpcSort,
        p_limit: rpcLimit,
        p_offset: rpcOffset,
        p_include_remote: includeRemoteFlag,
        gig_status: status || 'open',
      });

      if (error) {
        logger.error('Error fetching gigs nearby', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch gigs' });
      }

      let rows = data || [];

      if (shouldExcludeOwnGigs) {
        rows = excludeUserOwnedGigs(rows, currentUserId);
      }

      // Filter by task_archetype if provided
      if (task_archetype) {
        rows = rows.filter((g) => g.task_archetype === task_archetype);
      }

      // Apply deadline window filter (today/tomorrow/this_week narrowing)
      // Note: the RPC already excludes gigs whose deadline has passed
      if (deadline) {
        const now = new Date();
        let deadlineCutoff = null;
        if (deadline === 'today') {
          deadlineCutoff = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999
          );
        } else if (deadline === 'tomorrow') {
          deadlineCutoff = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
            23,
            59,
            59,
            999
          );
        } else if (deadline === 'this_week') {
          const daysUntilSunday = 7 - now.getDay();
          deadlineCutoff = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + daysUntilSunday,
            23,
            59,
            59,
            999
          );
        }
        if (deadlineCutoff) {
          rows = rows.filter((g) => {
            if (g.deadline && new Date(g.deadline) <= deadlineCutoff) return true;
            // Include urgent tasks for 'today' filter even without explicit deadline
            if (deadline === 'today' && g.is_urgent) return true;
            return false;
          });
        }
      }

      // ── Exclude dismissed gigs and hidden categories ──
      if (currentUserId) {
        try {
          const excl = await getUserExclusions(currentUserId);
          rows = applyUserExclusions(rows, excl);
        } catch {}
      }

      // ── best_match re-ranking ──
      if (isBestMatchSort && rows.length > 0) {
        let affinities = [];
        if (currentUserId) {
          try {
            affinities = await affinityService.getUserAffinities(currentUserId);
          } catch {}
        }
        const ranked = rankingService.rankGigs(rows, {
          maxRadius: radiusMeters,
          affinities,
        });
        rows = ranked
          .slice(parsedOffset, parsedOffset + parsedLimit)
          .map(({ _relevanceScore, ...rest }) => rest);
      }

      // Enrich with bid counts
      const gigIds = rows.map((g) => g.id).filter(Boolean);
      let bidCountsByGigId = {};
      if (gigIds.length > 0) {
        const { data: bidRows, error: bidCountErr } = await supabaseAdmin
          .from('GigBid')
          .select('gig_id')
          .in('gig_id', gigIds);

        if (!bidCountErr) {
          for (const r of bidRows || []) {
            const k = String(r.gig_id);
            bidCountsByGigId[k] = (bidCountsByGigId[k] || 0) + 1;
          }
        }
      }

      const savedGigIds = await getViewerSavedGigIds(currentUserId, gigIds);

      // Batch-fetch exact coordinates for unlocked gigs so list/map can show exact pin (Gap 2)
      const { resolveGigPrecision: resolveForFetch } = require('../utils/locationPrivacy');
      const unlockedGigIds = rows
        .filter((g) => resolveForFetch(g, currentUserId).locationUnlocked)
        .map((g) => g.id)
        .filter(Boolean);
      const exactCoordsByGigId = new Map();
      if (unlockedGigIds.length > 0) {
        const { data: exactRows } = await supabaseAdmin
          .from('Gig')
          .select('id, exact_location')
          .in('id', unlockedGigIds);
        for (const row of exactRows || []) {
          const coords = parsePostGISPoint(row.exact_location);
          if (coords) exactCoordsByGigId.set(String(row.id), coords);
        }
      }

      const gigsWithCounts = rows.map((g) => {
        const posterDisplayName = g.creator_name || g.creator_username || 'Anonymous';

        // Apply per-viewer location privacy
        const { resolveGigPrecision, applyLocationPrecision } = require('../utils/locationPrivacy');
        const { precision, isOwner, locationUnlocked } = resolveGigPrecision(g, currentUserId);

        let approxLat = g.approx_latitude;
        let approxLng = g.approx_longitude;
        let exactCity = g.exact_city;
        let exactState = g.exact_state;
        let exactAddress = null;

        if (locationUnlocked) {
          // Viewer is owner or accepted worker — use exact coords when available for list/map pin
          const exactCoords = exactCoordsByGigId.get(String(g.id));
          if (exactCoords) {
            approxLat = exactCoords.latitude;
            approxLng = exactCoords.longitude;
          }
          exactAddress = g.exact_address || null;
        } else {
          // Blur the coordinates through the standard privacy function
          const locObj = { latitude: approxLat, longitude: approxLng };
          applyLocationPrecision(locObj, precision, isOwner, { stripAddress: false, setUnlockedFlag: false });
          approxLat = locObj.latitude;
          approxLng = locObj.longitude;
          // Strip exact address for non-authorized viewers
          exactAddress = null;
        }

        return {
          id: g.id,
          title: g.title,
          description: g.description,
          price: g.price,
          category: g.category,
          deadline: g.deadline,
          estimated_duration: g.estimated_duration,
          user_id: g.user_id,
          status: g.status,
          accepted_by: g.accepted_by,
          created_at: g.created_at,
          poster_display_name: posterDisplayName,
          poster_username: g.creator_username || null,
          poster_profile_picture_url: g.profile_picture_url || null,
          bid_count: bidCountsByGigId[String(g.id)] || 0,
          bidsCount: bidCountsByGigId[String(g.id)] || 0,
          viewer_has_saved: savedGigIds.has(String(g.id)),
          // Location fields (privacy-enforced)
          distance_meters: g.distance_meters,
          exact_city: exactCity,
          exact_state: exactState,
          exact_address: exactAddress,
          approx_latitude: approxLat,
          approx_longitude: approxLng,
          location_precision: g.location_precision,
          visibility_scope: g.visibility_scope,
          locationUnlocked,
          is_urgent: g.is_urgent,
          tags: g.tags,
          items: g.items,
          scheduled_start: g.scheduled_start,
          attachments: g.attachments,
          first_image: extractFirstImage(g.attachments),
        };
      });

      return res.json({
        gigs: gigsWithCounts,
        pagination: {
          limit: parsedLimit,
          offset: parsedOffset,
          hasMore: rows.length === parsedLimit,
        },
        // Keep legacy top-level fields for backward compat
        total: null,
        limit: parsedLimit,
        offset: parsedOffset,
        page: Math.floor(parsedOffset / parsedLimit) + 1,
      });
    }

    // ── Non-spatial path: existing query logic (backward-compatible) ──

    // Resolve sort: accept convenience 'sort' param or explicit sortBy/sortOrder
    const SORT_MAP = {
      newest: { field: 'created_at', ascending: false },
      oldest: { field: 'created_at', ascending: true },
      price_low: { field: 'price', ascending: true },
      price_high: { field: 'price', ascending: false },
      ending_soon: { field: 'deadline', ascending: true },
      distance: { field: 'created_at', ascending: false }, // distance sort requires lat/lng; falls back to newest
      best_match: { field: 'created_at', ascending: false }, // best_match ranking implemented in Phase 3
      urgency: { field: 'deadline', ascending: true }, // alias for ending_soon
      quick: { field: 'price', ascending: true }, // quick jobs: cheapest first
    };
    let resolvedSortField = 'created_at';
    let resolvedAscending = false;
    if (sort && SORT_MAP[sort]) {
      resolvedSortField = SORT_MAP[sort].field;
      resolvedAscending = SORT_MAP[sort].ascending;
    } else {
      const validSortFields = ['created_at', 'price', 'deadline', 'title'];
      resolvedSortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      resolvedAscending = sortOrder === 'asc';
    }

    // Public reads should not depend on RLS.
    let query = supabaseAdmin.from('Gig').select(
      `
        id,
        title,
        description,
        price,
        category,
        deadline,
        estimated_duration,
        user_id,
        status,
        accepted_by,
        created_at,
        engagement_mode,
        schedule_type,
        pay_type,
        attachments,
        task_archetype,
        starts_asap,
        response_window_minutes,
        pickup_address,
        dropoff_address,
        requires_license,
        scope_description,
        care_details,
        logistics_details,
        remote_details,
        urgent_details,
        event_details,
        User:user_id (
          id,
          username,
          name,
          first_name,
          last_name,
          profile_picture_url,
          city,
          state,
          account_type
        )
      `,
      { count: 'exact' }
    );

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    const filterUserId = requestedUserId;
    if (filterUserId) query = query.eq('user_id', filterUserId);
    if (!filterUserId && shouldExcludeOwnGigs) query = query.neq('user_id', currentUserId);
    if (resolvedMinPrice) query = query.gte('price', parseFloat(resolvedMinPrice));
    if (resolvedMaxPrice) query = query.lte('price', parseFloat(resolvedMaxPrice));
    if (engagement_mode) query = query.eq('engagement_mode', engagement_mode);
    if (schedule_type) query = query.eq('schedule_type', schedule_type);
    if (pay_type) query = query.eq('pay_type', pay_type);
    if (task_archetype) query = query.eq('task_archetype', task_archetype);

    // Exclude gigs whose deadline has already passed (non-spatial path)
    query = query.or('deadline.is.null,deadline.gt.' + new Date().toISOString());

    // Search filter (non-spatial path)
    const searchTerm = (search || '').trim();
    if (searchTerm) {
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    // Deadline filter (non-spatial path)
    if (deadline) {
      const now = new Date();
      let deadlineCutoff = null;
      if (deadline === 'today') {
        deadlineCutoff = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999
        );
      } else if (deadline === 'tomorrow') {
        deadlineCutoff = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          23,
          59,
          59,
          999
        );
      } else if (deadline === 'this_week') {
        const daysUntilSunday = 7 - now.getDay();
        deadlineCutoff = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + daysUntilSunday,
          23,
          59,
          59,
          999
        );
      }
      if (deadlineCutoff) {
        if (deadline === 'today') {
          // Include tasks with deadline today OR flagged as urgent
          query = query.or(`deadline.lte.${deadlineCutoff.toISOString()},is_urgent.eq.true`);
        } else {
          query = query.lte('deadline', deadlineCutoff.toISOString());
        }
      }
    }

    query = query.order(resolvedSortField, { ascending: resolvedAscending });

    query = query.range(parsedOffset, parsedOffset + parsedLimit - 1);

    const { data: gigs, error, count } = await query;

    if (error) {
      logger.error('Error fetching gigs', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch gigs' });
    }

    const gigIdsFromGigs = (gigs || []).map((g) => g.id).filter(Boolean);

    let bidCountsByGigId = {};
    if (gigIdsFromGigs.length > 0) {
      const { data: bidRows, error: bidCountErr } = await supabaseAdmin
        .from('GigBid')
        .select('gig_id')
        .in('gig_id', gigIdsFromGigs);

      if (!bidCountErr) {
        for (const r of bidRows || []) {
          const k = String(r.gig_id);
          bidCountsByGigId[k] = (bidCountsByGigId[k] || 0) + 1;
        }
      }
    }

    const savedGigIds = await getViewerSavedGigIds(currentUserId, gigIdsFromGigs);

    const gigsWithCounts = (gigs || []).map((g) => {
      const poster = g.User || null;
      const posterDisplayName =
        poster?.name ||
        [poster?.first_name, poster?.last_name].filter(Boolean).join(' ') ||
        poster?.username ||
        'Anonymous';

      return {
        ...g,
        poster_display_name: posterDisplayName,
        poster_username: poster?.username || null,
        poster_profile_picture_url: poster?.profile_picture_url || null,
        bid_count: bidCountsByGigId[String(g.id)] || 0,
        bidsCount: bidCountsByGigId[String(g.id)] || 0,
        viewer_has_saved: savedGigIds.has(String(g.id)),
        first_image: extractFirstImage(g.attachments),
      };
    });

    return res.json({
      gigs: gigsWithCounts,
      total: count,
      limit: parsedLimit,
      offset: parsedOffset,
      page: Math.floor(parsedOffset / parsedLimit) + 1,
    });
  } catch (err) {
    logger.error('Gig fetch error', { error: err.message });
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Failed to fetch gigs' });
  }
});

/**
 * GET /api/gigs/in-bounds
 * Return gig “pins” for the current map viewport using privacy-safe approx_location.
 * Query params:
 *  - min_lat, min_lon, max_lat, max_lon (required)
 *  - status (optional, default 'open')
 */
router.get('/in-bounds', async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const min_lat = parseFloat(req.query.min_lat);
    const min_lon = parseFloat(req.query.min_lon);
    const max_lat = parseFloat(req.query.max_lat);
    const max_lon = parseFloat(req.query.max_lon);

    const { status, error: statusError } = resolvePublicStatusFilter(req.query, 'open');
    if (statusError) {
      return res.status(400).json({ error: statusError });
    }
    const includeRemote = parseBooleanQuery(req.query.includeRemote, true);
    const category = req.query.category || null;
    const currentUserId = req.user?.id || (await extractOptionalUserId(req));

    if (![min_lat, min_lon, max_lat, max_lon].every(Number.isFinite)) {
      return res
        .status(400)
        .json({ error: 'min_lat, min_lon, max_lat, max_lon are required numbers' });
    }

    const boundsArea = Math.abs((max_lat - min_lat) * (max_lon - min_lon));
    const zoomLevel = req.query.zoom ? parseFloat(req.query.zoom) : null;
    logger.info('viewport_request', {
      endpoint: '/api/gigs/in-bounds',
      bounds_area_sq_deg: Math.round(boundsArea * 10000) / 10000,
      zoom_level: zoomLevel,
    });

    // Use v2 RPC with remote gig support and enriched columns
    const { data, error } = await supabaseAdmin.rpc('find_gigs_in_bounds_v2', {
      min_lat,
      min_lon,
      max_lat,
      max_lon,
      gig_status: status,
      p_include_remote: includeRemote,
      p_category: category,
    });

    if (error) {
      logger.error('Error fetching gigs in bounds', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch gigs in bounds' });
    }

    const rows = data || [];
    const savedGigIds = await getViewerSavedGigIds(
      currentUserId,
      rows.map((gig) => gig.id).filter(Boolean)
    );

    // Batch-fetch exact coordinates for unlocked gigs (exact pin on map)
    const { resolveGigPrecision: _resolveBoundsPre } = require('../utils/locationPrivacy');
    const unlockedBoundsIds = rows.filter((g) => _resolveBoundsPre(g, currentUserId).locationUnlocked).map((g) => g.id).filter(Boolean);
    const exactCoordsByGigIdBounds = new Map();
    if (unlockedBoundsIds.length > 0) {
      const { data: exactBoundsRows } = await supabaseAdmin.from('Gig').select('id, exact_location').in('id', unlockedBoundsIds);
      for (const row of exactBoundsRows || []) {
        const coords = parsePostGISPoint(row.exact_location);
        if (coords) exactCoordsByGigIdBounds.set(String(row.id), coords);
      }
    }

    // v2 RPC already joins User for creator_name/creator_username/profile_picture_url
    const { resolveGigPrecision: _resolveBounds, applyLocationPrecision: _applyBounds } = require('../utils/locationPrivacy');
    const enriched = rows.map((gig) => {
      const posterDisplayName = gig.creator_name || gig.creator_username || 'Anonymous';

      // Apply location privacy per viewer
      const { precision, isOwner, locationUnlocked } = _resolveBounds(gig, currentUserId);
      _applyBounds(gig, precision, isOwner);

      const exactCoords = locationUnlocked ? exactCoordsByGigIdBounds.get(String(gig.id)) : null;
      const out = {
        ...gig,
        poster_display_name: posterDisplayName,
        poster_username: gig.creator_username || null,
        poster_profile_picture_url: gig.profile_picture_url || null,
        viewer_has_saved: savedGigIds.has(String(gig.id)),
        locationUnlocked,
      };
      if (exactCoords) {
        out.latitude = exactCoords.latitude;
        out.longitude = exactCoords.longitude;
      }
      return out;
    });

    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.info('viewport_response', {
      endpoint: '/api/gigs/in-bounds',
      status: 200,
      result_count: enriched.length,
      response_time_ms: Math.round(elapsed * 100) / 100,
      bounds_area_sq_deg: Math.round(boundsArea * 10000) / 10000,
      zoom_level: zoomLevel,
    });

    // When viewport is empty, find the nearest activity center
    let nearest_activity_center = null;
    if (enriched.length === 0) {
      const centerLat = (min_lat + max_lat) / 2;
      const centerLon = (min_lon + max_lon) / 2;
      const { data: nearestRows } = await supabaseAdmin.rpc('find_nearest_activity_center', {
        p_center_lat: centerLat,
        p_center_lon: centerLon,
        p_content_type: 'gig',
      });
      if (nearestRows && nearestRows.length > 0) {
        nearest_activity_center = {
          latitude: nearestRows[0].latitude,
          longitude: nearestRows[0].longitude,
        };
      }
    }

    // Response is pin-shaped + poster display fields.
    res.json({ gigs: enriched, nearest_activity_center });
  } catch (err) {
    const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
    logger.error('Gig in-bounds fetch error', {
      error: err.message,
      response_time_ms: Math.round(elapsed * 100) / 100,
    });
    res.status(500).json({ error: 'Failed to fetch gigs in bounds' });
  }
});

/**
 * GET /api/gigs/saved
 * Current user's saved/bookmarked gigs.
 * MUST be before /:id route so "saved" is not matched as a gig ID.
 * Returns empty array when user has no saved gigs (not 404).
 */
router.get('/saved', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: savedRows, error: savedErr } = await supabaseAdmin
      .from('GigSave')
      .select('gig_id, created_at')
      .eq('user_id', userId);

    if (savedErr) {
      if (isMissingTableError(savedErr, 'GigSave')) {
        logMissingGigFeatureTableOnce('GigSave', 'saved_list');
        return res.json({ gigs: [], total: 0 });
      }
      logger.error('Saved gigs fetch error', { error: savedErr.message, userId });
      return res.status(500).json({ error: 'Failed to fetch saved gigs' });
    }

    const savedGigIds = Array.from(
      new Set((savedRows || []).map((row) => String(row.gig_id)).filter(Boolean))
    );

    if (savedGigIds.length === 0) {
      return res.json({ gigs: [], total: 0 });
    }

    const { data: gigs, error: gigsErr } = await supabaseAdmin
      .from('Gig')
      .select(
        `
          id,
          title,
          description,
          price,
          category,
          deadline,
          estimated_duration,
          user_id,
          status,
          accepted_by,
          created_at,
          attachments,
          is_urgent,
          tags,
          items,
          engagement_mode,
          schedule_type,
          pay_type,
          task_archetype,
          starts_asap,
          response_window_minutes,
          pickup_address,
          dropoff_address,
          requires_license,
          scope_description,
          care_details,
          logistics_details,
          remote_details,
          urgent_details,
          event_details,
          User:user_id (
            id,
            username,
            name,
            first_name,
            last_name,
            profile_picture_url,
            city,
            state,
            account_type
          )
        `
      )
      .in('id', savedGigIds);

    if (gigsErr) {
      logger.error('Saved gigs fetch error', { error: gigsErr.message, userId });
      return res.status(500).json({ error: 'Failed to fetch saved gigs' });
    }

    let bidCountsByGigId = {};
    if (savedGigIds.length > 0) {
      const { data: bidRows, error: bidErr } = await supabaseAdmin
        .from('GigBid')
        .select('gig_id')
        .in('gig_id', savedGigIds);

      if (bidErr) {
        logger.warn('Failed to load bid counts for saved gigs', {
          userId,
          gigCount: savedGigIds.length,
          error: bidErr.message,
        });
      } else {
        for (const row of bidRows || []) {
          const gigId = String(row.gig_id);
          bidCountsByGigId[gigId] = (bidCountsByGigId[gigId] || 0) + 1;
        }
      }
    }

    const savedOrder = new Map(savedGigIds.map((gigId, index) => [String(gigId), index]));
    const enriched = (gigs || [])
      .map((gig) => {
        const poster = gig.User || null;
        const posterDisplayName =
          poster?.name ||
          [poster?.first_name, poster?.last_name].filter(Boolean).join(' ') ||
          poster?.username ||
          'Anonymous';

        return {
          ...gig,
          poster_display_name: posterDisplayName,
          poster_username: poster?.username || null,
          poster_profile_picture_url: poster?.profile_picture_url || null,
          poster_account_type: poster?.account_type || null,
          bid_count: bidCountsByGigId[String(gig.id)] || 0,
          bidsCount: bidCountsByGigId[String(gig.id)] || 0,
          viewer_has_saved: true,
          first_image: extractFirstImage(gig.attachments),
        };
      })
      .sort(
        (a, b) =>
          (savedOrder.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER) -
          (savedOrder.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER)
      );

    res.json({ gigs: enriched, total: enriched.length });
  } catch (err) {
    logger.error('Saved gigs fetch error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch saved gigs' });
  }
});

/**
 * GET /api/gigs/rebookable
 * Returns user's completed gigs that can be rebooked (same worker, same task type).
 * Deduplicates by worker + category, keeping the most recent.
 * MUST be before /:gigId routes so "rebookable" is not matched as a gig ID.
 */
router.get('/rebookable', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch completed gigs posted by the user within the last 6 months
    const { data: gigs, error: gigsErr } = await supabaseAdmin
      .from('Gig')
      .select('id, title, category, price, accepted_by, owner_confirmed_at, exact_city, exact_state')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('accepted_by', 'is', null)
      .gte('owner_confirmed_at', sixMonthsAgo)
      .order('owner_confirmed_at', { ascending: false })
      .limit(50);

    if (gigsErr) {
      logger.error('Rebookable gigs query error', { error: gigsErr.message, userId });
      return res.status(500).json({ error: 'Failed to fetch rebookable gigs' });
    }

    if (!gigs || gigs.length === 0) {
      return res.json({ rebookable: [] });
    }

    // 2. Deduplicate by worker + category (keep most recent, already sorted desc)
    const seen = new Set();
    const deduped = [];
    for (const gig of gigs) {
      const key = `${gig.accepted_by}::${gig.category}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(gig);
      }
    }
    const limited = deduped.slice(0, 10);

    // 3. Fetch worker profiles
    const workerIds = [...new Set(limited.map(g => g.accepted_by))];
    const { data: workers, error: workersErr } = await supabaseAdmin
      .from('User')
      .select('id, first_name, last_name, username, profile_picture_url, average_rating')
      .in('id', workerIds);

    if (workersErr) {
      logger.error('Rebookable workers query error', { error: workersErr.message });
    }

    const workerMap = {};
    for (const w of (workers || [])) {
      workerMap[w.id] = w;
    }

    // 4. Fetch poster's reviews for these gigs (batch)
    const gigIds = limited.map(g => g.id);
    const { data: reviews, error: reviewsErr } = await supabaseAdmin
      .from('Review')
      .select('gig_id, rating, comment')
      .in('gig_id', gigIds)
      .eq('reviewer_id', userId);

    if (reviewsErr) {
      logger.error('Rebookable reviews query error', { error: reviewsErr.message });
    }

    const reviewMap = {};
    for (const r of (reviews || [])) {
      reviewMap[r.gig_id] = { rating: r.rating, comment: r.comment };
    }

    // 5. Build response
    const rebookable = limited.map(gig => {
      const w = workerMap[gig.accepted_by];
      return {
        id: gig.id,
        title: gig.title,
        category: gig.category,
        price: gig.price,
        completedAt: gig.owner_confirmed_at,
        worker: w ? {
          id: w.id,
          firstName: w.first_name,
          lastName: w.last_name,
          username: w.username,
          avatarUrl: w.profile_picture_url,
          rating: w.average_rating,
        } : null,
        myReview: reviewMap[gig.id] || null,
        city: gig.exact_city,
        state: gig.exact_state,
      };
    });

    res.json({ rebookable });
  } catch (err) {
    logger.error('Rebookable gigs fetch error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch rebookable gigs' });
  }
});

/**
 * GET /api/gigs/price-benchmark
 * Returns price intelligence for a given gig/task category.
 * Query params: category (required), lat, lng
 * MUST be before /:gigId routes so "price-benchmark" is not matched as a gig ID.
 */
router.get('/price-benchmark', optionalAuth, async (req, res) => {
  try {
    const { category, lat, lng } = req.query;

    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }

    const benchmark = await gigPricingService.getGigPriceBenchmark({
      category,
      latitude: lat ? parseFloat(lat) : undefined,
      longitude: lng ? parseFloat(lng) : undefined,
    });

    res.json({ benchmark });
  } catch (err) {
    logger.error('Gig price benchmark error', { error: err.message });
    res.status(500).json({ error: 'Failed to get price benchmark' });
  }
});

/**
 * POST /api/gigs/:gigId/save
 * Save/bookmark a gig for the current user.
 */
router.post('/:gigId/save', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id')
      .eq('id', gigId)
      .maybeSingle();

    if (gigErr) {
      logger.error('Gig save lookup error', { gigId, userId, error: gigErr.message });
      return res.status(500).json({ error: 'Failed to save gig' });
    }

    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const { data: existingSave, error: existingErr } = await supabaseAdmin
      .from('GigSave')
      .select('id')
      .eq('gig_id', gigId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingErr) {
      if (isMissingTableError(existingErr, 'GigSave')) {
        logMissingGigFeatureTableOnce('GigSave', 'save');
        return res.status(503).json({
          error: 'Save feature is unavailable until database migrations are applied',
        });
      }
      logger.error('Gig save lookup error', { gigId, userId, error: existingErr.message });
      return res.status(500).json({ error: 'Failed to save gig' });
    }

    if (!existingSave) {
      const { error: insertErr } = await supabaseAdmin.from('GigSave').insert({
        gig_id: gigId,
        user_id: userId,
      });

      if (insertErr) {
        if (isMissingTableError(insertErr, 'GigSave')) {
          logMissingGigFeatureTableOnce('GigSave', 'save');
          return res.status(503).json({
            error: 'Save feature is unavailable until database migrations are applied',
          });
        }
        logger.error('Gig save insert error', { gigId, userId, error: insertErr.message });
        return res.status(500).json({ error: 'Failed to save gig' });
      }
    }

    res.json({ message: 'Gig saved', saved: true });
  } catch (err) {
    logger.error('Gig save error', { error: err.message, gigId: req.params.gigId });
    res.status(500).json({ error: 'Failed to save gig' });
  }
});

/**
 * DELETE /api/gigs/:gigId/save
 * Remove a saved gig for the current user.
 */
router.delete('/:gigId/save', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { error } = await supabaseAdmin
      .from('GigSave')
      .delete()
      .eq('gig_id', gigId)
      .eq('user_id', userId);

    if (error) {
      if (isMissingTableError(error, 'GigSave')) {
        logMissingGigFeatureTableOnce('GigSave', 'unsave');
        return res.status(503).json({
          error: 'Save feature is unavailable until database migrations are applied',
        });
      }
      logger.error('Gig unsave error', { gigId, userId, error: error.message });
      return res.status(500).json({ error: 'Failed to unsave gig' });
    }

    res.json({ message: 'Gig unsaved', saved: false });
  } catch (err) {
    logger.error('Gig unsave error', { error: err.message, gigId: req.params.gigId });
    res.status(500).json({ error: 'Failed to unsave gig' });
  }
});

/**
 * POST /api/gigs/:gigId/report
 * Report a gig for moderation review.
 */
router.post('/:gigId/report', verifyToken, validate(reportGigSchema), async (req, res) => {
  try {
    const { gigId } = req.params;
    const { reason, details } = req.body;
    const userId = req.user.id;

    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id')
      .eq('id', gigId)
      .maybeSingle();

    if (gigErr) {
      logger.error('Gig report lookup error', { gigId, userId, error: gigErr.message });
      return res.status(500).json({ error: 'Failed to report gig' });
    }

    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const { data: existingReport, error: existingErr } = await supabaseAdmin
      .from('GigReport')
      .select('id')
      .eq('gig_id', gigId)
      .eq('reported_by', userId)
      .maybeSingle();

    if (existingErr) {
      if (isMissingTableError(existingErr, 'GigReport')) {
        logMissingGigFeatureTableOnce('GigReport', 'report');
        return res.status(503).json({
          error: 'Report feature is unavailable until database migrations are applied',
        });
      }
      logger.error('Gig report lookup error', { gigId, userId, error: existingErr.message });
      return res.status(500).json({ error: 'Failed to report gig' });
    }

    if (!existingReport) {
      const { error: insertErr } = await supabaseAdmin.from('GigReport').insert({
        gig_id: gigId,
        reported_by: userId,
        reason,
        details: details || null,
      });

      if (insertErr) {
        if (isMissingTableError(insertErr, 'GigReport')) {
          logMissingGigFeatureTableOnce('GigReport', 'report');
          return res.status(503).json({
            error: 'Report feature is unavailable until database migrations are applied',
          });
        }
        logger.error('Gig report insert error', { gigId, userId, error: insertErr.message });
        return res.status(500).json({ error: 'Failed to report gig' });
      }
    }

    res.json({
      message: existingReport
        ? 'Gig already reported. We will review it shortly.'
        : 'Gig reported successfully. We will review it shortly.',
      already_reported: Boolean(existingReport),
    });
  } catch (err) {
    logger.error('Gig report error', { error: err.message, gigId: req.params.gigId });
    res.status(500).json({ error: 'Failed to report gig' });
  }
});

// ============ BROWSE SECTIONS ENDPOINT ============

const { getGigClusters } = require('../services/gig/clusterService');

/**
 * GET /api/gigs/browse
 * Returns pre-sectioned data for the task browse feed.
 * Query params: lat, lng (required), radius (optional, meters, default 100mi)
 */
router.get('/browse', async (req, res) => {
  const startTime = Date.now();
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({ error: 'Valid lat and lng query parameters are required' });
    }

    const radius = Math.min(
      Math.max(parseInt(req.query.radius, 10) || DEFAULT_BROWSE_RADIUS_METERS, MIN_BROWSE_RADIUS_METERS),
      MAX_BROWSE_RADIUS_METERS
    );
    const taskArchetype = req.query.task_archetype || null;
    const userId = await extractOptionalUserId(req);

    // ── Cache check ──
    if (!userId) {
      const cached = browseCache.get(lat, lng, radius);
      if (cached) {
        logger.info('Browse cache hit', { lat, lng, radius, ms: Date.now() - startTime });
        return res.json(cached);
      }
    }

    // Fetch all open gigs in radius (generous batch for sectioning)
    const fetchStart = Date.now();
    const { data: allGigs, error: rpcError } = await supabaseAdmin.rpc('find_gigs_nearby_v2', {
      user_lat: lat,
      user_lon: lng,
      p_radius_meters: radius,
      p_category: null,
      p_min_price: null,
      p_max_price: null,
      p_search: null,
      p_sort: 'newest',
      p_limit: 500,
      p_offset: 0,
      p_include_remote: true,
      gig_status: 'open',
    });

    const fetchMs = Date.now() - fetchStart;
    if (rpcError) {
      logger.error('Browse RPC error', { error: rpcError.message });
      return res.status(500).json({ error: 'Failed to fetch gigs' });
    }

    const visibleGigs = excludeUserOwnedGigs(allGigs || [], userId);

    // ── Fetch user context (optional, non-blocking) ──
    let userAffinities = [];
    let exclusions = { dismissedGigIds: new Set(), hiddenCategories: new Set() };
    if (userId) {
      try {
        [userAffinities, exclusions] = await Promise.all([
          affinityService.getUserAffinities(userId),
          getUserExclusions(userId),
        ]);
      } catch {
        // Non-fatal — ranking falls back to distance + recency only
      }
    }

    // ── Apply user exclusions (dismissed gigs + hidden categories) ──
    let filteredGigs = applyUserExclusions(visibleGigs, exclusions);

    // ── Filter by task_archetype if provided ──
    if (taskArchetype) {
      filteredGigs = filteredGigs.filter((g) => g.task_archetype === taskArchetype);
    }

    const totalActive = filteredGigs.length;

    // ── Batch-fetch exact coordinates for unlocked gigs (exact pin on map) ──
    const { resolveGigPrecision: _resolveBrowsePre } = require('../utils/locationPrivacy');
    const unlockedBrowseIds = filteredGigs.filter((g) => _resolveBrowsePre(g, userId).locationUnlocked).map((g) => g.id).filter(Boolean);
    const exactCoordsByGigIdBrowse = new Map();
    if (unlockedBrowseIds.length > 0) {
      const { data: exactBrowseRows } = await supabaseAdmin.from('Gig').select('id, exact_location').in('id', unlockedBrowseIds);
      for (const row of exactBrowseRows || []) {
        const coords = parsePostGISPoint(row.exact_location);
        if (coords) exactCoordsByGigIdBrowse.set(String(row.id), coords);
      }
    }

    // ── Apply location privacy to all gigs ──
    const { resolveGigPrecision: _resolveBrowse, applyLocationPrecision: _applyBrowse } = require('../utils/locationPrivacy');
    for (const g of filteredGigs) {
      const { precision, isOwner, locationUnlocked } = _resolveBrowse(g, userId);
      _applyBrowse(g, precision, isOwner);
      g.locationUnlocked = locationUnlocked;
      const exactCoords = locationUnlocked ? exactCoordsByGigIdBrowse.get(String(g.id)) : null;
      if (exactCoords) {
        g.latitude = exactCoords.latitude;
        g.longitude = exactCoords.longitude;
        if (g.approx_latitude != null) g.approx_latitude = exactCoords.latitude;
        if (g.approx_longitude != null) g.approx_longitude = exactCoords.longitude;
      }
    }

    // ── Build sections in parallel ──
    const sectionStart = Date.now();

    const [clusters, bestMatches, urgent, highPaying, newToday, quickJobs] = await Promise.all([
      // clusters — from the already-filtered browse set
      getGigClusters({ gigs: filteredGigs, limit: 6 }).catch((err) => {
        logger.warn('Browse: clusters failed', { error: err.message });
        return [];
      }),

      // best_matches — ranked by composite relevance score
      Promise.resolve().then(() => {
        const ranked = rankingService.rankGigs(filteredGigs, {
          maxRadius: radius,
          affinities: userAffinities,
        });
        return ranked.slice(0, 5).map(({ _relevanceScore, ...rest }) => rest);
      }),

      // urgent — deadline today/tomorrow or urgency keywords
      Promise.resolve().then(() => {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 0, 0, 0, 0);
        const urgencyWords = /\b(asap|urgent|today|immediately|emergency|rush)\b/i;

        const matches = filteredGigs.filter((g) => {
          if (g.is_urgent) return true;
          if (g.deadline && new Date(g.deadline) < tomorrow) return true;
          if (urgencyWords.test(g.title || '')) return true;
          return false;
        });

        // Sort by deadline ASC (soonest first), nulls last
        matches.sort((a, b) => {
          const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return da - db;
        });
        return matches.slice(0, 5);
      }),

      // high_paying — above 65th percentile price
      Promise.resolve().then(() => {
        const prices = filteredGigs
          .map((g) => parseFloat(g.price))
          .filter((p) => Number.isFinite(p))
          .sort((a, b) => a - b);

        if (prices.length < 5) return []; // too few to compute percentile

        const p65Index = Math.floor(prices.length * 0.65);
        const p65 = prices[p65Index];

        const matches = filteredGigs
          .filter((g) => parseFloat(g.price) >= p65)
          .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
          .slice(0, 5);

        return matches.length >= 3 ? matches : [];
      }),

      // new_today — posted in last 24h
      Promise.resolve().then(() => {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return filteredGigs
          .filter((g) => g.created_at && new Date(g.created_at) >= cutoff)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 10);
      }),

      // quick_jobs — under $100
      Promise.resolve().then(() => {
        const matches = filteredGigs
          .filter((g) => parseFloat(g.price) < 100)
          .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
          .slice(0, 5);
        return matches.length >= 2 ? matches : [];
      }),
    ]);

    const sectionMs = Date.now() - sectionStart;
    const totalMs = Date.now() - startTime;

    logger.info('Browse sections built', {
      totalMs,
      fetchMs,
      sectionMs,
      totalActive,
      counts: {
        best_matches: bestMatches.length,
        urgent: urgent.length,
        clusters: clusters.length,
        high_paying: highPaying.length,
        new_today: newToday.length,
        quick_jobs: quickJobs.length,
      },
    });

    // Enrich gigs with first_image for thumbnails
    const addFirstImage = (gigs) =>
      gigs.map((g) => ({
        ...g,
        first_image: extractFirstImage(g.attachments),
      }));

    const result = {
      sections: {
        best_matches: addFirstImage(bestMatches),
        urgent: addFirstImage(urgent),
        clusters,
        high_paying: addFirstImage(highPaying),
        new_today: addFirstImage(newToday),
        quick_jobs: addFirstImage(quickJobs),
      },
      total_active: totalActive,
      radius_used: radius,
    };

    // ── Cache store (2 min TTL) ──
    if (!userId) {
      browseCache.set(lat, lng, radius, result);
    }

    res.json(result);
  } catch (err) {
    logger.error('Browse endpoint error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to build browse feed' });
  }
});

// ============================================================
// HIDDEN CATEGORIES (static routes — must come before /:id)
// ============================================================

/**
 * GET /api/gigs/hidden-categories
 * Get current user's hidden categories.
 */
router.get('/hidden-categories', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabaseAdmin
      .from('user_hidden_categories')
      .select('category, hidden_at')
      .eq('user_id', userId);

    if (error) {
      logger.error('Get hidden categories error', { error: error.message });
      return res.status(500).json({ error: 'Failed to get hidden categories' });
    }

    return res.json({ categories: (data || []).map((r) => r.category) });
  } catch (err) {
    logger.error('Hidden categories error', { error: err.message });
    return res.status(500).json({ error: 'Failed to get hidden categories' });
  }
});

/**
 * POST /api/gigs/hidden-categories
 * Hide a category.
 */
router.post('/hidden-categories', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category } = req.body;

    if (!category || typeof category !== 'string') {
      return res.status(400).json({ error: 'Category is required' });
    }

    const { error } = await supabaseAdmin.from('user_hidden_categories').upsert(
      {
        user_id: userId,
        category: category.trim(),
        hidden_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,category' }
    );

    if (error) {
      logger.error('Hide category error', { error: error.message });
      return res.status(500).json({ error: 'Failed to hide category' });
    }

    return res.json({ success: true });
  } catch (err) {
    logger.error('Hide category error', { error: err.message });
    return res.status(500).json({ error: 'Failed to hide category' });
  }
});

/**
 * DELETE /api/gigs/hidden-categories/:category
 * Unhide a category.
 */
router.delete('/hidden-categories/:category', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category } = req.params;

    await supabaseAdmin
      .from('user_hidden_categories')
      .delete()
      .eq('user_id', userId)
      .eq('category', category);

    return res.json({ success: true });
  } catch (err) {
    logger.error('Unhide category error', { error: err.message });
    return res.status(500).json({ error: 'Failed to unhide category' });
  }
});

// -------------------- PARAM ROUTES (MUST COME AFTER STATIC) --------------------

/**
 * GET /api/gigs/:id
 * Get a single gig by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id || (await extractOptionalUserId(req));

    // Public reads should not depend on RLS (server does not forward user JWT to Supabase).
    // Use the service role client for consistent behavior.
    const { data: gig, error } = await supabaseAdmin
      .from('Gig')
      .select(
        `
        *,
        creator:user_id (
          id,
          username,
          name,
          first_name,
          last_name,
          profile_picture_url,
          account_type,
          city,
          state
        ),
        acceptedBy:accepted_by (
          id,
          username,
          name
        )
      `
      )
      .eq('id', id)
      .single();

    if (error || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    if (gig.exact_location) {
      const coords = parsePostGISPoint(gig.exact_location);
      gig.location = coords;
    }

    const savedGigIds = await getViewerSavedGigIds(currentUserId, [gig.id]);
    gig.viewer_has_saved = savedGigIds.has(String(gig.id));

    delete gig.exact_location;
    delete gig.approx_location;

    // Enforce location privacy based on precision + viewer relationship
    const { resolveGigPrecision, applyLocationPrecision } = require('../utils/locationPrivacy');
    const { precision, isOwner, locationUnlocked } = resolveGigPrecision(gig, currentUserId);
    if (gig.location) {
      applyLocationPrecision(gig.location, precision, isOwner, { stripAddress: false, setUnlockedFlag: false });
    }
    applyLocationPrecision(gig, precision, isOwner);
    gig.locationUnlocked = locationUnlocked;

    res.json({ gig: serializeGigForViewer(gig) });
  } catch (err) {
    logger.error('Gig fetch error', { error: err.message, gigId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch gig' });
  }
});

/**
 * PATCH /api/gigs/:id
 * Update a gig
 */
router.patch('/:id', verifyToken, validate(updateGigSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    logger.info('Updating gig', { gigId: id, userId });

    // Verify ownership
    // Use admin client for existence lookup so RLS visibility does not cause false 404s.
    const { data: existingGig, error: fetchError } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, created_by, beneficiary_user_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existingGig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const ownerAccess = await getGigOwnerAccess(existingGig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'You can only update your own gigs' });
    }

    if (existingGig.status !== 'open') {
      return res.status(400).json({ error: 'Can only update open gigs' });
    }

    const updateData = { ...req.body };

    // Handle location
    if (updateData.location) {
      const { latitude, longitude, mode, address, city, state, zip, homeId, place_id,
        geocode_provider, geocode_accuracy, geocode_place_id } =
        updateData.location;
      const approx = calculateApproxLocation(latitude, longitude);

      updateData.exact_location = formatLocationForDB(latitude, longitude);
      updateData.approx_location = formatLocationForDB(approx.latitude, approx.longitude);
      updateData.origin_mode = (mode === 'custom' ? 'address' : mode) || undefined;
      updateData.origin_home_id = homeId || null;
      updateData.origin_place_id = place_id || null;
      updateData.exact_address = address || null;
      updateData.exact_city = city || null;
      updateData.exact_state = state || null;
      updateData.exact_zip = zip || null;

      // Geocode provenance
      updateData.geocode_provider = geocode_provider || 'mapbox';
      updateData.geocode_mode = 'temporary';
      updateData.geocode_accuracy = geocode_accuracy || 'address';
      updateData.geocode_place_id = geocode_place_id || place_id || null;
      updateData.geocode_source_flow = 'gig_edit';
      updateData.geocode_created_at = new Date().toISOString();

      delete updateData.location;
    }

    if (Array.isArray(updateData.items)) {
      updateData.items = updateData.items.length ? JSON.stringify(updateData.items) : '[]';
    }

    const { data: updatedGig, error } = await supabaseAdmin
      .from('Gig')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating gig', { error: error.message, gigId: id });
      return res.status(500).json({ error: 'Failed to update gig' });
    }

    res.json({ gig: updatedGig });
  } catch (err) {
    logger.error('Gig update error', { error: err.message, gigId: req.params.id });
    res.status(500).json({ error: 'Failed to update gig' });
  }
});

/**
 * PATCH /api/gigs/:id/status
 * Update gig status
 */
router.patch('/:id/status', verifyToken, validate(updateStatusSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { status } = req.body;

    logger.info('Updating gig status', { gigId: id, userId, status });

    // Verify ownership
    const { data: existingGig, error: fetchError } = await supabase
      .from('Gig')
      .select('user_id, status, approx_latitude, approx_longitude')
      .eq('id', id)
      .single();

    if (fetchError || !existingGig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const ownerAccess = await getGigOwnerAccess(existingGig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'You can only update your own gigs' });
    }

    const { data: updatedGig, error } = await supabase
      .from('Gig')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating gig status', { error: error.message, gigId: id });
      return res.status(500).json({ error: 'Failed to update gig status' });
    }

    // Invalidate browse cache near this gig
    if (existingGig.approx_latitude != null && existingGig.approx_longitude != null) {
      browseCache.invalidateNear(existingGig.approx_latitude, existingGig.approx_longitude);
    }

    res.json({ gig: updatedGig });
  } catch (err) {
    logger.error('Gig status update error', { error: err.message, gigId: req.params.id });
    res.status(500).json({ error: 'Failed to update gig status' });
  }
});

/**
 * DELETE /api/gigs/:id
 * Delete a gig
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    logger.info('Deleting gig', { gigId: id, userId });

    // Verify ownership
    // Use admin client for existence lookup so RLS visibility does not cause false 404s.
    const { data: existingGig, error: fetchError } = await supabaseAdmin
      .from('Gig')
      .select('user_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existingGig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const ownerAccess = await getGigOwnerAccess(existingGig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'You can only delete your own gigs' });
    }

    if (existingGig.status !== 'open') {
      return res.status(400).json({ error: 'Can only delete open gigs' });
    }

    const { error } = await supabaseAdmin.from('Gig').delete().eq('id', id);

    if (error) {
      logger.error('Error deleting gig', { error: error.message, gigId: id });
      return res.status(500).json({ error: 'Failed to delete gig' });
    }

    logger.info('Gig deleted', { gigId: id, userId });

    res.json({ message: 'Gig deleted successfully' });
  } catch (err) {
    logger.error('Gig delete error', { error: err.message, gigId: req.params.id });
    res.status(500).json({ error: 'Failed to delete gig' });
  }
});

// -------------------- BIDS (PARAM+STATIC MIX) --------------------

/**
 * POST /api/gigs/:gigId/bids
 * Place a bid on a gig
 */
router.post('/:gigId/bids', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const bidAmountRaw = req.body.bid_amount ?? req.body.amount;
    const bidAmount = typeof bidAmountRaw === 'string' ? parseFloat(bidAmountRaw) : bidAmountRaw;

    const { message, proposed_time } = req.body;

    if (!bidAmount || Number.isNaN(bidAmount) || bidAmount <= 0) {
      return res.status(400).json({ error: 'Valid bid amount is required' });
    }

    logger.info('Placing bid', { gigId, userId, bidAmount });

    // Use admin to avoid RLS surprises
    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status, title, deadline, price, category')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    if (gig.status !== 'open') {
      return res.status(400).json({ error: 'This gig is no longer accepting bids' });
    }

    if (gig.user_id === userId) {
      return res.status(400).json({ error: 'You cannot bid on your own gig' });
    }

    // For paid gigs, bidder must have started payout onboarding (Stripe account created).
    // They don't need to be fully verified — just need to have begun the process.
    const gigPrice = parseFloat(gig.price || 0);
    if (gigPrice > 0) {
      const { data: stripeAccount } = await supabaseAdmin
        .from('StripeAccount')
        .select('stripe_account_id, details_submitted')
        .eq('user_id', userId)
        .maybeSingle();

      if (!stripeAccount || !stripeAccount.stripe_account_id) {
        return res.status(400).json({
          error:
            'You need to set up payout onboarding before bidding on paid gigs. Go to your Wallet to complete Stripe setup.',
          code: 'payout_onboarding_required',
        });
      }
    }

    // Check for existing active bid (pending/accepted) OR recent withdrawal cooldown
    const { data: existingBids, error: existingBidError } = await supabaseAdmin
      .from('GigBid')
      .select('id, status, withdrawn_at')
      .eq('gig_id', gigId)
      .eq('user_id', userId);

    if (existingBidError) {
      logger.error('Existing bid check failed', { existingBidError });
      return res.status(500).json({ error: 'Failed to place bid' });
    }

    const activeBid = (existingBids || []).find(
      (b) => b.status === 'pending' || b.status === 'accepted'
    );
    if (activeBid) {
      return res.status(400).json({ error: 'You already have an active bid on this gig' });
    }

    // Re-bid cooldown: 5 minutes after withdrawal
    const recentWithdrawal = (existingBids || []).find((b) => {
      if (b.status !== 'withdrawn' || !b.withdrawn_at) return false;
      const cooldownMs = 5 * 60 * 1000; // 5 minutes
      return Date.now() - new Date(b.withdrawn_at).getTime() < cooldownMs;
    });
    if (recentWithdrawal) {
      return res.status(429).json({
        error: 'Please wait before re-bidding. You can bid again after a short cooldown.',
        cooldown_until: new Date(
          new Date(recentWithdrawal.withdrawn_at).getTime() + 5 * 60 * 1000
        ).toISOString(),
      });
    }

    // Calculate bid expiry: 48h from now, or gig deadline, whichever is earlier
    const DEFAULT_EXPIRY_HOURS = 48;
    let expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000);
    if (gig.deadline) {
      const deadlineDate = new Date(gig.deadline);
      if (deadlineDate < expiresAt) {
        expiresAt = deadlineDate;
      }
    }

    const { data: bid, error: bidError } = await supabaseAdmin
      .from('GigBid')
      .insert({
        gig_id: gigId,
        user_id: userId,
        bid_amount: bidAmount,
        message: message || null,
        proposed_time: proposed_time || null,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (bidError) {
      logger.error('Error creating bid', { bidError });
      return res.status(500).json({ error: 'Failed to place bid' });
    }

    logger.info('Bid placed successfully', { bidId: bid.id, gigId, userId });

    // ─── Track category affinity (non-blocking) ───
    if (gig.category) {
      affinityService.recordInteraction(userId, gig.category, 'bid').catch(() => {});
    }

    // ─── Notify gig poster: new bid received ───
    const [{ data: bidder }, bidCountResult] = await Promise.all([
      supabaseAdmin
        .from('User')
        .select('name, username')
        .eq('id', userId)
        .single(),
      supabaseAdmin
        .from('GigBid')
        .select('id', { count: 'exact', head: true })
        .eq('gig_id', gigId)
        .in('status', ['pending', 'accepted', 'countered']),
    ]);
    const bidderName = bidder?.name || bidder?.username || 'Someone';
    const activeBidCount = bidCountResult.error ? null : bidCountResult.count;

    notifyBidReceived({
      gigOwnerId: gig.user_id,
      bidderName,
      gigTitle: gig.title || 'your gig',
      gigId,
      isFirstBid: activeBidCount === 1,
    });

    emitGigUpdate(req, gigId, 'bid-update');
    res.status(201).json({ bid });
  } catch (err) {
    logger.error('Place bid error', { error: err.message });
    res.status(500).json({ error: 'Failed to place bid' });
  }
});

/**
 * GET /api/gigs/:gigId/bids
 * Get all bids for a gig (poster only)
 */
router.get('/:gigId/bids', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    logger.info('Fetching gig bids', { gigId, userId });

    // Use admin client to avoid RLS surprises
    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status, category, exact_location, approx_location')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) {
      logger.error('Gig not found for bids', { gigId, gigError: gigError?.message });
      return res.status(404).json({ error: 'Gig not found' });
    }

    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig poster can view bids' });
    }

    // Auto-expire bids that have passed their expiry time
    await supabaseAdmin
      .from('GigBid')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('gig_id', gigId)
      .eq('status', 'pending')
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date().toISOString());

    const { data: bids, error: bidsError } = await supabaseAdmin
      .from('GigBid')
      .select(
        `
        id,
        gig_id,
        user_id,
        bid_amount,
        message,
        proposed_time,
        status,
        created_at,
        updated_at,
        expires_at,
        counter_amount,
        counter_message,
        countered_at,
        counter_status,
        withdrawal_reason,
        withdrawn_at,
        bidder:user_id (
          id,
          username,
          name,
          first_name,
          middle_name,
          last_name,
          profile_picture_url,
          average_rating,
          review_count,
          reliability_score,
          no_show_count,
          gigs_completed
        )
      `
      )
      .eq('gig_id', gigId)
      .order('created_at', { ascending: false });

    if (bidsError) {
      logger.error('Error fetching bids', {
        message: bidsError.message,
        details: bidsError.details,
        hint: bidsError.hint,
        code: bidsError.code,
        gigId,
      });
      return res.status(500).json({ error: 'Failed to fetch bids' });
    }

    // Normalize 'assigned' → 'accepted' for backwards compat
    const normalizedBids = (bids || []).map((b) => ({
      ...serializeGigBidForViewer(b),
      status: b.status === 'assigned' ? 'accepted' : b.status,
    }));

    // ─── Enrich bids with distance, category completions ───
    const bidderIds = [...new Set(normalizedBids.map((b) => b.user_id).filter(Boolean))];

    if (bidderIds.length > 0) {
      // Extract gig coordinates (prefer exact, fall back to approx)
      let gigLat = null;
      let gigLng = null;
      const gigLocRaw = gig.exact_location || gig.approx_location;
      if (gigLocRaw) {
        // Supabase returns geography as GeoJSON: {"type":"Point","coordinates":[lng,lat]}
        try {
          const parsed = typeof gigLocRaw === 'string' ? JSON.parse(gigLocRaw) : gigLocRaw;
          if (parsed && parsed.coordinates) {
            gigLng = parsed.coordinates[0];
            gigLat = parsed.coordinates[1];
          }
        } catch { /* not valid JSON — skip distance */ }
      }

      // Run distance + category completion queries in parallel
      const hasGigCoords = gigLat != null && gigLng != null;
      const [homeRows, categoryRows] = await Promise.all([
        // Batch: fetch primary home coords for each bidder
        hasGigCoords
          ? supabaseAdmin
              .from('HomeOccupancy')
              .select('user_id, home:home_id(map_center_lat, map_center_lng, location)')
              .in('user_id', bidderIds)
              .eq('is_active', true)
              .order('created_at', { ascending: true })
              .then(({ data }) => data || [])
          : Promise.resolve([]),
        // Batch: count category completions per bidder
        gig.category
          ? supabaseAdmin
              .rpc('count_category_completions', {
                p_bidder_ids: bidderIds,
                p_category: gig.category,
              })
              .then(({ data }) => data)
              .catch((err) => { logger.warn('count_category_completions RPC failed', { error: err?.message }); return null; })
          : Promise.resolve(null),
      ]);

      // Build distance map from home rows
      const distanceMap = {};
      if (hasGigCoords && homeRows.length > 0) {
        const seen = new Set();
        for (const row of homeRows) {
          if (seen.has(row.user_id)) continue;
          seen.add(row.user_id);

          const home = row.home;
          if (!home) continue;

          let homeLat = home.map_center_lat;
          let homeLng = home.map_center_lng;
          if ((homeLat == null || homeLng == null) && home.location) {
            try {
              const loc = typeof home.location === 'string' ? JSON.parse(home.location) : home.location;
              if (loc && loc.coordinates) {
                homeLng = loc.coordinates[0];
                homeLat = loc.coordinates[1];
              }
            } catch { /* skip */ }
          }

          if (homeLat != null && homeLng != null) {
            distanceMap[row.user_id] = Math.round(haversineMiles(gigLat, gigLng, homeLat, homeLng) * 10) / 10;
          }
        }
      }

      // Build category completions map
      const categoryCompletionsMap = {};
      if (categoryRows) {
        for (const row of categoryRows) {
          categoryCompletionsMap[row.user_id] = row.cnt;
        }
      } else if (gig.category) {
        // Fallback: direct query if RPC doesn't exist yet
        const { data: fallbackRows } = await supabaseAdmin
          .from('Gig')
          .select('accepted_by')
          .in('accepted_by', bidderIds)
          .eq('category', gig.category)
          .eq('status', 'completed');

        if (fallbackRows) {
          for (const row of fallbackRows) {
            categoryCompletionsMap[row.accepted_by] = (categoryCompletionsMap[row.accepted_by] || 0) + 1;
          }
        }
      }

      // Merge enrichment into each bid
      for (const bid of normalizedBids) {
        bid.bidder_distance_miles = distanceMap[bid.user_id] ?? null;
        bid.bidder_category_completions = categoryCompletionsMap[bid.user_id] ?? 0;
        bid.bidder_avg_response_minutes = null; // Not tracked yet
      }
    }

    res.json({ bids: normalizedBids });
  } catch (err) {
    logger.error('Get bids error', { error: err?.message, stack: err?.stack });
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

/**
 * PUT /api/gigs/:gigId/bids/:bidId
 * Update own active bid (pending/countered).
 */
router.put('/:gigId/bids/:bidId', verifyToken, async (req, res) => {
  try {
    const { gigId, bidId } = req.params;
    const userId = req.user.id;
    const bidAmountRaw = req.body.bid_amount ?? req.body.amount;
    const bidAmount = typeof bidAmountRaw === 'string' ? parseFloat(bidAmountRaw) : bidAmountRaw;
    const { message, proposed_time } = req.body;

    if (!bidAmount || Number.isNaN(bidAmount) || bidAmount <= 0) {
      return res.status(400).json({ error: 'Valid bid amount is required' });
    }

    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('GigBid')
      .select('id, gig_id, user_id, status')
      .eq('id', bidId)
      .eq('gig_id', gigId)
      .single();

    if (bidErr || !bid) return res.status(404).json({ error: 'Bid not found' });
    if (String(bid.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'You can only update your own bid' });
    }
    if (!['pending', 'countered'].includes(String(bid.status || ''))) {
      return res.status(400).json({ error: 'Only pending or countered bids can be updated' });
    }

    const { data: updatedBid, error: updErr } = await supabaseAdmin
      .from('GigBid')
      .update({
        bid_amount: bidAmount,
        message: message || null,
        proposed_time: proposed_time || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bidId)
      .eq('gig_id', gigId)
      .select('*')
      .single();

    if (updErr) {
      logger.error('Update bid error', { error: updErr.message, gigId, bidId, userId });
      return res.status(500).json({ error: 'Failed to update bid' });
    }

    emitGigUpdate(req, req.params.gigId, 'bid-update');
    return res.json({ bid: updatedBid });
  } catch (err) {
    logger.error('Update bid unexpected error', {
      error: err?.message,
      gigId: req.params.gigId,
      bidId: req.params.bidId,
    });
    return res.status(500).json({ error: 'Failed to update bid' });
  }
});

/**
 * POST /api/gigs/:gigId/bids/:bidId/accept
 * Accept a bid (poster only)
 */
router.post('/:gigId/bids/:bidId/accept', verifyToken, async (req, res) => {
  const { gigId, bidId } = req.params;
  const actorUserId = req.user.id;

  try {
    logger.info('Accepting bid', { gigId, bidId, actorUserId });

    // 1) Fetch gig (admin client to avoid RLS surprises)
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status, accepted_by, title, price, scheduled_start, origin_home_id')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) {
      logger.error('Accept bid: gig not found', { gigId, gigErr: gigErr?.message });
      return res.status(404).json({ error: 'Gig not found' });
    }

    const ownerAccess = await getGigOwnerAccess(gig.user_id, actorUserId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig owner can accept bids' });
    }

    if (gig.status !== 'open') {
      return res.status(400).json({ error: `Gig is not open (status=${gig.status})` });
    }

    // 2) Fetch bid and verify it belongs to this gig
    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('GigBid')
      .select('id, gig_id, user_id, status, bid_amount')
      .eq('id', bidId)
      .single();

    if (bidErr || !bid) {
      logger.error('Accept bid: bid not found', { bidId, bidErr: bidErr?.message });
      return res.status(404).json({ error: 'Bid not found' });
    }

    if (String(bid.gig_id) !== String(gigId)) {
      return res.status(400).json({ error: 'Bid does not belong to this gig' });
    }

    // 2.5) For paid gigs, set up payment BEFORE mutating bids/gig.
    // If payment setup fails, the poster must fix their payment method first.
    const agreedPrice = Number.isFinite(Number(bid?.bid_amount))
      ? Number(bid?.bid_amount)
      : (parseFloat(gig?.price || 0) || 0);
    let paymentResult = null;
    if (agreedPrice > 0) {
      try {
        const amountCents = Math.round(agreedPrice * 100);
        // Always create PaymentIntent with manual capture (authorization hold).
        // This places the hold during the payment sheet — no separate "Authorize Card" step.
        // For far-future tasks, if the hold expires, authorizeUpcomingGigs re-authorizes.
        paymentResult = await stripeService.createPaymentIntentForGig({
          payerId: gig.user_id,
          payeeId: bid.user_id,
          gigId,
          amount: amountCents,
          homeId: gig?.origin_home_id || null,
        });
      } catch (paymentErr) {
        logger.error('Accept bid: payment setup failed (blocking)', {
          error: paymentErr?.message,
          gigId,
        });
        return res.status(400).json({
          error: 'Payment setup failed. Please add a payment method before accepting this bid.',
          code: 'payer_payment_required',
        });
      }
    }

    // ── PAID GIG: soft accept with pending_payment ──
    if (agreedPrice > 0) {
      // Concurrency guard: only one bid can be in pending_payment at a time
      const { data: existingPending } = await supabaseAdmin
        .from('GigBid')
        .select('id')
        .eq('gig_id', gigId)
        .eq('status', 'pending_payment')
        .maybeSingle();

      if (existingPending) {
        return res.status(409).json({
          error: 'Another bid is already being processed for payment. Please wait.',
          code: 'pending_payment_conflict',
        });
      }

      // Mark bid as pending_payment (soft hold)
      const pendingExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
      const intentId = paymentResult?.paymentId || paymentResult?.paymentIntentId || paymentResult?.setupIntentId || null;

      const { error: pendingErr } = await supabaseAdmin
        .from('GigBid')
        .update({
          status: 'pending_payment',
          pending_payment_expires_at: pendingExpiry,
          pending_payment_intent_id: intentId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bidId);

      if (pendingErr) {
        logger.error('Accept bid: failed to set pending_payment', { error: pendingErr.message });
        return res.status(500).json({ error: 'Failed to process bid acceptance' });
      }

      const paymentPayload = paymentResult
        ? {
            clientSecret: paymentResult.clientSecret || null,
            paymentId: paymentResult.paymentId || null,
            setupIntentId: paymentResult.setupIntentId || null,
            paymentIntentId: paymentResult.paymentIntentId || null,
          }
        : null;

      // Create ephemeral key so the payment sheet can show saved cards
      let ephemeralKey = null;
      let customerId = null;
      try {
        customerId = await stripeService.getOrCreateCustomer(gig.user_id);
        const ek = await stripeService.createEphemeralKey(customerId);
        ephemeralKey = ek?.secret || null;
      } catch (ekErr) {
        logger.error('Accept bid: failed to create ephemeral key', { error: ekErr?.message });
      }

      return res.json({
        bid: { ...bid, status: 'pending_payment' },
        requiresPaymentSetup: true,
        isSetupIntent: false,
        payment: paymentPayload,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
        clientSecret: paymentPayload?.clientSecret || null,
        paymentId: paymentPayload?.paymentId || null,
        setupIntentId: paymentPayload?.setupIntentId || null,
        paymentIntentId: paymentPayload?.paymentIntentId || null,
        ephemeralKey,
        customerId,
      });
    }

    // ── FREE GIG: immediate full acceptance (no payment step) ──
    // 3) Mark this bid accepted
    const { error: acceptErr } = await supabaseAdmin
      .from('GigBid')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', bidId);

    if (acceptErr) {
      logger.error('Accept bid: failed to update bid', {
        message: acceptErr.message,
        details: acceptErr.details,
        code: acceptErr.code,
      });
      return res.status(500).json({ error: 'Failed to accept bid' });
    }

    // 4) Other pending bids stay alive as standby — they are NOT rejected here.
    //    They will only be rejected when the gig is confirmed complete or cancelled.

    // 5) Update gig to accepted + accepted_by
    const nowIso = new Date().toISOString();
    const { data: updatedGig, error: gigUpdateErr } = await supabaseAdmin
      .from('Gig')
      .update({
        status: 'assigned',
        accepted_by: bid.user_id,
        accepted_at: nowIso,
        price: gig.price,
        updated_at: nowIso,
      })
      .eq('id', gigId)
      .select('*')
      .single();

    if (gigUpdateErr) {
      logger.error('Accept bid: failed to update gig', {
        message: gigUpdateErr.message,
        details: gigUpdateErr.details,
        code: gigUpdateErr.code,
      });
      return res.status(500).json({ error: 'Failed to update gig after accepting bid' });
    }

    const gigTitle = gig.title || 'a gig';

    // 6) Create (or get) gig chat room and ensure participants are present
    let roomId = null;
    try {
      const { data: rpcRoomId, error: rpcErr } = await supabaseAdmin.rpc('get_or_create_gig_chat', {
        p_gig_id: gigId,
      });

      if (rpcErr) {
        logger.error('Accept bid: failed to get_or_create_gig_chat RPC, trying fallback', {
          message: rpcErr.message,
          details: rpcErr.details,
          code: rpcErr.code,
        });

        const { data: existingRoom } = await supabaseAdmin
          .from('ChatRoom')
          .select('id')
          .eq('gig_id', gigId)
          .eq('type', 'gig')
          .single();

        if (existingRoom) {
          roomId = existingRoom.id;
        } else {
          const { data: newRoom, error: createErr } = await supabaseAdmin
            .from('ChatRoom')
            .insert({
              type: 'gig',
              gig_id: gigId,
              name: `Gig: ${updatedGig?.title || 'Chat'}`,
            })
            .select('id')
            .single();

          if (createErr) {
            logger.error('Accept bid: fallback room creation failed', { message: createErr.message });
          } else {
            roomId = newRoom.id;
          }
        }
      } else {
        roomId = rpcRoomId;
      }

      if (roomId) {
        const participants = [
          { room_id: roomId, user_id: gig.user_id, role: 'owner', is_active: true },
          { room_id: roomId, user_id: bid.user_id, role: 'member', is_active: true },
          ...(String(actorUserId) !== String(gig.user_id)
            ? [{ room_id: roomId, user_id: actorUserId, role: 'member', is_active: true }]
            : []),
        ];

        await supabaseAdmin
          .from('ChatParticipant')
          .upsert(participants, { onConflict: 'room_id,user_id' });

        await supabaseAdmin.from('ChatMessage').insert({
          room_id: roomId,
          user_id: gig.user_id,
          type: 'gig_offer',
          message: `Offer accepted for "${gigTitle}" • Budget: $${updatedGig?.price ?? 'N/A'} • Open gig: /gigs/${gigId}`,
          metadata: {
            gigId,
            gig_id: gigId,
            title: gigTitle || gig?.title || 'Task',
            category: gig?.category || null,
            status: 'assigned',
            price: updatedGig?.price ?? gig?.price ?? null,
            auto_generated: true,
          },
        });

        const gigAddress = gig.exact_address || [gig.exact_city, gig.exact_state].filter(Boolean).join(', ') || null;
        if (gigAddress) {
          await supabaseAdmin.from('ChatMessage').insert({
            room_id: roomId,
            user_id: gig.user_id,
            type: 'system',
            message: `📍 Address unlocked: ${gigAddress}`,
          });
        }
      }
    } catch (e) {
      logger.error('Accept bid: chat room creation unexpected error', { error: e?.message, gigId });
    }

    // ─── Notifications ───
    const acceptedAddress = gig.exact_address || [gig.exact_city, gig.exact_state].filter(Boolean).join(', ') || null;
    notifyBidAccepted({
      bidderId: bid.user_id,
      gigTitle,
      gigId,
      gigOwnerId: gig.user_id,
      address: acceptedAddress,
    });

    // Notify other bidders they are on standby (bids stay pending)
    const { data: standbyBids } = await supabaseAdmin
      .from('GigBid')
      .select('user_id')
      .eq('gig_id', gigId)
      .in('status', ['pending', 'countered'])
      .neq('user_id', bid.user_id);

    if (standbyBids && standbyBids.length > 0) {
      const standbyUserIds = [...new Set(standbyBids.map((sb) => sb.user_id))];
      createBulkNotifications(standbyUserIds.map((uid) => ({
        userId: uid,
        type: 'bid_on_standby',
        title: `Another bid was selected first for "${gigTitle}"`,
        body: "Don't be discouraged — your bid is still active. If things don't work out, you may still be selected. You can also withdraw your bid if you prefer.",
        icon: '⏳',
        link: `/gigs/${gigId}`,
        metadata: { gig_id: gigId },
      })));
    }

    emitGigUpdate(req, gigId, 'bid-accepted');
    emitGigUpdate(req, gigId, 'status-change');
    return res.json({
      gig: updatedGig || null,
      bid: { ...bid, status: 'accepted' },
      roomId,
      paymentRequired: false,
      requiresPaymentSetup: false,
      isSetupIntent: false,
      payment: null,
      publishableKey: null,
      clientSecret: null,
      paymentId: null,
      setupIntentId: null,
      paymentIntentId: null,
    });
  } catch (err) {
    logger.error('Accept bid: unexpected error', { error: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to accept bid' });
  }
});

/**
 * POST /api/gigs/:gigId/bids/:bidId/finalize-accept
 * Completes the acceptance after payment is authorized.
 * Transitions bid from pending_payment → accepted, assigns gig, sends notifications.
 */
router.post('/:gigId/bids/:bidId/finalize-accept', verifyToken, async (req, res) => {
  const { gigId, bidId } = req.params;
  const actorUserId = req.user.id;

  try {
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status, title, price, scheduled_start, origin_home_id, exact_address, exact_city, exact_state, category')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) return res.status(404).json({ error: 'Gig not found' });

    const ownerAccess = await getGigOwnerAccess(gig.user_id, actorUserId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig owner can finalize acceptance' });
    }

    if (gig.status !== 'open') {
      return res.status(400).json({ error: `Gig is not open (status=${gig.status})` });
    }

    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('GigBid')
      .select('id, gig_id, user_id, status, bid_amount, pending_payment_expires_at, pending_payment_intent_id')
      .eq('id', bidId)
      .single();

    if (bidErr || !bid) return res.status(404).json({ error: 'Bid not found' });

    if (String(bid.gig_id) !== String(gigId)) {
      return res.status(400).json({ error: 'Bid does not belong to this gig' });
    }

    if (bid.status !== 'pending_payment') {
      return res.status(400).json({ error: `Bid is not in pending_payment state (status=${bid.status})` });
    }

    // Check expiry
    if (bid.pending_payment_expires_at && new Date(bid.pending_payment_expires_at) < new Date()) {
      // Revert the expired bid
      await supabaseAdmin
        .from('GigBid')
        .update({ status: 'pending', pending_payment_expires_at: null, pending_payment_intent_id: null, updated_at: new Date().toISOString() })
        .eq('id', bidId);
      return res.status(410).json({ error: 'Payment window expired. Please try accepting the bid again.' });
    }

    const agreedPrice = Number.isFinite(Number(bid.bid_amount)) ? Number(bid.bid_amount) : (parseFloat(gig.price || 0) || 0);
    const nowIso = new Date().toISOString();

    // 1) Mark bid accepted, clear pending_payment fields
    const { error: acceptErr } = await supabaseAdmin
      .from('GigBid')
      .update({
        status: 'accepted',
        pending_payment_expires_at: null,
        pending_payment_intent_id: null,
        updated_at: nowIso,
      })
      .eq('id', bidId)
      .eq('status', 'pending_payment'); // optimistic lock

    if (acceptErr) {
      logger.error('Finalize accept: failed to update bid', { error: acceptErr.message });
      return res.status(500).json({ error: 'Failed to finalize acceptance' });
    }

    // 2) Other pending bids stay alive as standby — NOT rejected here.
    //    They will only be rejected when the gig is confirmed complete or cancelled.

    // 3) Assign gig
    const { data: updatedGig, error: gigUpdateErr } = await supabaseAdmin
      .from('Gig')
      .update({
        status: 'assigned',
        accepted_by: bid.user_id,
        accepted_at: nowIso,
        price: agreedPrice > 0 ? agreedPrice : gig.price,
        updated_at: nowIso,
      })
      .eq('id', gigId)
      .select('*')
      .single();

    if (gigUpdateErr) {
      logger.error('Finalize accept: failed to update gig', { error: gigUpdateErr.message });
      return res.status(500).json({ error: 'Failed to assign gig' });
    }

    // 4) Link payment to gig and sync authorization status from Stripe
    if (bid.pending_payment_intent_id) {
      // Link payment first
      await supabaseAdmin
        .from('Gig')
        .update({
          payment_id: bid.pending_payment_intent_id,
          payment_status: PAYMENT_STATES.AUTHORIZE_PENDING,
          updated_at: nowIso,
        })
        .eq('id', gigId);

      // Sync actual status from Stripe — if the user completed the payment sheet,
      // the PaymentIntent should be in requires_capture (AUTHORIZED).
      try {
        const syncResult = await stripeService.syncPaymentAuthorizationStatus(bid.pending_payment_intent_id);
        if (syncResult.payment_status && syncResult.payment_status !== PAYMENT_STATES.AUTHORIZE_PENDING) {
          await supabaseAdmin
            .from('Gig')
            .update({ payment_status: syncResult.payment_status, updated_at: nowIso })
            .eq('id', gigId);
        }
      } catch (syncErr) {
        logger.error('Finalize accept: payment sync failed, webhook will update later', {
          gigId,
          paymentId: bid.pending_payment_intent_id,
          error: syncErr.message,
        });
      }

      // Save the payment method to the user's PaymentMethod table so it
      // appears in Payments & Payouts > Methods.
      try {
        logger.info('Finalize accept: syncing payment method', {
          paymentId: bid.pending_payment_intent_id,
          userId: gig.user_id,
        });
        await stripeService.syncPaymentMethodToLocal(bid.pending_payment_intent_id, gig.user_id);
      } catch (pmErr) {
        logger.error('Finalize accept: failed to save payment method', {
          error: pmErr?.message,
          stack: pmErr?.stack,
        });
      }
    }

    const gigTitle = gig.title || 'a gig';

    // 5) Create (or get) gig chat room
    let roomId = null;
    try {
      const { data: rpcRoomId, error: rpcErr } = await supabaseAdmin.rpc('get_or_create_gig_chat', {
        p_gig_id: gigId,
      });

      if (rpcErr) {
        const { data: existingRoom } = await supabaseAdmin
          .from('ChatRoom')
          .select('id')
          .eq('gig_id', gigId)
          .eq('type', 'gig')
          .single();

        roomId = existingRoom ? existingRoom.id : null;
        if (!existingRoom) {
          const { data: newRoom } = await supabaseAdmin
            .from('ChatRoom')
            .insert({ type: 'gig', gig_id: gigId, name: `Gig: ${updatedGig?.title || 'Chat'}` })
            .select('id')
            .single();
          roomId = newRoom?.id || null;
        }
      } else {
        roomId = rpcRoomId;
      }

      if (roomId) {
        const participants = [
          { room_id: roomId, user_id: gig.user_id, role: 'owner', is_active: true },
          { room_id: roomId, user_id: bid.user_id, role: 'member', is_active: true },
          ...(String(actorUserId) !== String(gig.user_id)
            ? [{ room_id: roomId, user_id: actorUserId, role: 'member', is_active: true }]
            : []),
        ];
        await supabaseAdmin
          .from('ChatParticipant')
          .upsert(participants, { onConflict: 'room_id,user_id' });

        await supabaseAdmin.from('ChatMessage').insert({
          room_id: roomId,
          user_id: gig.user_id,
          type: 'gig_offer',
          message: `Offer accepted for "${gigTitle}" • Budget: $${updatedGig?.price ?? 'N/A'} • Open gig: /gigs/${gigId}`,
          metadata: {
            gigId, gig_id: gigId, title: gigTitle, category: gig?.category || null,
            status: 'assigned', price: updatedGig?.price ?? gig?.price ?? null, auto_generated: true,
          },
        });

        const gigAddress = gig.exact_address || [gig.exact_city, gig.exact_state].filter(Boolean).join(', ') || null;
        if (gigAddress) {
          await supabaseAdmin.from('ChatMessage').insert({
            room_id: roomId, user_id: gig.user_id, type: 'system',
            message: `📍 Address unlocked: ${gigAddress}`,
          });
        }
      }
    } catch (e) {
      logger.error('Finalize accept: chat room error', { error: e?.message, gigId });
    }

    // 6) Notifications
    const acceptedAddress = gig.exact_address || [gig.exact_city, gig.exact_state].filter(Boolean).join(', ') || null;
    notifyBidAccepted({ bidderId: bid.user_id, gigTitle, gigId, gigOwnerId: gig.user_id, address: acceptedAddress });

    // Notify other bidders they are on standby (bids stay pending)
    const { data: standbyBids } = await supabaseAdmin
      .from('GigBid')
      .select('user_id')
      .eq('gig_id', gigId)
      .in('status', ['pending', 'countered'])
      .neq('user_id', bid.user_id);

    if (standbyBids && standbyBids.length > 0) {
      const standbyUserIds = [...new Set(standbyBids.map((sb) => sb.user_id))];
      createBulkNotifications(standbyUserIds.map((uid) => ({
        userId: uid, type: 'bid_on_standby',
        title: `Another bid was selected first for "${gigTitle}"`,
        body: "Don't be discouraged — your bid is still active. If things don't work out, you may still be selected. You can also withdraw your bid if you prefer.",
        icon: '⏳', link: `/gigs/${gigId}`, metadata: { gig_id: gigId },
      })));
    }

    // Payout onboarding nudge
    if (agreedPrice > 0) {
      const { data: payeeAccount } = await supabaseAdmin
        .from('StripeAccount')
        .select('stripe_account_id')
        .eq('user_id', bid.user_id)
        .maybeSingle();

      if (!payeeAccount || !payeeAccount.stripe_account_id) {
        createNotification({
          userId: bid.user_id, type: 'payout_onboarding_nudge',
          title: 'Set up your payout account',
          body: `You've been assigned a paid gig! Set up your payout account to withdraw your earnings.`,
          icon: '💳', link: '/app/settings/payments', metadata: { gig_id: gigId },
        });
      }
    }

    emitGigUpdate(req, gigId, 'bid-accepted');
    emitGigUpdate(req, gigId, 'status-change');

    return res.json({
      gig: updatedGig || null,
      bid: { ...bid, status: 'accepted', pending_payment_expires_at: null, pending_payment_intent_id: null },
      roomId,
      message: 'Bid accepted and gig assigned.',
    });
  } catch (err) {
    logger.error('Finalize accept: unexpected error', { error: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Failed to finalize acceptance' });
  }
});

/**
 * POST /api/gigs/:gigId/bids/:bidId/abort-accept
 * Aborts a pending payment acceptance. Reverts bid to pending, cancels Stripe intent.
 */
router.post('/:gigId/bids/:bidId/abort-accept', verifyToken, async (req, res) => {
  const { gigId, bidId } = req.params;
  const actorUserId = req.user.id;

  try {
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) return res.status(404).json({ error: 'Gig not found' });

    const ownerAccess = await getGigOwnerAccess(gig.user_id, actorUserId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig owner can abort acceptance' });
    }

    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('GigBid')
      .select('id, status, pending_payment_intent_id')
      .eq('id', bidId)
      .single();

    if (bidErr || !bid) return res.status(404).json({ error: 'Bid not found' });

    // Idempotent: if bid is already not pending_payment, nothing to do
    if (bid.status !== 'pending_payment') {
      return res.json({ bid, message: 'Bid already processed' });
    }

    // Cancel the Stripe intent if one was created
    if (bid.pending_payment_intent_id) {
      try {
        await stripeService.cancelAuthorization(bid.pending_payment_intent_id);
      } catch (cancelErr) {
        logger.error('Abort accept: failed to cancel Stripe intent', {
          error: cancelErr.message,
          intentId: bid.pending_payment_intent_id,
        });
        // Continue — reverting the bid is more important than cancelling the intent
      }
    }

    // Revert bid to pending
    await supabaseAdmin
      .from('GigBid')
      .update({
        status: 'pending',
        pending_payment_expires_at: null,
        pending_payment_intent_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bidId);

    return res.json({
      bid: { ...bid, status: 'pending', pending_payment_expires_at: null, pending_payment_intent_id: null },
      message: 'Payment aborted. Bid restored to pending.',
    });
  } catch (err) {
    logger.error('Abort accept: unexpected error', { error: err?.message });
    return res.status(500).json({ error: 'Failed to abort acceptance' });
  }
});

/**
 * POST /api/gigs/:gigId/reopen-bidding
 * Reopen bidding after an assigned gig didn't work out before work started.
 * - Cancels pre-capture payment/setup if present
 * - By default: reverts accepted bid to rejected and reopens rejected bids
 * - In payment-abort rollback mode: restores accepted bid to pending and only
 *   reopens bids likely rejected during the just-attempted accept flow
 * - Moves gig back to open
 */
router.post('/:gigId/reopen-bidding', verifyToken, async (req, res) => {
  const { gigId } = req.params;
  const actorUserId = req.user.id;
  const rollbackMode =
    typeof req.body?.rollbackMode === 'string'
      ? req.body.rollbackMode
      : typeof req.body?.rollback_mode === 'string'
        ? req.body.rollback_mode
        : typeof req.body?.reason === 'string'
          ? req.body.reason
          : null;
  const isPaymentAbortRollback = rollbackMode === 'payment_setup_aborted';

  try {
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select(
        'id, user_id, status, accepted_by, accepted_at, started_at, payment_id, payment_status, title'
      )
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const ownerAccess = await getGigOwnerAccess(gig.user_id, actorUserId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig owner can reopen bidding' });
    }

    if (gig.status !== 'assigned') {
      return res
        .status(400)
        .json({
          error: `Bidding can only be reopened from assigned status (current: ${gig.status})`,
        });
    }
    if (gig.started_at) {
      return res.status(400).json({ error: 'Cannot reopen bidding after work has started' });
    }

    // If a payment is linked, it must still be in a pre-capture state.
    if (gig.payment_id) {
      const { data: payment } = await supabaseAdmin
        .from('Payment')
        .select('id, payment_status')
        .eq('id', gig.payment_id)
        .single();

      if (payment) {
        const preCaptureStates = [
          PAYMENT_STATES.AUTHORIZED,
          PAYMENT_STATES.AUTHORIZE_PENDING,
          PAYMENT_STATES.AUTHORIZATION_FAILED,
          PAYMENT_STATES.SETUP_PENDING,
          PAYMENT_STATES.READY_TO_AUTHORIZE,
          PAYMENT_STATES.CANCELED,
          PAYMENT_STATES.NONE,
        ];

        if (!preCaptureStates.includes(payment.payment_status)) {
          return res.status(400).json({
            error: `Cannot reopen bidding because payment is already in ${payment.payment_status} state`,
          });
        }

        if (![PAYMENT_STATES.CANCELED, PAYMENT_STATES.NONE].includes(payment.payment_status)) {
          await stripeService.cancelAuthorization(gig.payment_id);
        }
      }
    }

    // Find currently accepted bid (if any) and roll it back.
    const { data: acceptedBid } = await supabaseAdmin
      .from('GigBid')
      .select('id, user_id')
      .eq('gig_id', gigId)
      .eq('status', 'accepted')
      .maybeSingle();

    if (acceptedBid?.id) {
      const acceptedRollbackStatus = isPaymentAbortRollback ? 'pending' : 'rejected';
      await supabaseAdmin
        .from('GigBid')
        .update({ status: acceptedRollbackStatus, updated_at: new Date().toISOString() })
        .eq('id', acceptedBid.id);
    }

    // Other bids are already pending (no longer auto-rejected on accept),
    // so no need to reopen them. Just reset the gig to open.

    const nowIso = new Date().toISOString();
    const { data: updatedGig, error: gigUpdateErr } = await supabaseAdmin
      .from('Gig')
      .update({
        status: 'open',
        accepted_by: null,
        accepted_at: null,
        payment_id: null,
        payment_status: PAYMENT_STATES.NONE,
        worker_ack_status: null,
        worker_ack_eta_minutes: null,
        worker_ack_note: null,
        worker_ack_updated_at: null,
        last_worker_reminder_at: null,
        auto_reminder_count: 0,
        updated_at: nowIso,
      })
      .eq('id', gigId)
      .select('*')
      .single();

    if (gigUpdateErr) {
      logger.error('Reopen bidding: failed to update gig', { error: gigUpdateErr.message, gigId });
      return res.status(500).json({ error: 'Failed to reopen bidding' });
    }

    // Notify the formerly accepted worker.
    if (acceptedBid?.user_id && !isPaymentAbortRollback) {
      createNotification({
        userId: acceptedBid.user_id,
        type: 'bid_rejected',
        title: 'Gig was reopened',
        body: `The poster reopened bidding for "${gig.title || 'a gig'}".`,
        icon: 'ℹ️',
        link: `/gigs/${gigId}`,
        metadata: { gig_id: gigId, reason: 'reopened_bidding' },
      });
    }
    if (acceptedBid?.user_id && isPaymentAbortRollback) {
      createNotification({
        userId: acceptedBid.user_id,
        type: 'bid_reopened',
        title: `Bid active again for "${gig.title || 'a gig'}"`,
        body: 'Payment setup was not completed. Your bid is back to pending.',
        icon: '🔄',
        link: `/gigs/${gigId}`,
        metadata: { gig_id: gigId, reason: 'payment_setup_aborted' },
      });
    }

    return res.json({
      gig: updatedGig,
      reopened_count: 0,
      accepted_bid_restored: Boolean(isPaymentAbortRollback && acceptedBid?.id),
      message: 'Bidding reopened successfully.',
    });
  } catch (err) {
    logger.error('Reopen bidding error', { error: err?.message, gigId, actorUserId });
    return res.status(500).json({ error: 'Failed to reopen bidding' });
  }
});

/**
 * POST /api/gigs/:gigId/bids/:bidId/reject
 * Reject a bid (poster only)
 */
router.post('/:gigId/bids/:bidId/reject', verifyToken, async (req, res) => {
  try {
    const { gigId, bidId } = req.params;
    const userId = req.user.id;

    logger.info('Rejecting bid', { gigId, bidId, userId });

    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('user_id, title')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig poster can reject bids' });
    }

    // Fetch bid to get bidder user_id before updating
    const { data: bidData, error: bidFetchErr } = await supabaseAdmin
      .from('GigBid')
      .select('user_id')
      .eq('id', bidId)
      .eq('gig_id', gigId)
      .single();

    if (bidFetchErr || !bidData) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const { error: bidError } = await supabaseAdmin
      .from('GigBid')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', bidId)
      .eq('gig_id', gigId);

    if (bidError) {
      logger.error('Error rejecting bid', { error: bidError.message });
      return res.status(500).json({ error: 'Failed to reject bid' });
    }

    // ─── Notify the bidder ───
    if (bidData) {
      createNotification({
        userId: bidData.user_id,
        type: 'bid_rejected',
        title: 'Your bid was declined',
        body: `The poster declined your bid on "${gig.title || 'a gig'}".`,
        icon: '😔',
        link: `/gigs/${gigId}`,
        metadata: { gig_id: gigId },
      });
    }

    logger.info('Bid rejected successfully', { bidId, gigId });
    emitGigUpdate(req, gigId, 'bid-update');
    res.json({ message: 'Bid rejected successfully' });
  } catch (err) {
    logger.error('Reject bid error', { error: err.message });
    res.status(500).json({ error: 'Failed to reject bid' });
  }
});

/**
 * POST /api/gigs/:gigId/bids/:bidId/counter
 * Requester sends a counter-offer to a bidder (one counter per bid)
 */
router.post('/:gigId/bids/:bidId/counter', verifyToken, async (req, res) => {
  try {
    const { gigId, bidId } = req.params;
    const userId = req.user.id;
    const { amount, message: counterMsg } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valid counter amount is required' });
    }

    // Verify gig ownership
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status, title')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) return res.status(404).json({ error: 'Gig not found' });
    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig poster can send counter-offers' });
    }
    if (gig.status !== 'open') {
      return res.status(400).json({ error: 'Gig is no longer open for bidding' });
    }

    // Verify bid is pending and belongs to this gig
    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('GigBid')
      .select('id, gig_id, user_id, status, counter_status, bid_amount')
      .eq('id', bidId)
      .single();

    if (bidErr || !bid) return res.status(404).json({ error: 'Bid not found' });
    if (String(bid.gig_id) !== String(gigId)) {
      return res.status(400).json({ error: 'Bid does not belong to this gig' });
    }
    if (bid.status !== 'pending') {
      return res.status(400).json({ error: 'Can only counter pending bids' });
    }
    if (bid.counter_status === 'pending') {
      return res.status(400).json({ error: 'A counter-offer is already pending on this bid' });
    }

    const nowIso = new Date().toISOString();
    const { data: updatedBid, error: updateErr } = await supabaseAdmin
      .from('GigBid')
      .update({
        counter_amount: parseFloat(amount),
        counter_message: counterMsg || null,
        countered_at: nowIso,
        countered_by: userId,
        counter_status: 'pending',
        status: 'countered',
        updated_at: nowIso,
      })
      .eq('id', bidId)
      .select()
      .single();

    if (updateErr) {
      logger.error('Counter-offer failed', { error: updateErr.message });
      return res.status(500).json({ error: 'Failed to send counter-offer' });
    }

    // Notify the bidder
    createNotification({
      userId: bid.user_id,
      type: 'bid_countered',
      title: `Counter-offer on "${gig.title || 'a gig'}"`,
      body: `The poster countered your $${bid.bid_amount} bid with $${amount}.`,
      icon: '🤝',
      link: `/gigs/${gigId}`,
      metadata: { gig_id: gigId, counter_amount: amount },
    });

    emitGigUpdate(req, gigId, 'bid-update');
    res.json({ bid: updatedBid });
  } catch (err) {
    logger.error('Counter-offer error', { error: err.message });
    res.status(500).json({ error: 'Failed to send counter-offer' });
  }
});

/**
 * POST /api/gigs/:gigId/bids/:bidId/counter/accept
 * Bidder accepts a counter-offer
 */
router.post('/:gigId/bids/:bidId/counter/accept', verifyToken, async (req, res) => {
  try {
    const { gigId, bidId } = req.params;
    const userId = req.user.id;

    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('GigBid')
      .select('*')
      .eq('id', bidId)
      .eq('gig_id', gigId)
      .single();

    if (bidErr || !bid) return res.status(404).json({ error: 'Bid not found' });
    if (String(bid.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Only the bidder can respond to a counter-offer' });
    }
    if (bid.counter_status !== 'pending') {
      return res.status(400).json({ error: 'No pending counter-offer on this bid' });
    }

    const nowIso = new Date().toISOString();
    const { data: updatedBid, error: updateErr } = await supabaseAdmin
      .from('GigBid')
      .update({
        bid_amount: bid.counter_amount, // Update bid to the counter amount
        counter_status: 'accepted',
        status: 'pending', // Back to pending (counter resolved)
        updated_at: nowIso,
      })
      .eq('id', bidId)
      .select()
      .single();

    if (updateErr) {
      logger.error('Accept counter failed', { error: updateErr.message });
      return res.status(500).json({ error: 'Failed to accept counter-offer' });
    }

    // Notify the requester
    const { data: gig } = await supabaseAdmin
      .from('Gig')
      .select('user_id, title')
      .eq('id', gigId)
      .single();

    if (gig) {
      const { data: bidder } = await supabaseAdmin
        .from('User')
        .select('name, username')
        .eq('id', userId)
        .single();
      const bidderName = bidder?.name || bidder?.username || 'The bidder';

      createNotification({
        userId: gig.user_id,
        type: 'counter_accepted',
        title: `Counter-offer accepted!`,
        body: `${bidderName} accepted your counter of $${bid.counter_amount} on "${gig.title || 'a gig'}".`,
        icon: '✅',
        link: `/gigs/${gigId}`,
        metadata: { gig_id: gigId },
      });
    }

    emitGigUpdate(req, gigId, 'bid-update');
    res.json({ bid: updatedBid });
  } catch (err) {
    logger.error('Accept counter error', { error: err.message });
    res.status(500).json({ error: 'Failed to accept counter-offer' });
  }
});

/**
 * POST /api/gigs/:gigId/bids/:bidId/counter/decline
 * Bidder declines a counter-offer (bid reverts to original pending state)
 */
router.post('/:gigId/bids/:bidId/counter/decline', verifyToken, async (req, res) => {
  try {
    const { gigId, bidId } = req.params;
    const userId = req.user.id;

    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('GigBid')
      .select('*')
      .eq('id', bidId)
      .eq('gig_id', gigId)
      .single();

    if (bidErr || !bid) return res.status(404).json({ error: 'Bid not found' });
    if (String(bid.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Only the bidder can respond to a counter-offer' });
    }
    if (bid.counter_status !== 'pending') {
      return res.status(400).json({ error: 'No pending counter-offer on this bid' });
    }

    const nowIso = new Date().toISOString();
    const { data: updatedBid, error: updateErr } = await supabaseAdmin
      .from('GigBid')
      .update({
        counter_status: 'declined',
        status: 'pending', // Back to original pending bid
        updated_at: nowIso,
      })
      .eq('id', bidId)
      .select()
      .single();

    if (updateErr) {
      logger.error('Decline counter failed', { error: updateErr.message });
      return res.status(500).json({ error: 'Failed to decline counter-offer' });
    }

    // Notify the requester
    const { data: gig } = await supabaseAdmin
      .from('Gig')
      .select('user_id, title')
      .eq('id', gigId)
      .single();

    if (gig) {
      const { data: bidder } = await supabaseAdmin
        .from('User')
        .select('name, username')
        .eq('id', userId)
        .single();
      const bidderName = bidder?.name || bidder?.username || 'The bidder';

      createNotification({
        userId: gig.user_id,
        type: 'counter_declined',
        title: `Counter-offer declined`,
        body: `${bidderName} declined your counter on "${gig.title || 'a gig'}". The original bid stands.`,
        icon: '❌',
        link: `/gigs/${gigId}`,
        metadata: { gig_id: gigId },
      });
    }

    emitGigUpdate(req, gigId, 'bid-update');
    res.json({ bid: updatedBid });
  } catch (err) {
    logger.error('Decline counter error', { error: err.message });
    res.status(500).json({ error: 'Failed to decline counter-offer' });
  }
});

/**
 * POST /api/gigs/:gigId/bids/:bidId/counter/withdraw
 * Gig owner withdraws their pending counter-offer (bid reverts to pending)
 */
router.post('/:gigId/bids/:bidId/counter/withdraw', verifyToken, async (req, res) => {
  try {
    const { gigId, bidId } = req.params;
    const userId = req.user.id;

    // Verify gig ownership
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, title')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) return res.status(404).json({ error: 'Gig not found' });
    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig poster can withdraw a counter-offer' });
    }

    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('GigBid')
      .select('*')
      .eq('id', bidId)
      .eq('gig_id', gigId)
      .single();

    if (bidErr || !bid) return res.status(404).json({ error: 'Bid not found' });
    if (bid.counter_status !== 'pending') {
      return res.status(400).json({ error: 'No pending counter-offer to withdraw' });
    }

    const nowIso = new Date().toISOString();
    const { data: updatedBid, error: updateErr } = await supabaseAdmin
      .from('GigBid')
      .update({
        counter_status: null,
        counter_amount: null,
        counter_message: null,
        countered_at: null,
        countered_by: null,
        status: 'pending',
        updated_at: nowIso,
      })
      .eq('id', bidId)
      .select()
      .single();

    if (updateErr) {
      logger.error('Withdraw counter failed', { error: updateErr.message });
      return res.status(500).json({ error: 'Failed to withdraw counter-offer' });
    }

    // Notify the bidder
    createNotification({
      userId: bid.user_id,
      type: 'counter_withdrawn',
      title: `Counter-offer withdrawn`,
      body: `The poster withdrew their counter-offer on "${gig.title || 'a gig'}". Your original bid stands.`,
      icon: '↩️',
      link: `/gigs/${gigId}`,
      metadata: { gig_id: gigId },
    });

    emitGigUpdate(req, gigId, 'bid-update');
    res.json({ bid: updatedBid });
  } catch (err) {
    logger.error('Withdraw counter error', { error: err.message });
    res.status(500).json({ error: 'Failed to withdraw counter-offer' });
  }
});

/**
 * DELETE /api/gigs/:gigId/bids/:bidId
 * Withdraw a bid (bidder only)
 * Body (optional): { reason: 'schedule_conflict' | 'underpriced' | 'mistake' | 'other' }
 */
router.delete('/:gigId/bids/:bidId', verifyToken, async (req, res) => {
  try {
    const { gigId, bidId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body || {};

    logger.info('Withdrawing bid', { gigId, bidId, userId, reason });

    const { data: bid, error: bidError } = await supabaseAdmin
      .from('GigBid')
      .select('*')
      .eq('id', bidId)
      .eq('gig_id', gigId)
      .single();

    if (bidError || !bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    if (bid.user_id !== userId) {
      return res.status(403).json({ error: 'You can only withdraw your own bids' });
    }

    if (bid.status !== 'pending' && bid.status !== 'countered') {
      return res.status(400).json({ error: 'You can only withdraw pending or countered bids' });
    }

    const nowIso = new Date().toISOString();
    const validReasons = ['schedule_conflict', 'underpriced', 'mistake', 'other'];
    const safeReason = validReasons.includes(reason) ? reason : null;

    // Soft-delete: update status to 'withdrawn' instead of deleting
    const { error: updateError } = await supabaseAdmin
      .from('GigBid')
      .update({
        status: 'withdrawn',
        withdrawal_reason: safeReason,
        withdrawn_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', bidId);

    if (updateError) {
      logger.error('Error withdrawing bid', { error: updateError.message });
      return res.status(500).json({ error: 'Failed to withdraw bid' });
    }

    // ─── Notify gig poster: bidder withdrew ───
    const { data: gigData } = await supabaseAdmin
      .from('Gig')
      .select('user_id, title')
      .eq('id', gigId)
      .single();

    if (gigData) {
      const { data: bidder } = await supabaseAdmin
        .from('User')
        .select('name, username')
        .eq('id', userId)
        .single();
      const bidderName = bidder?.name || bidder?.username || 'A bidder';

      createNotification({
        userId: gigData.user_id,
        type: 'bid_withdrawn',
        title: `Bid withdrawn on "${gigData.title || 'your gig'}"`,
        body: `${bidderName} withdrew their bid.`,
        icon: '↩️',
        link: `/gigs/${gigId}`,
        metadata: { gig_id: gigId },
      });
    }

    logger.info('Bid withdrawn successfully', { bidId, gigId, reason: safeReason });
    emitGigUpdate(req, gigId, 'bid-update');
    res.json({
      message: 'Bid withdrawn successfully',
      // Tell frontend the cooldown for re-bidding
      rebid_available_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    logger.error('Withdraw bid error', { error: err.message });
    res.status(500).json({ error: 'Failed to withdraw bid' });
  }
});

/**
 * POST /api/gigs/:gigId/start
 * Worker starts work: assigned -> in_progress
 */
router.post('/:gigId/start', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status, accepted_by, title, payment_id, payment_status, price, scheduled_start, origin_home_id')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });

    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);
    if (!isWorker)
      return res.status(403).json({ error: 'Only the assigned worker can start this gig' });

    if (gig.status !== 'assigned') {
      return res
        .status(400)
        .json({ error: `Gig must be assigned to start (current: ${gig.status})` });
    }

    // ─── Payment Guard: worker cannot start unless payment is authorized ───
    const gigPrice = parseFloat(gig?.price || 0);
    if (gigPrice > 0 && !gig.payment_id) {
      let createdPaymentStatus = PAYMENT_STATES.NONE;
      let selfHealSucceeded = false;

      // Self-heal legacy assignments that were created without payment initialization.
      // This prevents workers from being permanently blocked on older records.
      // TODO: Remove after migration 094 reconciliation confirms no more legacy rows
      try {
        const amountCents = Math.round(gigPrice * 100);
        const scheduledStart = gig?.scheduled_start ? new Date(gig.scheduled_start) : null;
        const now = new Date();
        const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
        const startsWithinFiveDays = !scheduledStart || scheduledStart <= fiveDaysFromNow;

        const paymentInit = startsWithinFiveDays
          ? await stripeService.createPaymentIntentForGig({
              payerId: gig.user_id,
              payeeId: gig.accepted_by,
              gigId,
              amount: amountCents,
              homeId: gig?.origin_home_id || null,
            })
          : await stripeService.createSetupIntent({
              payerId: gig.user_id,
              payeeId: gig.accepted_by,
              gigId,
              amount: amountCents,
              homeId: gig?.origin_home_id || null,
            });

        createdPaymentStatus = paymentInit?.payment?.payment_status
          || (paymentInit?.setupIntentId ? PAYMENT_STATES.SETUP_PENDING : PAYMENT_STATES.AUTHORIZE_PENDING);

        if (paymentInit?.paymentId) {
          // Idempotency guard: only link payment if no other request beat us to it
          const { data: updatedRows, error: linkErr } = await supabaseAdmin
            .from('Gig')
            .update({
              payment_id: paymentInit.paymentId,
              payment_status: createdPaymentStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', gigId)
            .is('payment_id', null)
            .select('id');

          if (linkErr || !updatedRows || updatedRows.length === 0) {
            // Another request already linked a payment, or the update failed.
            // Cancel the orphaned payment to avoid a dangling Stripe PI/SI.
            logger.warn('Self-heal gig update failed or lost race, canceling orphaned payment', {
              gigId,
              paymentId: paymentInit.paymentId,
              linkErr: linkErr?.message,
            });
            try {
              await stripeService.cancelAuthorization(paymentInit.paymentId);
            } catch (cancelErr) {
              logger.error('Failed to cancel orphaned self-heal payment', {
                gigId,
                paymentId: paymentInit.paymentId,
                error: cancelErr?.message,
              });
            }
          } else {
            selfHealSucceeded = true;
            gig.payment_id = paymentInit.paymentId;
            gig.payment_status = createdPaymentStatus;
          }
        }
      } catch (initErr) {
        logger.error('Start work payment self-heal failed', {
          gigId,
          gigPrice,
          error: initErr?.message,
        });
      }

      // Notify payer that the worker is blocked on payment
      if (String(gig.user_id) !== String(userId)) {
        createNotification({
          userId: gig.user_id,
          type: 'payment_action_required',
          title: 'Worker is waiting for payment setup',
          body: `Your worker tried to start "${gig.title || 'a gig'}", but payment setup is incomplete.`,
          icon: '💳',
          link: `/gigs/${gigId}`,
          metadata: { gig_id: gigId, required_status: PAYMENT_STATES.AUTHORIZED },
        });
      }

      // If self-heal created a payment successfully, tell the client so the
      // payer can complete authorization — don't return a bare 400 after
      // having successfully mutated state.
      if (selfHealSucceeded) {
        return res.status(402).json({
          error: 'Payment was initialized but requires payer authorization',
          payment_status: createdPaymentStatus,
          payment_id: gig.payment_id,
          code: 'payer_authorization_required',
        });
      }

      return res.status(400).json({
        error: 'Payment setup is required before starting work',
        payment_status: createdPaymentStatus,
        code: 'payer_authorization_required',
      });
    }

    if (gig.payment_id) {
      const { data: payment } = await supabaseAdmin
        .from('Payment')
        .select('id, payment_status')
        .eq('id', gig.payment_id)
        .single();

      let effectivePaymentStatus = payment?.payment_status;
      if (payment?.payment_status === PAYMENT_STATES.AUTHORIZE_PENDING) {
        try {
          const reconciled = await stripeService.syncPaymentAuthorizationStatus(payment.id);
          effectivePaymentStatus = reconciled?.payment_status || effectivePaymentStatus;
        } catch (syncErr) {
          logger.warn('Start work payment status reconcile failed', {
            gigId,
            paymentId: payment.id,
            error: syncErr.message,
          });
        }
      }

      if (payment && effectivePaymentStatus !== PAYMENT_STATES.AUTHORIZED) {
        if (String(gig.user_id) !== String(userId)) {
          createNotification({
            userId: gig.user_id,
            type: 'payment_action_required',
            title: 'Worker is waiting for payment authorization',
            body: `Your worker tried to start "${gig.title || 'a gig'}". Please authorize payment first.`,
            icon: '💳',
            link: `/gigs/${gigId}`,
            metadata: {
              gig_id: gigId,
              payment_status: effectivePaymentStatus,
              required_status: PAYMENT_STATES.AUTHORIZED,
            },
          });
        }
        return res.status(400).json({
          error: 'Payment must be authorized before starting work',
          payment_status: effectivePaymentStatus,
          code: 'payer_authorization_required',
        });
      }
    }

    const nowIso = new Date().toISOString();
    const { data: updatedGig, error: updateError } = await supabaseAdmin
      .from('Gig')
      .update({ status: 'in_progress', started_at: nowIso, updated_at: nowIso })
      .eq('id', gigId)
      .select('*')
      .single();

    if (updateError) {
      logger.error('Error starting gig', { error: updateError.message, gigId, userId });
      return res.status(500).json({ error: 'Failed to start gig' });
    }

    // ─── Notify gig poster: worker started ───
    const { data: worker } = await supabaseAdmin
      .from('User')
      .select('name, username')
      .eq('id', userId)
      .single();
    const workerName = worker?.name || worker?.username || 'The worker';

    const ownerRecipients = await getGigOwnerNotificationRecipients(gig.user_id, userId);
    if (ownerRecipients.length > 0) {
      createBulkNotifications(
        ownerRecipients.map((recipientId) => ({
          userId: recipientId,
          type: 'gig_started',
          title: `Work started on "${gig.title || 'your gig'}"`,
          body: `${workerName} has started working on your gig.`,
          icon: '🚀',
          link: `/gigs/${gigId}`,
          metadata: { gig_id: gigId },
        }))
      );
    }

    emitGigUpdate(req, gigId, 'status-change');
    return res.json({ gig: updatedGig });
  } catch (err) {
    logger.error('Start gig error', { error: err.message });
    return res.status(500).json({ error: 'Failed to start gig' });
  }
});

/**
 * POST /api/gigs/:gigId/remind-worker
 * Send a formal reminder to the assigned worker before work has started.
 */
router.post('/:gigId/remind-worker', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const actorUserId = req.user.id;

    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status, accepted_by, started_at, title, scheduled_start, last_worker_reminder_at')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    const ownerAccess = await getGigOwnerAccess(gig.user_id, actorUserId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig owner can remind the worker' });
    }

    if (gig.status !== 'assigned') {
      return res.status(400).json({
        error: `Workers can only be reminded while the gig is assigned (current: ${gig.status})`,
      });
    }

    if (!gig.accepted_by) {
      return res.status(400).json({ error: 'No worker is assigned to this gig' });
    }

    if (gig.started_at) {
      return res.status(400).json({ error: 'Cannot remind the worker after work has started' });
    }

    const nowMs = Date.now();
    const lastReminderMs = gig.last_worker_reminder_at
      ? Date.parse(gig.last_worker_reminder_at)
      : NaN;

    if (
      Number.isFinite(lastReminderMs) &&
      nowMs - lastReminderMs < GIG_START_REMINDER_COOLDOWN_MS
    ) {
      const nextAllowedAt = new Date(
        lastReminderMs + GIG_START_REMINDER_COOLDOWN_MS
      ).toISOString();
      return res.status(429).json({
        error: 'A reminder was already sent recently. Please wait before sending another one.',
        code: 'gig_start_reminder_rate_limited',
        next_allowed_at: nextAllowedAt,
      });
    }

    const scheduledStartText = gig.scheduled_start
      ? ` The scheduled start is ${new Date(gig.scheduled_start).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'UTC',
        })} UTC.`
      : '';

    const reminder = await createNotification({
      userId: gig.accepted_by,
      type: GIG_START_REMINDER_TYPE,
      title: `Please start "${gig.title || 'your task'}"`,
      body: `The task owner is waiting for you to begin work.${scheduledStartText}`,
      icon: '⏰',
      link: `/gigs/${gigId}`,
      metadata: {
        gig_id: gigId,
        reminder_kind: 'start_work',
        sent_by: actorUserId,
      },
    });

    if (!reminder) {
      return res.status(500).json({ error: 'Failed to send reminder right now' });
    }

    const sentAt = new Date(nowMs).toISOString();

    // Persist the reminder timestamp on the Gig row for cooldown tracking
    const { error: reminderUpdateErr } = await supabaseAdmin
      .from('Gig')
      .update({ last_worker_reminder_at: sentAt })
      .eq('id', gigId);

    if (reminderUpdateErr) {
      logger.error('Remind worker: failed to persist reminder timestamp', {
        gigId,
        error: reminderUpdateErr.message,
      });
    }

    return res.json({
      success: true,
      sent_at: sentAt,
      message: 'Reminder sent to the worker.',
    });
  } catch (err) {
    logger.error('Remind worker error', { error: err.message });
    return res.status(500).json({ error: 'Failed to send reminder right now' });
  }
});

/**
 * POST /api/gigs/:gigId/worker-ack
 * Worker acknowledges the assignment: "starting_now" or "running_late".
 * Body: { status: 'starting_now' | 'running_late', eta_minutes?: number, note?: string }
 */
router.post('/:gigId/worker-ack', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const workerId = req.user.id;
    const { status, eta_minutes, note } = req.body || {};

    if (!status || !['starting_now', 'running_late'].includes(status)) {
      return res.status(400).json({ error: 'status must be "starting_now" or "running_late"' });
    }

    if (status === 'running_late' && eta_minutes != null) {
      const eta = Number(eta_minutes);
      if (!Number.isFinite(eta) || !Number.isInteger(eta) || eta < 1 || eta > 480) {
        return res.status(400).json({ error: 'eta_minutes must be a whole number between 1 and 480' });
      }
    }

    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status, accepted_by, started_at, title, worker_ack_status')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    if (String(gig.accepted_by) !== String(workerId)) {
      return res.status(403).json({ error: 'Only the assigned worker can acknowledge' });
    }

    if (gig.status !== 'assigned') {
      return res.status(400).json({
        error: `Acknowledgement is only available while the gig is assigned (current: ${gig.status})`,
      });
    }

    if (gig.started_at) {
      return res.status(400).json({ error: 'Cannot acknowledge after work has started' });
    }

    const statusChanged = gig.worker_ack_status !== status;
    const nowIso = new Date().toISOString();
    const updatePayload = {
      worker_ack_status: status,
      worker_ack_eta_minutes: status === 'running_late' ? (eta_minutes || null) : null,
      worker_ack_note: note ? String(note).slice(0, 1000) : null,
      worker_ack_updated_at: nowIso,
    };

    const { error: ackUpdateErr } = await supabaseAdmin.from('Gig').update(updatePayload).eq('id', gigId);

    if (ackUpdateErr) {
      logger.error('Worker ack: failed to persist acknowledgement', {
        gigId,
        error: ackUpdateErr.message,
      });
      return res.status(500).json({ error: 'Failed to save acknowledgement' });
    }

    // Notify the owner only if the status actually changed
    const isLate = status === 'running_late';
    if (statusChanged) {
      const ownerRecipients = await getGigOwnerNotificationRecipients(gig.user_id, workerId);
      if (ownerRecipients.length > 0) {
        const etaText = isLate && eta_minutes ? ` ETA: ~${eta_minutes} min.` : '';
        createBulkNotifications(
          ownerRecipients.map((recipientId) => ({
            userId: recipientId,
            type: isLate ? 'worker_running_late' : 'worker_starting',
            title: isLate
              ? `Worker is running late for "${gig.title || 'your task'}"`
              : `Worker is on their way to "${gig.title || 'your task'}"`,
            body: isLate
              ? `The worker let you know they are running late.${etaText}`
              : 'The worker confirmed they are starting now.',
            icon: isLate ? '⏳' : '🏃',
            link: `/gigs/${gigId}`,
            metadata: {
              gig_id: gigId,
              worker_ack_status: status,
              ...(isLate && eta_minutes ? { eta_minutes } : {}),
            },
          }))
        );
      }
    }

    emitGigUpdate(req, gigId, 'worker-ack');

    return res.json({
      success: true,
      worker_ack_status: status,
      worker_ack_updated_at: nowIso,
      message: isLate
        ? 'Running late update sent to the task owner.'
        : 'Starting now update sent to the task owner.',
    });
  } catch (err) {
    logger.error('Worker ack error', { error: err.message });
    return res.status(500).json({ error: 'Failed to send acknowledgement' });
  }
});

/**
 * POST /api/gigs/:gigId/worker-release
 * Worker self-releases from the assignment ("can't make it").
 * Unassigns the worker, releases payment hold, and reopens bidding.
 * Body: { note?: string }
 */
router.post('/:gigId/worker-release', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const workerId = req.user.id;
    const { note } = req.body || {};

    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select(
        'id, user_id, status, accepted_by, accepted_at, started_at, payment_id, payment_status, title'
      )
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    if (String(gig.accepted_by) !== String(workerId)) {
      return res.status(403).json({ error: 'Only the assigned worker can release themselves' });
    }

    if (gig.status !== 'assigned') {
      return res.status(400).json({
        error: `Self-release is only available while the gig is assigned (current: ${gig.status})`,
      });
    }

    if (gig.started_at) {
      return res.status(400).json({ error: 'Cannot release after work has started' });
    }

    const nowIso = new Date().toISOString();
    const releaseNote = note ? String(note).slice(0, 1000) : null;

    // Cancel payment authorization if present
    if (gig.payment_id) {
      const { data: payment } = await supabaseAdmin
        .from('Payment')
        .select('id, payment_status')
        .eq('id', gig.payment_id)
        .single();

      if (payment) {
        const preCaptureStates = [
          PAYMENT_STATES.AUTHORIZED,
          PAYMENT_STATES.AUTHORIZE_PENDING,
          PAYMENT_STATES.AUTHORIZATION_FAILED,
          PAYMENT_STATES.SETUP_PENDING,
          PAYMENT_STATES.READY_TO_AUTHORIZE,
        ];
        if (preCaptureStates.includes(payment.payment_status)) {
          try {
            await stripeService.cancelAuthorization(gig.payment_id);
          } catch (cancelErr) {
            logger.error('Worker release: failed to cancel authorization', {
              error: cancelErr.message,
              gigId,
              paymentId: gig.payment_id,
            });
            return res.status(502).json({
              error: 'Could not release the payment hold right now. Please try again or contact support.',
            });
          }
        }
      }
    }

    // Roll back the accepted bid to rejected
    const { data: acceptedBid } = await supabaseAdmin
      .from('GigBid')
      .select('id, user_id')
      .eq('gig_id', gigId)
      .eq('status', 'accepted')
      .maybeSingle();

    if (acceptedBid?.id) {
      await supabaseAdmin
        .from('GigBid')
        .update({ status: 'rejected', updated_at: nowIso })
        .eq('id', acceptedBid.id);
    }

    // Other bids are already pending (no longer auto-rejected on accept),
    // so no need to reopen them.

    // Reopen the gig
    const { error: updateErr } = await supabaseAdmin
      .from('Gig')
      .update({
        status: 'open',
        accepted_by: null,
        accepted_at: null,
        payment_id: null,
        payment_status: PAYMENT_STATES.NONE,
        worker_ack_status: null,
        worker_ack_eta_minutes: null,
        worker_ack_note: null,
        worker_ack_updated_at: null,
        last_worker_reminder_at: null,
        auto_reminder_count: 0,
        updated_at: nowIso,
      })
      .eq('id', gigId);

    if (updateErr) {
      logger.error('Worker release: failed to update gig', { error: updateErr.message, gigId });
      return res.status(500).json({ error: 'Failed to release from assignment' });
    }

    // Notify the owner
    const ownerRecipients = await getGigOwnerNotificationRecipients(gig.user_id, workerId);
    if (ownerRecipients.length > 0) {
      createBulkNotifications(
        ownerRecipients.map((recipientId) => ({
          userId: recipientId,
          type: 'worker_cant_make_it',
          title: `Worker can't make it for "${gig.title || 'your task'}"`,
          body: 'The worker released themselves from the assignment. The task is now open for new bids.',
          icon: '⚠️',
          link: `/gigs/${gigId}`,
          metadata: { gig_id: gigId, released_by: workerId, ...(releaseNote ? { note: releaseNote } : {}) },
        }))
      );
    }

    emitGigUpdate(req, gigId, 'status-change');
    emitGigUpdate(req, gigId, 'bid-update');

    return res.json({
      success: true,
      message: 'You have been released from this assignment. The task is now open for bids.',
    });
  } catch (err) {
    logger.error('Worker release error', { error: err.message });
    return res.status(500).json({ error: 'Failed to release from assignment' });
  }
});

/**
 * POST /api/gigs/:gigId/mark-completed
 * Worker marks gig completed: in_progress -> completed
 * Body: { note?, photos?: string[], checklist?: { item: string, done: boolean }[] }
 */
router.post('/:gigId/mark-completed', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;
    const { note, photos, checklist } = req.body;

    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status, accepted_by, title, category')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });

    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);
    if (!isWorker)
      return res.status(403).json({ error: 'Only the assigned worker can mark completion' });

    if (gig.status !== 'in_progress') {
      return res
        .status(400)
        .json({ error: `Gig must be in_progress to complete (current: ${gig.status})` });
    }

    // Validate photos array
    const safePhotos = Array.isArray(photos)
      ? photos.filter((p) => typeof p === 'string').slice(0, 10)
      : [];
    // Validate checklist
    const safeChecklist = Array.isArray(checklist)
      ? checklist.filter((c) => c && typeof c.item === 'string').slice(0, 20)
      : [];

    const nowIso = new Date().toISOString();
    const updateData = {
      status: 'completed',
      worker_completed_at: nowIso,
      updated_at: nowIso,
      completion_note: note ? String(note).slice(0, 2000) : null,
      completion_photos: safePhotos,
      completion_checklist: safeChecklist,
    };

    const { data: updatedGig, error: updateError } = await supabaseAdmin
      .from('Gig')
      .update(updateData)
      .eq('id', gigId)
      .select('*')
      .single();

    if (updateError) {
      logger.error('Error marking gig completed', { error: updateError.message, gigId, userId });
      return res.status(500).json({ error: 'Failed to mark gig completed' });
    }

    // ─── Track category affinity (non-blocking) ───
    if (gig.category && gig.accepted_by) {
      affinityService
        .recordInteraction(gig.accepted_by, gig.category, 'completion')
        .catch(() => {});
    }

    // ─── Notify gig poster: worker marked completed ───
    const { data: worker } = await supabaseAdmin
      .from('User')
      .select('name, username')
      .eq('id', userId)
      .single();
    const workerName = worker?.name || worker?.username || 'The worker';

    const hasProof = safePhotos.length > 0 || note;
    const ownerRecipients = await getGigOwnerNotificationRecipients(gig.user_id, userId);
    if (ownerRecipients.length > 0) {
      createBulkNotifications(
        ownerRecipients.map((recipientId) => ({
          userId: recipientId,
          type: 'gig_completed',
          title: `"${gig.title || 'Your gig'}" marked as completed`,
          body: `${workerName} marked the gig as done${hasProof ? ' with proof attached' : ''}. Please review and confirm completion.`,
          icon: '✅',
          link: `/gigs/${gigId}`,
          metadata: { gig_id: gigId, has_photos: safePhotos.length > 0, has_note: !!note },
        }))
      );
    }

    emitGigUpdate(req, gigId, 'completion-update');
    emitGigUpdate(req, gigId, 'status-change');
    return res.json({ gig: updatedGig });
  } catch (err) {
    logger.error('Mark completed error', { error: err.message });
    return res.status(500).json({ error: 'Failed to mark gig completed' });
  }
});

/**
 * Shared helper: validate gig state, capture payment, confirm completion.
 * Used by both /confirm-completion and /complete routes.
 * Throws on any failure — callers catch and return appropriate HTTP errors.
 */
async function confirmCompletionHelper(req, { gigId, userId, satisfaction, note }) {
  const { data: gig, error: gigError } = await supabaseAdmin
    .from('Gig')
    .select('*')
    .eq('id', gigId)
    .single();

  if (gigError || !gig) {
    const err = new Error('Gig not found');
    err.statusCode = 404;
    throw err;
  }

  const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
  if (!ownerAccess.allowed) {
    const err = new Error('Only the gig owner can confirm completion');
    err.statusCode = 403;
    throw err;
  }

  if (gig.status !== 'completed') {
    const err = new Error(`Gig must be completed before confirmation (current: ${gig.status})`);
    err.statusCode = 400;
    throw err;
  }

  if (!gig.worker_completed_at) {
    const err = new Error('Worker has not marked this gig completed yet');
    err.statusCode = 400;
    throw err;
  }

  // ─── Capture Payment BEFORE confirming ───
  if (gig.payment_id) {
    await stripeService.capturePayment(gig.payment_id);
    await supabaseAdmin
      .from('Gig')
      .update({ payment_status: PAYMENT_STATES.CAPTURED_HOLD })
      .eq('id', gigId);
  }

  const nowIso = new Date().toISOString();
  const safeSatisfaction = satisfaction ? Math.min(5, Math.max(1, parseInt(satisfaction))) : null;

  const { data: updatedGig, error: updateError } = await supabaseAdmin
    .from('Gig')
    .update({
      owner_confirmed_at: nowIso,
      updated_at: nowIso,
      owner_confirmation_note: note ? String(note).slice(0, 1000) : null,
      owner_satisfaction: safeSatisfaction,
    })
    .eq('id', gigId)
    .select('*')
    .single();

  if (updateError) {
    logger.error('Error confirming completion', { error: updateError.message, gigId, userId });
    throw new Error('Failed to confirm completion');
  }

  // ─── Notify the worker: owner confirmed completion ───
  if (gig.accepted_by) {
    createNotification({
      userId: gig.accepted_by,
      type: 'gig_confirmed',
      title: `Gig "${gig.title || 'completed gig'}" confirmed!`,
      body: 'The gig owner confirmed your work is complete. Great job!',
      icon: '🎉',
      link: `/gigs/${gigId}`,
      metadata: { gig_id: gigId },
    });

    // ─── Update worker reliability: increment gigs_completed ───
    const { data: workerData } = await supabaseAdmin
      .from('User')
      .select('gigs_completed')
      .eq('id', gig.accepted_by)
      .single();
    if (workerData) {
      await supabaseAdmin
        .from('User')
        .update({ gigs_completed: (workerData.gigs_completed || 0) + 1 })
        .eq('id', gig.accepted_by);
    }
  }

  // ─── Reject all remaining standby bids now that the gig is confirmed complete ───
  const gigTitle = gig.title || 'a gig';
  const { data: remainingBids } = await supabaseAdmin
    .from('GigBid')
    .select('id, user_id')
    .eq('gig_id', gigId)
    .in('status', ['pending', 'countered']);

  if (remainingBids && remainingBids.length > 0) {
    const remainingIds = remainingBids.map((b) => b.id);
    const remainingUserIds = [...new Set(remainingBids.map((b) => b.user_id))];

    await supabaseAdmin
      .from('GigBid')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .in('id', remainingIds);

    createBulkNotifications(remainingUserIds.map((uid) => ({
      userId: uid,
      type: 'bid_rejected',
      title: `"${gigTitle}" has been completed`,
      body: `The gig "${gigTitle}" has been completed by another worker. Your bid is now closed.`,
      icon: '✅',
      link: `/gigs/${gigId}`,
      metadata: { gig_id: gigId, reason: 'gig_completed' },
    })));
  }

  emitGigUpdate(req, gigId, 'completion-update');
  emitGigUpdate(req, gigId, 'status-change');
  emitGigUpdate(req, gigId, 'payment-update');

  return updatedGig;
}

/**
 * POST /api/gigs/:gigId/confirm-completion
 * Owner confirms completion after worker marks completed.
 * Body: { satisfaction?: 1-5, note?: string }
 */
router.post('/:gigId/confirm-completion', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;
    const { satisfaction, note } = req.body;
    const updatedGig = await confirmCompletionHelper(req, { gigId, userId, satisfaction, note });
    return res.json({ gig: updatedGig });
  } catch (err) {
    logger.error('Confirm completion error', { error: err.message });
    return res.status(err.statusCode || 500).json({ error: err.message || 'Failed to confirm completion' });
  }
});

/**
 * POST /api/gigs/:gigId/complete
 * Owner confirmation alias (same as /confirm-completion)
 */
router.post('/:gigId/complete', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;
    const { satisfaction, note } = req.body || {};
    const updatedGig = await confirmCompletionHelper(req, { gigId, userId, satisfaction, note });
    return res.json({ gig: updatedGig });
  } catch (err) {
    logger.error('Complete gig error', { error: err.message });
    return res.status(err.statusCode || 500).json({ error: err.message || 'Failed to confirm completion' });
  }
});

/**
 * GET /api/gigs/:gigId/cancellation-preview
 * Preview what happens if the user cancels — shows zone, fee, policy info.
 * Available to both poster and worker.
 */
router.get('/:gigId/cancellation-preview', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('*')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });

    const isPoster = String(gig.user_id) === String(userId);
    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);
    if (!isPoster && !isWorker) {
      return res.status(403).json({ error: 'Only the poster or worker can preview cancellation' });
    }

    const info = computeCancellationInfo(gig, userId);
    const policyKey = gig.cancellation_policy || 'standard';
    const policyConfig = CANCELLATION_POLICIES[policyKey] || CANCELLATION_POLICIES.standard;

    res.json({
      ...info,
      policy: policyKey,
      policy_label: policyConfig.label,
      policy_description: policyConfig.description,
      can_reschedule: info.zone <= 1 && gig.status !== 'in_progress',
    });
  } catch (err) {
    logger.error('Cancellation preview error', { error: err.message });
    res.status(500).json({ error: 'Failed to preview cancellation' });
  }
});

/**
 * POST /api/gigs/:gigId/reschedule
 * P6 — poster moves an assigned gig to a new start time instead of
 * cancelling (the "Reschedule instead" path the cancellation preview's
 * `can_reschedule` advertises). Mirrors that gate: zone <= 1 and not
 * yet in progress.
 *
 * Body: { scheduled_start: ISO date (future, required), note?: string }
 */
router.post('/:gigId/reschedule', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;
    const { scheduled_start, note } = req.body || {};

    const newStart = scheduled_start ? new Date(scheduled_start) : null;
    if (!newStart || Number.isNaN(newStart.getTime())) {
      return res.status(400).json({ error: 'scheduled_start must be a valid ISO date' });
    }
    if (newStart.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'scheduled_start must be in the future' });
    }

    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('*')
      .eq('id', gigId)
      .single();
    if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });

    if (String(gig.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Only the poster can reschedule' });
    }
    if (gig.status !== 'assigned') {
      return res.status(400).json({ error: 'Only assigned gigs can be rescheduled' });
    }
    const info = computeCancellationInfo(gig, userId);
    if (info.zone > 1) {
      return res.status(400).json({ error: 'Too close to the start time to reschedule' });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('Gig')
      .update({
        scheduled_start: newStart.toISOString(),
        schedule_type: 'scheduled',
        // A reschedule resets the worker's on-my-way state.
        worker_ack_status: null,
        worker_ack_eta_minutes: null,
      })
      .eq('id', gigId)
      .select()
      .single();
    if (updateError) throw updateError;

    if (gig.accepted_by) {
      createNotification({
        userId: gig.accepted_by,
        type: 'gig_rescheduled',
        title: 'Task rescheduled',
        body: `"${gig.title}" was moved to ${newStart.toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })}${note ? ` — ${note}` : ''}`,
        link: `/gigs/${gigId}`,
        contextType: 'gig',
        contextId: gigId,
        metadata: { gig_id: gigId, scheduled_start: newStart.toISOString() },
      }).catch(() => {});
    }
    emitGigUpdate(req, gigId, 'rescheduled');

    res.json({ message: 'Task rescheduled', gig: updated });
  } catch (err) {
    logger.error('Reschedule gig error', { error: err.message });
    res.status(500).json({ error: 'Failed to reschedule task' });
  }
});

/**
 * POST /api/gigs/:gigId/cancel
 * Cancel a gig — available to poster (any time) or worker (after acceptance).
 * Computes cancellation zone, fee, and notifies all affected parties.
 *
 * Body: { reason: string } — one of:
 *   Poster reasons:  'changed_plans', 'found_someone_else', 'too_expensive', 'emergency', 'other'
 *   Worker reasons:  'schedule_conflict', 'unable_to_complete', 'emergency', 'safety_concern', 'other'
 */
router.post('/:gigId/cancel', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    logger.info('Cancelling gig', { gigId, userId, reason });

    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('*')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });

    const isPoster = String(gig.user_id) === String(userId);
    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);

    if (!isPoster && !isWorker) {
      return res.status(403).json({ error: 'Only the poster or assigned worker can cancel' });
    }

    if (gig.status === 'cancelled') {
      return res.status(400).json({ error: 'Gig is already cancelled' });
    }
    if (gig.status === 'completed') {
      return res.status(400).json({ error: 'Cannot cancel a completed gig' });
    }

    // Compute cancellation zone and fee
    const info = computeCancellationInfo(gig, userId);
    const nowIso = new Date().toISOString();

    // ─── Payment handling on cancellation ───
    if (gig.payment_id) {
      try {
        const { data: payment } = await supabaseAdmin
          .from('Payment')
          .select('*')
          .eq('id', gig.payment_id)
          .single();

        if (payment) {
          const preCaptureStates = [
            PAYMENT_STATES.AUTHORIZED,
            PAYMENT_STATES.AUTHORIZE_PENDING,
            PAYMENT_STATES.AUTHORIZATION_FAILED,
            PAYMENT_STATES.SETUP_PENDING,
            PAYMENT_STATES.READY_TO_AUTHORIZE,
          ];

          if (preCaptureStates.includes(payment.payment_status)) {
            // Before capture: cancel authorization (release hold)
            await stripeService.cancelAuthorization(gig.payment_id);
          } else if (
            [PAYMENT_STATES.CAPTURED_HOLD, PAYMENT_STATES.TRANSFER_SCHEDULED].includes(
              payment.payment_status
            )
          ) {
            // After capture, before transfer: refund minus cancellation fee
            const cancellationFeeCents = Math.round((info.fee || 0) * 100);
            const refundAmount = payment.amount_total - cancellationFeeCents;
            if (refundAmount > 0) {
              await stripeService.createSmartRefund(
                gig.payment_id,
                refundAmount,
                'requested_by_customer',
                userId
              );
            }
          } else if (
            [PAYMENT_STATES.TRANSFER_PENDING, PAYMENT_STATES.TRANSFERRED].includes(
              payment.payment_status
            )
          ) {
            // After transfer: refund + transfer reversal
            const cancellationFeeCents = Math.round((info.fee || 0) * 100);
            const refundAmount = payment.amount_total - cancellationFeeCents;
            if (refundAmount > 0) {
              await stripeService.createSmartRefund(
                gig.payment_id,
                refundAmount,
                'requested_by_customer',
                userId
              );
            }
          }
        }
      } catch (paymentErr) {
        logger.error('Cancel gig: payment handling failed (non-blocking)', {
          error: paymentErr?.message,
          gigId,
          paymentId: gig.payment_id,
        });
      }
    }

    const { data: updatedGig, error: updateError } = await supabaseAdmin
      .from('Gig')
      .update({
        status: 'cancelled',
        cancelled_at: nowIso,
        cancelled_by: userId,
        cancellation_reason: reason || null,
        cancellation_zone: info.zone,
        cancellation_fee: info.fee,
        updated_at: nowIso,
      })
      .eq('id', gigId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error cancelling gig', { error: updateError.message });
      return res.status(500).json({ error: 'Failed to cancel gig' });
    }

    // ─── Notifications ───
    const notifs = [];
    const gigTitle = gig.title || 'a gig';
    const cancellerRole = isPoster ? 'poster' : 'worker';

    // Fetch canceller name for notifications
    const { data: canceller } = await supabaseAdmin
      .from('User')
      .select('name, username')
      .eq('id', userId)
      .single();
    const cancellerName =
      canceller?.name || canceller?.username || (isPoster ? 'The poster' : 'The worker');

    // Notify the other party
    if (isPoster && gig.accepted_by) {
      notifs.push({
        userId: gig.accepted_by,
        type: 'gig_cancelled',
        title: `"${gigTitle}" has been cancelled`,
        body: `The poster cancelled this gig.${info.fee > 0 ? ` Cancellation fee: $${info.fee.toFixed(2)}` : ''}`,
        icon: '🚫',
        link: `/gigs/${gigId}`,
        metadata: { gig_id: gigId, zone: info.zone, fee: info.fee, cancelled_by: 'poster' },
      });
    } else if (isWorker) {
      notifs.push({
        userId: gig.user_id,
        type: 'gig_cancelled',
        title: `Worker cancelled "${gigTitle}"`,
        body: `${cancellerName} cancelled.${reason ? ` Reason: ${reason.replace(/_/g, ' ')}` : ''}${info.fee > 0 ? ` Fee: $${info.fee.toFixed(2)}` : ''}`,
        icon: '🚫',
        link: `/gigs/${gigId}`,
        metadata: { gig_id: gigId, zone: info.zone, fee: info.fee, cancelled_by: 'worker' },
      });
    }

    // Reject all remaining standby bids and notify bidders (all zones, since bids now survive past assignment)
    {
      const { data: pendingBids } = await supabaseAdmin
        .from('GigBid')
        .select('id, user_id')
        .eq('gig_id', gigId)
        .in('status', ['pending', 'countered']);

      if (pendingBids && pendingBids.length > 0) {
        const pendingBidIds = pendingBids.map((b) => b.id);
        await supabaseAdmin
          .from('GigBid')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .in('id', pendingBidIds);

        for (const pb of pendingBids) {
          notifs.push({
            userId: pb.user_id,
            type: 'gig_cancelled',
            title: `"${gigTitle}" has been cancelled`,
            body: 'The gig you bid on was cancelled. Your bid is now closed.',
            icon: '🚫',
            link: `/gigs/${gigId}`,
            metadata: { gig_id: gigId },
          });
        }
      }
    }

    if (notifs.length > 0) {
      createBulkNotifications(notifs);
    }

    // ─── Track late-cancel in reliability metrics ───
    if (info.zone >= 1 && !info.in_grace) {
      const { data: cancelUser } = await supabaseAdmin
        .from('User')
        .select('late_cancel_count, no_show_count, reliability_score')
        .eq('id', userId)
        .single();
      if (cancelUser) {
        const newLateCancelCount = (cancelUser.late_cancel_count || 0) + 1;
        const newScore = Math.max(
          0,
          100 - (cancelUser.no_show_count || 0) * 15 - newLateCancelCount * 5
        );
        await supabaseAdmin
          .from('User')
          .update({ late_cancel_count: newLateCancelCount, reliability_score: newScore })
          .eq('id', userId);
      }
    }

    logger.info('Gig cancelled', {
      gigId,
      zone: info.zone,
      fee: info.fee,
      cancelledBy: cancellerRole,
    });
    emitGigUpdate(req, gigId, 'status-change');
    res.json({
      gig: updatedGig,
      cancellation: {
        zone: info.zone,
        zone_label: info.zone_label,
        fee: info.fee,
        in_grace: info.in_grace,
        cancelled_by: cancellerRole,
      },
    });
  } catch (err) {
    logger.error('Cancel gig error', { error: err.message });
    res.status(500).json({ error: 'Failed to cancel gig' });
  }
});

// ================================
// CHANGE ORDERS
// ================================

/**
 * GET /api/gigs/:gigId/change-orders
 * List change orders for a gig. Visible to poster and worker.
 */
router.get('/:gigId/change-orders', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigFetchErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by')
      .eq('id', gigId)
      .single();

    if (gigFetchErr) {
      return res.status(500).json({ error: 'Failed to fetch gig' });
    }
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    const isPoster = String(gig.user_id) === String(userId);
    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);
    if (!isPoster && !isWorker) {
      return res.status(403).json({ error: 'Only the poster or worker can view change orders' });
    }

    const { data: orders, error } = await supabaseAdmin
      .from('GigChangeOrder')
      .select(
        `
        *,
        requester:requested_by ( id, username, name ),
        reviewer:reviewed_by ( id, username, name )
      `
      )
      .eq('gig_id', gigId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching change orders', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch change orders' });
    }

    res.json({ change_orders: orders || [] });
  } catch (err) {
    logger.error('Change orders fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch change orders' });
  }
});

/**
 * POST /api/gigs/:gigId/change-orders
 * Request a change order (worker or poster, gig must be assigned or in_progress).
 * Body: { type, description, amount_change?, time_change_minutes? }
 */
router.post('/:gigId/change-orders', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;
    const { type, description, amount_change, time_change_minutes } = req.body;

    // Validate
    const validTypes = [
      'price_increase',
      'price_decrease',
      'scope_addition',
      'scope_reduction',
      'timeline_extension',
      'other',
    ];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: `Type must be one of: ${validTypes.join(', ')}` });
    }
    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return res.status(400).json({ error: 'Description must be at least 5 characters' });
    }
    if (description.length > 2000) {
      return res.status(400).json({ error: 'Description must be under 2000 characters' });
    }

    const { data: gig, error: gigFetchErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, status, title, price')
      .eq('id', gigId)
      .single();

    if (gigFetchErr) {
      return res.status(500).json({ error: 'Failed to fetch gig' });
    }
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    if (!['assigned', 'in_progress'].includes(gig.status)) {
      return res
        .status(400)
        .json({ error: 'Change orders can only be made on assigned or in-progress gigs' });
    }

    const isPoster = String(gig.user_id) === String(userId);
    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);
    if (!isPoster && !isWorker) {
      return res
        .status(403)
        .json({ error: 'Only the poster or assigned worker can request changes' });
    }

    // Rate limit: max 5 pending change orders per gig
    const { count, error: countErr } = await supabaseAdmin
      .from('GigChangeOrder')
      .select('id', { count: 'exact', head: true })
      .eq('gig_id', gigId)
      .eq('status', 'pending');

    if (countErr) {
      return res.status(500).json({ error: 'Failed to check change-order limit' });
    }
    if ((count || 0) >= 5) {
      return res
        .status(429)
        .json({ error: 'Too many pending change orders. Wait for existing ones to be reviewed.' });
    }

    const safeAmountChange = amount_change ? parseFloat(amount_change) : 0;
    const safeTimeChange = time_change_minutes ? parseInt(time_change_minutes) : 0;

    const { data: order, error: insertErr } = await supabaseAdmin
      .from('GigChangeOrder')
      .insert({
        gig_id: gigId,
        requested_by: userId,
        type,
        description: description.trim(),
        amount_change: Math.round(safeAmountChange * 100) / 100,
        time_change_minutes: safeTimeChange,
      })
      .select(
        `
        *,
        requester:requested_by ( id, username, name )
      `
      )
      .single();

    if (insertErr) {
      logger.error('Error creating change order', { error: insertErr.message });
      return res.status(500).json({ error: 'Failed to create change order' });
    }

    // Notify the other party
    const otherUserId = isPoster ? gig.accepted_by : gig.user_id;
    const { data: requester } = await supabaseAdmin
      .from('User')
      .select('name, username')
      .eq('id', userId)
      .single();
    const requesterName =
      requester?.name || requester?.username || (isPoster ? 'The poster' : 'The worker');
    const gigTitle = gig.title || 'a gig';

    const changeLabel =
      {
        price_increase: `+$${Math.abs(safeAmountChange).toFixed(2)} price increase`,
        price_decrease: `-$${Math.abs(safeAmountChange).toFixed(2)} price decrease`,
        scope_addition: 'scope addition',
        scope_reduction: 'scope reduction',
        timeline_extension: `+${safeTimeChange}min timeline extension`,
        other: 'change',
      }[type] || 'change';

    if (otherUserId) {
      createNotification({
        userId: otherUserId,
        type: 'change_order',
        title: `Change request on "${gigTitle}"`,
        body: `${requesterName} requested a ${changeLabel}: "${description.trim().slice(0, 80)}${description.length > 80 ? '…' : ''}"`,
        icon: '📝',
        link: `/gigs/${gigId}`,
        metadata: { gig_id: gigId, change_order_id: order?.id, change_type: type },
      });
    }

    emitGigUpdate(req, gigId, 'status-change');
    res.status(201).json({ change_order: order });
  } catch (err) {
    logger.error('Change order create error', { error: err.message });
    res.status(500).json({ error: 'Failed to create change order' });
  }
});

/**
 * POST /api/gigs/:gigId/change-orders/:orderId/approve
 * Approve a change order (the OTHER party approves).
 */
router.post('/:gigId/change-orders/:orderId/approve', verifyToken, async (req, res) => {
  try {
    const { gigId, orderId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigFetchErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, title, price')
      .eq('id', gigId)
      .single();

    if (gigFetchErr) {
      return res.status(500).json({ error: 'Failed to fetch gig' });
    }
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    const { data: order } = await supabaseAdmin
      .from('GigChangeOrder')
      .select('*')
      .eq('id', orderId)
      .eq('gig_id', gigId)
      .single();

    if (!order) return res.status(404).json({ error: 'Change order not found' });
    if (order.status !== 'pending') {
      return res.status(400).json({ error: `Change order is already ${order.status}` });
    }

    // The approver must be the OTHER party (not the requester)
    if (String(order.requested_by) === String(userId)) {
      return res.status(403).json({ error: 'You cannot approve your own change order' });
    }

    const isPoster = String(gig.user_id) === String(userId);
    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);
    if (!isPoster && !isWorker) {
      return res.status(403).json({ error: 'Only the poster or worker can approve' });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('GigChangeOrder')
      .update({ status: 'approved', reviewed_by: userId, reviewed_at: nowIso, updated_at: nowIso })
      .eq('id', orderId)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to approve change order' });
    }

    // Apply price change to gig if applicable
    if (order.amount_change && order.amount_change !== 0) {
      const currentPrice = parseFloat(gig.price) || 0;
      const newPrice = Math.max(0, currentPrice + parseFloat(order.amount_change));
      await supabaseAdmin
        .from('Gig')
        .update({ price: newPrice, updated_at: nowIso })
        .eq('id', gigId);
    }

    // Notify the requester
    createNotification({
      userId: order.requested_by,
      type: 'change_order_approved',
      title: `Change request approved`,
      body: `Your change request on "${gig.title || 'a gig'}" was approved.`,
      icon: '✅',
      link: `/gigs/${gigId}`,
      metadata: { gig_id: gigId, change_order_id: orderId },
    });

    emitGigUpdate(req, gigId, 'status-change');
    res.json({ change_order: updated });
  } catch (err) {
    logger.error('Approve change order error', { error: err.message });
    res.status(500).json({ error: 'Failed to approve change order' });
  }
});

/**
 * POST /api/gigs/:gigId/change-orders/:orderId/reject
 * Reject a change order.
 * Body: { reason?: string }
 */
router.post('/:gigId/change-orders/:orderId/reject', verifyToken, async (req, res) => {
  try {
    const { gigId, orderId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const { data: gig, error: gigFetchErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, title')
      .eq('id', gigId)
      .single();

    if (gigFetchErr) {
      return res.status(500).json({ error: 'Failed to fetch gig' });
    }
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    const { data: order } = await supabaseAdmin
      .from('GigChangeOrder')
      .select('*')
      .eq('id', orderId)
      .eq('gig_id', gigId)
      .single();

    if (!order) return res.status(404).json({ error: 'Change order not found' });
    if (order.status !== 'pending') {
      return res.status(400).json({ error: `Change order is already ${order.status}` });
    }

    if (String(order.requested_by) === String(userId)) {
      return res
        .status(403)
        .json({ error: 'You cannot reject your own change order. Use withdraw instead.' });
    }

    const isPoster = String(gig.user_id) === String(userId);
    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);
    if (!isPoster && !isWorker) {
      return res.status(403).json({ error: 'Only the poster or worker can reject' });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('GigChangeOrder')
      .update({
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: nowIso,
        rejection_reason: reason ? String(reason).slice(0, 500) : null,
        updated_at: nowIso,
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to reject change order' });
    }

    createNotification({
      userId: order.requested_by,
      type: 'change_order_rejected',
      title: `Change request declined`,
      body: `Your change request on "${gig.title || 'a gig'}" was declined.${reason ? ` Reason: ${reason.slice(0, 80)}` : ''}`,
      icon: '❌',
      link: `/gigs/${gigId}`,
      metadata: { gig_id: gigId, change_order_id: orderId },
    });

    emitGigUpdate(req, gigId, 'status-change');
    res.json({ change_order: updated });
  } catch (err) {
    logger.error('Reject change order error', { error: err.message });
    res.status(500).json({ error: 'Failed to reject change order' });
  }
});

/**
 * POST /api/gigs/:gigId/change-orders/:orderId/withdraw
 * Withdraw your own change order.
 */
router.post('/:gigId/change-orders/:orderId/withdraw', verifyToken, async (req, res) => {
  try {
    const { gigId, orderId } = req.params;
    const userId = req.user.id;

    const { data: order } = await supabaseAdmin
      .from('GigChangeOrder')
      .select('*')
      .eq('id', orderId)
      .eq('gig_id', gigId)
      .single();

    if (!order) return res.status(404).json({ error: 'Change order not found' });
    if (order.status !== 'pending') {
      return res.status(400).json({ error: `Change order is already ${order.status}` });
    }
    if (String(order.requested_by) !== String(userId)) {
      return res.status(403).json({ error: 'Only the requester can withdraw' });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('GigChangeOrder')
      .update({ status: 'withdrawn', updated_at: nowIso })
      .eq('id', orderId)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to withdraw change order' });
    }
    emitGigUpdate(req, gigId, 'status-change');
    res.json({ change_order: updated });
  } catch (err) {
    logger.error('Withdraw change order error', { error: err.message });
    res.status(500).json({ error: 'Failed to withdraw change order' });
  }
});

// ================================
// GIG TIMELINE
// ================================

/**
 * GET /api/gigs/:gigId/timeline
 * Returns computed timeline steps with timestamps for a gig.
 */
router.get('/:gigId/timeline', async (req, res) => {
  try {
    const { gigId } = req.params;

    const { data: gig, error } = await supabaseAdmin
      .from('Gig')
      .select(
        'id, status, created_at, accepted_at, started_at, worker_completed_at, owner_confirmed_at, cancelled_at, cancellation_reason, accepted_by, user_id'
      )
      .eq('id', gigId)
      .single();

    if (error || !gig) return res.status(404).json({ error: 'Gig not found' });

    // Check if review exists
    const { count: reviewCount } = await supabaseAdmin
      .from('Review')
      .select('id', { count: 'exact', head: true })
      .eq('gig_id', gigId);

    const hasReview = (reviewCount || 0) > 0;

    const status = gig.status;
    const isCancelled = status === 'cancelled';

    const steps = [
      { key: 'posted', label: 'Posted', completed: true, timestamp: gig.created_at },
      {
        key: 'bidding',
        label: 'Bidding',
        completed: status !== 'open',
        current: status === 'open',
        timestamp: null,
      },
      {
        key: 'selected',
        label: 'Bid Selected',
        completed:
          ['assigned', 'in_progress', 'completed'].includes(status) ||
          (isCancelled && !!gig.accepted_by),
        current: status === 'assigned',
        timestamp: gig.accepted_at,
      },
      {
        key: 'in_progress',
        label: 'In Progress',
        completed: ['in_progress', 'completed'].includes(status),
        current: status === 'in_progress',
        timestamp: gig.started_at,
      },
      {
        key: 'delivered',
        label: 'Delivered',
        completed: !!gig.worker_completed_at,
        current: status === 'completed' && !!gig.worker_completed_at && !gig.owner_confirmed_at,
        timestamp: gig.worker_completed_at,
      },
      {
        key: 'confirmed',
        label: 'Confirmed',
        completed: !!gig.owner_confirmed_at,
        current: false,
        timestamp: gig.owner_confirmed_at,
      },
      {
        key: 'reviewed',
        label: 'Reviewed',
        completed: hasReview,
        current: !!gig.owner_confirmed_at && !hasReview,
        timestamp: null,
      },
    ];

    res.json({
      gig_id: gigId,
      status,
      is_cancelled: isCancelled,
      cancellation_reason: gig.cancellation_reason || null,
      steps,
    });
  } catch (err) {
    logger.error('Timeline error', { error: err.message });
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

// ================================
// STRUCTURED Q&A
// ================================

/**
 * GET /api/gigs/:gigId/questions
 * List all questions for a gig (public).
 * Pinned first, then by upvote_count desc, then newest.
 */
router.get('/:gigId/questions', async (req, res) => {
  try {
    const { gigId } = req.params;
    const { data: gig } = await supabaseAdmin
      .from('Gig')
      .select(
        `
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
      `
      )
      .eq('id', gigId)
      .maybeSingle();

    const { data: questions, error } = await supabaseAdmin
      .from('GigQuestion')
      .select(
        `
        id, gig_id, question, answer, question_attachments, answer_attachments, answered_at, is_pinned, upvote_count, status, created_at, updated_at,
        asker:asked_by ( id, username, first_name, last_name, name, profile_picture_url ),
        answerer:answered_by ( id, username, name )
      `
      )
      .eq('gig_id', gigId)
      .order('is_pinned', { ascending: false })
      .order('upvote_count', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching questions', { error: error.message, gigId });
      return res.status(500).json({ error: 'Failed to fetch questions' });
    }

    const owner = gig?.owner || null;
    const ownerIsBusiness = owner?.account_type === 'business';
    const ownerDisplayName =
      owner?.name ||
      [owner?.first_name, owner?.last_name].filter(Boolean).join(' ') ||
      owner?.username ||
      'Business';

    const normalized = (questions || []).map((q) => ({
      ...serializeGigQuestionForViewer(q),
      question_attachments: q.question_attachments || [],
      answer_attachments: q.answer_attachments || [],
      answerer_display_name: ownerIsBusiness && q.answer ? ownerDisplayName : null,
      answerer_display_id: ownerIsBusiness && q.answer ? owner?.id : null,
      answerer_display_username: ownerIsBusiness && q.answer ? owner?.username || null : null,
    }));

    res.json({ questions: normalized });
  } catch (err) {
    logger.error('Questions fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

/**
 * POST /api/gigs/:gigId/questions
 * Ask a question on a gig.
 * Body: { question: string }
 */
router.post('/:gigId/questions', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
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

    // Verify gig exists
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, title, status')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) return res.status(404).json({ error: 'Gig not found' });

    // Rate limit: max 5 questions per user per gig
    const { count, error: countErr } = await supabaseAdmin
      .from('GigQuestion')
      .select('id', { count: 'exact', head: true })
      .eq('gig_id', gigId)
      .eq('asked_by', userId);

    if (countErr) {
      return res.status(500).json({ error: 'Failed to check question limit' });
    }
    if ((count || 0) >= 5) {
      return res.status(429).json({ error: 'You can ask up to 5 questions per gig' });
    }

    const { data: q, error: insertErr } = await supabaseAdmin
      .from('GigQuestion')
      .insert({
        gig_id: gigId,
        asked_by: userId,
        question: question.trim(),
        question_attachments: normalizedAttachments,
      })
      .select(
        `
        id, gig_id, question, answer, question_attachments, answer_attachments, answered_at, is_pinned, upvote_count, status, created_at, updated_at,
        asker:asked_by ( id, username, first_name, last_name, name, profile_picture_url )
      `
      )
      .single();

    if (insertErr) {
      logger.error('Error creating question', { error: insertErr.message });
      return res.status(500).json({ error: 'Failed to post question' });
    }

    // Notify gig poster
    if (String(gig.user_id) !== String(userId)) {
      const { data: asker } = await supabaseAdmin
        .from('User')
        .select('name, username')
        .eq('id', userId)
        .single();
      const askerName = asker?.name || asker?.username || 'Someone';

      createNotification({
        userId: gig.user_id,
        type: 'gig_question',
        title: `New question on "${gig.title || 'your gig'}"`,
        body: `${askerName} asked: "${question.trim().slice(0, 80)}${question.length > 80 ? '…' : ''}"`,
        icon: '❓',
        link: `/gigs/${gigId}`,
        metadata: { gig_id: gigId, question_id: q?.id },
      });
    }

    emitGigUpdate(req, gigId, 'qa-update');
    res.status(201).json({ question: serializeGigQuestionForViewer(q) });
  } catch (err) {
    logger.error('Question create error', { error: err.message });
    res.status(500).json({ error: 'Failed to post question' });
  }
});

/**
 * POST /api/gigs/:gigId/questions/:questionId/answer
 * Answer a question (poster only).
 * Body: { answer: string }
 */
router.post('/:gigId/questions/:questionId/answer', verifyToken, async (req, res) => {
  try {
    const { gigId, questionId } = req.params;
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

    // Verify poster
    const { data: gig, error: gigFetchErr } = await supabaseAdmin
      .from('Gig')
      .select(
        'id, user_id, title, owner:user_id(id, username, name, first_name, last_name, account_type)'
      )
      .eq('id', gigId)
      .single();

    if (gigFetchErr) {
      return res.status(500).json({ error: 'Failed to fetch gig' });
    }
    if (!gig) return res.status(404).json({ error: 'Gig not found' });
    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig poster can answer questions' });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error } = await supabaseAdmin
      .from('GigQuestion')
      .update({
        answer: answer.trim(),
        answered_by: userId,
        answer_attachments: normalizedAttachments,
        answered_at: nowIso,
        status: 'answered',
        updated_at: nowIso,
      })
      .eq('id', questionId)
      .eq('gig_id', gigId)
      .select(
        `
        id, gig_id, question, answer, question_attachments, answer_attachments, answered_at, is_pinned, upvote_count, status, created_at, updated_at,
        asker:asked_by ( id, username, name ),
        answerer:answered_by ( id, username, name )
      `
      )
      .single();

    if (error) {
      logger.error('Error answering question', { error: error.message });
      return res.status(500).json({ error: 'Failed to answer question' });
    }

    // Notify the asker
    if (updated?.asker && String(updated.asker.id) !== String(userId)) {
      createNotification({
        userId: updated.asker.id,
        type: 'gig_question_answered',
        title: `Your question was answered`,
        body: `The poster answered your question on "${gig.title || 'a gig'}": "${answer.trim().slice(0, 80)}${answer.length > 80 ? '…' : ''}"`,
        icon: '✅',
        link: `/gigs/${gigId}`,
        metadata: { gig_id: gigId, question_id: questionId },
      });
    }

    const owner = gig.owner || null;
    const ownerIsBusiness = owner?.account_type === 'business';
    const ownerDisplayName =
      owner?.name ||
      [owner?.first_name, owner?.last_name].filter(Boolean).join(' ') ||
      owner?.username ||
      'Business';

    emitGigUpdate(req, gigId, 'qa-update');
    res.json({
      question: {
        ...serializeGigQuestionForViewer(updated),
        answerer_display_name: ownerIsBusiness ? ownerDisplayName : null,
        answerer_display_id: ownerIsBusiness ? owner?.id : null,
        answerer_display_username: ownerIsBusiness ? owner?.username || null : null,
      },
    });
  } catch (err) {
    logger.error('Answer question error', { error: err.message });
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

/**
 * POST /api/gigs/:gigId/questions/:questionId/pin
 * Toggle pin on a question (poster only).
 */
router.post('/:gigId/questions/:questionId/pin', verifyToken, async (req, res) => {
  try {
    const { gigId, questionId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigFetchErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id')
      .eq('id', gigId)
      .single();

    if (gigFetchErr) {
      return res.status(500).json({ error: 'Failed to fetch gig' });
    }
    if (!gig) return res.status(404).json({ error: 'Gig not found' });
    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig poster can pin questions' });
    }

    // Get current pin state
    const { data: q } = await supabaseAdmin
      .from('GigQuestion')
      .select('id, is_pinned')
      .eq('id', questionId)
      .eq('gig_id', gigId)
      .single();

    if (!q) return res.status(404).json({ error: 'Question not found' });

    const { data: updated, error } = await supabaseAdmin
      .from('GigQuestion')
      .update({ is_pinned: !q.is_pinned, updated_at: new Date().toISOString() })
      .eq('id', questionId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to toggle pin' });
    }

    emitGigUpdate(req, gigId, 'qa-update');
    res.json({ question: updated });
  } catch (err) {
    logger.error('Pin question error', { error: err.message });
    res.status(500).json({ error: 'Failed to toggle pin' });
  }
});

/**
 * POST /api/gigs/:gigId/questions/:questionId/upvote
 * Toggle upvote on a question.
 */
router.post('/:gigId/questions/:questionId/upvote', verifyToken, async (req, res) => {
  try {
    const { gigId, questionId } = req.params;
    const userId = req.user.id;

    // Check if already upvoted
    const { data: existing } = await supabaseAdmin
      .from('GigQuestionUpvote')
      .select('id')
      .eq('question_id', questionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Remove upvote
      await supabaseAdmin.from('GigQuestionUpvote').delete().eq('id', existing.id);

      // Decrement count
      const { data: q } = await supabaseAdmin
        .from('GigQuestion')
        .select('upvote_count')
        .eq('id', questionId)
        .single();

      await supabaseAdmin
        .from('GigQuestion')
        .update({ upvote_count: Math.max(0, (q?.upvote_count || 1) - 1) })
        .eq('id', questionId);

      return res.json({ upvoted: false });
    } else {
      // Add upvote
      const { error: insertErr } = await supabaseAdmin
        .from('GigQuestionUpvote')
        .insert({ question_id: questionId, user_id: userId });

      if (insertErr) {
        logger.error('Upvote insert error', { error: insertErr.message });
        return res.status(500).json({ error: 'Failed to upvote' });
      }

      // Increment count
      const { data: q } = await supabaseAdmin
        .from('GigQuestion')
        .select('upvote_count')
        .eq('id', questionId)
        .single();

      await supabaseAdmin
        .from('GigQuestion')
        .update({ upvote_count: (q?.upvote_count || 0) + 1 })
        .eq('id', questionId);

      return res.json({ upvoted: true });
    }
  } catch (err) {
    logger.error('Upvote toggle error', { error: err.message });
    res.status(500).json({ error: 'Failed to toggle upvote' });
  }
});

/**
 * DELETE /api/gigs/:gigId/questions/:questionId
 * Delete own question (or poster can delete any).
 */
router.delete('/:gigId/questions/:questionId', verifyToken, async (req, res) => {
  try {
    const { gigId, questionId } = req.params;
    const userId = req.user.id;

    const { data: q } = await supabaseAdmin
      .from('GigQuestion')
      .select('id, asked_by')
      .eq('id', questionId)
      .eq('gig_id', gigId)
      .single();

    if (!q) return res.status(404).json({ error: 'Question not found' });

    // Check: own question or gig poster
    const { data: gig, error: gigFetchErr } = await supabaseAdmin
      .from('Gig')
      .select('user_id')
      .eq('id', gigId)
      .single();

    if (gigFetchErr) {
      return res.status(500).json({ error: 'Failed to fetch gig' });
    }
    const isAsker = String(q.asked_by) === String(userId);
    const ownerAccess = gig
      ? await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage')
      : { allowed: false };
    const isPoster = Boolean(ownerAccess.allowed);

    if (!isAsker && !isPoster) {
      return res.status(403).json({ error: 'Only the question author or gig poster can delete' });
    }

    await supabaseAdmin.from('GigQuestion').delete().eq('id', questionId);

    emitGigUpdate(req, gigId, 'qa-update');
    res.json({ deleted: true });
  } catch (err) {
    logger.error('Delete question error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// ================================
// NO-SHOW HANDLING
// ================================

/**
 * POST /api/gigs/:gigId/report-no-show
 * Report a no-show by the other party.
 * Body: { description?, evidence_urls? }
 *
 * Poster reports worker no-show → cancels gig, penalizes worker
 * Worker reports poster no-show → cancels gig, penalizes poster
 */
router.post('/:gigId/report-no-show', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;
    const { description, evidence_urls } = req.body;

    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('*')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) return res.status(404).json({ error: 'Gig not found' });

    const isPoster = String(gig.user_id) === String(userId);
    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);

    if (!isPoster && !isWorker) {
      return res
        .status(403)
        .json({ error: 'Only the poster or assigned worker can report a no-show' });
    }

    // Must be in assigned or in_progress state
    if (!['assigned', 'in_progress'].includes(gig.status)) {
      return res
        .status(400)
        .json({ error: `Cannot report no-show for a gig in "${gig.status}" status` });
    }

    const incidentType = isPoster ? 'no_show_worker' : 'no_show_poster';
    const reportedAgainst = isPoster ? gig.accepted_by : gig.user_id;
    const nowIso = new Date().toISOString();

    // 1) Create the incident record
    const { data: incident, error: incidentErr } = await supabaseAdmin
      .from('GigIncident')
      .insert({
        gig_id: gigId,
        reported_by: userId,
        reported_against: reportedAgainst,
        type: incidentType,
        description: description || null,
        evidence_urls: evidence_urls || [],
        status: 'open',
      })
      .select()
      .single();

    if (incidentErr) {
      logger.error('Failed to create no-show incident', { error: incidentErr.message });
      return res.status(500).json({ error: 'Failed to report no-show' });
    }

    // 2) Cancel the gig with zone 3 (no-show)
    const gigPrice = parseFloat(gig.price) || 0;
    const policyKey = gig.cancellation_policy || 'standard';
    const noShowFee = Math.round(gigPrice * 0.25 * 100) / 100; // 25% no-show fee

    const { data: updatedGig, error: cancelErr } = await supabaseAdmin
      .from('Gig')
      .update({
        status: 'cancelled',
        cancelled_at: nowIso,
        cancelled_by: userId,
        cancellation_reason: incidentType,
        cancellation_zone: 3,
        cancellation_fee: noShowFee,
        updated_at: nowIso,
      })
      .eq('id', gigId)
      .select()
      .single();

    if (cancelErr) {
      return res.status(500).json({ error: 'Failed to cancel gig' });
    }

    // 3) Update reliability metrics for the no-show party
    // Increment no_show_count and recalculate reliability_score
    const { data: currentUser } = await supabaseAdmin
      .from('User')
      .select('no_show_count, late_cancel_count, gigs_completed, reliability_score')
      .eq('id', reportedAgainst)
      .single();

    if (currentUser) {
      const newNoShowCount = (currentUser.no_show_count || 0) + 1;
      const totalGigs =
        (currentUser.gigs_completed || 0) + newNoShowCount + (currentUser.late_cancel_count || 0);
      // Score: starts at 100, each no-show costs 15 points, each late cancel costs 5 points
      const newScore = Math.max(
        0,
        100 - newNoShowCount * 15 - (currentUser.late_cancel_count || 0) * 5
      );

      await supabaseAdmin
        .from('User')
        .update({
          no_show_count: newNoShowCount,
          reliability_score: newScore,
        })
        .eq('id', reportedAgainst);
    }

    // 4) Notify the no-show party
    const { data: reporter } = await supabaseAdmin
      .from('User')
      .select('name, username')
      .eq('id', userId)
      .single();
    const reporterName = reporter?.name || reporter?.username || 'The other party';
    const gigTitle = gig.title || 'a gig';

    createNotification({
      userId: reportedAgainst,
      type: 'no_show_reported',
      title: `No-show reported for "${gigTitle}"`,
      body: `${reporterName} reported you as a no-show.${noShowFee > 0 ? ` Fee: $${noShowFee.toFixed(2)}` : ''} This affects your reliability score.`,
      icon: '⚠️',
      link: `/gigs/${gigId}`,
      metadata: { gig_id: gigId, incident_id: incident?.id, fee: noShowFee },
    });

    logger.info('No-show reported', {
      gigId,
      reportedBy: userId,
      reportedAgainst,
      type: incidentType,
    });
    res.json({
      incident,
      gig: updatedGig,
      fee: noShowFee,
      message: 'No-show reported successfully. The gig has been cancelled.',
    });
  } catch (err) {
    logger.error('Report no-show error', { error: err.message });
    res.status(500).json({ error: 'Failed to report no-show' });
  }
});

/**
 * GET /api/gigs/:gigId/no-show-check
 * Check if a no-show should be prompted. Returns timing info.
 * Called by the frontend when viewing an assigned gig to determine
 * if the "Report No-Show" button should be visible.
 */
router.get('/:gigId/no-show-check', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { data: gig, error } = await supabaseAdmin
      .from('Gig')
      .select(
        'id, status, accepted_by, user_id, accepted_at, started_at, scheduled_start, deadline'
      )
      .eq('id', gigId)
      .single();

    if (error || !gig) return res.status(404).json({ error: 'Gig not found' });

    const isPoster = String(gig.user_id) === String(userId);
    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);

    if (!isPoster && !isWorker) {
      return res.json({ can_report: false, reason: 'Not involved' });
    }

    // Only for assigned or in_progress gigs
    if (!['assigned', 'in_progress'].includes(gig.status)) {
      return res.json({ can_report: false, reason: `Status is ${gig.status}` });
    }

    // Check if enough time has passed to suspect a no-show
    const NO_SHOW_BUFFER_MS = 30 * 60 * 1000; // 30 min buffer after expected start
    const now = Date.now();

    // Determine expected start time
    let expectedStart = null;
    if (gig.scheduled_start) {
      expectedStart = new Date(gig.scheduled_start).getTime();
    } else if (gig.accepted_at) {
      // If no scheduled start, assume they should start within 2 hours of acceptance
      expectedStart = new Date(gig.accepted_at).getTime() + 2 * 60 * 60 * 1000;
    }

    // For poster: can report worker no-show after expected start + buffer
    if (isPoster && gig.status === 'assigned' && expectedStart) {
      const canReportAfter = expectedStart + NO_SHOW_BUFFER_MS;
      return res.json({
        can_report: now > canReportAfter,
        expected_start: expectedStart ? new Date(expectedStart).toISOString() : null,
        can_report_after: new Date(canReportAfter).toISOString(),
        minutes_overdue: now > canReportAfter ? Math.floor((now - canReportAfter) / 60000) : 0,
        reason:
          now > canReportAfter
            ? 'Worker has not started after expected time'
            : 'Too early to report',
      });
    }

    // For worker: can report poster no-show if poster becomes unresponsive
    // (e.g., after gig is assigned for 24+ hours with no communication)
    if (isWorker && gig.status === 'assigned') {
      const acceptedAt = gig.accepted_at ? new Date(gig.accepted_at).getTime() : now;
      const hoursOverdue = (now - acceptedAt) / (60 * 60 * 1000);
      return res.json({
        can_report: hoursOverdue > 24,
        hours_since_accept: Math.floor(hoursOverdue),
        reason: hoursOverdue > 24 ? 'Poster unresponsive for 24+ hours' : 'Too early to report',
      });
    }

    return res.json({ can_report: false, reason: 'No grounds for no-show report' });
  } catch (err) {
    logger.error('No-show check error', { error: err.message });
    res.status(500).json({ error: 'Failed to check no-show status' });
  }
});

// ================================
// GET my bid for a given gig
// GET /api/gigs/:id/my-bid
// ================================
router.get('/:id/my-bid', verifyToken, async (req, res) => {
  const gigId = req.params.id;
  const userId = req.user.id;

  try {
    const { data, error } = await supabase
      .from('GigBid')
      .select(
        'id, gig_id, user_id, bid_amount, message, proposed_time, status, created_at, updated_at'
      )
      .eq('gig_id', gigId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error('Error fetching my bid', { error: error.message, gigId, userId });
      return res.status(500).json({ error: 'Failed to fetch my bid' });
    }

    // Normalize 'assigned' → 'accepted' for backwards compat
    const bid = data
      ? { ...data, status: data.status === 'assigned' ? 'accepted' : data.status }
      : null;
    return res.json({ bid });
  } catch (err) {
    logger.error('My bid fetch error', { error: err.message, gigId, userId });
    return res.status(500).json({ error: 'Failed to fetch my bid' });
  }
});

// ================================
// PATCH update my bid
// PATCH /api/gigs/:id/my-bid
// body: { bid_amount?, message?, proposed_time? }
// ================================
router.patch('/:id/my-bid', verifyToken, async (req, res) => {
  const gigId = req.params.id;
  const userId = req.user.id;
  const { bid_amount, message, proposed_time } = req.body || {};

  try {
    // Only allow editing while pending
    const { data: existing, error: exErr } = await supabaseAdmin
      .from('GigBid')
      .select('id, status')
      .eq('gig_id', gigId)
      .eq('user_id', userId)
      .maybeSingle();

    if (exErr) {
      logger.error('Error reading existing bid', { error: exErr.message, gigId, userId });
      return res.status(500).json({ error: 'Failed to update bid' });
    }

    if (!existing) return res.status(404).json({ error: 'Bid not found' });
    if (existing.status !== 'pending')
      return res.status(400).json({ error: 'Only pending bids can be edited' });

    const patch = {};
    if (bid_amount !== undefined) patch.bid_amount = bid_amount;
    if (message !== undefined) patch.message = message;
    if (proposed_time !== undefined) patch.proposed_time = proposed_time;
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('GigBid')
      .update(patch)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) {
      logger.error('Error updating bid', { error: error.message, gigId, userId });
      return res.status(500).json({ error: 'Failed to update bid' });
    }

    return res.json({ bid: data });
  } catch (err) {
    logger.error('Bid update error', { error: err.message, gigId, userId });
    return res.status(500).json({ error: 'Failed to update bid' });
  }
});

// ================================
// DELETE withdraw my bid
// DELETE /api/gigs/:id/my-bid
// ================================
router.delete('/:id/my-bid', verifyToken, async (req, res) => {
  const gigId = req.params.id;
  const userId = req.user.id;

  try {
    // Only allow withdrawing pending bids
    const { data: existing, error: exErr } = await supabaseAdmin
      .from('GigBid')
      .select('id, status')
      .eq('gig_id', gigId)
      .eq('user_id', userId)
      .maybeSingle();

    if (exErr) {
      logger.error('Error reading existing bid for delete', {
        error: exErr.message,
        gigId,
        userId,
      });
      return res.status(500).json({ error: 'Failed to withdraw bid' });
    }

    if (!existing) return res.status(404).json({ error: 'Bid not found' });
    if (existing.status !== 'pending')
      return res.status(400).json({ error: 'Only pending bids can be withdrawn' });

    const { error } = await supabaseAdmin.from('GigBid').delete().eq('id', existing.id);
    if (error) {
      logger.error('Error deleting bid', { error: error.message, gigId, userId });
      return res.status(500).json({ error: 'Failed to withdraw bid' });
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error('Bid withdraw error', { error: err.message, gigId, userId });
    return res.status(500).json({ error: 'Failed to withdraw bid' });
  }
});

// ================================
// POST close/cancel gig
// POST /api/gigs/:id/close
// ================================
router.post('/:id/close', verifyToken, async (req, res) => {
  const gigId = req.params.id;
  const userId = req.user.id;

  try {
    // Ensure owner
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, status')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) return res.status(404).json({ error: 'Gig not found' });
    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) return res.status(403).json({ error: 'Not allowed' });

    const { data, error } = await supabaseAdmin
      .from('Gig')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', gigId)
      .select('*')
      .single();

    if (error) {
      logger.error('Error closing gig', { error: error.message, gigId, userId });
      return res.status(500).json({ error: 'Failed to close gig' });
    }

    return res.json({ gig: data });
  } catch (err) {
    logger.error('Close gig error', { error: err.message, gigId, userId });
    return res.status(500).json({ error: 'Failed to close gig' });
  }
});

// ================================
// Accept bid -> set gig.status = assigned
// POST /api/gigs/:gigId/bids/:bidId/accept
// ================================

/**
 * GET /api/gigs/:gigId/chat-room
 * Get (or create) the gig chat room, ensuring participants exist.
 * Access: gig owner, accepted worker, OR any authenticated user for pre-bid chat.
 * Pre-bid users get added as participants but are message-limited.
 */
router.get('/:gigId/chat-room', verifyToken, async (req, res) => {
  const { gigId } = req.params;
  const userId = req.user.id;

  try {
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, status, title, price, category')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) return res.status(404).json({ error: 'Gig not found' });

    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    const isOwner = ownerAccess.allowed;
    const isAcceptedWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);

    // Check if user has a bid on this gig
    const { data: userBid } = await supabaseAdmin
      .from('GigBid')
      .select('id, status')
      .eq('gig_id', gigId)
      .eq('user_id', userId)
      .in('status', ['pending', 'accepted', 'countered'])
      .maybeSingle();

    const hasBid = !!userBid;
    const isPreBid = !isOwner && !isAcceptedWorker && !hasBid;

    // Anyone authenticated can open gig chat for pre-bid questions
    // (but will be message-limited — see POST /api/chat/messages)

    const { data: roomId, error: rpcErr } = await supabaseAdmin.rpc('get_or_create_gig_chat', {
      p_gig_id: gigId,
    });

    if (rpcErr || !roomId) {
      logger.error('Gig chat-room: rpc error', {
        message: rpcErr?.message,
        details: rpcErr?.details,
        code: rpcErr?.code,
        gigId,
      });
      return res.status(500).json({ error: 'Failed to get chat room' });
    }

    // Ensure participants
    const participants = [
      { room_id: roomId, user_id: gig.user_id, role: 'owner' },
      ...(gig.accepted_by ? [{ room_id: roomId, user_id: gig.accepted_by, role: 'member' }] : []),
      // Add current acting user as participant when different from canonical owner/worker.
      ...(!isAcceptedWorker && String(userId) !== String(gig.user_id)
        ? [{ room_id: roomId, user_id: userId, role: 'member' }]
        : []),
    ];

    const { error: partErr } = await supabaseAdmin
      .from('ChatParticipant')
      .upsert(participants, { onConflict: 'room_id,user_id' });

    if (partErr) {
      logger.error('Gig chat-room: failed to upsert participants', {
        message: partErr.message,
        details: partErr.details,
        code: partErr.code,
        gigId,
        roomId,
      });
      // not fatal
    }

    // ─── Auto-send gig card if this is a brand new chat room ───
    try {
      const { count: msgCount, error: msgCountErr } = await supabaseAdmin
        .from('ChatMessage')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId);

      if (msgCountErr) {
        logger.warn('Failed to check chat message count', { error: msgCountErr.message, roomId });
      }
      if (!msgCountErr && (msgCount || 0) === 0) {
        // New room — send an auto gig card message
        const gigPrice = gig.price != null ? `$${gig.price}` : null;
        await supabaseAdmin.from('ChatMessage').insert({
          room_id: roomId,
          user_id: gig.user_id, // sent "from" the gig owner
          message: `Gig: ${gig.title || 'Untitled'}`,
          type: 'gig_offer',
          metadata: {
            gigId: gig.id,
            title: gig.title || 'Untitled',
            category: gig.category || null,
            status: gig.status || 'open',
            price: gigPrice,
            auto_generated: true,
          },
        });
      }
    } catch (cardErr) {
      // Non-fatal — don't block room access if card fails
      logger.warn('Gig chat-room: failed to send auto gig card', {
        error: cardErr?.message,
        gigId,
        roomId,
      });
    }

    // Return pre-bid status so frontend can show the limit UI
    let preBidInfo = null;
    if (isPreBid) {
      const { count } = await supabaseAdmin
        .from('ChatMessage')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('user_id', userId);

      preBidInfo = {
        is_pre_bid: true,
        messages_sent: count || 0,
        messages_limit: 3,
        messages_remaining: Math.max(0, 3 - (count || 0)),
      };
    }

    // ─── Unified conversation: also create direct room + task topic ───
    let topicId = null;
    const gigOwnerId = gig.user_id;
    try {
      // Create direct room between current user and gig owner
      if (String(userId) !== String(gigOwnerId)) {
        const { data: directRoomId } = await supabaseAdmin.rpc('get_or_create_direct_chat', {
          p_user_id_1: userId,
          p_user_id_2: gigOwnerId,
        });
        if (directRoomId) {
          // Ensure participants in direct room
          await supabaseAdmin.from('ChatParticipant').upsert(
            [
              { room_id: directRoomId, user_id: userId, role: 'member' },
              { room_id: directRoomId, user_id: gigOwnerId, role: 'owner' },
            ],
            { onConflict: 'room_id,user_id' }
          );
        }

        // Find or create a task topic for this gig
        const uid1 = userId < gigOwnerId ? userId : gigOwnerId;
        const uid2 = userId < gigOwnerId ? gigOwnerId : userId;

        const { data: existingTopic } = await supabaseAdmin
          .from('ConversationTopic')
          .select('id')
          .eq('conversation_user_id_1', uid1)
          .eq('conversation_user_id_2', uid2)
          .eq('topic_type', 'task')
          .eq('topic_ref_id', gigId)
          .maybeSingle();

        if (existingTopic) {
          topicId = existingTopic.id;
        } else {
          const { data: newTopic } = await supabaseAdmin
            .from('ConversationTopic')
            .insert({
              conversation_user_id_1: uid1,
              conversation_user_id_2: uid2,
              topic_type: 'task',
              topic_ref_id: gigId,
              title: gig.title || 'Untitled Gig',
              status: 'active',
              created_by: userId,
            })
            .select('id')
            .single();
          if (newTopic) topicId = newTopic.id;
        }
      }
    } catch (topicErr) {
      // Non-fatal — don't block gig chat access
      logger.warn('Gig chat-room: failed to create topic/direct room', {
        error: topicErr?.message,
        gigId,
      });
    }

    return res.json({ roomId, preBidInfo, topicId, gigOwnerId });
  } catch (err) {
    logger.error('Gig chat-room: unexpected error', {
      error: err?.message,
      stack: err?.stack,
      gigId,
    });
    return res.status(500).json({ error: 'Failed to get chat room' });
  }
});

// ================================
// PAYMENT LIFECYCLE ROUTES
// ================================

/**
 * POST /api/gigs/:gigId/complete-payment-setup
 * Called after frontend confirms the SetupIntent (card saved for future gig).
 * Transitions payment from setup_pending → ready_to_authorize.
 */
router.post('/:gigId/complete-payment-setup', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigFetchErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, payment_id, payment_status')
      .eq('id', gigId)
      .single();

    if (gigFetchErr) {
      return res.status(500).json({ error: 'Failed to fetch gig' });
    }
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig owner can complete payment setup' });
    }

    if (!gig.payment_id) {
      return res.status(400).json({ error: 'No payment linked to this gig' });
    }

    if (gig.payment_status !== PAYMENT_STATES.SETUP_PENDING) {
      return res
        .status(400)
        .json({ error: `Payment is not in setup_pending state (current: ${gig.payment_status})` });
    }

    const result = await stripeService.confirmSetupAndSaveCard(gig.payment_id);
    const { data: payment } = await supabaseAdmin
      .from('Payment')
      .select('*')
      .eq('id', gig.payment_id)
      .single();

    emitGigUpdate(req, gigId, 'payment-update');
    res.json({
      success: true,
      payment: payment || null,
      message: 'Card saved successfully. Payment will be authorized before the gig starts.',
      paymentMethodId: result.paymentMethodId,
    });
  } catch (err) {
    logger.error('Complete payment setup error', { error: err.message });
    res.status(500).json({ error: 'Failed to complete payment setup' });
  }
});

/**
 * POST /api/gigs/:gigId/retry-authorization
 * Called when off-session authorization failed and user wants to retry on-session.
 * Returns a new clientSecret for frontend SCA completion.
 */
router.post('/:gigId/retry-authorization', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigFetchErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, payment_id, payment_status, price')
      .eq('id', gigId)
      .single();

    if (gigFetchErr) {
      return res.status(500).json({ error: 'Failed to fetch gig' });
    }
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig owner can retry authorization' });
    }

    if (!gig.payment_id) {
      return res.status(400).json({ error: 'No payment linked to this gig' });
    }

    if (gig.payment_status !== PAYMENT_STATES.AUTHORIZATION_FAILED) {
      return res
        .status(400)
        .json({
          error: `Payment is not in authorization_failed state (current: ${gig.payment_status})`,
        });
    }

    // Get the existing payment to find payee and amount
    const { data: payment } = await supabaseAdmin
      .from('Payment')
      .select('*')
      .eq('id', gig.payment_id)
      .single();

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Create a new on-session PaymentIntent (user can complete SCA in browser)
    const result = await stripeService.createPaymentIntentForGig({
      payerId: payment.payer_id,
      payeeId: payment.payee_id,
      gigId,
      amount: payment.amount_total,
      paymentMethodId: payment.stripe_payment_method_id,
      offSession: false, // on-session — user completes in browser
      existingPaymentId: gig.payment_id,
    });

    emitGigUpdate(req, gigId, 'payment-update');
    res.json({
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      paymentId: result.paymentId,
    });
  } catch (err) {
    logger.error('Retry authorization error', { error: err.message });
    res.status(500).json({ error: 'Failed to retry authorization' });
  }
});

/**
 * POST /api/gigs/:gigId/continue-authorization
 * Resume an in-progress on-session authorization (authorize_pending).
 * Returns the existing PaymentIntent clientSecret so frontend can confirm.
 */
router.post('/:gigId/continue-authorization', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigFetchErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, payment_id, payment_status')
      .eq('id', gigId)
      .single();

    if (gigFetchErr) {
      return res.status(500).json({ error: 'Failed to fetch gig' });
    }
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig owner can continue authorization' });
    }

    if (!gig.payment_id) {
      return res.status(400).json({ error: 'No payment linked to this gig' });
    }

    if (gig.payment_status !== PAYMENT_STATES.AUTHORIZE_PENDING) {
      return res
        .status(400)
        .json({
          error: `Payment is not in authorize_pending state (current: ${gig.payment_status})`,
        });
    }

    const { data: payment } = await supabaseAdmin
      .from('Payment')
      .select('id, stripe_payment_intent_id')
      .eq('id', gig.payment_id)
      .single();

    if (!payment || !payment.stripe_payment_intent_id) {
      return res.status(404).json({ error: 'PaymentIntent not found for this gig payment' });
    }

    // Reconcile with Stripe in case webhook delivery is delayed.
    const reconciled = await stripeService.syncPaymentAuthorizationStatus(payment.id);
    if (reconciled?.payment_status === PAYMENT_STATES.AUTHORIZED) {
      return res.json({
        alreadyAuthorized: true,
        paymentId: payment.id,
      });
    }

    const clientSecret = await stripeService.getPaymentIntentClientSecret(
      payment.stripe_payment_intent_id
    );

    res.json({
      clientSecret,
      paymentIntentId: payment.stripe_payment_intent_id,
      paymentId: payment.id,
    });
  } catch (err) {
    logger.error('Continue authorization error', { error: err.message });
    res.status(500).json({ error: 'Failed to continue authorization' });
  }
});

/**
 * POST /api/gigs/:gigId/refresh-payment-status
 * Owner-triggered status sync for authorize_pending payments.
 * Useful in local/test environments when webhooks are delayed.
 */
router.post('/:gigId/refresh-payment-status', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigFetchErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, payment_id, payment_status')
      .eq('id', gigId)
      .single();

    if (gigFetchErr) {
      return res.status(500).json({ error: 'Failed to fetch gig' });
    }
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    const ownerAccess = await getGigOwnerAccess(gig.user_id, userId, 'gigs.manage');
    if (!ownerAccess.allowed) {
      return res.status(403).json({ error: 'Only the gig owner can refresh payment status' });
    }

    if (!gig.payment_id) {
      return res.status(400).json({ error: 'No payment linked to this gig' });
    }

    const { data: payment } = await supabaseAdmin
      .from('Payment')
      .select('id, payment_status')
      .eq('id', gig.payment_id)
      .single();

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    let beforeStatus = payment.payment_status;
    let afterStatus = beforeStatus;

    if (beforeStatus === PAYMENT_STATES.AUTHORIZE_PENDING) {
      const reconciled = await stripeService.syncPaymentAuthorizationStatus(payment.id);
      afterStatus = reconciled?.payment_status || beforeStatus;
    }

    return res.json({
      paymentStatus: afterStatus,
      previousPaymentStatus: beforeStatus,
      changed: beforeStatus !== afterStatus,
    });
  } catch (err) {
    logger.error('Refresh payment status error', { error: err.message });
    res.status(500).json({ error: 'Failed to refresh payment status' });
  }
});

/**
 * GET /api/gigs/:gigId/payment
 * Get payment details for a gig. Visible to poster and worker.
 */
router.get('/:gigId/payment', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigFetchErr } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, payment_id')
      .eq('id', gigId)
      .maybeSingle();

    if (gigFetchErr) {
      logger.error('Get gig payment error: failed to fetch gig', {
        gigId,
        userId,
        supabase: {
          code: gigFetchErr.code,
          message: gigFetchErr.message,
          details: gigFetchErr.details,
          hint: gigFetchErr.hint,
        },
      });
      return res.status(500).json({ error: 'Failed to fetch gig' });
    }
    if (!gig) return res.status(404).json({ error: 'Gig not found' });

    const isPoster = String(gig.user_id) === String(userId);
    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);
    if (!isPoster && !isWorker) {
      return res.status(403).json({ error: 'Only the poster or worker can view payment details' });
    }

    if (!gig.payment_id) {
      return res.json({ payment: null, stateInfo: null });
    }

    const [{ data: payment }, { data: successfulTips }] = await Promise.all([
      supabaseAdmin
        .from('Payment')
        .select('*')
        .eq('id', gig.payment_id)
        .single(),
      supabaseAdmin
        .from('Payment')
        .select('tip_amount, refunded_amount')
        .eq('gig_id', gigId)
        .eq('payment_type', 'tip')
        .not('payment_succeeded_at', 'is', null),
    ]);

    if (payment) {
      payment.tip_amount = (successfulTips || []).reduce((sum, tip) => {
        const grossTip = Number(tip?.tip_amount || 0) || 0;
        const refundedTip = Number(tip?.refunded_amount || 0) || 0;
        return sum + Math.max(0, grossTip - refundedTip);
      }, 0);
    }

    // Don't expose sensitive fields to the worker
    if (isWorker && !isPoster && payment) {
      delete payment.stripe_payment_intent_id;
      delete payment.stripe_setup_intent_id;
      delete payment.stripe_customer_id;
      delete payment.stripe_charge_id;
    }

    const stateInfo = payment?.payment_status
      ? getPaymentStateInfo(payment.payment_status)
      : null;

    res.json({ payment: payment || null, stateInfo });
  } catch (err) {
    logger.error('Get gig payment error', { error: err.message });
    res.status(500).json({ error: 'Failed to get payment details' });
  }
});

// ============================================================
// DISMISS / HIDE — "Not Interested" and category suppression
// ============================================================

/**
 * POST /api/gigs/:gigId/dismiss
 * Dismiss a gig ("Not Interested"). Records affinity signal and stores dismissal.
 */
router.post('/:gigId/dismiss', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    // Look up gig category
    const { data: gig, error: gigErr } = await supabaseAdmin
      .from('Gig')
      .select('id, category')
      .eq('id', gigId)
      .single();

    if (gigErr || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    // Record affinity signal (non-blocking)
    if (gig.category) {
      affinityService.recordInteraction(userId, gig.category, 'dismiss').catch(() => {});
    }

    // Store dismissal (upsert to avoid duplicate errors)
    const { error: insertErr } = await supabaseAdmin.from('dismissed_gigs').upsert(
      {
        user_id: userId,
        gig_id: gigId,
        reason: reason ? String(reason).slice(0, 500) : null,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,gig_id' }
    );

    if (insertErr) {
      logger.error('Dismiss gig insert error', { error: insertErr.message, gigId, userId });
      return res.status(500).json({ error: 'Failed to dismiss gig' });
    }

    return res.json({ success: true });
  } catch (err) {
    logger.error('Dismiss gig error', { error: err.message });
    return res.status(500).json({ error: 'Failed to dismiss gig' });
  }
});

/**
 * DELETE /api/gigs/:gigId/dismiss
 * Undo a gig dismissal.
 */
router.delete('/:gigId/dismiss', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    await supabaseAdmin.from('dismissed_gigs').delete().eq('user_id', userId).eq('gig_id', gigId);

    return res.json({ success: true });
  } catch (err) {
    logger.error('Undo dismiss error', { error: err.message });
    return res.status(500).json({ error: 'Failed to undo dismiss' });
  }
});

// ============ URGENT TASK STATUS LIFECYCLE ============

const VALID_FULFILLMENT_STATUSES = ['on_the_way', 'arrived', 'picked_up', 'dropped_off', 'in_progress'];
const WORKER_ONLY_STATUSES = new Set(['on_the_way', 'arrived', 'picked_up', 'dropped_off']);

const urgentStatusSchema = Joi.object({
  status: Joi.string().valid(...VALID_FULFILLMENT_STATUSES).required(),
  helper_eta_minutes: Joi.number().integer().min(0).max(120).allow(null).optional(),
  helper_latitude: Joi.number().min(-90).max(90).optional(),
  helper_longitude: Joi.number().min(-180).max(180).optional(),
});

/**
 * POST /api/gigs/:gigId/status
 * Update the fulfillment status of an urgent task.
 * Worker can set: on_the_way, arrived, picked_up, dropped_off
 * Poster can set: in_progress
 * Status also auto-sets to in_progress on arrived.
 */
router.post('/:gigId/status', verifyToken, validate(urgentStatusSchema), async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;
    const { status, helper_eta_minutes, helper_latitude, helper_longitude } = req.body;

    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, status, is_urgent, starts_asap, urgent_details, title')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });

    // Only urgent/asap tasks can use this endpoint
    if (!gig.is_urgent && !gig.starts_asap) {
      return res.status(400).json({ error: 'This endpoint is only for urgent tasks' });
    }

    const isPoster = String(gig.user_id) === String(userId);
    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);

    if (!isPoster && !isWorker) {
      return res.status(403).json({ error: 'Only the poster or assigned worker can update status' });
    }

    // Enforce role restrictions
    if (WORKER_ONLY_STATUSES.has(status) && !isWorker) {
      return res.status(403).json({ error: `Only the assigned worker can set status to '${status}'` });
    }
    if (status === 'in_progress' && !isPoster && !isWorker) {
      return res.status(403).json({ error: 'Only the poster or worker can set in_progress' });
    }

    // Build JSONB merge for urgent_details
    const existingUrgent = (typeof gig.urgent_details === 'string'
      ? JSON.parse(gig.urgent_details)
      : gig.urgent_details) || {};

    const updatedUrgent = {
      ...existingUrgent,
      current_fulfillment_status: status,
      fulfillment_status_updated_at: new Date().toISOString(),
    };

    if (helper_eta_minutes !== undefined) {
      updatedUrgent.helper_eta_minutes = helper_eta_minutes;
    }

    if (helper_latitude !== undefined && helper_longitude !== undefined) {
      updatedUrgent.helper_last_location = {
        latitude: helper_latitude,
        longitude: helper_longitude,
        updated_at: new Date().toISOString(),
      };
    }

    const nowIso = new Date().toISOString();
    const updateData = {
      urgent_details: updatedUrgent,
      updated_at: nowIso,
    };

    const { data: updatedGig, error: updateError } = await supabaseAdmin
      .from('Gig')
      .update(updateData)
      .eq('id', gigId)
      .select('id, status, is_urgent, urgent_details')
      .single();

    if (updateError) {
      logger.error('Urgent status update error', { error: updateError.message, gigId, userId });
      return res.status(500).json({ error: 'Failed to update status' });
    }

    // Emit Socket.IO event to both poster and worker
    const io = req.app.get('io');
    if (io) {
      const statusPayload = {
        gigId,
        fulfillmentStatus: status,
        helper_eta_minutes: updatedUrgent.helper_eta_minutes || null,
        timestamp: Date.now(),
      };
      io.to(`gig:${gigId}`).emit('gig_status_update', statusPayload);
    }

    // Notify the other party
    const recipientId = isWorker ? gig.user_id : gig.accepted_by;
    if (recipientId) {
      const statusLabels = {
        on_the_way: 'is on the way',
        arrived: 'has arrived',
        picked_up: 'picked up the item',
        dropped_off: 'dropped off the item',
        in_progress: 'confirmed work is in progress',
      };
      createNotification({
        userId: recipientId,
        type: 'urgent_status_update',
        title: `Task update: ${gig.title || 'Urgent task'}`,
        body: `${isWorker ? 'Your helper' : 'The poster'} ${statusLabels[status] || status}${updatedUrgent.helper_eta_minutes ? ` (ETA: ${updatedUrgent.helper_eta_minutes} min)` : ''}`,
        icon: '\u26A1',
        link: `/gig/${gigId}`,
        metadata: { gig_id: gigId, fulfillment_status: status },
      });
    }

    logger.info('Urgent status updated', { gigId, userId, status, role: isWorker ? 'worker' : 'poster' });
    return res.json({ gig: updatedGig, fulfillment_status: status });
  } catch (err) {
    logger.error('Urgent status error', { error: err.message });
    return res.status(500).json({ error: 'Failed to update urgent status' });
  }
});

/**
 * GET /api/gigs/:gigId/active-status
 * Returns current fulfillment status, helper ETA, and helper location
 * (if location sharing is enabled) for an urgent task.
 */
router.get('/:gigId/active-status', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const userId = req.user.id;

    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, status, is_urgent, starts_asap, urgent_details')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) return res.status(404).json({ error: 'Gig not found' });

    if (!gig.is_urgent && !gig.starts_asap) {
      return res.status(400).json({ error: 'This endpoint is only for urgent tasks' });
    }

    const isPoster = String(gig.user_id) === String(userId);
    const isWorker = gig.accepted_by && String(gig.accepted_by) === String(userId);

    if (!isPoster && !isWorker) {
      return res.status(403).json({ error: 'Only the poster or assigned worker can view active status' });
    }

    const urgentDetails = (typeof gig.urgent_details === 'string'
      ? JSON.parse(gig.urgent_details)
      : gig.urgent_details) || {};

    const result = {
      gigId,
      gig_status: gig.status,
      fulfillment_status: urgentDetails.current_fulfillment_status || null,
      fulfillment_status_updated_at: urgentDetails.fulfillment_status_updated_at || null,
      helper_eta_minutes: urgentDetails.helper_eta_minutes || null,
      helper_location: null,
    };

    // Only expose helper location if location sharing is enabled
    if (urgentDetails.shareLocationDuringTask && urgentDetails.helper_last_location) {
      result.helper_location = urgentDetails.helper_last_location;
    }

    return res.json(result);
  } catch (err) {
    logger.error('Active status error', { error: err.message });
    return res.status(500).json({ error: 'Failed to get active status' });
  }
});

module.exports = router;
