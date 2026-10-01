const express = require('express');
const { createHash } = require('node:crypto');
const Joi = require('joi');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth');
const validate = require('../middleware/validate');
const { supportTrainDraftLimiter, supportTrainWriteLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../errorHandler');
const {
  draftSupportTrain,
  draftOpenSlotsNudge,
} = require('../services/ai/supportTrainDraftService');
const {
  loadSupportTrain,
  requireSupportTrainRole,
  requireSupportTrainViewer,
} = require('../middleware/supportTrainPermissions');
const { emitSupportTrainEvent } = require('../services/supportTrainNotifications');
const {
  sendGuestReservationAddressEmail,
  sendGuestReservationConfirmationEmail,
} = require('../services/emailService');
const stripeService = require('../stripe/stripeService');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { applyLocationPrecision } = require('../utils/locationPrivacy');
const { getAccessibleHomeIds } = require('../utils/homeMailAccess');
const {
  countActiveReservationsForSlot,
  listEffectivelyOpenSlots,
  normalizeSlotsWithActiveReservations,
} = require('../services/supportTrainSlotAvailability');

/** PostGIS GEOGRAPHY Point WKT */
function formatLocationForDB(latitude, longitude) {
  return `POINT(${longitude} ${latitude})`;
}

function parsePostGISPoint(point) {
  if (!point) return null;

  if (typeof point === 'object' && point.coordinates) {
    return { longitude: point.coordinates[0], latitude: point.coordinates[1] };
  }

  const str = String(point);
  const wktMatch = str.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (wktMatch) {
    return { longitude: parseFloat(wktMatch[1]), latitude: parseFloat(wktMatch[2]) };
  }

  if (/^[0-9a-fA-F]+$/.test(str) && (str.length === 42 || str.length === 50)) {
    try {
      const buf = Buffer.from(str, 'hex');
      const le = buf[0] === 1;
      const wkbType = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
      const hasSRID = (wkbType & 0x20000000) !== 0;
      const geomType = wkbType & 0xff;
      if (geomType !== 1) return null;
      const coordOffset = hasSRID ? 9 : 5;
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
}

function buildCoarseLocation(home) {
  if (!home) return null;

  const coarseLocation = {
    city: home.city || null,
    state: home.state || null,
    zip_code: home.zip_code || home.zipcode || null,
    latitude: null,
    longitude: null,
  };

  let lat = home.map_center_lat != null ? Number(home.map_center_lat) : null;
  let lng = home.map_center_lng != null ? Number(home.map_center_lng) : null;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    lat = home.latitude != null ? Number(home.latitude) : null;
    lng = home.longitude != null ? Number(home.longitude) : null;
  }

  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && home.location) {
    const parsed = parsePostGISPoint(home.location);
    lat = parsed?.latitude ?? lat;
    lng = parsed?.longitude ?? lng;
  }

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    coarseLocation.latitude = lat;
    coarseLocation.longitude = lng;
    applyLocationPrecision(coarseLocation, 'neighborhood_only', false, {
      stripAddress: false,
      setUnlockedFlag: false,
    });
  }

  return coarseLocation;
}

async function hasSupportTrainAddressGrant(supportTrainId, granteeUserId) {
  if (!supportTrainId || !granteeUserId) return false;

  const { count } = await supabaseAdmin
    .from('SupportTrainAddressGrant')
    .select('id', { count: 'exact', head: true })
    .eq('support_train_id', supportTrainId)
    .eq('grantee_user_id', granteeUserId);

  return (count || 0) > 0;
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function formatSupportTrainSlotDate(raw) {
  if (!raw) return 'an upcoming date';
  return new Date(`${raw}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatSupportTrainSlotTime(slot) {
  if (!slot) return null;
  if (slot.start_time && slot.end_time) return `${slot.start_time} - ${slot.end_time}`;
  if (slot.start_time) return `${slot.start_time}+`;
  if (slot.end_time) return `Until ${slot.end_time}`;
  return null;
}

function formatAddressLabel(address) {
  if (!address) return '';
  const firstLine = [address.address, address.unit_number].filter(Boolean).join(' ');
  const secondLine = [address.city, address.state, address.zip_code].filter(Boolean).join(', ');
  return [firstLine, secondLine].filter(Boolean).join('\n');
}

async function getSupportTrainExactDeliveryDetails(st, supportTrainId) {
  const [{ data: profile }, homeResult] = await Promise.all([
    supabaseAdmin
      .from('SupportTrainRecipientProfile')
      .select('delivery_instructions, special_instructions')
      .eq('support_train_id', supportTrainId)
      .single(),
    (async () => {
      const locationHomeId = st.recipient_home_id || st.Activity?.home_id || null;
      if (!locationHomeId) return { data: null, error: null };
      return supabaseAdmin
        .from('Home')
        .select('address, address2, city, state, zipcode')
        .eq('id', locationHomeId)
        .single();
    })(),
  ]);

  if (homeResult.error) {
    logger.warn('Failed to resolve Support Train exact address for guest email', {
      supportTrainId,
      error: homeResult.error.message,
    });
  }

  let address = null;
  if (homeResult.data) {
    address = {
      address: homeResult.data.address,
      unit_number: homeResult.data.address2 || null,
      city: homeResult.data.city,
      state: homeResult.data.state,
      zip_code: homeResult.data.zipcode || null,
    };
  } else if (st.delivery_address) {
    address = {
      address: st.delivery_address,
      unit_number: null,
      city: st.delivery_city,
      state: st.delivery_state,
      zip_code: st.delivery_zip || null,
    };
  }

  return {
    address,
    addressLabel: formatAddressLabel(address),
    deliveryInstructions: profile?.delivery_instructions || null,
    specialInstructions: profile?.special_instructions || null,
  };
}

// ─── Delivery location resolution ────────────────────────────────────────
/**
 * Resolve delivery location for a Support Train.
 * Returns { homeId, delivery } where homeId is set only when
 * the user picks an existing home, and delivery holds inline
 * address data for GPS/manual addresses (no Home record created).
 */
async function resolveDeliveryLocation(userId, deliveryLocation) {
  if (!deliveryLocation || typeof deliveryLocation !== 'object') {
    return { homeId: null, delivery: null };
  }

  const {
    mode,
    latitude,
    longitude,
    address,
    city,
    state,
    zip,
    home_id: bodyHomeId,
    place_id,
  } = deliveryLocation;

  // Existing home — only one the user belongs to (a trusted occupancy; a pending claim
  // is not membership), since the train shows its exact address. No new Home created.
  if (mode === 'home' && bodyHomeId) {
    const homeIds = await getAccessibleHomeIds(userId);
    if (!homeIds.includes(bodyHomeId)) {
      logger.warn('Support Train delivery_location home_id not a home the user belongs to', {
        userId,
        bodyHomeId,
      });
      return { homeId: null, delivery: null };
    }
    return { homeId: bodyHomeId, delivery: null };
  }

  // GPS or manual address — store inline, do NOT create a Home record
  const lat = Number(latitude);
  const lng = Number(longitude);
  const addr = typeof address === 'string' ? address.trim() : '';
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || addr.length < 3) {
    return { homeId: null, delivery: null };
  }

  return {
    homeId: null,
    delivery: {
      delivery_address: addr.slice(0, 500),
      delivery_city: (city && String(city).trim()) || null,
      delivery_state: (state && String(state).trim()) || null,
      delivery_zip: (zip && String(zip).trim()) || null,
      delivery_lat: lat,
      delivery_lng: lng,
      delivery_place_id: place_id || null,
    },
  };
}

/** Inline delivery columns resolveDeliveryLocation can set; cleared when a draft is refreshed. */
const EMPTY_DELIVERY = {
  delivery_address: null,
  delivery_city: null,
  delivery_state: null,
  delivery_zip: null,
  delivery_lat: null,
  delivery_lng: null,
  delivery_place_id: null,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function aiErrorStatus(errorCode) {
  if (errorCode === 'AI_UNAVAILABLE') return 503;
  if (errorCode === 'AI_TIMEOUT') return 504;
  return 422;
}

// ─── Validation Schemas ────────────────────────────────────────────────────

const draftFromStorySchema = Joi.object({
  story: Joi.string().min(10).max(2000).required(),
  support_modes_requested: Joi.array()
    .items(Joi.string().valid('meal', 'takeout', 'groceries', 'gift_funds'))
    .max(4)
    .optional(),
  recipient_reference: Joi.object({
    user_id: Joi.string().uuid().optional(),
    label: Joi.string().max(100).optional(),
  }).optional(),
  home_reference: Joi.object({
    home_id: Joi.string().uuid().required(),
  }).optional(),
});

const deliveryLocationSchema = Joi.object({
  mode: Joi.string().valid('home', 'current', 'address').required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  address: Joi.string().min(3).max(500).required(),
  city: Joi.string().allow('', null).optional(),
  state: Joi.string().allow('', null).optional(),
  zip: Joi.string().allow('', null).optional(),
  home_id: Joi.string().uuid().allow(null).optional(),
  place_id: Joi.string().allow('', null).optional(),
});

const createSupportTrainSchema = Joi.object({
  client_request_id: Joi.string().uuid().optional(),
  draft_payload: Joi.object().required(),
  title: Joi.string().max(200).required(),
  recipient_user_id: Joi.string().uuid().optional(),
  recipient_home_id: Joi.string().uuid().optional(),
  home_id: Joi.string().uuid().optional(),
  /** When set, resolves to recipient_home_id (for existing home) or inline delivery columns (GPS/address) */
  delivery_location: deliveryLocationSchema.optional(),
  sharing_mode: Joi.string()
    .valid('private_link', 'invited_only', 'direct_share_only')
    .default('private_link'),
  enable_home_cooked_meals: Joi.boolean().default(true),
  enable_takeout: Joi.boolean().default(true),
  enable_groceries: Joi.boolean().default(true),
  enable_gift_funds: Joi.boolean().default(false),
  timezone: Joi.string().max(64).default('America/Los_Angeles'),
});

const updateSupportTrainSchema = Joi.object({
  title: Joi.string().max(200).optional(),
  summary: Joi.string().max(2000).allow(null).optional(),
  story: Joi.string().max(2000).allow(null).optional(),
  sharing_mode: Joi.string().valid('private_link', 'invited_only', 'direct_share_only').optional(),
  enable_home_cooked_meals: Joi.boolean().optional(),
  enable_takeout: Joi.boolean().optional(),
  enable_groceries: Joi.boolean().optional(),
  enable_gift_funds: Joi.boolean().optional(),
  show_exact_address_after_signup: Joi.boolean().optional(),
  /** Activity.visibility: private = not in neighborhood Tasks list; nearby/public = listed when in radius */
  activity_visibility: Joi.string().valid('private', 'nearby', 'public').optional(),
}).min(1);

const recipientProfileSchema = Joi.object({
  household_size: Joi.number().integer().min(1).max(50).allow(null).optional(),
  adults_count: Joi.number().integer().min(0).max(50).allow(null).optional(),
  children_count: Joi.number().integer().min(0).max(50).allow(null).optional(),
  preferred_dropoff_start_time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .allow(null)
    .optional(),
  preferred_dropoff_end_time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .allow(null)
    .optional(),
  contactless_preferred: Joi.boolean().optional(),
  delivery_instructions: Joi.string().max(2000).allow(null).optional(),
  dietary_styles: Joi.array().items(Joi.string().max(100)).max(50).optional(),
  allergies: Joi.array().items(Joi.string().max(100)).max(50).optional(),
  favorite_meals: Joi.array().items(Joi.string().max(100)).max(50).optional(),
  least_favorite_meals: Joi.array().items(Joi.string().max(100)).max(50).optional(),
  favorite_restaurants: Joi.array().items(Joi.string().max(100)).max(50).optional(),
  special_instructions: Joi.string().max(2000).allow(null).optional(),
});

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const generateSlotsSchema = Joi.object({
  preset: Joi.string()
    .valid('every_dinner', 'mwf_dinners', 'every_lunch', 'weekly_groceries')
    .required(),
  start_date: Joi.string().pattern(isoDatePattern).required(),
  end_date: Joi.string().pattern(isoDatePattern).required(),
  replace_existing: Joi.boolean().default(false),
  weekdays: Joi.array()
    .items(Joi.number().integer().min(0).max(6))
    .min(1)
    .max(7)
    .unique()
    .optional(),
  start_time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .optional(),
  end_time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .optional(),
  slot_label: Joi.string().valid('Breakfast', 'Lunch', 'Dinner', 'Groceries', 'Custom').optional(),
  support_mode: Joi.string().valid('meal', 'takeout', 'groceries').optional(),
}).custom((value, helpers) => {
  const start = new Date(value.start_date);
  const end = new Date(value.end_date);
  if (end < start)
    return helpers.error('any.invalid', { message: 'end_date must be >= start_date' });
  const diffDays = (end - start) / (1000 * 60 * 60 * 24);
  if (diffDays > 90)
    return helpers.error('any.invalid', { message: 'Date range must not exceed 90 days' });
  const st = value.start_time;
  const et = value.end_time;
  if ((st && !et) || (!st && et)) {
    return helpers.error('any.invalid', {
      message: 'start_time and end_time must both be set when customizing slot times',
    });
  }
  if (st && et && st >= et) {
    return helpers.error('any.invalid', { message: 'start_time must be before end_time' });
  }
  return value;
});

const customSlotSchema = Joi.object({
  client_request_id: Joi.string().uuid().optional(),
  slot_date: Joi.string().pattern(isoDatePattern).required(),
  slot_label: Joi.string().valid('Breakfast', 'Lunch', 'Dinner', 'Groceries', 'Custom').required(),
  support_mode: Joi.string().valid('meal', 'takeout', 'groceries').required(),
  start_time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .allow(null)
    .optional(),
  end_time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .allow(null)
    .optional(),
  capacity: Joi.number().integer().min(1).max(20).default(1),
  notes: Joi.string().max(500).allow(null).optional(),
});

const updateSlotSchema = Joi.object({
  slot_label: Joi.string().valid('Breakfast', 'Lunch', 'Dinner', 'Groceries', 'Custom').optional(),
  support_mode: Joi.string().valid('meal', 'takeout', 'groceries').optional(),
  slot_date: Joi.string().pattern(isoDatePattern).optional(),
  start_time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .allow(null)
    .optional(),
  end_time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .allow(null)
    .optional(),
  capacity: Joi.number().integer().min(1).max(20).optional(),
  notes: Joi.string().max(500).allow(null).optional(),
  status: Joi.string().valid('open', 'canceled').optional(),
}).min(1);

// ─── Routes ────────────────────────────────────────────────────────────────

// Health check (no auth) — smoke-test the mount point
router.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'support_trains' });
});

// List my Support Train participations
router.get(
  '/me/support-trains',
  verifyToken,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const roleFilter = req.query.role; // 'organizer' | 'helper'
    const statusFilter = req.query.status;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const offset = parseInt(req.query.offset, 10) || 0;

    const results = [];

    // Fetch organizer participations
    if (!roleFilter || roleFilter === 'organizer') {
      let orgQuery = supabaseAdmin
        .from('SupportTrain')
        .select(
          `
        id, status, published_at, created_at,
        Activity!inner ( title )
      `
        )
        .eq('organizer_user_id', userId)
        .order('created_at', { ascending: false });

      if (statusFilter) orgQuery = orgQuery.eq('status', statusFilter);

      const { data: owned } = await orgQuery;

      // Also check co-organizer rows
      const { data: coOrgRows } = await supabaseAdmin
        .from('SupportTrainOrganizer')
        .select('support_train_id, role')
        .eq('user_id', userId)
        .neq('role', 'primary');

      const coOrgIds = (coOrgRows || []).map((r) => r.support_train_id);
      const ownedIds = new Set((owned || []).map((s) => s.id));

      let coOrgTrains = [];
      const missingIds = coOrgIds.filter((id) => !ownedIds.has(id));
      if (missingIds.length > 0) {
        let coQuery = supabaseAdmin
          .from('SupportTrain')
          .select('id, status, published_at, created_at, Activity!inner ( title )')
          .in('id', missingIds);
        if (statusFilter) coQuery = coQuery.eq('status', statusFilter);
        const { data } = await coQuery;
        coOrgTrains = data || [];
      }

      const coOrgRoleMap = {};
      (coOrgRows || []).forEach((r) => {
        coOrgRoleMap[r.support_train_id] = r.role;
      });

      for (const st of owned || []) {
        results.push({
          id: st.id,
          title: st.Activity?.title || null,
          status: st.status,
          published_at: st.published_at,
          created_at: st.created_at,
          my_role: 'organizer',
        });
      }
      for (const st of coOrgTrains) {
        results.push({
          id: st.id,
          title: st.Activity?.title || null,
          status: st.status,
          published_at: st.published_at,
          created_at: st.created_at,
          my_role: coOrgRoleMap[st.id] || 'co_organizer',
        });
      }
    }

    // Fetch helper participations
    if (!roleFilter || roleFilter === 'helper') {
      const { data: reservations } = await supabaseAdmin
        .from('SupportTrainReservation')
        .select('support_train_id')
        .eq('user_id', userId)
        .neq('status', 'canceled');

      const helperTrainIds = [...new Set((reservations || []).map((r) => r.support_train_id))];
      const existingIds = new Set(results.map((r) => r.id));
      const newHelperIds = helperTrainIds.filter((id) => !existingIds.has(id));

      if (newHelperIds.length > 0) {
        let helperQuery = supabaseAdmin
          .from('SupportTrain')
          .select('id, status, published_at, created_at, Activity!inner ( title )')
          .in('id', newHelperIds);
        if (statusFilter) helperQuery = helperQuery.eq('status', statusFilter);
        const { data: helperTrains } = await helperQuery;

        for (const st of helperTrains || []) {
          results.push({
            id: st.id,
            title: st.Activity?.title || null,
            status: st.status,
            published_at: st.published_at,
            created_at: st.created_at,
            my_role: 'helper',
          });
        }
      }
    }

    // Sort by created_at desc, paginate
    results.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const paginated = results.slice(offset, offset + limit);

    res.json({
      support_trains: paginated,
      total: results.length,
      limit,
      offset,
    });
  })
);

// Nearby Support Trains for Tasks feed (visibility nearby/public, same radius idea as gigs)
router.get(
  '/nearby',
  verifyToken,
  asyncHandler(async (req, res) => {
    const lat = parseFloat(req.query.latitude);
    const lng = parseFloat(req.query.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid latitude is required.' });
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res
        .status(400)
        .json({ error: 'BAD_REQUEST', message: 'Valid longitude is required.' });
    }

    let radiusMeters = parseFloat(req.query.radius_meters);
    if (!Number.isFinite(radiusMeters)) {
      radiusMeters = 40234; // ~25 mi
    }
    radiusMeters = Math.min(Math.max(radiusMeters, 100), 200000);

    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit)) limit = 40;
    limit = Math.min(Math.max(limit, 1), 100);

    const { data, error } = await supabaseAdmin.rpc('list_support_trains_nearby', {
      p_lat: lat,
      p_lng: lng,
      p_radius_meters: radiusMeters,
      p_limit: limit,
    });

    if (error) {
      logger.error('list_support_trains_nearby RPC failed', { error: error.message, lat, lng });
      return res
        .status(500)
        .json({ error: 'INTERNAL', message: 'Failed to load nearby Support Trains.' });
    }

    res.json({ support_trains: data || [] });
  })
);

// AI draft from organizer story
router.post(
  '/draft-from-story',
  verifyToken,
  supportTrainDraftLimiter,
  validate(draftFromStorySchema),
  asyncHandler(async (req, res) => {
    const { story, support_modes_requested, recipient_reference, home_reference } = req.body;

    const result = await draftSupportTrain({
      story,
      supportModesRequested: support_modes_requested,
      recipientReference: recipient_reference,
      homeReference: home_reference,
      userId: req.user.id,
    });

    if (result.error) {
      return res.status(aiErrorStatus(result.error)).json(result);
    }

    res.json(result);
  })
);

// Create a new Support Train (draft)
router.post(
  '/',
  verifyToken,
  supportTrainWriteLimiter,
  validate(createSupportTrainSchema),
  asyncHandler(async (req, res) => {
    const {
      draft_payload,
      title,
      recipient_user_id,
      recipient_home_id,
      home_id,
      delivery_location,
      sharing_mode,
      enable_home_cooked_meals,
      enable_takeout,
      enable_groceries,
      enable_gift_funds,
      timezone,
      client_request_id,
    } = req.body;
    const userId = req.user.id;
    // A train's organizers, recipient and helpers see its Home's exact address, so a train
    // may only name a Home its organizer belongs to.
    const namedHomeIds = [recipient_home_id, home_id].filter(Boolean);
    if (namedHomeIds.length > 0) {
      const homeIds = await getAccessibleHomeIds(userId);
      if (namedHomeIds.some((id) => !homeIds.includes(id))) {
        return res.status(403).json({ error: 'HOME_NOT_ACCESSIBLE', message: 'You can only use a home you belong to.' });
      }
    }
    // One create keeps its identity through an uncertain reply: a retry with the same
    // client_request_id reaches the draft the first attempt made instead of making another.
    const createId = (kind) => (client_request_id ? createHash('sha256')
      .update(`pantopus:train-create:v1:${kind}:${userId.toLowerCase()}:${client_request_id.toLowerCase()}`)
      .digest('hex').slice(0, 32) : null);
    const requestActivityId = createId('activity');
    const requestTrainId = createId('train');

    let resolvedRecipientHomeId = recipient_home_id || null;
    let resolvedActivityHomeId = home_id || null;
    let deliveryFields = {};

    if (delivery_location) {
      const { homeId, delivery } = await resolveDeliveryLocation(userId, delivery_location);
      if (homeId) {
        resolvedRecipientHomeId = homeId;
        resolvedActivityHomeId = homeId;
      }
      if (delivery) {
        deliveryFields = delivery;
      }
    }

    const activityFields = {
      title,
      summary: draft_payload.story || null,
      home_id: resolvedActivityHomeId,
      timezone,
    };
    const trainFields = {
      recipient_user_id: recipient_user_id || null,
      recipient_home_id: resolvedRecipientHomeId,
      ...deliveryFields,
      story: draft_payload.story || null,
      sharing_mode,
      enable_home_cooked_meals,
      enable_takeout,
      enable_groceries,
      enable_gift_funds,
      ai_draft_payload: draft_payload,
    };
    const readRequestTrain = async () => {
      const { data, error } = await supabaseAdmin
        .from('SupportTrain')
        .select('id, activity_id, organizer_user_id, status')
        .eq('id', requestTrainId)
        .maybeSingle();
      if (error) throw error;
      return data;
    };
    // The same create already landed (its reply was lost): the draft takes this attempt's
    // answers, which the organizer may have edited since, and keeps its ids.
    const acknowledgeRetry = async (existing) => {
      if (existing.organizer_user_id !== userId || existing.status !== 'draft') {
        return res.status(409).json({
          error: 'CREATE_REQUEST_DONE',
          message: 'This support train was already created. Find it in My trains.',
        });
      }
      const [{ error: activityRefreshErr }, { error: trainRefreshErr }] = await Promise.all([
        supabaseAdmin.from('Activity').update(activityFields).eq('id', existing.activity_id),
        supabaseAdmin
          .from('SupportTrain')
          .update({ ...EMPTY_DELIVERY, ...trainFields })
          .eq('id', existing.id)
          .eq('status', 'draft'),
      ]);
      if (activityRefreshErr || trainRefreshErr) {
        logger.error('Refresh retried SupportTrain draft failed', {
          supportTrainId: existing.id,
          error: (activityRefreshErr || trainRefreshErr).message,
        });
        return res.status(500).json({ error: 'INTERNAL', message: 'Failed to create support train.' });
      }
      return res.status(201).json({
        support_train_id: existing.id,
        activity_id: existing.activity_id,
        status: 'draft',
      });
    };
    if (requestTrainId) {
      const existing = await readRequestTrain();
      if (existing) return acknowledgeRetry(existing);
    }

    // 1. Insert Activity
    const activityRow = {
      creator_user_id: userId,
      activity_type: 'support_train',
      status: 'draft',
      ...activityFields,
    };
    const { data: activity, error: actErr } = await (requestActivityId
      ? supabaseAdmin
        .from('Activity')
        .upsert({ ...activityRow, id: requestActivityId }, { onConflict: 'id', ignoreDuplicates: true })
      : supabaseAdmin.from('Activity').insert(activityRow))
      .select('id')
      .maybeSingle();

    if (actErr || (!activity && !requestActivityId)) {
      logger.error('Create Activity failed', { userId, error: actErr?.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to create activity.' });
    }
    if (!activity) {
      // This request's Activity already exists: a concurrent retry, or an attempt whose
      // train insert and clean-up both failed. Its train, if any, answers the retry.
      const existing = await readRequestTrain();
      if (existing) return acknowledgeRetry(existing);
      await supabaseAdmin.from('Activity').update(activityFields).eq('id', requestActivityId);
    }
    const activityId = activity?.id || requestActivityId;

    // 2. Insert SupportTrain
    const { data: supportTrain, error: stErr } = await supabaseAdmin
      .from('SupportTrain')
      .insert({
        activity_id: activityId,
        support_train_type: 'meal_support',
        organizer_user_id: userId,
        status: 'draft',
        show_exact_address_after_signup: false,
        ...trainFields,
        ...(requestTrainId ? { id: requestTrainId } : {}),
      })
      .select('id')
      .single();

    if (stErr?.code === '23505' && requestTrainId) {
      // A concurrent retry of the same create inserted it first.
      const existing = await readRequestTrain();
      if (existing) return acknowledgeRetry(existing);
    }
    if (stErr || !supportTrain) {
      logger.error('Create SupportTrain failed, cleaning up Activity', {
        activityId,
        error: stErr?.message,
      });
      // Only an Activity this request inserted; a reused one stays for the next retry.
      if (activity) await supabaseAdmin.from('Activity').delete().eq('id', activityId);
      return res
        .status(500)
        .json({ error: 'INTERNAL', message: 'Failed to create support train.' });
    }

    // 3. Insert SupportTrainOrganizer (primary)
    const { error: orgErr } = await supabaseAdmin.from('SupportTrainOrganizer').insert({
      support_train_id: supportTrain.id,
      user_id: userId,
      role: 'primary',
    });

    if (orgErr) {
      logger.error('Create SupportTrainOrganizer failed, cleaning up', {
        supportTrainId: supportTrain.id,
        error: orgErr.message,
      });
      await supabaseAdmin.from('SupportTrain').delete().eq('id', supportTrain.id);
      await supabaseAdmin.from('Activity').delete().eq('id', activityId);
      return res
        .status(500)
        .json({ error: 'INTERNAL', message: 'Failed to create organizer record.' });
    }

    // 4. Insert the RecipientProfile. Publishing requires one, and a client that collects
    // no recipient details (the native Start wizards) would otherwise never be able to
    // publish; the web fills in the details with its own upsert right after create.
    const dp = draft_payload;
    const profileRow = {
      support_train_id: supportTrain.id,
      household_size: dp.household_size || null,
      contactless_preferred: dp.contactless_preferred || false,
      delivery_instructions: null,
      special_instructions: dp.special_instructions || null,
    };

    // Map dietary arrays to JSONB
    if (dp.dietary_restrictions && dp.dietary_restrictions.length > 0) {
      profileRow.allergies = { items: dp.dietary_restrictions };
    }
    if (dp.dietary_preferences && dp.dietary_preferences.length > 0) {
      profileRow.dietary_styles = { items: dp.dietary_preferences };
    }

    // Map dropoff window
    if (dp.preferred_dropoff_window) {
      profileRow.preferred_dropoff_start_time = dp.preferred_dropoff_window.start_time || null;
      profileRow.preferred_dropoff_end_time = dp.preferred_dropoff_window.end_time || null;
    }

    const { error: profErr } = await supabaseAdmin
      .from('SupportTrainRecipientProfile')
      .insert(profileRow);

    if (profErr) {
      // Non-fatal: log but don't fail the whole creation
      logger.warn('Create SupportTrainRecipientProfile failed', {
        supportTrainId: supportTrain.id,
        error: profErr.message,
      });
    }

    res.status(201).json({
      support_train_id: supportTrain.id,
      activity_id: activityId,
      status: 'draft',
    });
  })
);

// ─── Slot Management ──────────────────────────────────────────────────────

// Preset config: day-of-week filter, label, support_mode, time window
const PRESET_CONFIG = {
  every_dinner: { days: null, label: 'Dinner', mode: 'meal', start: '17:00', end: '19:00' },
  mwf_dinners: { days: [1, 3, 5], label: 'Dinner', mode: 'meal', start: '17:00', end: '19:00' },
  every_lunch: { days: null, label: 'Lunch', mode: 'meal', start: '12:00', end: '13:30' },
  weekly_groceries: {
    days: [6],
    label: 'Groceries',
    mode: 'groceries',
    start: '09:00',
    end: '11:00',
  },
};

// Generate slots from preset
router.post(
  '/:id/generate-slots',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  validate(generateSlotsSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const {
      preset,
      start_date,
      end_date,
      replace_existing,
      weekdays,
      start_time,
      end_time,
      slot_label,
      support_mode,
    } = req.body;

    // If replace_existing, delete open slots without reservations
    if (replace_existing) {
      // Find slots that have reservations (any status)
      const { data: slotsWithRes } = await supabaseAdmin
        .from('SupportTrainReservation')
        .select('slot_id')
        .eq('support_train_id', st.id);
      const protectedSlotIds = (slotsWithRes || []).map((r) => r.slot_id);

      let deleteQuery = supabaseAdmin
        .from('SupportTrainSlot')
        .delete()
        .eq('support_train_id', st.id)
        .eq('status', 'open');

      if (protectedSlotIds.length > 0) {
        deleteQuery = deleteQuery.not('id', 'in', `(${protectedSlotIds.join(',')})`);
      }

      await deleteQuery;
    }

    const base = PRESET_CONFIG[preset];
    const config = {
      days: base.days,
      label: base.label,
      mode: base.mode,
      start: base.start,
      end: base.end,
    };
    if (Array.isArray(weekdays) && weekdays.length > 0) {
      config.days = weekdays;
    }
    if (start_time && end_time) {
      config.start = start_time;
      config.end = end_time;
    }
    if (slot_label) config.label = slot_label;
    if (support_mode) config.mode = support_mode;

    const slots = [];
    // Use explicit UTC to avoid local-timezone date shifting
    const start = new Date(start_date + 'T00:00:00Z');
    const end = new Date(end_date + 'T00:00:00Z');
    let sortOrder = 0;

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dow = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      if (config.days !== null && !config.days.includes(dow)) continue;

      slots.push({
        support_train_id: st.id,
        slot_date: d.toISOString().split('T')[0],
        slot_label: config.label,
        support_mode: config.mode,
        start_time: config.start,
        end_time: config.end,
        capacity: 1,
        filled_count: 0,
        status: 'open',
        sort_order: sortOrder++,
      });
    }

    if (slots.length === 0) {
      return res.json({ slots: [], count: 0 });
    }

    // A re-sent request (Android re-sends a POST after a dropped connection) or an overlapping
    // range must not add a second identical slot to a day: keep the slot that is there, add only
    // the missing ones, and answer with every slot of the schedule.
    const slotKey = (s) =>
      [s.slot_date, s.slot_label, s.support_mode, String(s.start_time).slice(0, 5), String(s.end_time).slice(0, 5)].join('|');
    const { data: existingSlots, error: existingErr } = await supabaseAdmin
      .from('SupportTrainSlot')
      .select('*')
      .eq('support_train_id', st.id)
      .in('slot_date', slots.map((s) => s.slot_date))
      .neq('status', 'canceled');

    if (existingErr) {
      logger.error('Generate slots read failed', { supportTrainId: st.id, error: existingErr.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to generate slots.' });
    }

    const kept = new Map((existingSlots || []).map((s) => [slotKey(s), s]));
    const missing = slots.filter((s) => !kept.has(slotKey(s)));
    if (missing.length > 0) {
      const { data, error } = await supabaseAdmin.from('SupportTrainSlot').insert(missing).select('*');

      if (error) {
        logger.error('Generate slots failed', { supportTrainId: st.id, error: error.message });
        return res.status(500).json({ error: 'INTERNAL', message: 'Failed to generate slots.' });
      }
      for (const s of data || []) kept.set(slotKey(s), s);
    }

    const scheduled = slots.map((s) => kept.get(slotKey(s))).filter(Boolean);
    res.json({ slots: scheduled, count: scheduled.length });
  })
);

// Add a custom slot
router.post(
  '/:id/slots',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  validate(customSlotSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const { slot_date, slot_label, support_mode, start_time, end_time, capacity, notes, client_request_id } = req.body;
    // One editor keeps its command identity through an uncertain response.
    // The existing primary key arbitrates concurrent retries, scoped to actor/train.
    const slotId = client_request_id ? createHash('sha256')
      .update(`pantopus:train-slot:v1:${st.id.toLowerCase()}:${req.user.id.toLowerCase()}:${client_request_id.toLowerCase()}`)
      .digest('hex').slice(0, 32) : null;
    const readRetry = async () => {
      const { data, error } = await supabaseAdmin.from('SupportTrainSlot')
        .select('*').eq('id', slotId).maybeSingle();
      if (error) throw error;
      return data;
    };
    const acknowledgeRetry = (existing) => {
      if (existing.support_train_id !== st.id || existing.slot_date !== slot_date ||
          existing.slot_label !== slot_label || existing.support_mode !== support_mode ||
          (existing.start_time?.slice(0, 5) || null) !== (start_time || null) ||
          (existing.end_time?.slice(0, 5) || null) !== (end_time || null) ||
          existing.capacity !== capacity || (existing.notes || null) !== (notes || null) ||
          existing.status === 'canceled') {
        return res.status(409).json({ error: 'SLOT_REQUEST_CHANGED',
          message: 'This date was already saved with different details. Close the editor and review your dates.' });
      }
      return res.status(201).json(existing);
    };
    if (slotId) {
      const existing = await readRetry();
      if (existing) return acknowledgeRetry(existing);
    }

    // Determine sort_order: max existing + 1
    const { data: maxRow } = await supabaseAdmin
      .from('SupportTrainSlot')
      .select('sort_order')
      .eq('support_train_id', st.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (maxRow?.sort_order ?? -1) + 1;

    const row = {
        support_train_id: st.id,
        slot_date,
        slot_label,
        support_mode,
        start_time: start_time || null,
        end_time: end_time || null,
        capacity,
        filled_count: 0,
        status: 'open',
        notes: notes || null,
        sort_order: sortOrder,
    };
    const insert = slotId
      ? supabaseAdmin.from('SupportTrainSlot').upsert({ ...row, id: slotId }, { onConflict: 'id', ignoreDuplicates: true })
      : supabaseAdmin.from('SupportTrainSlot').insert(row);
    const { data, error } = await insert.select('*').maybeSingle();
    if (!error && !data && slotId) {
      const existing = await readRetry();
      if (existing) return acknowledgeRetry(existing);
    }

    if (error || !data) {
      logger.error('Create custom slot failed', { supportTrainId: st.id, error: error?.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to create slot.' });
    }

    res.status(201).json(data);
  })
);

// Update a slot
router.patch(
  '/:id/slots/:slotId',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  validate(updateSlotSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const { slotId } = req.params;
    const body = req.body;

    // Verify slot belongs to this support train
    const { data: slot, error: fetchErr } = await supabaseAdmin
      .from('SupportTrainSlot')
      .select('*')
      .eq('id', slotId)
      .eq('support_train_id', st.id)
      .single();

    if (fetchErr || !slot) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Slot not found.' });
    }

    const isCancelingSlot = body.status === 'canceled' && slot.status !== 'canceled';

    // If changing support_mode, slot_date, or canceling the slot, check for existing reservations
    if (body.support_mode !== undefined || body.slot_date !== undefined || isCancelingSlot) {
      const { count } = await supabaseAdmin
        .from('SupportTrainReservation')
        .select('id', { count: 'exact', head: true })
        .eq('slot_id', slotId)
        .neq('status', 'canceled');

      if ((count || 0) > 0) {
        return res.status(409).json({
          error: 'SLOT_HAS_RESERVATIONS',
          message: isCancelingSlot
            ? 'Cannot remove a slot with active reservations.'
            : 'Cannot change support mode or date for a slot with active reservations.',
        });
      }
    }

    // Build patch
    const patch = {};
    if (body.slot_label !== undefined) patch.slot_label = body.slot_label;
    if (body.support_mode !== undefined) patch.support_mode = body.support_mode;
    if (body.slot_date !== undefined) patch.slot_date = body.slot_date;
    if (body.start_time !== undefined) patch.start_time = body.start_time;
    if (body.end_time !== undefined) patch.end_time = body.end_time;
    if (body.capacity !== undefined) patch.capacity = body.capacity;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.status !== undefined) patch.status = body.status;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('SupportTrainSlot')
      .update(patch)
      .eq('id', slotId)
      .select('*')
      .single();

    if (updateErr || !updated) {
      logger.error('Update slot failed', { slotId, error: updateErr?.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to update slot.' });
    }

    res.json(updated);
  })
);

// ─── Co-organizer Management ──────────────────────────────────────────────

const addOrganizerSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  role: Joi.string().valid('co_organizer', 'recipient_delegate').required(),
});

// Add a co-organizer
router.post(
  '/:id/organizers',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary']),
  validate(addOrganizerSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const { user_id, role } = req.body;

    // Prevent adding the primary organizer again
    if (user_id === st.organizer_user_id) {
      return res
        .status(409)
        .json({ error: 'ALREADY_PRIMARY', message: 'This user is already the primary organizer.' });
    }

    const { data, error } = await supabaseAdmin
      .from('SupportTrainOrganizer')
      .upsert(
        { support_train_id: st.id, user_id, role },
        { onConflict: 'support_train_id,user_id' }
      )
      .select('*')
      .single();

    if (error || !data) {
      logger.error('Add organizer failed', {
        supportTrainId: st.id,
        userId: user_id,
        error: error?.message,
      });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to add organizer.' });
    }

    // A co-organizer added after publishing joins the campaign chat, as publish does for earlier ones.
    try {
      const chatThreadId = req.activity?.chat_thread_id;
      if (chatThreadId) {
        await supabaseAdmin
          .from('ChatParticipant')
          .upsert(
            { room_id: chatThreadId, user_id, role: 'member', is_active: true },
            { onConflict: 'room_id,user_id' }
          );
      }
    } catch (chatErr) {
      logger.error('Add organizer to chat failed (non-fatal)', {
        supportTrainId: st.id,
        userId: user_id,
        error: chatErr.message,
      });
    }

    res.status(201).json(data);
  })
);

// Remove a co-organizer
router.delete(
  '/:id/organizers/:userId',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary']),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const targetUserId = req.params.userId;

    // Cannot remove the primary organizer
    if (targetUserId === st.organizer_user_id) {
      return res
        .status(409)
        .json({ error: 'CANNOT_REMOVE_PRIMARY', message: 'Cannot remove the primary organizer.' });
    }

    const { error } = await supabaseAdmin
      .from('SupportTrainOrganizer')
      .delete()
      .eq('support_train_id', st.id)
      .eq('user_id', targetUserId);

    if (error) {
      logger.error('Remove organizer failed', {
        supportTrainId: st.id,
        targetUserId,
        error: error.message,
      });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to remove organizer.' });
    }

    // A removed co-organizer leaves the campaign chat unless they are still the recipient or a helper
    // with an active signup (the same rule as a helper's cancel).
    try {
      const chatThreadId = req.activity?.chat_thread_id;
      if (chatThreadId && targetUserId !== st.recipient_user_id) {
        const { count: activeRes } = await supabaseAdmin
          .from('SupportTrainReservation')
          .select('id', { count: 'exact', head: true })
          .eq('support_train_id', st.id)
          .eq('user_id', targetUserId)
          .neq('status', 'canceled');

        if ((activeRes || 0) === 0) {
          await supabaseAdmin
            .from('ChatParticipant')
            .delete()
            .eq('room_id', chatThreadId)
            .eq('user_id', targetUserId);
        }
      }
    } catch (chatErr) {
      logger.error('Remove organizer from chat failed (non-fatal)', {
        supportTrainId: st.id,
        targetUserId,
        error: chatErr.message,
      });
    }

    res.status(204).end();
  })
);

// List organizers
router.get(
  '/:id/organizers',
  verifyToken,
  loadSupportTrain,
  requireSupportTrainViewer,
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    // Always include the primary organizer
    const { data: organizers, error } = await supabaseAdmin
      .from('SupportTrainOrganizer')
      .select(
        `
      id, role, created_at,
      user_id,
      User:user_id ( id, username, name, profile_picture_url )
    `
      )
      .eq('support_train_id', st.id)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('List organizers failed', { supportTrainId: st.id, error: error.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to list organizers.' });
    }

    const result = (organizers || []).map((o) => ({
      id: o.id,
      user_id: o.user_id,
      role: o.role,
      created_at: o.created_at,
      user: o.User
        ? {
            id: o.User.id,
            username: o.User.username,
            name: o.User.name,
            profile_picture_url: o.User.profile_picture_url,
          }
        : null,
    }));

    res.json({ organizers: result });
  })
);

// Upsert recipient profile
router.put(
  '/:id/recipient-profile',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer', 'recipient_delegate']),
  validate(recipientProfileSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const body = req.body;

    // Build the row, converting array inputs to JSONB objects
    const row = {
      support_train_id: st.id,
    };

    if (body.household_size !== undefined) row.household_size = body.household_size;
    if (body.adults_count !== undefined) row.adults_count = body.adults_count;
    if (body.children_count !== undefined) row.children_count = body.children_count;
    if (body.preferred_dropoff_start_time !== undefined)
      row.preferred_dropoff_start_time = body.preferred_dropoff_start_time;
    if (body.preferred_dropoff_end_time !== undefined)
      row.preferred_dropoff_end_time = body.preferred_dropoff_end_time;
    if (body.contactless_preferred !== undefined)
      row.contactless_preferred = body.contactless_preferred;
    if (body.delivery_instructions !== undefined)
      row.delivery_instructions = body.delivery_instructions;
    if (body.special_instructions !== undefined)
      row.special_instructions = body.special_instructions;

    // Arrays → JSONB
    if (body.dietary_styles !== undefined) row.dietary_styles = { items: body.dietary_styles };
    if (body.allergies !== undefined) row.allergies = { items: body.allergies };
    if (body.favorite_meals !== undefined) row.favorite_meals = { items: body.favorite_meals };
    if (body.least_favorite_meals !== undefined)
      row.least_favorite_meals = { items: body.least_favorite_meals };
    if (body.favorite_restaurants !== undefined)
      row.favorite_restaurants = { items: body.favorite_restaurants };

    const { data, error } = await supabaseAdmin
      .from('SupportTrainRecipientProfile')
      .upsert(row, { onConflict: 'support_train_id' })
      .select('*')
      .single();

    if (error || !data) {
      logger.error('Upsert RecipientProfile failed', {
        supportTrainId: st.id,
        error: error?.message,
      });
      return res
        .status(500)
        .json({ error: 'INTERNAL', message: 'Failed to save recipient profile.' });
    }

    res.json(data);
  })
);

// ─── Lifecycle Transitions ────────────────────────────────────────────────

// Publish
router.post(
  '/:id/publish',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    // A publish whose reply was lost can come again (Android re-sends a POST after a dropped
    // connection). Answer it with the train as it is, without publishing or notifying twice.
    if (st.status === 'published' || st.status === 'active') {
      return res.json(await readPublishedTrain(st.id));
    }

    if (st.status !== 'draft') {
      return res.status(409).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot publish from status '${st.status}'. Only drafts can be published.`,
      });
    }

    // Verify at least one open slot
    const { count: slotCount } = await supabaseAdmin
      .from('SupportTrainSlot')
      .select('id', { count: 'exact', head: true })
      .eq('support_train_id', st.id)
      .eq('status', 'open');

    if ((slotCount || 0) === 0) {
      return res
        .status(422)
        .json({ error: 'NO_SLOTS', message: 'Add at least one slot before publishing.' });
    }

    // Verify recipient profile exists
    const { count: profileCount } = await supabaseAdmin
      .from('SupportTrainRecipientProfile')
      .select('id', { count: 'exact', head: true })
      .eq('support_train_id', st.id);

    if ((profileCount || 0) === 0) {
      return res.status(422).json({
        error: 'NO_RECIPIENT_PROFILE',
        message: 'Add recipient profile details before publishing.',
      });
    }

    // Update both SupportTrain and Activity
    const now = new Date().toISOString();

    const { error: stErr } = await supabaseAdmin
      .from('SupportTrain')
      .update({ status: 'published', published_at: now })
      .eq('id', st.id);

    if (stErr) {
      logger.error('Publish SupportTrain failed', { supportTrainId: st.id, error: stErr.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to publish.' });
    }

    const { error: actErr } = await supabaseAdmin
      .from('Activity')
      // Only a train shared with nearby neighbors is listed; My connections and Link only are not.
      .update({ status: 'published', visibility: st.sharing_mode === 'private_link' ? 'nearby' : 'private' })
      .eq('id', st.activity_id);

    if (actErr) {
      logger.error('Publish Activity failed', {
        activityId: st.activity_id,
        error: actErr.message,
      });
    }

    // Create campaign chat thread. A train that went back to draft keeps its thread,
    // so publishing again reuses it instead of splitting the conversation.
    try {
      const activityTitle = req.activity?.title || 'Support Train';

      const { data: existingRoom } = await supabaseAdmin
        .from('ChatRoom')
        .select('id')
        .eq('type', 'support_train')
        .eq('support_train_id', st.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      let chatRoom = existingRoom;
      if (chatRoom) {
        await supabaseAdmin.from('ChatRoom').update({ is_active: true }).eq('id', chatRoom.id);
      } else {
        const { data: createdRoom } = await supabaseAdmin
          .from('ChatRoom')
          .insert({
            type: 'support_train',
            support_train_id: st.id,
            name: activityTitle,
            description: 'Support Train coordination thread',
            is_active: true,
          })
          .select('id')
          .single();
        chatRoom = createdRoom;
      }

      if (chatRoom) {
        // Add participants: primary organizer + co-organizers + recipient
        const participants = [
          { room_id: chatRoom.id, user_id: st.organizer_user_id, role: 'owner', is_active: true },
        ];

        const { data: coOrgs } = await supabaseAdmin
          .from('SupportTrainOrganizer')
          .select('user_id')
          .eq('support_train_id', st.id)
          .neq('user_id', st.organizer_user_id);

        for (const co of coOrgs || []) {
          participants.push({
            room_id: chatRoom.id,
            user_id: co.user_id,
            role: 'member',
            is_active: true,
          });
        }

        if (st.recipient_user_id && st.recipient_user_id !== st.organizer_user_id) {
          participants.push({
            room_id: chatRoom.id,
            user_id: st.recipient_user_id,
            role: 'member',
            is_active: true,
          });
        }

        await supabaseAdmin
          .from('ChatParticipant')
          .upsert(participants, { onConflict: 'room_id,user_id' });

        // Link chat thread to Activity
        await supabaseAdmin
          .from('Activity')
          .update({ chat_thread_id: chatRoom.id })
          .eq('id', st.activity_id);
      }
    } catch (chatErr) {
      logger.error('Create campaign chat failed (non-fatal)', {
        supportTrainId: st.id,
        error: chatErr.message,
      });
    }

    // Notify invitees
    emitSupportTrainEvent({
      event: 'support_train.published',
      supportTrainId: st.id,
      actorUserId: req.user.id,
      payload: {},
    });

    res.json(await readPublishedTrain(st.id));
  })
);

// The publish reply: the train with its Activity.
async function readPublishedTrain(supportTrainId) {
  const { data: updated } = await supabaseAdmin
    .from('SupportTrain')
    .select('*, Activity!inner ( * )')
    .eq('id', supportTrainId)
    .single();

  const { Activity: activity, ...train } = updated || {};
  return { ...train, activity };
}

// Unpublish (back to draft)
router.post(
  '/:id/unpublish',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary']),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    // A reply can be lost after the authorized unpublish has committed.
    if (st.status === 'draft') return res.json({ id: st.id, status: 'draft' });

    if (st.status !== 'published' && st.status !== 'active') {
      return res.status(409).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot unpublish from status '${st.status}'.`,
      });
    }

    // Reject if there are non-canceled reservations
    const { count: resCount } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select('id', { count: 'exact', head: true })
      .eq('support_train_id', st.id)
      .neq('status', 'canceled');

    if ((resCount || 0) > 0) {
      return res.status(409).json({
        error: 'HAS_ACTIVE_RESERVATIONS',
        message: 'Cannot unpublish while there are active reservations.',
      });
    }

    const { error: stErr } = await supabaseAdmin
      .from('SupportTrain')
      .update({ status: 'draft', published_at: null })
      .eq('id', st.id);

    if (stErr) {
      logger.error('Unpublish SupportTrain failed', {
        supportTrainId: st.id,
        error: stErr.message,
      });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to unpublish.' });
    }

    await supabaseAdmin
      .from('Activity')
      .update({ status: 'draft', visibility: 'private' })
      .eq('id', st.activity_id);

    res.json({ id: st.id, status: 'draft' });
  })
);

// Pause
router.post(
  '/:id/pause',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    // A reply can be lost after the authorized pause has committed.
    if (st.status === 'paused') return res.json({ id: st.id, status: 'paused' });

    if (st.status !== 'published' && st.status !== 'active') {
      return res.status(409).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot pause from status '${st.status}'. Only published or active trains can be paused.`,
      });
    }

    const { error: stErr } = await supabaseAdmin
      .from('SupportTrain')
      .update({ status: 'paused' })
      .eq('id', st.id);

    if (stErr) {
      logger.error('Pause SupportTrain failed', { supportTrainId: st.id, error: stErr.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to pause.' });
    }

    await supabaseAdmin.from('Activity').update({ status: 'paused' }).eq('id', st.activity_id);

    res.json({ id: st.id, status: 'paused' });
  })
);

// Resume (unpause)
router.post(
  '/:id/resume',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    // A reply can be lost after the authorized resume has committed.
    if (st.status === 'active') return res.json({ id: st.id, status: 'active' });

    if (st.status !== 'paused') {
      return res.status(409).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot resume from status '${st.status}'. Only paused trains can be resumed.`,
      });
    }

    // Resume to 'active' (was previously published/active before pause)
    const { error: stErr } = await supabaseAdmin
      .from('SupportTrain')
      .update({ status: 'active' })
      .eq('id', st.id);

    if (stErr) {
      logger.error('Resume SupportTrain failed', { supportTrainId: st.id, error: stErr.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to resume.' });
    }

    await supabaseAdmin.from('Activity').update({ status: 'active' }).eq('id', st.activity_id);

    res.json({ id: st.id, status: 'active' });
  })
);

// Complete
router.post(
  '/:id/complete',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary']),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    // A reply can be lost after the authorized close has committed.
    if (st.status === 'completed') return res.json({ id: st.id, status: 'completed' });

    if (!['published', 'active', 'paused'].includes(st.status)) {
      return res.status(409).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot complete from status '${st.status}'.`,
      });
    }

    const { error: stErr } = await supabaseAdmin
      .from('SupportTrain')
      .update({ status: 'completed' })
      .eq('id', st.id);

    if (stErr) {
      logger.error('Complete SupportTrain failed', { supportTrainId: st.id, error: stErr.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to complete.' });
    }

    await supabaseAdmin.from('Activity').update({ status: 'completed' }).eq('id', st.activity_id);

    res.json({ id: st.id, status: 'completed' });
  })
);

// Archive
router.post(
  '/:id/archive',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary']),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    // A reply can be lost after the authorized archive has committed.
    if (st.status === 'archived') return res.json({ id: st.id, status: 'archived' });

    if (st.status !== 'completed') {
      return res.status(409).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot archive from status '${st.status}'. Only completed trains can be archived.`,
      });
    }

    const { error: stErr } = await supabaseAdmin
      .from('SupportTrain')
      .update({ status: 'archived' })
      .eq('id', st.id);

    if (stErr) {
      logger.error('Archive SupportTrain failed', { supportTrainId: st.id, error: stErr.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to archive.' });
    }

    await supabaseAdmin.from('Activity').update({ status: 'archived' }).eq('id', st.activity_id);

    res.json({ id: st.id, status: 'archived' });
  })
);

// ─── Updates ──────────────────────────────────────────────────────────────

const createUpdateSchema = Joi.object({
  client_request_id: Joi.string().uuid().optional(),
  push_to_phones: Joi.boolean().default(true),
  body: Joi.string().min(1).max(5000).required(),
  media_urls: Joi.array().items(Joi.string().uri()).max(6).optional(),
});

// Post an update
router.post(
  '/:id/updates',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  validate(createUpdateSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const userId = req.user.id;

    // Allow organizers, co-organizers, recipient_delegates, and the recipient
    const isRecipient = st.recipient_user_id === userId;
    let isAuthorized = isRecipient || st.organizer_user_id === userId;

    if (!isAuthorized) {
      const { data: orgRow } = await supabaseAdmin
        .from('SupportTrainOrganizer')
        .select('role')
        .eq('support_train_id', st.id)
        .eq('user_id', userId)
        .single();
      if (orgRow) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only organizers or the recipient can post updates.',
      });
    }

    const updateId = req.body.client_request_id ? createHash('sha256')
      .update(`pantopus:train-update:v1:${st.id.toLowerCase()}:${userId.toLowerCase()}:${req.body.client_request_id.toLowerCase()}`)
      .digest('hex').slice(0, 32) : null;
    const readRetry = async () => {
      const { data, error } = await supabaseAdmin.from('SupportTrainUpdate')
        .select('*').eq('id', updateId).maybeSingle();
      if (error) throw error;
      return data;
    };
    const acknowledgeRetry = (existing) => {
      if (existing.support_train_id !== st.id || existing.author_user_id !== userId ||
          existing.body !== req.body.body || existing.push_to_phones !== req.body.push_to_phones ||
          JSON.stringify(existing.media_urls || []) !== JSON.stringify(req.body.media_urls || [])) {
        return res.status(409).json({ error: 'UPDATE_REQUEST_CHANGED',
          message: 'This update was already sent with different text or delivery settings. Review the updates before starting a new message.' });
      }
      return res.status(201).json(existing);
    };
    if (updateId) {
      const existing = await readRetry();
      if (existing) return acknowledgeRetry(existing);
    }
    const row = {
        support_train_id: st.id,
        author_user_id: userId,
        body: req.body.body,
        media_urls: req.body.media_urls || null,
        push_to_phones: req.body.push_to_phones,
    };
    const insert = updateId
      ? supabaseAdmin.from('SupportTrainUpdate').upsert({ ...row, id: updateId }, { onConflict: 'id', ignoreDuplicates: true })
      : supabaseAdmin.from('SupportTrainUpdate').insert(row);
    const { data, error } = await insert.select('*').maybeSingle();
    if (!error && !data && updateId) {
      const existing = await readRetry();
      if (existing) return acknowledgeRetry(existing);
    }

    if (error || !data) {
      logger.error('Create update failed', { supportTrainId: st.id, error: error?.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to post update.' });
    }

    emitSupportTrainEvent({
      event: 'support_train.update_posted',
      supportTrainId: st.id,
      actorUserId: userId,
      payload: { body: req.body.body, update_id: data.id, push_to_phones: data.push_to_phones },
    });

    res.status(201).json(data);
  })
);

// List updates
router.get(
  '/:id/updates',
  verifyToken,
  loadSupportTrain,
  requireSupportTrainViewer,
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    const { data: updates, error } = await supabaseAdmin
      .from('SupportTrainUpdate')
      .select(
        `
      id, body, media_urls, created_at,
      author_user_id,
      User:author_user_id ( id, username, name, profile_picture_url )
    `
      )
      .eq('support_train_id', st.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('List updates failed', { supportTrainId: st.id, error: error.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to list updates.' });
    }

    const result = (updates || []).map((u) => ({
      id: u.id,
      body: u.body,
      media_urls: u.media_urls,
      created_at: u.created_at,
      author: u.User
        ? {
            id: u.User.id,
            username: u.User.username,
            name: u.User.name,
            profile_picture_url: u.User.profile_picture_url,
          }
        : null,
    }));

    res.json({ updates: result });
  })
);

// ─── Gift Funds ───────────────────────────────────────────────────────────

const enableFundSchema = Joi.object({
  goal_amount: Joi.number().integer().min(1).max(100000).optional(), // cents, $0.01–$1000
});

// Enable gift fund (idempotent)
router.post(
  '/:id/fund/enable',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  validate(enableFundSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const goalAmount = req.body.goal_amount || null;
    // The train's enable_gift_funds is what the detail and share pages list, and
    // disable turns it off: set it again whenever the fund ends up on.
    const showGiftFunds = async () => {
      if (!st.enable_gift_funds) {
        await supabaseAdmin.from('SupportTrain').update({ enable_gift_funds: true }).eq('id', st.id);
      }
    };

    const answerWithExisting = async (existing) => {
      let current = existing;
      // If disabled, re-enable; if already enabled, update goal if provided
      if (existing.status === 'disabled' || goalAmount !== null) {
        const patch = { status: 'enabled' };
        if (goalAmount !== null) patch.goal_amount = goalAmount;

        const { data: updated } = await supabaseAdmin
          .from('SupportTrainFund')
          .update(patch)
          .eq('id', existing.id)
          .select('*')
          .single();

        current = updated || existing;
      }
      if (current.status === 'enabled') await showGiftFunds();
      return res.json(current);
    };

    // Check if fund already exists
    const { data: existingFunds } = await supabaseAdmin
      .from('SupportTrainFund')
      .select('*')
      .eq('support_train_id', st.id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (existingFunds?.[0]) return answerWithExisting(existingFunds[0]);

    // Create new fund. Its id comes from the train, so two enables at once (a double tap or a
    // re-sent request) can't make two funds: the second insert collides and answers with the first.
    const fundId = createHash('sha256')
      .update(`pantopus:train-fund:v1:${st.id.toLowerCase()}`)
      .digest('hex')
      .slice(0, 32);
    const { data: fund, error } = await supabaseAdmin
      .from('SupportTrainFund')
      .insert({
        id: fundId,
        support_train_id: st.id,
        currency: 'USD',
        goal_amount: goalAmount,
        status: 'enabled',
      })
      .select('*')
      .single();

    if (error?.code === '23505') {
      const { data: winner } = await supabaseAdmin
        .from('SupportTrainFund')
        .select('*')
        .eq('id', fundId)
        .maybeSingle();
      if (winner) return answerWithExisting(winner);
    }

    if (error || !fund) {
      logger.error('Enable fund failed', { supportTrainId: st.id, error: error?.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to enable fund.' });
    }

    await showGiftFunds();

    res.status(201).json(fund);
  })
);

// Disable gift fund (primary only)
router.post(
  '/:id/fund/disable',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary']),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    const { data: fund } = await supabaseAdmin
      .from('SupportTrainFund')
      .select('*')
      .eq('support_train_id', st.id)
      .single();

    if (!fund) {
      return res
        .status(404)
        .json({ error: 'NOT_FOUND', message: 'No fund exists for this Support Train.' });
    }

    if (fund.status === 'disabled') {
      return res.json(fund); // Already disabled, idempotent
    }

    const { data: updated, error } = await supabaseAdmin
      .from('SupportTrainFund')
      .update({ status: 'disabled' })
      .eq('id', fund.id)
      .select('*')
      .single();

    if (error || !updated) {
      logger.error('Disable fund failed', { fundId: fund.id, error: error?.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to disable fund.' });
    }

    // Also set enable_gift_funds to false on the SupportTrain
    await supabaseAdmin.from('SupportTrain').update({ enable_gift_funds: false }).eq('id', st.id);

    res.json(updated);
  })
);

const contributeFundSchema = Joi.object({
  amount: Joi.number().integer().min(100).max(100000).required(), // cents, $1 – $1000
  note: Joi.string().max(500).allow(null).optional(),
  is_anonymous: Joi.boolean().default(false),
  payment_method_id: Joi.string().optional(),
});

// Contribute to gift fund
router.post(
  '/:id/fund/contributions',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  validate(contributeFundSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const userId = req.user.id;
    const { amount, note, is_anonymous, payment_method_id } = req.body;

    // Must be published or active
    if (st.status !== 'published' && st.status !== 'active') {
      return res.status(409).json({
        error: 'INVALID_STATE',
        message: 'This Support Train is not currently accepting contributions.',
      });
    }

    // Load fund and verify it's enabled
    const { data: fund } = await supabaseAdmin
      .from('SupportTrainFund')
      .select('*')
      .eq('support_train_id', st.id)
      .single();

    if (!fund || fund.status !== 'enabled') {
      return res.status(409).json({
        error: 'FUND_DISABLED',
        message: 'Gift funds are not enabled on this Support Train.',
      });
    }

    // Insert contribution record first (so we can include contribution_id in metadata)
    const { data: contribution, error: contribErr } = await supabaseAdmin
      .from('SupportTrainFundContribution')
      .insert({
        support_train_fund_id: fund.id,
        contributor_user_id: userId, // always stored, even for anonymous (fraud/refund)
        amount,
        currency: 'USD',
        note: note || null,
        is_anonymous,
        payment_status: 'pending',
      })
      .select('*')
      .single();

    if (contribErr || !contribution) {
      logger.error('Record contribution failed', { fundId: fund.id, error: contribErr?.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to record contribution.' });
    }

    // Determine payee — the recipient if they're a Pantopus user, otherwise the organizer
    const payeeId = st.recipient_user_id || st.organizer_user_id;
    const fees = stripeService.calculateFees(amount);

    // Create PaymentIntent (mirrors business catalog donation pattern)
    let paymentResult;
    try {
      paymentResult = await stripeService.createPaymentIntentForGig({
        payerId: userId,
        payeeId,
        gigId: null,
        amount,
        paymentMethodId: payment_method_id,
        metadata: {
          type: 'support_train_gift_fund',
          support_train_id: st.id,
          support_train_fund_id: fund.id,
          contribution_id: contribution.id,
          is_anonymous: String(is_anonymous),
        },
      });
    } catch (err) {
      logger.error('Gift fund PaymentIntent failed', { supportTrainId: st.id, error: err.message });
      // Mark contribution as failed
      await supabaseAdmin
        .from('SupportTrainFundContribution')
        .update({ payment_status: 'failed' })
        .eq('id', contribution.id);
      return res
        .status(402)
        .json({ error: 'PAYMENT_FAILED', message: err.message || 'Failed to create payment.' });
    }

    if (!paymentResult?.success) {
      await supabaseAdmin
        .from('SupportTrainFundContribution')
        .update({ payment_status: 'failed' })
        .eq('id', contribution.id);
      return res
        .status(402)
        .json({ error: 'PAYMENT_FAILED', message: 'Failed to create payment.' });
    }

    // On synchronous charge success, update status and increment total
    // (For async Stripe confirmation, the webhook handler will also update)
    await supabaseAdmin
      .from('SupportTrainFundContribution')
      .update({ payment_status: 'succeeded' })
      .eq('id', contribution.id);

    await supabaseAdmin
      .from('SupportTrainFund')
      .update({ total_amount: fund.total_amount + amount })
      .eq('id', fund.id);

    // Notify organizers + recipient
    emitSupportTrainEvent({
      event: 'support_train.donation_received',
      supportTrainId: st.id,
      actorUserId: is_anonymous ? null : userId,
      payload: {
        amount,
        // The notification names a donor who isn't anonymous from their profile.
        donor_name: is_anonymous ? 'Anonymous' : null,
      },
    });

    res.status(201).json({
      client_secret: paymentResult.clientSecret,
      payment_intent_id: paymentResult.paymentIntentId,
      payment_id: paymentResult.paymentId,
      contribution_id: contribution.id,
      amount,
      fee_cents: fees.platformFee,
      net_to_recipient: fees.amountToPayee,
    });
  })
);

// Get fund summary (any viewer)
router.get(
  '/:id/fund',
  verifyToken,
  loadSupportTrain,
  requireSupportTrainViewer,
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    const { data: fund } = await supabaseAdmin
      .from('SupportTrainFund')
      .select('*')
      .eq('support_train_id', st.id)
      .single();

    if (!fund) {
      return res.json({
        enabled: false,
        currency: 'USD',
        goal_amount: null,
        total_amount: 0,
        contribution_count: 0,
      });
    }

    // Recompute total_amount from settled contributions (no race risk)
    const { data: contributions } = await supabaseAdmin
      .from('SupportTrainFundContribution')
      .select('amount, payment_status')
      .eq('support_train_fund_id', fund.id);

    const settled = (contributions || []).filter((c) => c.payment_status === 'succeeded');
    const totalAmount = settled.reduce((sum, c) => sum + c.amount, 0);

    res.json({
      enabled: fund.status === 'enabled',
      currency: fund.currency,
      goal_amount: fund.goal_amount,
      total_amount: totalAmount,
      contribution_count: settled.length,
    });
  })
);

// List fund contributions
router.get(
  '/:id/fund/contributions',
  verifyToken,
  loadSupportTrain,
  requireSupportTrainViewer,
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const viewerRole = req.supportTrainRole;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const offset = parseInt(req.query.offset, 10) || 0;

    const { data: fund } = await supabaseAdmin
      .from('SupportTrainFund')
      .select('id')
      .eq('support_train_id', st.id)
      .single();

    if (!fund) {
      return res.json({ contributions: [], total: 0, limit, offset });
    }

    const {
      data: contributions,
      count,
      error,
    } = await supabaseAdmin
      .from('SupportTrainFundContribution')
      .select(
        `
      id, amount, currency, note, is_anonymous, payment_status, created_at,
      contributor_user_id,
      User:contributor_user_id ( id, username, name, profile_picture_url )
    `,
        { count: 'exact' }
      )
      .eq('support_train_fund_id', fund.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('List contributions failed', { fundId: fund.id, error: error.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to list contributions.' });
    }

    const isOrganizer = viewerRole === 'primary' || viewerRole === 'co_organizer';

    const shaped = (contributions || []).map((c) => {
      const item = {
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        note: c.is_anonymous && !isOrganizer ? null : c.note,
        is_anonymous: c.is_anonymous,
        payment_status: c.payment_status,
        created_at: c.created_at,
      };

      if (c.is_anonymous && !isOrganizer) {
        item.contributor = { name: 'Anonymous' };
      } else {
        item.contributor = c.User
          ? {
              id: c.User.id,
              username: c.User.username,
              name: c.User.name,
              profile_picture_url: c.User.profile_picture_url,
            }
          : null;
      }

      return item;
    });

    res.json({ contributions: shaped, total: count || 0, limit, offset });
  })
);

// ─── Invites ──────────────────────────────────────────────────────────────

const createInviteSchema = Joi.object({
  invitee_user_id: Joi.string().uuid().optional(),
  invitee_email: Joi.string().email().max(255).optional(),
}).or('invitee_user_id', 'invitee_email');

// Create invite
router.post(
  '/:id/invites',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  validate(createInviteSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const { invitee_user_id, invitee_email } = req.body;

    const crypto = require('crypto');
    const inviteToken = crypto.randomBytes(24).toString('base64url');

    const { data, error } = await supabaseAdmin
      .from('SupportTrainInvite')
      .insert({
        support_train_id: st.id,
        invited_by_user_id: req.user.id,
        invitee_user_id: invitee_user_id || null,
        invitee_email: invitee_email || null,
        invite_token: inviteToken,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error || !data) {
      logger.error('Create invite failed', { supportTrainId: st.id, error: error?.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to create invite.' });
    }

    res.status(201).json(data);
  })
);

// List invites
router.get(
  '/:id/invites',
  verifyToken,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    const { data, error } = await supabaseAdmin
      .from('SupportTrainInvite')
      .select(
        `
      id, invitee_user_id, invitee_email, invite_token, status, created_at, accepted_at,
      User:invitee_user_id ( id, username, name, profile_picture_url )
    `
      )
      .eq('support_train_id', st.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('List invites failed', { supportTrainId: st.id, error: error.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to list invites.' });
    }

    res.json({ invites: data || [] });
  })
);

// ─── Nudges ───────────────────────────────────────────────────────────────

const nudgeSendSchema = Joi.object({
  message: Joi.string().min(1).max(1000).required(),
});
// The same reminder text within this window is a repeat of one send, not a new reminder.
const NUDGE_REPEAT_WINDOW_MS = 10 * 60 * 1000;

// Draft a nudge message via AI
router.post(
  '/:id/nudges/draft',
  verifyToken,
  supportTrainDraftLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    let slots;
    try {
      slots = (
        await listEffectivelyOpenSlots({
          supportTrainId: st.id,
          columns:
            'id, support_train_id, slot_date, slot_label, support_mode, status, capacity, filled_count',
        })
      ).slice(0, 20);
    } catch (error) {
      logger.error('Draft open slots nudge availability lookup failed', {
        supportTrainId: st.id,
        error: error.message,
      });
      return res
        .status(500)
        .json({ error: 'INTERNAL', message: 'Failed to load open slots.' });
    }

    if (slots.length === 0) {
      return res.json({ message: 'All slots are filled — no nudge needed!' });
    }

    const dates = slots.map((s) => {
      const d = new Date(s.slot_date + 'T00:00:00Z');
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
    });
    const modes = [...new Set(slots.map((s) => s.support_mode))];

    const result = await draftOpenSlotsNudge({
      openSlotsContext: { count: slots.length, dates, support_modes: modes },
      userId: req.user.id,
    });

    if (result.error) {
      return res.status(aiErrorStatus(result.error)).json(result);
    }

    res.json(result);
  })
);

// Send a nudge message to the campaign chat thread
router.post(
  '/:id/nudges/send',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  validate(nudgeSendSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const chatThreadId = req.activity?.chat_thread_id;

    if (!chatThreadId) {
      return res.status(422).json({
        error: 'NO_CHAT_THREAD',
        message: 'This Support Train does not have a chat thread yet. Publish it first.',
      });
    }

    // The same reminder from the same organizer within a few minutes is a repeat of this send (a
    // re-sent request or a second tap): answer with the message already posted instead of posting
    // it to the helpers' chat again.
    const { data: recentNudges, error: recentErr } = await supabaseAdmin
      .from('ChatMessage')
      .select('id, room_id, message, created_at')
      .eq('room_id', chatThreadId)
      .eq('user_id', req.user.id)
      .eq('message', req.body.message)
      .contains('metadata', { source: 'support_train_nudge' })
      .not('deleted', 'is', true)
      .gte('created_at', new Date(Date.now() - NUDGE_REPEAT_WINDOW_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentErr) {
      logger.error('Send nudge repeat check failed', { supportTrainId: st.id, error: recentErr.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to send nudge.' });
    }
    if (recentNudges?.[0]) return res.status(201).json(recentNudges[0]);

    const { data: msg, error } = await supabaseAdmin
      .from('ChatMessage')
      .insert({
        room_id: chatThreadId,
        user_id: req.user.id,
        type: 'text',
        message: req.body.message,
        metadata: { source: 'support_train_nudge', support_train_id: st.id },
      })
      .select('id, room_id, message, created_at')
      .single();

    if (error || !msg) {
      logger.error('Send nudge failed', { supportTrainId: st.id, error: error?.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to send nudge.' });
    }

    res.status(201).json(msg);
  })
);

// ─── Helper Reserve Flow ──────────────────────────────────────────────────

const reserveSchema = Joi.object({
  contribution_mode: Joi.string().valid('cook', 'takeout', 'groceries').required(),
  dish_title: Joi.string().max(200).allow(null).optional(),
  restaurant_name: Joi.string().max(200).allow(null).optional(),
  estimated_arrival_at: Joi.string().isoDate().allow(null).optional(),
  note_to_recipient: Joi.string().max(1000).allow(null).optional(),
  private_note_to_organizer: Joi.string().max(1000).allow(null).optional(),
});

const cancelReservationSchema = Joi.object({
  organizer_reason: Joi.string().max(500).allow('', null).optional(),
  helper_reason: Joi.string().max(500).allow('', null).optional(),
});

// Reserve a slot
router.post(
  '/:id/slots/:slotId/reserve',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  validate(reserveSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const { slotId } = req.params;
    const userId = req.user.id;
    const body = req.body;

    // Must be published or active
    if (st.status !== 'published' && st.status !== 'active') {
      return res.status(409).json({
        error: 'INVALID_STATE',
        message: 'This Support Train is not currently accepting reservations.',
      });
    }

    // Validate contribution_mode is enabled on the Support Train
    const modeToFlag = {
      cook: 'enable_home_cooked_meals',
      takeout: 'enable_takeout',
      groceries: 'enable_groceries',
    };
    if (!st[modeToFlag[body.contribution_mode]]) {
      return res.status(409).json({
        error: 'MODE_NOT_ENABLED',
        message: `${body.contribution_mode} is not enabled on this Support Train.`,
      });
    }

    // Use an RPC or serialized queries to prevent race conditions.
    // Supabase JS doesn't support SELECT FOR UPDATE, so we use a
    // read-check-write pattern with the unique partial index on
    // SupportTrainReservation (slot_id WHERE status='reserved')
    // as the concurrency guard for capacity-1 slots.

    // Load the slot
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('SupportTrainSlot')
      .select('*')
      .eq('id', slotId)
      .eq('support_train_id', st.id)
      .single();

    if (slotErr || !slot) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Slot not found.' });
    }

    if (!['open', 'full'].includes(slot.status)) {
      return res
        .status(409)
        .json({ error: 'SLOT_NOT_OPEN', message: 'This slot is no longer open.' });
    }

    // A lost successful reply must acknowledge this helper's unchanged signup
    // before capacity is checked. Reuse the existing reservation, without
    // repeating its notification or chat membership side effects.
    const details = {
      contribution_mode: body.contribution_mode,
      dish_title: body.dish_title || null,
      restaurant_name: body.restaurant_name || null,
      estimated_arrival_at: body.estimated_arrival_at || null,
      note_to_recipient: body.note_to_recipient || null,
      private_note_to_organizer: body.private_note_to_organizer || null,
    };
    const readExisting = async () => {
      const { data, error } = await supabaseAdmin
        .from('SupportTrainReservation')
        .select('*')
        .eq('slot_id', slotId)
        .eq('support_train_id', st.id)
        .eq('user_id', userId)
        .eq('status', 'reserved')
        .maybeSingle();
      if (error) throw error;
      return data;
    };
    const acknowledgeExisting = (existing) => {
      const sameDetails = Object.entries(details).every(([key, value]) =>
        key === 'estimated_arrival_at' && value && existing[key]
          ? new Date(value).getTime() === new Date(existing[key]).getTime()
          : (existing[key] || null) === value
      );
      if (!sameDetails) {
        return res.status(409).json({
          error: 'ALREADY_RESERVED',
          message: 'You already have a reservation on this slot with different details.',
        });
      }
      return res.status(201).json(existing);
    };
    const existing = await readExisting();
    if (existing) return acknowledgeExisting(existing);

    let activeReservationCount;
    try {
      activeReservationCount = await countActiveReservationsForSlot(slotId);
    } catch (error) {
      logger.error('Reserve slot availability check failed', { slotId, error: error.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to verify slot availability.' });
    }

    if (activeReservationCount >= slot.capacity) {
      return res.status(409).json({ error: 'SLOT_FULL', message: 'This slot is already full.' });
    }

    // Insert reservation — the unique partial index
    // (slot_id WHERE status='reserved') prevents duplicate concurrent inserts
    // for capacity-1 slots.
    const { data: reservation, error: resErr } = await supabaseAdmin
      .from('SupportTrainReservation')
      .insert({
        slot_id: slotId,
        support_train_id: st.id,
        user_id: userId,
        status: 'reserved',
        ...details,
      })
      .select('*')
      .single();

    if (resErr) {
      // Unique constraint violation = concurrent race lost
      if (resErr.code === '23505') {
        const concurrent = await readExisting();
        if (concurrent) return acknowledgeExisting(concurrent);
        return res
          .status(409)
          .json({ error: 'SLOT_FULL', message: 'This slot was just filled by another helper.' });
      }
      logger.error('Reserve slot failed', { slotId, userId, error: resErr.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to reserve slot.' });
    }

    // Increment filled_count and update slot status if full
    const newFilledCount = activeReservationCount + 1;
    const slotPatch = { filled_count: newFilledCount };
    if (newFilledCount >= slot.capacity) {
      slotPatch.status = 'full';
    }

    await supabaseAdmin.from('SupportTrainSlot').update(slotPatch).eq('id', slotId);

    // If first reservation and train is still 'published', promote to 'active'
    if (st.status === 'published') {
      const { count: totalRes } = await supabaseAdmin
        .from('SupportTrainReservation')
        .select('id', { count: 'exact', head: true })
        .eq('support_train_id', st.id)
        .eq('status', 'reserved');

      if ((totalRes || 0) === 1) {
        await supabaseAdmin.from('SupportTrain').update({ status: 'active' }).eq('id', st.id);
        await supabaseAdmin.from('Activity').update({ status: 'active' }).eq('id', st.activity_id);
      }
    }

    emitSupportTrainEvent({
      event: 'support_train.slot_filled',
      supportTrainId: st.id,
      actorUserId: userId,
      payload: {
        slot_id: slotId,
        slot_label: slot.slot_label,
        slot_date: slot.slot_date,
      },
    });

    // Add helper to campaign chat if not already a participant
    try {
      const chatThreadId = req.activity?.chat_thread_id;
      if (chatThreadId) {
        await supabaseAdmin
          .from('ChatParticipant')
          .upsert(
            { room_id: chatThreadId, user_id: userId, role: 'member', is_active: true },
            { onConflict: 'room_id,user_id' }
          );
      }
    } catch (chatErr) {
      logger.error('Add helper to chat failed (non-fatal)', {
        supportTrainId: st.id,
        userId,
        error: chatErr.message,
      });
    }

    res.status(201).json(reservation);
  })
);

// ─── Guest (Email-only) Reserve Flow ────────────────────────────────────────

const guestReserveSchema = Joi.object({
  guest_name: Joi.string().trim().min(1).max(100).required(),
  guest_email: Joi.string().email().max(320).required(),
  allow_guest_for_existing_account: Joi.boolean().optional(),
  contribution_mode: Joi.string().valid('cook', 'takeout', 'groceries').required(),
  dish_title: Joi.string().max(200).allow(null, '').optional(),
  restaurant_name: Joi.string().max(200).allow(null, '').optional(),
  estimated_arrival_at: Joi.string().isoDate().allow(null).optional(),
  note_to_recipient: Joi.string().max(1000).allow(null, '').optional(),
  private_note_to_organizer: Joi.string().max(1000).allow(null, '').optional(),
});

router.post(
  '/:id/slots/:slotId/guest-reserve',
  supportTrainWriteLimiter,
  optionalAuth,
  loadSupportTrain,
  validate(guestReserveSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const { slotId } = req.params;
    const body = req.body;
    const guestEmail = normalizeEmail(body.guest_email);
    const authenticatedUserId =
      req.user?.id && normalizeEmail(req.user?.email) === guestEmail ? req.user.id : null;

    // Must be published or active
    if (st.status !== 'published' && st.status !== 'active') {
      return res.status(409).json({
        error: 'INVALID_STATE',
        message: 'This Support Train is not currently accepting reservations.',
      });
    }

    // Must be shareable via private_link (public page)
    if (st.sharing_mode !== 'private_link') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Guest signups are not available for this Support Train.',
      });
    }

    // Validate contribution_mode is enabled
    const modeToFlag = {
      cook: 'enable_home_cooked_meals',
      takeout: 'enable_takeout',
      groceries: 'enable_groceries',
    };
    if (!st[modeToFlag[body.contribution_mode]]) {
      return res.status(409).json({
        error: 'MODE_NOT_ENABLED',
        message: `${body.contribution_mode} is not enabled on this Support Train.`,
      });
    }

    // Load the slot
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('SupportTrainSlot')
      .select('*')
      .eq('id', slotId)
      .eq('support_train_id', st.id)
      .single();

    if (slotErr || !slot) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Slot not found.' });
    }

    if (!['open', 'full'].includes(slot.status)) {
      return res
        .status(409)
        .json({ error: 'SLOT_NOT_OPEN', message: 'This slot is no longer open.' });
    }

    let activeReservationCount;
    try {
      activeReservationCount = await countActiveReservationsForSlot(slotId);
    } catch (error) {
      logger.error('Public reserve slot availability check failed', { slotId, error: error.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to verify slot availability.' });
    }

    if (activeReservationCount >= slot.capacity) {
      return res.status(409).json({ error: 'SLOT_FULL', message: 'This slot is already full.' });
    }

    if (authenticatedUserId) {
      const { count: existingUserReservationCount } = await supabaseAdmin
        .from('SupportTrainReservation')
        .select('id', { count: 'exact', head: true })
        .eq('slot_id', slotId)
        .eq('user_id', authenticatedUserId)
        .eq('status', 'reserved');

      if ((existingUserReservationCount || 0) > 0) {
        return res.status(409).json({
          error: 'ALREADY_RESERVED',
          message: 'You already have a reservation on this slot.',
        });
      }

      const { data: userRow } = await supabaseAdmin
        .from('User')
        .select('name, username')
        .eq('id', authenticatedUserId)
        .maybeSingle();

      const { data: reservation, error: resErr } = await supabaseAdmin
        .from('SupportTrainReservation')
        .insert({
          slot_id: slotId,
          support_train_id: st.id,
          user_id: authenticatedUserId,
          status: 'reserved',
          contribution_mode: body.contribution_mode,
          dish_title: body.dish_title || null,
          restaurant_name: body.restaurant_name || null,
          estimated_arrival_at: body.estimated_arrival_at || null,
          note_to_recipient: body.note_to_recipient || null,
          private_note_to_organizer: body.private_note_to_organizer || null,
        })
        .select('*')
        .single();

      if (resErr) {
        if (resErr.code === '23505') {
          return res
            .status(409)
            .json({ error: 'SLOT_FULL', message: 'This slot was just filled by another helper.' });
        }
        logger.error('Authenticated public reserve slot failed', {
          slotId,
          userId: authenticatedUserId,
          error: resErr.message,
        });
        return res.status(500).json({ error: 'INTERNAL', message: 'Failed to reserve slot.' });
      }

      const newFilledCount = activeReservationCount + 1;
      const slotPatch = { filled_count: newFilledCount };
      if (newFilledCount >= slot.capacity) {
        slotPatch.status = 'full';
      }
      await supabaseAdmin.from('SupportTrainSlot').update(slotPatch).eq('id', slotId);

      if (st.status === 'published') {
        const { count: totalRes } = await supabaseAdmin
          .from('SupportTrainReservation')
          .select('id', { count: 'exact', head: true })
          .eq('support_train_id', st.id)
          .eq('status', 'reserved');

        if ((totalRes || 0) === 1) {
          await supabaseAdmin.from('SupportTrain').update({ status: 'active' }).eq('id', st.id);
          await supabaseAdmin
            .from('Activity')
            .update({ status: 'active' })
            .eq('id', st.activity_id);
        }
      }

      emitSupportTrainEvent({
        event: 'support_train.slot_filled',
        supportTrainId: st.id,
        actorUserId: authenticatedUserId,
        payload: {
          slot_id: slotId,
          slot_label: slot.slot_label,
          slot_date: slot.slot_date,
          helper_name: userRow?.name || userRow?.username || body.guest_name,
        },
      });

      try {
        const chatThreadId = req.activity?.chat_thread_id;
        if (chatThreadId) {
          await supabaseAdmin.from('ChatParticipant').upsert(
            {
              room_id: chatThreadId,
              user_id: authenticatedUserId,
              role: 'member',
              is_active: true,
            },
            { onConflict: 'room_id,user_id' }
          );
        }
      } catch (chatErr) {
        logger.error('Add helper to chat failed (non-fatal)', {
          supportTrainId: st.id,
          userId: authenticatedUserId,
          error: chatErr.message,
        });
      }

      return res.status(201).json(reservation);
    }

    // Check if this guest email already has a reserved reservation on this slot
    const { count: existingCount } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select('id', { count: 'exact', head: true })
      .eq('slot_id', slotId)
      .eq('guest_email', guestEmail)
      .eq('status', 'reserved');

    if ((existingCount || 0) > 0) {
      return res.status(409).json({
        error: 'ALREADY_RESERVED',
        message: 'This email already has a reservation on this slot.',
      });
    }

    const { data: existingUsers, error: existingUserErr } = await supabaseAdmin
      .from('User')
      .select('id, email')
      .ilike('email', guestEmail)
      .limit(10);

    if (existingUserErr) {
      logger.warn('Guest reserve existing-user lookup failed', {
        guestEmail,
        error: existingUserErr.message,
      });
    }

    const existingUser = (existingUsers || []).find(
      (user) => normalizeEmail(user.email) === guestEmail
    );

    if (existingUser && !body.allow_guest_for_existing_account) {
      return res.status(409).json({
        error: 'ACCOUNT_EXISTS',
        message:
          'This email has a Pantopus account. Sign in for chat and in-app location sharing, or continue with email.',
      });
    }

    // Insert guest reservation (user_id is null)
    const { data: reservation, error: resErr } = await supabaseAdmin
      .from('SupportTrainReservation')
      .insert({
        slot_id: slotId,
        support_train_id: st.id,
        user_id: null,
        guest_name: body.guest_name,
        guest_email: guestEmail,
        status: 'reserved',
        contribution_mode: body.contribution_mode,
        dish_title: body.dish_title || null,
        restaurant_name: body.restaurant_name || null,
        estimated_arrival_at: body.estimated_arrival_at || null,
        note_to_recipient: body.note_to_recipient || null,
        private_note_to_organizer: body.private_note_to_organizer || null,
      })
      .select('*')
      .single();

    if (resErr) {
      if (resErr.code === '23505') {
        return res
          .status(409)
          .json({ error: 'SLOT_FULL', message: 'This slot was just filled by another helper.' });
      }
      logger.error('Guest reserve slot failed', {
        slotId,
        guestEmail,
        error: resErr.message,
      });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to reserve slot.' });
    }

    // Increment filled_count and update slot status if full
    const newFilledCount = activeReservationCount + 1;
    const slotPatch = { filled_count: newFilledCount };
    if (newFilledCount >= slot.capacity) {
      slotPatch.status = 'full';
    }
    await supabaseAdmin.from('SupportTrainSlot').update(slotPatch).eq('id', slotId);

    // Promote to 'active' on first reservation
    if (st.status === 'published') {
      const { count: totalRes } = await supabaseAdmin
        .from('SupportTrainReservation')
        .select('id', { count: 'exact', head: true })
        .eq('support_train_id', st.id)
        .eq('status', 'reserved');

      if ((totalRes || 0) === 1) {
        await supabaseAdmin.from('SupportTrain').update({ status: 'active' }).eq('id', st.id);
        await supabaseAdmin.from('Activity').update({ status: 'active' }).eq('id', st.activity_id);
      }
    }

    // Notify organizers (reuse existing event — they see "guest_name signed up")
    emitSupportTrainEvent({
      event: 'support_train.slot_filled',
      supportTrainId: st.id,
      actorUserId: null,
      payload: {
        slot_id: slotId,
        slot_label: slot.slot_label,
        slot_date: slot.slot_date,
        helper_name: body.guest_name,
      },
    });

    // Send confirmation email to the guest
    const trainTitle = st.Activity?.title || 'Support Train';
    const slotDateLabel = formatSupportTrainSlotDate(slot.slot_date);

    sendGuestReservationConfirmationEmail({
      toEmail: guestEmail,
      guestName: body.guest_name,
      trainTitle,
      slotLabel: slot.slot_label || 'Support',
      slotDate: slotDateLabel,
      slotTime: formatSupportTrainSlotTime(slot),
      contributionMode: body.contribution_mode,
      supportTrainId: st.id,
    }).catch((err) => {
      logger.error('Guest confirmation email failed (non-fatal)', {
        guestEmail,
        error: err.message,
      });
    });

    res.status(201).json(reservation);
  })
);

// A guest's address email repeated within this window is one share, not a resend.
const GUEST_ADDRESS_REPEAT_WINDOW_MS = 60 * 1000;

// Manually reveal the exact address to a specific helper reservation
router.post(
  '/:id/reservations/:reservationId/reveal-address',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const { reservationId } = req.params;
    const userId = req.user.id;

    let isOrganizer = st.organizer_user_id === userId;
    if (!isOrganizer) {
      const { data: orgRow } = await supabaseAdmin
        .from('SupportTrainOrganizer')
        .select('role')
        .eq('support_train_id', st.id)
        .eq('user_id', userId)
        .single();
      if (orgRow && (orgRow.role === 'primary' || orgRow.role === 'co_organizer')) {
        isOrganizer = true;
      }
    }

    if (!isOrganizer) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only organizers can share the exact address.',
      });
    }

    const { data: reservation, error: resErr } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select(
        'id, user_id, guest_name, guest_email, guest_address_shared_at, guest_address_share_count, status, slot_id'
      )
      .eq('id', reservationId)
      .eq('support_train_id', st.id)
      .single();

    if (resErr || !reservation) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Reservation not found.' });
    }

    if (reservation.status === 'canceled') {
      return res.status(409).json({
        error: 'INVALID_STATE',
        message: 'Cannot share the exact address for a canceled reservation.',
      });
    }

    if (!reservation.user_id && !reservation.guest_email) {
      return res.status(409).json({
        error: 'NO_HELPER',
        message: 'This reservation is not linked to a helper account or guest email.',
      });
    }

    if (!reservation.user_id) {
      // A share emailed moments ago is this same share (a re-sent request or a second tap):
      // answer as it did without emailing the guest again. A later Resend still emails.
      const sharedAgoMs = reservation.guest_address_shared_at
        ? Date.now() - new Date(reservation.guest_address_shared_at).getTime()
        : Infinity;
      if (sharedAgoMs < GUEST_ADDRESS_REPEAT_WINDOW_MS) {
        return res.json({
          shared: true,
          already_shared: true,
          guest_email: reservation.guest_email,
          guest_address_shared_at: reservation.guest_address_shared_at,
          reservation_id: reservation.id,
        });
      }

      const { data: slot } = await supabaseAdmin
        .from('SupportTrainSlot')
        .select('slot_date, slot_label, start_time, end_time')
        .eq('id', reservation.slot_id)
        .single();
      const delivery = await getSupportTrainExactDeliveryDetails(st, st.id);

      if (!delivery.addressLabel) {
        return res.status(409).json({
          error: 'ADDRESS_UNAVAILABLE',
          message: 'This Support Train does not have an exact delivery address to share.',
        });
      }

      const alreadyShared = !!reservation.guest_address_shared_at;
      const emailResult = await sendGuestReservationAddressEmail({
        toEmail: reservation.guest_email,
        guestName: reservation.guest_name || 'there',
        trainTitle: st.Activity?.title || 'Support Train',
        slotLabel: slot?.slot_label || 'Support',
        slotDate: formatSupportTrainSlotDate(slot?.slot_date),
        slotTime: formatSupportTrainSlotTime(slot),
        addressLabel: delivery.addressLabel,
        deliveryInstructions: delivery.deliveryInstructions,
        specialInstructions: delivery.specialInstructions,
        supportTrainId: st.id,
      });

      if (!emailResult?.success) {
        logger.error('Guest address email failed', {
          supportTrainId: st.id,
          reservationId: reservation.id,
          guestEmail: reservation.guest_email,
          error: emailResult?.error,
        });
        return res
          .status(500)
          .json({ error: 'INTERNAL', message: 'Failed to email the exact address.' });
      }

      const nextShareCount = (reservation.guest_address_share_count || 0) + 1;
      const sharedAt = new Date().toISOString();
      const { error: updateErr } = await supabaseAdmin
        .from('SupportTrainReservation')
        .update({
          guest_address_shared_at: sharedAt,
          guest_address_shared_by: userId,
          guest_address_share_count: nextShareCount,
        })
        .eq('id', reservation.id);

      if (updateErr) {
        logger.error('Guest address share tracking update failed', {
          supportTrainId: st.id,
          reservationId: reservation.id,
          guestEmail: reservation.guest_email,
          error: updateErr.message,
        });
        return res.status(500).json({
          error: 'INTERNAL',
          message: 'The address email was sent, but sharing status could not be saved.',
        });
      }

      emitSupportTrainEvent({
        event: 'support_train.address_shared',
        supportTrainId: st.id,
        actorUserId: userId,
        payload: {
          guest_email: reservation.guest_email,
          guest_name: reservation.guest_name || null,
          reservation_id: reservation.id,
          slot_id: reservation.slot_id,
          slot_label: slot?.slot_label || null,
          slot_date: slot?.slot_date || null,
        },
      });

      return res.json({
        shared: true,
        already_shared: alreadyShared,
        guest_email: reservation.guest_email,
        guest_address_shared_at: sharedAt,
        reservation_id: reservation.id,
      });
    }

    const alreadyShared = await hasSupportTrainAddressGrant(st.id, reservation.user_id);

    if (!alreadyShared) {
      const { error: grantErr } = await supabaseAdmin.from('SupportTrainAddressGrant').insert({
        support_train_id: st.id,
        grantee_user_id: reservation.user_id,
        granted_by: userId,
      });

      if (grantErr) {
        const isDuplicateGrant =
          grantErr.code === '23505' ||
          /duplicate key|unique constraint/i.test(String(grantErr.message || ''));

        if (!isDuplicateGrant) {
          logger.error('Reveal Support Train address failed', {
            supportTrainId: st.id,
            reservationId,
            granteeUserId: reservation.user_id,
            error: grantErr.message,
          });
          return res
            .status(500)
            .json({ error: 'INTERNAL', message: 'Failed to share the exact address.' });
        }
      } else {
        const { data: slot } = await supabaseAdmin
          .from('SupportTrainSlot')
          .select('slot_date, slot_label')
          .eq('id', reservation.slot_id)
          .single();

        emitSupportTrainEvent({
          event: 'support_train.address_shared',
          supportTrainId: st.id,
          actorUserId: userId,
          payload: {
            helper_user_id: reservation.user_id,
            reservation_id: reservation.id,
            slot_id: reservation.slot_id,
            slot_label: slot?.slot_label || null,
            slot_date: slot?.slot_date || null,
          },
        });
      }
    }

    res.json({
      shared: true,
      already_shared: alreadyShared,
      helper_user_id: reservation.user_id,
      reservation_id: reservation.id,
    });
  })
);

// Cancel a reservation
router.post(
  '/:id/reservations/:reservationId/cancel',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  validate(cancelReservationSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const { reservationId } = req.params;
    const userId = req.user.id;
    const organizerReason =
      typeof req.body?.organizer_reason === 'string' ? req.body.organizer_reason.trim() : '';
    const helperReason =
      typeof req.body?.helper_reason === 'string' ? req.body.helper_reason.trim() : '';

    // Load the reservation
    const { data: reservation, error: resErr } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select('*')
      .eq('id', reservationId)
      .eq('support_train_id', st.id)
      .single();

    if (resErr || !reservation) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Reservation not found.' });
    }

    // Allow cancel by the helper themselves or by a primary/co_organizer
    const isOwner = reservation.user_id === userId;
    let isOrganizer = st.organizer_user_id === userId;
    if (!isOrganizer) {
      const { data: orgRow } = await supabaseAdmin
        .from('SupportTrainOrganizer')
        .select('role')
        .eq('support_train_id', st.id)
        .eq('user_id', userId)
        .single();
      if (orgRow && (orgRow.role === 'primary' || orgRow.role === 'co_organizer')) {
        isOrganizer = true;
      }
    }

    if (!isOwner && !isOrganizer) {
      return res
        .status(403)
        .json({ error: 'FORBIDDEN', message: 'You can only cancel your own reservation.' });
    }

    if (reservation.status === 'canceled') {
      // The prior cancellation may have committed before its reply was lost.
      // Keep its original timestamp and avoid repeating notifications.
      return res.json(reservation);
    }

    if (reservation.status !== 'reserved') {
      return res.status(409).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot cancel from status '${reservation.status}'. Only reserved signups can be removed.`,
      });
    }

    // Cancel the reservation
    const { data: updated, error: cancelErr } = await supabaseAdmin
      .from('SupportTrainReservation')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('id', reservationId)
      .select('*')
      .single();

    if (cancelErr || !updated) {
      logger.error('Cancel reservation failed', { reservationId, error: cancelErr?.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to cancel reservation.' });
    }

    // Recalculate filled_count from active reservations after cancellation. This
    // avoids carrying forward stale denormalized slot counters.
    const { data: slot } = await supabaseAdmin
      .from('SupportTrainSlot')
      .select('id, slot_date, slot_label, filled_count, status, capacity')
      .eq('id', reservation.slot_id)
      .single();

    if (slot) {
      try {
        const newCount = await countActiveReservationsForSlot(slot.id);
        const slotPatch = { filled_count: newCount };
        if (['open', 'full'].includes(slot.status)) {
          slotPatch.status = newCount >= slot.capacity ? 'full' : 'open';
        }
        await supabaseAdmin.from('SupportTrainSlot').update(slotPatch).eq('id', slot.id);
      } catch (error) {
        logger.error('Cancel reservation slot availability sync failed', {
          slotId: slot.id,
          error: error.message,
        });
      }
    }

    if (isOwner && !isOrganizer) {
      emitSupportTrainEvent({
        event: 'support_train.slot_canceled_by_helper',
        supportTrainId: st.id,
        actorUserId: userId,
        payload: {
          slot_id: reservation.slot_id,
          slot_label: slot?.slot_label,
          helper_reason: helperReason || null,
        },
      });
    } else if (isOrganizer && !isOwner) {
      emitSupportTrainEvent({
        event: 'support_train.slot_canceled_by_organizer',
        supportTrainId: st.id,
        actorUserId: userId,
        payload: {
          helper_user_id: reservation.user_id,
          slot_id: reservation.slot_id,
          slot_label: slot?.slot_label,
          slot_date: slot?.slot_date,
          organizer_reason: organizerReason || null,
        },
      });
    }

    // Remove helper from chat if they have no other active reservations
    try {
      const canceledUserId = reservation.user_id;
      const chatThreadId = req.activity?.chat_thread_id;
      if (chatThreadId && canceledUserId) {
        // Check for other active reservations on this train
        const { count: otherRes } = await supabaseAdmin
          .from('SupportTrainReservation')
          .select('id', { count: 'exact', head: true })
          .eq('support_train_id', st.id)
          .eq('user_id', canceledUserId)
          .neq('status', 'canceled')
          .neq('id', reservationId);

        if ((otherRes || 0) === 0) {
          // Don't remove organizers or recipients from chat
          const isOrgOrRecipient =
            canceledUserId === st.organizer_user_id || canceledUserId === st.recipient_user_id;

          if (!isOrgOrRecipient) {
            const { data: orgCheck } = await supabaseAdmin
              .from('SupportTrainOrganizer')
              .select('id')
              .eq('support_train_id', st.id)
              .eq('user_id', canceledUserId)
              .single();

            if (!orgCheck) {
              await supabaseAdmin
                .from('ChatParticipant')
                .delete()
                .eq('room_id', chatThreadId)
                .eq('user_id', canceledUserId);
            }
          }
        }
      }
    } catch (chatErr) {
      logger.error('Remove helper from chat failed (non-fatal)', {
        supportTrainId: st.id,
        error: chatErr.message,
      });
    }

    res.json(updated);
  })
);

// Edit an existing signup without changing its helper, slot or lifecycle state.
const editReservationSchema = Joi.object({
  dish_title: Joi.string().max(200).allow('', null).required(),
  restaurant_name: Joi.string().max(200).allow('', null).required(),
  estimated_arrival_at: Joi.string().isoDate().allow(null).required(),
  private_note_to_organizer: Joi.string().max(1000).allow('', null).required(),
  expected_updated_at: Joi.string().isoDate().raw().required(),
});

router.patch(
  '/:id/reservations/:reservationId',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  validate(editReservationSchema),
  asyncHandler(async (req, res) => {
    const { reservationId } = req.params;
    const selection = '*, User:user_id (id, username, name, profile_picture_url), Slot:slot_id (slot_date)';
    const { data: reservation, error: readError } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select(selection)
      .eq('id', reservationId)
      .eq('support_train_id', req.supportTrain.id)
      .maybeSingle();
    if (readError) {
      return res.status(500).json({ error: 'INTERNAL', message: 'Could not load this signup.' });
    }
    if (!reservation) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Signup not found.' });
    }
    if (reservation.status === 'canceled') {
      return res.status(409).json({ error: 'INVALID_TRANSITION', message: 'This signup was canceled. Reopen the list to refresh it.' });
    }
    const body = req.body;
    const patch = {
      dish_title: body.dish_title?.trim() || null,
      restaurant_name: body.restaurant_name?.trim() || null,
      estimated_arrival_at: body.estimated_arrival_at,
      private_note_to_organizer: body.private_note_to_organizer?.trim() || null,
    };
    const unchanged = Object.entries(patch).every(([key, value]) =>
      key === 'estimated_arrival_at' && value && reservation[key]
        ? Date.parse(value) === Date.parse(reservation[key])
        : value === reservation[key]
    );
    // A lost reply may be retried with the original version. Never write it twice.
    if (unchanged) return res.json({ ...reservation, slot_date: reservation.Slot?.slot_date || null });
    const { data: updated, error: writeError } = await supabaseAdmin
      .from('SupportTrainReservation')
      .update(patch)
      .eq('id', reservationId)
      .eq('support_train_id', req.supportTrain.id)
      .eq('updated_at', body.expected_updated_at)
      .eq('status', reservation.status)
      .select(selection)
      .maybeSingle();
    if (writeError) {
      return res.status(500).json({ error: 'INTERNAL', message: 'Could not save this signup. Try again.' });
    }
    if (!updated) {
      return res.status(409).json({ error: 'CONFLICT', message: 'This signup changed. Pull down to refresh the signup list, then edit again.' });
    }
    res.json({ ...updated, slot_date: updated.Slot?.slot_date || null });
  })
);

// Mark reservation as delivered (helper or organizer for guest reservations)
router.post(
  '/:id/reservations/:reservationId/deliver',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const { reservationId } = req.params;
    const userId = req.user.id;

    const { data: reservation, error: resErr } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select('*')
      .eq('id', reservationId)
      .eq('support_train_id', st.id)
      .single();

    if (resErr || !reservation) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Reservation not found.' });
    }

    const isOwner = reservation.user_id && reservation.user_id === userId;

    // For guest reservations (user_id is null), allow organizers to mark as delivered
    let isOrganizer = false;
    if (!isOwner) {
      isOrganizer = st.organizer_user_id === userId;
      if (!isOrganizer) {
        const { data: orgRow } = await supabaseAdmin
          .from('SupportTrainOrganizer')
          .select('role')
          .eq('support_train_id', st.id)
          .eq('user_id', userId)
          .single();
        if (orgRow && (orgRow.role === 'primary' || orgRow.role === 'co_organizer')) {
          isOrganizer = true;
        }
      }
    }

    if (!isOwner && !isOrganizer) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only the helper or an organizer can mark this as delivered.',
      });
    }

    // A committed delivery may already have been confirmed before its reply is retried.
    // Return the saved state without changing timestamps or emitting another notice.
    if (reservation.status === 'delivered' || reservation.status === 'confirmed') {
      return res.json(reservation);
    }

    if (reservation.status !== 'reserved') {
      return res.status(409).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot mark as delivered from status '${reservation.status}'.`,
      });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('SupportTrainReservation')
      .update({ status: 'delivered' })
      .eq('id', reservationId)
      .select('*')
      .single();

    if (updateErr || !updated) {
      logger.error('Deliver reservation failed', { reservationId, error: updateErr?.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to update reservation.' });
    }

    emitSupportTrainEvent({
      event: 'support_train.reservation_delivered',
      supportTrainId: st.id,
      actorUserId: userId,
      payload: {
        reservation_id: reservationId,
        // A guest's delivery is named by the guest; otherwise the notification names whoever marked it.
        helper_name: reservation.guest_name || null,
      },
    });

    res.json(updated);
  })
);

// Confirm reservation (recipient or organizer only)
router.post(
  '/:id/reservations/:reservationId/confirm',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const { reservationId } = req.params;
    const userId = req.user.id;

    const { data: reservation, error: resErr } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select('*')
      .eq('id', reservationId)
      .eq('support_train_id', st.id)
      .single();

    if (resErr || !reservation) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Reservation not found.' });
    }

    // Only recipient or organizer can confirm
    const isRecipient = st.recipient_user_id === userId;
    let isOrganizer = st.organizer_user_id === userId;
    if (!isOrganizer) {
      const { data: orgRow } = await supabaseAdmin
        .from('SupportTrainOrganizer')
        .select('role')
        .eq('support_train_id', st.id)
        .eq('user_id', userId)
        .single();
      if (orgRow) isOrganizer = true;
    }

    if (!isRecipient && !isOrganizer) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only the recipient or an organizer can confirm delivery.',
      });
    }

    // A lost success reply must remain recoverable through the same command.
    if (reservation.status === 'confirmed') {
      return res.json(reservation);
    }

    if (reservation.status !== 'delivered') {
      return res.status(409).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot confirm from status '${reservation.status}'. Reservation must be in 'delivered' state.`,
      });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('SupportTrainReservation')
      .update({ status: 'confirmed' })
      .eq('id', reservationId)
      .select('*')
      .single();

    if (updateErr || !updated) {
      logger.error('Confirm reservation failed', { reservationId, error: updateErr?.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to confirm reservation.' });
    }

    // Mark the slot as completed if all reservations are terminal (confirmed or canceled)
    const { count: pendingCount } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select('id', { count: 'exact', head: true })
      .eq('slot_id', reservation.slot_id)
      .not('status', 'in', '("confirmed","canceled")');

    if ((pendingCount || 0) === 0) {
      await supabaseAdmin
        .from('SupportTrainSlot')
        .update({ status: 'completed' })
        .eq('id', reservation.slot_id);
    }

    // Notify the helper that their delivery was confirmed
    if (reservation.user_id) {
      emitSupportTrainEvent({
        event: 'support_train.reservation_confirmed',
        supportTrainId: st.id,
        actorUserId: userId,
        payload: { reservation_id: reservationId, helper_user_id: reservation.user_id },
      });
    }

    // TODO: Background job to auto-complete SupportTrain when all slots are
    //       confirmed/canceled AND end_date has passed.

    res.json(updated);
  })
);

// List reservations (role-gated detail)
router.get(
  '/:id/reservations',
  verifyToken,
  loadSupportTrain,
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const userId = req.user.id;

    // Determine role
    let role = 'none';
    if (st.organizer_user_id === userId) {
      role = 'organizer';
    } else {
      const { data: orgRow } = await supabaseAdmin
        .from('SupportTrainOrganizer')
        .select('role')
        .eq('support_train_id', st.id)
        .eq('user_id', userId)
        .single();
      if (orgRow) role = 'organizer';
    }

    if (role === 'none' && st.recipient_user_id === userId) {
      role = 'recipient';
    }

    if (role === 'none') {
      // Check if helper
      const { count } = await supabaseAdmin
        .from('SupportTrainReservation')
        .select('id', { count: 'exact', head: true })
        .eq('support_train_id', st.id)
        .eq('user_id', userId)
        .neq('status', 'canceled');
      if ((count || 0) > 0) role = 'helper';
    }

    if (role === 'none') {
      return res
        .status(403)
        .json({ error: 'FORBIDDEN', message: 'You do not have access to reservations.' });
    }

    // Build query based on role
    let query = supabaseAdmin
      .from('SupportTrainReservation')
      .select(
        `
      id, slot_id, user_id, guest_name, guest_email, status, contribution_mode,
      dish_title, restaurant_name, estimated_arrival_at,
      note_to_recipient, private_note_to_organizer,
      guest_address_shared_at, guest_address_shared_by, guest_address_share_count,
      created_at, updated_at, canceled_at,
      Slot:slot_id ( slot_date ),
      User:user_id ( id, username, name, profile_picture_url )
    `
      )
      .eq('support_train_id', st.id)
      .order('created_at', { ascending: true });

    // Helpers can only see their own reservations
    if (role === 'helper') {
      query = query.eq('user_id', userId);
    }

    const { data: reservations, error } = await query;

    if (error) {
      logger.error('List reservations failed', { supportTrainId: st.id, error: error.message });
      return res.status(500).json({ error: 'INTERNAL', message: 'Failed to list reservations.' });
    }

    const { data: grants, error: grantsErr } = await supabaseAdmin
      .from('SupportTrainAddressGrant')
      .select('grantee_user_id')
      .eq('support_train_id', st.id);

    if (grantsErr) {
      logger.error('List Support Train address grants failed', {
        supportTrainId: st.id,
        error: grantsErr.message,
      });
      return res
        .status(500)
        .json({ error: 'INTERNAL', message: 'Failed to load reservation access state.' });
    }

    const sharedUserIds = new Set(
      (grants || []).map((grant) => grant.grantee_user_id).filter(Boolean)
    );

    // Shape the response based on role
    const result = (reservations || []).map((r) => {
      const item = {
        id: r.id,
        slot_id: r.slot_id,
        slot_date: r.Slot?.slot_date || null,
        status: r.status,
        contribution_mode: r.contribution_mode,
        dish_title: r.dish_title,
        restaurant_name: r.restaurant_name,
        estimated_arrival_at: r.estimated_arrival_at,
        note_to_recipient: r.note_to_recipient,
        created_at: r.created_at,
        updated_at: r.updated_at,
        canceled_at: r.canceled_at,
        guest_name: r.guest_name,
        guest_email: r.guest_email || null,
        guest_address_shared_at: r.guest_address_shared_at || null,
        guest_address_shared_by: r.guest_address_shared_by || null,
        guest_address_share_count: r.guest_address_share_count || 0,
        exact_address_shared: r.user_id
          ? sharedUserIds.has(r.user_id)
          : !!r.guest_address_shared_at,
        user: r.User
          ? {
              id: r.User.id,
              username: r.User.username,
              name: r.User.name,
              profile_picture_url: r.User.profile_picture_url,
            }
          : null,
      };

      // Only organizers see private_note_to_organizer
      if (role === 'organizer') {
        item.private_note_to_organizer = r.private_note_to_organizer;
      }

      return item;
    });

    res.json({ reservations: result, viewer_role: role });
  })
);

// ─── Public Campaign View ─────────────────────────────────────────────────

// Get a Support Train (public-facing with privacy gating)
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const supportTrainId = req.params.id;
    const userId = req.user?.id || null;

    // Load SupportTrain + Activity
    const { data: st, error: stErr } = await supabaseAdmin
      .from('SupportTrain')
      .select('*, Activity!inner ( * )')
      .eq('id', supportTrainId)
      .single();

    if (stErr || !st) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Support Train not found.' });
    }

    // ── Determine viewer level ──

    let viewerLevel = 'none';
    let viewerSupportTrainRole = 'viewer';

    // Check organizer (primary or via SupportTrainOrganizer table)
    if (userId && st.organizer_user_id === userId) {
      viewerLevel = 'organizer';
      viewerSupportTrainRole = 'primary';
    }

    if (userId && viewerLevel === 'none') {
      const { data: orgRow } = await supabaseAdmin
        .from('SupportTrainOrganizer')
        .select('role')
        .eq('support_train_id', supportTrainId)
        .eq('user_id', userId)
        .single();
      if (orgRow) {
        viewerLevel = 'organizer';
        viewerSupportTrainRole = orgRow.role;
      }
    }

    // Check recipient
    if (userId && viewerLevel === 'none' && st.recipient_user_id === userId) {
      viewerLevel = 'recipient';
      viewerSupportTrainRole = 'recipient';
    }

    // Check signed-up helper
    if (userId && viewerLevel === 'none') {
      const { count: resCount } = await supabaseAdmin
        .from('SupportTrainReservation')
        .select('id', { count: 'exact', head: true })
        .eq('support_train_id', supportTrainId)
        .eq('user_id', userId)
        .in('status', ['reserved', 'delivered', 'confirmed']);
      if ((resCount || 0) > 0) {
        viewerLevel = 'signed_up_helper';
        viewerSupportTrainRole = 'helper';
      }
    }

    // Check viewer access based on sharing_mode. A draft (never published, or moved back
    // to draft) is for its organizers and recipient only: "neighbors stop seeing it".
    if (viewerLevel === 'none' && st.status !== 'draft') {
      if (st.sharing_mode === 'private_link' || st.sharing_mode === 'direct_share_only') {
        // Nearby neighbors and Link only: anyone with the link can view. A Link only
        // train is simply never listed ("Hidden — share the link with people you trust").
        viewerLevel = 'viewer';
        viewerSupportTrainRole = 'viewer';
      } else if (userId && st.sharing_mode === 'invited_only') {
        // My connections ("Only people you're connected to can find this"): the
        // organizer's accepted connections, and anyone the organizer invited. No route
        // ever accepts an invite, so any invite row for the viewer counts.
        const [{ count: invCount }, { count: connCount }] = await Promise.all([
          supabaseAdmin
            .from('SupportTrainInvite')
            .select('id', { count: 'exact', head: true })
            .eq('support_train_id', supportTrainId)
            .eq('invitee_user_id', userId),
          supabaseAdmin
            .from('Relationship')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'accepted')
            .or(`and(requester_id.eq.${st.organizer_user_id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${st.organizer_user_id})`),
        ]);
        if ((invCount || 0) > 0 || (connCount || 0) > 0) {
          viewerLevel = 'viewer';
          viewerSupportTrainRole = 'viewer';
        }
      }
    }

    if (viewerLevel === 'none') {
      return res
        .status(403)
        .json({ error: 'FORBIDDEN', message: 'You do not have access to this Support Train.' });
    }

    // ── Load related data ──

    const [profileRes, slotsRes, updatesRes, organizersRes, myResRes] = await Promise.all([
      supabaseAdmin
        .from('SupportTrainRecipientProfile')
        .select('*')
        .eq('support_train_id', supportTrainId)
        .single(),
      supabaseAdmin
        .from('SupportTrainSlot')
        .select(
          'id, slot_date, slot_label, support_mode, start_time, end_time, status, filled_count, capacity'
        )
        .eq('support_train_id', supportTrainId)
        .order('slot_date', { ascending: true })
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('SupportTrainUpdate')
        .select('id, author_user_id, body, media_urls, created_at')
        .eq('support_train_id', supportTrainId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('SupportTrainOrganizer')
        .select(
          `
        id, role,
        User:user_id ( id, username, name, profile_picture_url )
      `
        )
        .eq('support_train_id', supportTrainId),
      userId
        ? supabaseAdmin
            .from('SupportTrainReservation')
            .select(
              'id, slot_id, status, contribution_mode, dish_title, restaurant_name, estimated_arrival_at, note_to_recipient, created_at'
            )
            .eq('support_train_id', supportTrainId)
            .eq('user_id', userId)
            .in('status', ['reserved', 'delivered', 'confirmed'])
        : Promise.resolve({ data: [] }),
    ]);

    const profile = profileRes.data;
    let slots = slotsRes.data || [];
    try {
      slots = await normalizeSlotsWithActiveReservations(slots);
    } catch (error) {
      logger.error('Support Train slot availability normalization failed', {
        supportTrainId,
        error: error.message,
      });
    }
    const helperHasExactAddress =
      viewerLevel === 'signed_up_helper'
        ? await hasSupportTrainAddressGrant(supportTrainId, userId)
        : false;
    const canSeeExactAddress =
      viewerLevel === 'organizer' || viewerLevel === 'recipient' || helperHasExactAddress;

    // ── Build response ──

    const activity = st.Activity;
    const chips = st.ai_draft_payload?.summary_chips || [];
    const locationHomeId = st.recipient_home_id || activity?.home_id || null;
    const organizers = (organizersRes.data || []).map((o) => ({
      id: o.id,
      role: o.User?.id === st.organizer_user_id ? 'primary' : o.role,
      user: o.User
        ? {
            id: o.User.id,
            username: o.User.username,
            name: o.User.name,
            profile_picture_url: o.User.profile_picture_url,
          }
        : null,
    }));
    const primaryOrganizerIndex = organizers.findIndex(
      (organizer) => organizer.user?.id === st.organizer_user_id
    );

    if (primaryOrganizerIndex > 0) {
      const [primaryOrganizer] = organizers.splice(primaryOrganizerIndex, 1);
      organizers.unshift(primaryOrganizer);
    }

    if (primaryOrganizerIndex === -1 && st.organizer_user_id) {
      const { data: organizerUser } = await supabaseAdmin
        .from('User')
        .select('id, username, name, profile_picture_url')
        .eq('id', st.organizer_user_id)
        .maybeSingle();

      if (organizerUser) {
        organizers.unshift({
          id: `primary-${organizerUser.id}`,
          role: 'primary',
          user: {
            id: organizerUser.id,
            username: organizerUser.username,
            name: organizerUser.name,
            profile_picture_url: organizerUser.profile_picture_url,
          },
        });
      }
    }

    const response = {
      id: st.id,
      activity_id: st.activity_id,
      title: activity?.title || null,
      story: st.story,
      status: st.status,
      published_at: st.published_at,
      sharing_mode: st.sharing_mode,

      // Support modes
      support_modes: {
        home_cooked_meals: st.enable_home_cooked_meals,
        takeout: st.enable_takeout,
        groceries: st.enable_groceries,
        gift_funds: st.enable_gift_funds,
      },

      // Recipient info (always public). No summary until the household size is known:
      // the clients show it as written, and "Household of ?" read as a broken sentence.
      recipient_summary: profile?.household_size ? `Household of ${profile.household_size}` : null,
      household_size: profile?.household_size || null,
      dietary_restrictions: profile?.allergies?.items || [],
      dietary_preferences: profile?.dietary_styles?.items || [],
      contactless_preferred: profile?.contactless_preferred || false,
      preferred_dropoff_window: profile
        ? {
            start_time: profile.preferred_dropoff_start_time || null,
            end_time: profile.preferred_dropoff_end_time || null,
          }
        : null,
      summary_chips: chips,

      // Slots
      slots,

      // My reservations (used to render \"You're signed up\" on slots)
      my_reservations: myResRes.data || [],

      // Updates
      updates: updatesRes.data || [],

      // Organizers (display info only)
      organizers,

      viewer_level: viewerLevel,
      viewer_support_train_role: viewerSupportTrainRole,
      exact_address_shared: canSeeExactAddress,
    };

    if (viewerLevel === 'organizer') {
      response.activity_visibility = activity?.visibility || 'private';
    }

    // ── Privacy-gated fields (address, delivery instructions) ──

    if (canSeeExactAddress) {
      // Organizer, recipient, or signed-up helper gets full details
      response.delivery_instructions = profile?.delivery_instructions || null;
      response.special_instructions = profile?.special_instructions || null;

      // Resolve address from recipient_home_id, or inline delivery columns
      if (locationHomeId) {
        const { data: home, error: homeError } = await supabaseAdmin
          .from('Home')
          .select(
            'address, address2, city, state, zipcode, map_center_lat, map_center_lng, location'
          )
          .eq('id', locationHomeId)
          .single();
        if (homeError) {
          logger.warn('Failed to resolve Support Train exact address home', {
            supportTrainId,
            locationHomeId,
            error: homeError.message,
          });
        }
        if (home) {
          response.coarse_location = buildCoarseLocation(home);
          response.address = {
            address: home.address,
            unit_number: home.address2 || null,
            city: home.city,
            state: home.state,
            zip_code: home.zipcode || null,
          };
        }
      } else if (st.delivery_address) {
        // Inline delivery location (no Home record)
        response.coarse_location = buildCoarseLocation({
          city: st.delivery_city,
          state: st.delivery_state,
          zipcode: st.delivery_zip,
          map_center_lat: st.delivery_lat,
          map_center_lng: st.delivery_lng,
        });
        response.address = {
          address: st.delivery_address,
          unit_number: null,
          city: st.delivery_city,
          state: st.delivery_state,
          zip_code: st.delivery_zip || null,
        };
      }
    } else {
      // Viewers get coarse location only
      if (locationHomeId) {
        const { data: home, error: homeError } = await supabaseAdmin
          .from('Home')
          .select('city, state, zipcode, map_center_lat, map_center_lng, location')
          .eq('id', locationHomeId)
          .single();
        if (homeError) {
          logger.warn('Failed to resolve Support Train coarse location home', {
            supportTrainId,
            locationHomeId,
            error: homeError.message,
          });
        }
        if (home) {
          response.coarse_location = buildCoarseLocation(home);
        }
      } else if (st.delivery_city || st.delivery_state) {
        // Inline delivery location — coarse only for non-authorized viewers
        response.coarse_location = buildCoarseLocation({
          city: st.delivery_city,
          state: st.delivery_state,
          zipcode: st.delivery_zip,
          map_center_lat: st.delivery_lat,
          map_center_lng: st.delivery_lng,
        });
      }
    }

    res.json(response);
  })
);

// Update a Support Train
router.patch(
  '/:id',
  verifyToken,
  supportTrainWriteLimiter,
  loadSupportTrain,
  requireSupportTrainRole(['primary', 'co_organizer']),
  validate(updateSupportTrainSchema),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;

    // Reject updates to archived/completed trains
    if (st.status === 'archived' || st.status === 'completed') {
      return res.status(409).json({
        error: 'IMMUTABLE_STATE',
        message: 'Cannot update a completed or archived Support Train.',
      });
    }

    const body = req.body;

    // Split into Activity-bound and SupportTrain-bound fields
    const activityPatch = {};
    const supportTrainPatch = {};

    if (body.title !== undefined) activityPatch.title = body.title;
    if (body.summary !== undefined) activityPatch.summary = body.summary;
    if (body.activity_visibility !== undefined) activityPatch.visibility = body.activity_visibility;
    // A train not shared with nearby neighbors is never listed, whatever else is asked; one
    // switched back to neighbors while live is listed again.
    const nextSharingMode = body.sharing_mode ?? st.sharing_mode;
    if (nextSharingMode !== 'private_link') {
      activityPatch.visibility = 'private';
    } else if (body.sharing_mode === 'private_link' && st.sharing_mode !== 'private_link'
      && body.activity_visibility === undefined && ['published', 'active', 'paused'].includes(st.status)) {
      activityPatch.visibility = 'nearby';
    }

    if (body.story !== undefined) supportTrainPatch.story = body.story;
    if (body.sharing_mode !== undefined) supportTrainPatch.sharing_mode = body.sharing_mode;
    if (body.enable_home_cooked_meals !== undefined)
      supportTrainPatch.enable_home_cooked_meals = body.enable_home_cooked_meals;
    if (body.enable_takeout !== undefined) supportTrainPatch.enable_takeout = body.enable_takeout;
    if (body.enable_groceries !== undefined)
      supportTrainPatch.enable_groceries = body.enable_groceries;
    if (body.enable_gift_funds !== undefined)
      supportTrainPatch.enable_gift_funds = body.enable_gift_funds;
    if (body.show_exact_address_after_signup !== undefined)
      supportTrainPatch.show_exact_address_after_signup = body.show_exact_address_after_signup;

    // Update Activity if there are activity-bound fields
    if (Object.keys(activityPatch).length > 0) {
      const { error: actErr } = await supabaseAdmin
        .from('Activity')
        .update(activityPatch)
        .eq('id', st.activity_id);

      if (actErr) {
        logger.error('Update Activity failed', {
          activityId: st.activity_id,
          error: actErr.message,
        });
        return res.status(500).json({ error: 'INTERNAL', message: 'Failed to update activity.' });
      }
    }

    // Update SupportTrain if there are support-train-bound fields
    if (Object.keys(supportTrainPatch).length > 0) {
      const { error: stErr } = await supabaseAdmin
        .from('SupportTrain')
        .update(supportTrainPatch)
        .eq('id', st.id);

      if (stErr) {
        logger.error('Update SupportTrain failed', { supportTrainId: st.id, error: stErr.message });
        return res
          .status(500)
          .json({ error: 'INTERNAL', message: 'Failed to update support train.' });
      }
    }

    // Re-fetch merged result
    const { data: updated, error: fetchErr } = await supabaseAdmin
      .from('SupportTrain')
      .select(
        `
      *,
      Activity!inner ( * )
    `
      )
      .eq('id', st.id)
      .single();

    if (fetchErr || !updated) {
      logger.error('Re-fetch after update failed', {
        supportTrainId: st.id,
        error: fetchErr?.message,
      });
      return res
        .status(500)
        .json({ error: 'INTERNAL', message: 'Update succeeded but failed to fetch result.' });
    }

    const { Activity: activity, ...supportTrain } = updated;
    res.json({ ...supportTrain, activity });
  })
);

// A delete reply can be lost after the Support Train was removed; a retry then finds
// nothing to load. Acknowledge that desired absence instead of a false 404.
async function acknowledgeDeletedSupportTrain(req, res, next) {
  const { data, error } = await supabaseAdmin
    .from('SupportTrain').select('id').eq('id', req.params.id).maybeSingle();
  if (!error && !data) return res.json({ id: req.params.id, deleted: true });
  return next();
}

// Delete a Support Train (primary organizer only, low-risk cases only)
router.delete(
  '/:id',
  verifyToken,
  supportTrainWriteLimiter,
  acknowledgeDeletedSupportTrain,
  loadSupportTrain,
  requireSupportTrainRole(['primary']),
  asyncHandler(async (req, res) => {
    const st = req.supportTrain;
    const userId = req.user.id;

    // The Start wizards discard a half-built train with ?draft_only=true. One that went live
    // meanwhile (its publish reply was lost) is not half-built, so it is kept.
    if (req.query.draft_only === 'true' && st.status !== 'draft') {
      return res.status(409).json({
        error: 'NOT_A_DRAFT',
        message: 'This Support Train is already published, so it was kept.',
        status: st.status,
      });
    }

    const [
      { count: activeReservationCount, error: activeReservationError },
      { data: fundRows, error: fundError },
    ] = await Promise.all([
      supabaseAdmin
        .from('SupportTrainReservation')
        .select('id', { count: 'exact', head: true })
        .eq('support_train_id', st.id)
        .in('status', ['reserved', 'delivered', 'confirmed']),
      supabaseAdmin.from('SupportTrainFund').select('id').eq('support_train_id', st.id),
    ]);

    if (activeReservationError || fundError) {
      logger.error('Delete SupportTrain precheck failed', {
        supportTrainId: st.id,
        activeReservationError: activeReservationError?.message,
        fundError: fundError?.message,
      });
      return res.status(500).json({
        error: 'INTERNAL',
        message: 'Failed to validate whether this Support Train can be deleted.',
      });
    }

    const fundIds = (fundRows || []).map((row) => row.id).filter(Boolean);
    let contributionCount = 0;
    if (fundIds.length > 0) {
      const { count, error: contributionError } = await supabaseAdmin
        .from('SupportTrainFundContribution')
        .select('id', { count: 'exact', head: true })
        .in('support_train_fund_id', fundIds)
        .in('payment_status', ['pending', 'succeeded']);

      if (contributionError) {
        logger.error('Delete SupportTrain contribution check failed', {
          supportTrainId: st.id,
          error: contributionError.message,
        });
        return res.status(500).json({
          error: 'INTERNAL',
          message: 'Failed to validate whether this Support Train has contributions.',
        });
      }

      contributionCount = count || 0;
    }

    if ((activeReservationCount || 0) > 0) {
      return res.status(409).json({
        error: 'DELETE_BLOCKED_ACTIVE_HELPERS',
        message:
          'This Support Train already has active helper commitments. Use pause, complete, or archive instead of deleting it.',
      });
    }

    if (contributionCount > 0) {
      return res.status(409).json({
        error: 'DELETE_BLOCKED_CONTRIBUTIONS',
        message:
          'This Support Train already has gift fund contributions. Keep it for history and use archive instead.',
      });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('Activity')
      .delete()
      .eq('id', st.activity_id);

    if (deleteError) {
      logger.error('Delete SupportTrain failed', {
        supportTrainId: st.id,
        activityId: st.activity_id,
        userId,
        error: deleteError.message,
      });
      return res.status(500).json({
        error: 'INTERNAL',
        message: 'Failed to delete this Support Train.',
      });
    }

    logger.info('Support Train deleted', {
      supportTrainId: st.id,
      activityId: st.activity_id,
      userId,
    });

    res.json({ id: st.id, deleted: true });
  })
);

module.exports = router;
