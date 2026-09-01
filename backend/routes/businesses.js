/**
 * Business Routes
 *
 * CRUD for business profiles, locations, hours, catalog, pages & blocks.
 * Mount at: app.use('/api/businesses', require('./routes/businesses'));
 *
 * Endpoints:
 *   POST   /                                          — Create business
 *   POST   /create-full                               — Create business + location + hours atomically
 *   GET    /my-businesses                             — List my businesses
 *   GET    /:businessId                               — Get business (public or admin)
 *   GET    /:businessId/dashboard                     — Dashboard aggregate
 *   PATCH  /:businessId                               — Update profile
 *   DELETE /:businessId                               — Delete business (owner only)
 *
 *   POST   /:businessId/validate-address               — Validate business address (decision engine)
 *   POST   /:businessId/locations                     — Add location (with decision engine)
 *   GET    /:businessId/locations                     — List locations
 *   PATCH  /:businessId/locations/:locationId         — Update location
 *   DELETE /:businessId/locations/:locationId         — Delete location
 *   POST   /:businessId/mailing-address               — Set business mailing address
 *
 *   PUT    /:businessId/locations/:locationId/hours   — Set weekly hours (bulk)
 *   GET    /:businessId/locations/:locationId/hours   — Get weekly hours
 *   POST   /:businessId/locations/:locationId/special-hours — Add special hours
 *   GET    /:businessId/locations/:locationId/special-hours — List special hours
 *   DELETE /:businessId/locations/:locationId/special-hours/:shId — Delete special hours
 *
 *   POST   /:businessId/catalog/categories            — Create category
 *   GET    /:businessId/catalog/categories            — List categories
 *   PATCH  /:businessId/catalog/categories/:catId     — Update category
 *   DELETE /:businessId/catalog/categories/:catId     — Delete category
 *   POST   /:businessId/catalog/items                 — Create catalog item
 *   GET    /:businessId/catalog/items                 — List catalog items
 *   PATCH  /:businessId/catalog/items/:itemId         — Update catalog item
 *   DELETE /:businessId/catalog/items/:itemId         — Delete catalog item
 *
 *   POST   /:businessId/pages                         — Create page
 *   GET    /:businessId/pages                         — List pages
 *   PATCH  /:businessId/pages/:pageId                 — Update page meta
 *   DELETE /:businessId/pages/:pageId                 — Delete page
 *   GET    /:businessId/pages/:pageId/blocks          — Get blocks (draft or published)
 *   PUT    /:businessId/pages/:pageId/blocks          — Save draft blocks
 *   POST   /:businessId/pages/:pageId/publish         — Publish draft
 *   GET    /:businessId/pages/:pageId/revisions       — List revisions
 *   POST   /:businessId/pages/:pageId/revisions/:rev/restore — Restore revision to draft
 *
 *   POST   /:businessId/catalog/items/reorder         — Bulk reorder catalog items
 *
 *   GET    /:businessId/private                       — Get sensitive business data (owner)
 *   PATCH  /:businessId/private                       — Update sensitive business data (owner)
 *
 *   GET    /public/:username                          — Public business profile (no auth)
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { geocodeAddress } = require('../utils/geocoding');
const { validateBusinessAddress } = require('../services/businessAddressService');
const { computeAddressHash } = require('../utils/normalizeAddress');
const rateLimit = require('express-rate-limit');
const {
  checkBusinessPermission,
  hasPermission,
  getUserAccess,
  writeAuditLog,
  BUSINESS_ROLE_RANK,
} = require('../utils/businessPermissions');
const { RESERVED_USERNAMES, ENTITY_TYPES, getPublishRequirements } = require('../utils/businessConstants');
const { applyEntityTypeSideEffects } = require('../services/businessEntityService');
const stripeService = require('../stripe/stripeService');
const { calculateAndStoreCompleteness, calculateProfileCompleteness } = require('../utils/businessCompleteness');
const { shouldBlockCoordinateOverwrite } = require('../utils/verifiedCoordinateGuard');
const { generateNewBusinessSignal } = require('../services/businessSignalService');


// ============ CONSTANTS ============

const VALID_BLOCK_TYPES = [
  'hero', 'text', 'gallery', 'catalog_grid', 'hours',
  'locations_map', 'cta', 'faq', 'reviews', 'embed',
  'divider', 'stats', 'team', 'contact_form', 'posts_feed',
];

const MAX_BLOCKS_PER_PAGE = 50;

const CATALOG_ITEM_KINDS = ['service', 'product', 'menu_item', 'class', 'rental', 'membership', 'donation', 'event', 'other'];
const CATALOG_ITEM_STATUSES = ['active', 'draft', 'archived'];

const BUSINESS_LOCATION_TYPES = ['storefront', 'office', 'warehouse', 'home_based_private', 'service_area_only', 'mailing_only', 'unknown'];
const LOCATION_INTENTS = ['CUSTOMER_FACING', 'OFFICE_NOT_PUBLIC', 'WAREHOUSE', 'HOME_BASED_PRIVATE', 'SERVICE_AREA_ONLY', 'MAILING_ONLY'];

/** Rate limiter: 20 address validations per business per hour. */
const addressValidationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `biz-addr-${req.params.businessId || req.user?.id || req.ip}`,
  message: { error: 'Too many address validation requests. Please try again later.' },
});


// ============ VALIDATION SCHEMAS ============

const createBusinessSchema = Joi.object({
  username: Joi.string().pattern(/^[a-z0-9_]+$/).min(3).max(30).required()
    .messages({ 'string.pattern.base': 'Username may only contain lowercase letters, numbers, and underscores' }),
  name: Joi.string().min(1).max(255).required(),
  email: Joi.string().email().required(),
  business_type: Joi.string().valid(...Array.from(ENTITY_TYPES)).optional(),
  categories: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  description: Joi.string().max(5000).optional().allow('', null),
  public_phone: Joi.string().max(20).optional().allow('', null),
  website: Joi.string().uri().max(500).optional().allow('', null),
});

const updateBusinessSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  business_type: Joi.string().valid(...Array.from(ENTITY_TYPES)),
  categories: Joi.array().items(Joi.string().max(50)).max(10),
  description: Joi.string().max(5000).allow('', null),
  public_email: Joi.string().email().allow('', null),
  public_phone: Joi.string().max(20).allow('', null),
  website: Joi.string().uri().max(500).allow('', null),
  social_links: Joi.object(),
  founded_year: Joi.number().integer().min(1800).max(2100).allow(null),
  employee_count: Joi.string().max(30).allow('', null),
  service_area: Joi.object(),
  theme: Joi.object(),
  attributes: Joi.object(),
  is_published: Joi.boolean(),
  tagline: Joi.string().max(255).allow('', null),
  bio: Joi.string().max(5000).allow('', null),
}).min(1);

const validateAddressSchema = Joi.object({
  address: Joi.string().min(5).max(255).required(),
  address2: Joi.string().max(255).optional().allow('', null),
  city: Joi.string().min(2).max(100).required(),
  state: Joi.string().max(50).optional().allow('', null),
  zipcode: Joi.string().max(20).optional().allow('', null),
  country: Joi.string().max(50).optional(),
  place_id: Joi.string().max(255).optional().allow('', null),
  location_intent: Joi.string().valid(...LOCATION_INTENTS).optional(),
  force_manual: Joi.boolean().optional(),
});

const createLocationSchema = Joi.object({
  label: Joi.string().max(100).optional(),
  is_primary: Joi.boolean().optional(),
  address: Joi.string().min(3).max(255).required(),
  address2: Joi.string().max(255).optional().allow('', null),
  city: Joi.string().min(1).max(100).required(),
  state: Joi.string().max(50).optional().allow('', null),
  zipcode: Joi.string().max(20).optional().allow('', null),
  country: Joi.string().max(50).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  timezone: Joi.string().max(50).optional().allow('', null),
  phone: Joi.string().max(20).optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
  location_type: Joi.string().valid(...BUSINESS_LOCATION_TYPES).optional(),
  is_customer_facing: Joi.boolean().optional(),
  location_intent: Joi.string().valid(...LOCATION_INTENTS).optional(),
  decision_id: Joi.string().uuid().optional().allow('', null),
  service_area: Joi.object({
    radius_miles: Joi.number().min(0).max(500).optional(),
    center_lat: Joi.number().min(-90).max(90).optional(),
    center_lng: Joi.number().min(-180).max(180).optional(),
  }).optional().allow(null),
  place_id: Joi.string().max(255).optional().allow('', null),
});

const createMailingAddressSchema = Joi.object({
  address: Joi.string().min(3).max(255).required(),
  address2: Joi.string().max(255).optional().allow('', null),
  city: Joi.string().min(1).max(100).required(),
  state: Joi.string().max(50).required(),
  zipcode: Joi.string().max(20).required(),
  country: Joi.string().max(50).optional(),
});

const updateLocationSchema = Joi.object({
  label: Joi.string().max(100),
  is_primary: Joi.boolean(),
  address: Joi.string().min(3).max(255),
  address2: Joi.string().max(255).allow('', null),
  city: Joi.string().min(1).max(100),
  state: Joi.string().max(50).allow('', null),
  zipcode: Joi.string().max(20).allow('', null),
  country: Joi.string().max(50),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  timezone: Joi.string().max(50).allow('', null),
  phone: Joi.string().max(20).allow('', null),
  email: Joi.string().email().allow('', null),
  is_active: Joi.boolean(),
}).min(1);

const weeklyHoursSchema = Joi.object({
  hours: Joi.array().items(Joi.object({
    day_of_week: Joi.number().integer().min(0).max(6).required(),
    open_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null),
    close_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null),
    is_closed: Joi.boolean().required(),
    notes: Joi.string().max(200).optional().allow('', null),
  })).min(1).max(7).required(),
});

const specialHoursSchema = Joi.object({
  date: Joi.string().isoDate().required(),
  label: Joi.string().max(100).optional().allow('', null),
  open_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null),
  close_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).allow(null),
  is_closed: Joi.boolean().required(),
  notes: Joi.string().max(200).optional().allow('', null),
});

const createCategorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional().allow('', null),
  slug: Joi.string().max(100).optional().allow('', null),
  sort_order: Joi.number().integer().min(0).optional(),
});

const createCatalogItemSchema = Joi.object({
  category_id: Joi.string().uuid().optional().allow(null),
  name: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(5000).optional().allow('', null),
  kind: Joi.string().valid(...CATALOG_ITEM_KINDS).optional(),
  price_cents: Joi.number().integer().min(0).optional().allow(null),
  price_max_cents: Joi.number().integer().min(0).optional().allow(null),
  price_unit: Joi.string().max(30).optional().allow('', null),
  currency: Joi.string().max(5).optional(),
  duration_minutes: Joi.number().integer().min(0).optional().allow(null),
  image_file_id: Joi.string().uuid().optional().allow(null),
  image_url: Joi.string().uri().optional().allow('', null),
  gallery_file_ids: Joi.array().items(Joi.string().uuid()).max(20).optional(),
  status: Joi.string().valid(...CATALOG_ITEM_STATUSES).optional(),
  is_featured: Joi.boolean().optional(),
  available_at_location_ids: Joi.array().items(Joi.string().uuid()).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  details: Joi.object().optional(),
  sort_order: Joi.number().integer().min(0).optional(),
  suggested_amounts: Joi.array().items(Joi.number().integer().min(100)).max(6).optional().allow(null),
  tax_deductible: Joi.boolean().optional(),
  suggested_description: Joi.string().max(200).optional().allow('', null),
});

const updateCatalogItemSchema = createCatalogItemSchema.fork(
  ['name'],
  (schema) => schema.optional()
).min(1);

const createPageSchema = Joi.object({
  slug: Joi.string().min(1).max(100).required(),
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(1000).optional().allow('', null),
  is_default: Joi.boolean().optional(),
  show_in_nav: Joi.boolean().optional(),
  nav_order: Joi.number().integer().min(0).optional(),
  icon_key: Joi.string().max(50).optional().allow('', null),
  seo: Joi.object().optional(),
  theme: Joi.object().optional(),
});

const updatePageSchema = Joi.object({
  slug: Joi.string().min(1).max(100),
  title: Joi.string().min(1).max(200),
  description: Joi.string().max(1000).allow('', null),
  is_default: Joi.boolean(),
  show_in_nav: Joi.boolean(),
  nav_order: Joi.number().integer().min(0),
  icon_key: Joi.string().max(50).allow('', null),
  seo: Joi.object(),
  theme: Joi.object(),
}).min(1);

const blockSchema = Joi.object({
  id: Joi.string().uuid().optional(), // for existing blocks
  block_type: Joi.string().valid(...VALID_BLOCK_TYPES).required(),
  schema_version: Joi.number().integer().min(1).optional(),
  sort_order: Joi.number().integer().min(0).required(),
  data: Joi.object().required(),
  settings: Joi.object().optional(),
  location_id: Joi.string().uuid().optional().allow(null),
  show_from: Joi.string().isoDate().optional().allow(null),
  show_until: Joi.string().isoDate().optional().allow(null),
  is_visible: Joi.boolean().optional(),
});

const saveDraftBlocksSchema = Joi.object({
  blocks: Joi.array().items(blockSchema).max(MAX_BLOCKS_PER_PAGE).required(),
});


// ============ HELPERS ============

const formatLocationForDB = (latitude, longitude) => {
  return `POINT(${longitude} ${latitude})`;
};

const parsePostGISPoint = (point) => {
  if (!point) return null;
  if (typeof point === 'object' && point.coordinates) {
    return { longitude: point.coordinates[0], latitude: point.coordinates[1] };
  }
  const str = String(point);
  const wktMatch = str.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (wktMatch) {
    return { longitude: parseFloat(wktMatch[1]), latitude: parseFloat(wktMatch[2]) };
  }
  // WKB hex (Supabase returns geography columns in this format)
  if (/^[0-9a-fA-F]+$/.test(str) && (str.length === 42 || str.length === 50)) {
    try {
      const buf = Buffer.from(str, 'hex');
      const le = buf[0] === 1;
      const wkbType = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
      const hasSRID = (wkbType & 0x20000000) !== 0;
      const geomType = wkbType & 0xFF;
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
};

/** Strip raw validation response from a verdict before sending to client. */
const stripRawData = (verdict) => {
  const clean = { ...verdict };
  delete clean.raw_validation_response;
  return clean;
};


// ================================================================
//  USERNAME AVAILABILITY CHECK
// ================================================================

/**
 * GET /check-username — Check if a business username is available.
 * No auth required. Returns { available, reason? }.
 */
router.get('/check-username', async (req, res) => {
  try {
    const raw = (req.query.username || '').toLowerCase().trim();

    // Validate format
    if (!raw || raw.length < 3 || raw.length > 30 || !/^[a-z0-9_]+$/.test(raw)) {
      return res.json({ available: false, reason: 'invalid' });
    }

    // Check reserved list
    if (RESERVED_USERNAMES.has(raw)) {
      return res.json({ available: false, reason: 'reserved' });
    }

    // Check database uniqueness
    const { data: existing } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('username', raw)
      .maybeSingle();

    if (existing) {
      return res.json({ available: false, reason: 'taken' });
    }

    res.json({ available: true });
  } catch (err) {
    logger.error('check-username error', { error: err.message });
    res.status(500).json({ available: false, reason: 'error' });
  }
});


// ================================================================
//  BUSINESS CRUD
// ================================================================

/**
 * POST / — Create a new business
 *
 * Atomically creates User, BusinessProfile, BusinessPrivate, BusinessTeam
 * (owner), and default BusinessPage via the create_business_transaction RPC.
 */
router.post('/', verifyToken, validate(createBusinessSchema), async (req, res) => {
  try {
    const actorId = req.user.id;
    const { username, name, email, business_type, categories, description, public_phone, website } = req.body;

    // 1) Reserved username check — before any DB operations
    if (RESERVED_USERNAMES.has(username.toLowerCase())) {
      return res.status(409).json({ error: 'This username is reserved', code: 'USERNAME_RESERVED' });
    }

    // 2) Rate limiting — max 3 businesses created per user per 24 hours
    //    Check both seat-based and legacy BusinessTeam
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Seat-based ownership count
    const { data: ownedSeats } = await supabaseAdmin
      .from('SeatBinding')
      .select('seat:seat_id ( business_user_id, role_base, is_active, created_at )')
      .eq('user_id', actorId);
    const recentSeatCount = (ownedSeats || [])
      .filter(s => s.seat?.is_active && s.seat?.role_base === 'owner' && s.seat?.created_at >= twentyFourHoursAgo)
      .length;

    // Fallback: also check legacy BusinessTeam
    const { count: legacyCount } = await supabaseAdmin
      .from('BusinessTeam')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', actorId)
      .eq('role_base', 'owner')
      .eq('is_active', true)
      .gte('joined_at', twentyFourHoursAgo);

    const recentCount = Math.max(recentSeatCount, legacyCount || 0);

    if ((recentCount || 0) >= 3) {
      return res.status(429).json({
        error: 'Too many businesses created recently. Please try again tomorrow.',
        code: 'RATE_LIMITED',
      });
    }

    // 3) Check username uniqueness
    const { data: existing } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Username already taken', code: 'USERNAME_TAKEN' });
    }

    // 4) Check email uniqueness with better UX
    const { data: existingEmail } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      if (existingEmail.id === actorId) {
        return res.status(409).json({
          error: 'This email is already used by your personal account. Try a business-specific email like hello@yourbusiness.com',
          code: 'EMAIL_IS_PERSONAL',
        });
      }
      return res.status(409).json({ error: 'Email already in use by another account', code: 'EMAIL_TAKEN' });
    }

    // 5) Atomic creation via RPC
    const { data, error: rpcErr } = await supabaseAdmin.rpc('create_business_transaction', {
      p_username: username,
      p_name: name,
      p_email: email,
      p_business_type: business_type || 'for_profit',
      p_categories: categories || [],
      p_description: description || null,
      p_public_phone: public_phone || null,
      p_website: website || null,
      p_actor_user_id: actorId,
    });

    if (rpcErr) {
      logger.error('create_business_transaction RPC failed', { error: rpcErr.message });
      return res.status(500).json({ error: 'Failed to create business', code: 'CREATION_FAILED' });
    }

    const businessUserId = data.business_user_id;

    // 6a) Apply entity-type side effects (fee override, nonprofit flags)
    applyEntityTypeSideEffects(businessUserId, business_type || 'for_profit', {
      actorUserId: actorId,
    }).catch((err) => {
      logger.error('Post-creation entity type side effects failed', { businessUserId, error: err.message });
    });

    // 6b) Calculate profile completeness (fire-and-forget with error logging)
    calculateAndStoreCompleteness(businessUserId).catch((err) => {
      logger.error('Post-creation completeness calculation failed', { businessUserId, error: err.message });
    });

    await writeAuditLog(businessUserId, actorId, 'create_business', 'User', businessUserId, { username, name });

    res.status(201).json({
      message: 'Business created',
      business: {
        id: businessUserId,
        username,
        name,
        email,
        account_type: 'business',
      },
    });
  } catch (err) {
    logger.error('Create business error', { error: err.message });
    res.status(500).json({ error: 'Failed to create business', code: 'INTERNAL_ERROR' });
  }
});


/**
 * POST /create-full — Create a business with optional location + hours in one call
 *
 * Eliminates ghost accounts by deferring all creation to a single atomic step.
 * Used by the refactored creation wizard.
 */
const createBusinessFullSchema = Joi.object({
  username: Joi.string().min(3).max(40).regex(/^[a-z0-9_]+$/).required(),
  name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().required(),
  business_type: Joi.string().valid(...Object.keys(ENTITY_TYPES)).optional(),
  categories: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  description: Joi.string().max(2000).allow('', null).optional(),
  public_phone: Joi.string().max(30).allow('', null).optional(),
  website: Joi.string().max(200).allow('', null).optional(),
  // Optional location
  location: Joi.object({
    label: Joi.string().max(100).optional(),
    address: Joi.string().max(200).required(),
    city: Joi.string().max(100).required(),
    state: Joi.string().max(100).allow('', null).optional(),
    zipcode: Joi.string().max(20).allow('', null).optional(),
    country: Joi.string().max(5).default('US'),
  }).optional().allow(null),
  // Optional hours
  hours: Joi.array().items(Joi.object({
    day_of_week: Joi.number().integer().min(0).max(6).required(),
    open_time: Joi.string().max(10).allow('', null).optional(),
    close_time: Joi.string().max(10).allow('', null).optional(),
    is_closed: Joi.boolean().optional(),
  })).max(7).optional().allow(null),
});

router.post('/create-full', verifyToken, validate(createBusinessFullSchema), async (req, res) => {
  try {
    const actorId = req.user.id;
    const { username, name, email, business_type, categories, description, public_phone, website, location, hours } = req.body;

    // 1) Reserved username check
    if (RESERVED_USERNAMES.has(username.toLowerCase())) {
      return res.status(409).json({ error: 'This username is reserved', code: 'USERNAME_RESERVED' });
    }

    // 2) Rate limiting — max 3 businesses per user per 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: ownedSeats } = await supabaseAdmin
      .from('SeatBinding')
      .select('seat:seat_id ( business_user_id, role_base, is_active, created_at )')
      .eq('user_id', actorId);
    const recentSeatCount = (ownedSeats || [])
      .filter(s => s.seat?.is_active && s.seat?.role_base === 'owner' && s.seat?.created_at >= twentyFourHoursAgo)
      .length;
    const { count: legacyCount } = await supabaseAdmin
      .from('BusinessTeam')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', actorId)
      .eq('role_base', 'owner')
      .eq('is_active', true)
      .gte('joined_at', twentyFourHoursAgo);
    if (Math.max(recentSeatCount, legacyCount || 0) >= 3) {
      return res.status(429).json({ error: 'Too many businesses created recently. Please try again tomorrow.', code: 'RATE_LIMITED' });
    }

    // 3) Username uniqueness
    const { data: existing } = await supabaseAdmin
      .from('User').select('id').eq('username', username).maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'Username already taken', code: 'USERNAME_TAKEN' });
    }

    // 4) Email uniqueness
    const { data: existingEmail } = await supabaseAdmin
      .from('User').select('id').eq('email', email).maybeSingle();
    if (existingEmail) {
      if (existingEmail.id === actorId) {
        return res.status(409).json({ error: 'This email is already used by your personal account. Try a business-specific email.', code: 'EMAIL_IS_PERSONAL' });
      }
      return res.status(409).json({ error: 'Email already in use by another account', code: 'EMAIL_TAKEN' });
    }

    // 5) Build hours JSON for RPC (pass as plain array — Supabase serialises to jsonb)
    const hoursJson = hours && hours.length > 0
      ? hours.map(h => ({
          day_of_week: h.day_of_week,
          open_time: h.is_closed ? null : (h.open_time || null),
          close_time: h.is_closed ? null : (h.close_time || null),
          is_closed: h.is_closed || false,
        }))
      : null;

    // 6) Atomic creation via RPC
    const { data, error: rpcErr } = await supabaseAdmin.rpc('create_business_full', {
      p_username: username,
      p_name: name,
      p_email: email,
      p_business_type: business_type || 'for_profit',
      p_categories: categories || [],
      p_description: description || null,
      p_public_phone: public_phone || null,
      p_website: website || null,
      p_actor_user_id: actorId,
      p_location_address: location?.address || null,
      p_location_city: location?.city || null,
      p_location_state: location?.state || null,
      p_location_zipcode: location?.zipcode || null,
      p_location_country: location?.country || 'US',
      p_location_label: location?.label || 'Main',
      p_hours: hoursJson,
    });

    if (rpcErr) {
      logger.error('create_business_full RPC failed', { error: rpcErr.message });
      return res.status(500).json({ error: 'Failed to create business', code: 'CREATION_FAILED' });
    }

    const businessUserId = data.business_user_id;

    // 7) Post-creation side effects (fire-and-forget)

    // Bridge sole_proprietor to personal identity
    const entityType = business_type || 'for_profit';
    if (entityType === 'sole_proprietor') {
      await supabaseAdmin
        .from('BusinessProfile')
        .update({ personal_user_id: actorId })
        .eq('business_user_id', businessUserId);
    }

    applyEntityTypeSideEffects(businessUserId, entityType, {
      actorUserId: actorId,
    }).catch((err) => {
      logger.error('Post-creation entity type side effects failed', { businessUserId, error: err.message });
    });

    calculateAndStoreCompleteness(businessUserId).catch((err) => {
      logger.error('Post-creation completeness calculation failed', { businessUserId, error: err.message });
    });

    await writeAuditLog(businessUserId, actorId, 'create_business', 'User', businessUserId, { username, name, method: 'create-full' });

    res.status(201).json({
      message: 'Business created',
      business: {
        id: businessUserId,
        username,
        name,
        email,
        account_type: 'business',
      },
      location_id: data.location_id || null,
    });
  } catch (err) {
    logger.error('Create business full error', { error: err.message });
    res.status(500).json({ error: 'Failed to create business', code: 'INTERNAL_ERROR' });
  }
});


/**
 * GET /my-businesses — List businesses the current user is a member of
 */
router.get('/my-businesses', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Seat-based: get all active seats for this user
    const { getAllSeatsForUser } = require('../utils/seatPermissions');
    const seats = await getAllSeatsForUser(userId);

    let memberships;
    if (seats.length > 0) {
      // Map seat data to the shape expected downstream. T6.3f added city/state
      // so My businesses can render the locality body without a second hop.
      const bizIds = seats.map(s => s.business_user_id);
      const { data: bizUsers } = await supabaseAdmin
        .from('User')
        .select('id, username, name, email, profile_picture_url, account_type, city, state, average_rating, review_count')
        .in('id', bizIds);
      const bizMap = {};
      for (const u of (bizUsers || [])) bizMap[u.id] = u;

      memberships = seats.map(s => ({
        id: s.seat_id,
        role_base: s.role_base,
        title: s.display_name,
        joined_at: null,
        business_user_id: s.business_user_id,
        business: bizMap[s.business_user_id] || { id: s.business_user_id, username: s.business_username, name: s.business_name },
      }));
    } else {
      // Fallback to legacy BusinessTeam. T6.3f added city/state on the join.
      const { data, error } = await supabaseAdmin
        .from('BusinessTeam')
        .select(`
          id,
          role_base,
          title,
          joined_at,
          business_user_id,
          business:business_user_id (
            id, username, name, email, profile_picture_url, account_type, city, state, average_rating, review_count
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('joined_at', { ascending: false });

      if (error) {
        logger.error('Error fetching my businesses', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch businesses' });
      }
      memberships = data || [];
    }

    // Enrich with profile data
    const businessIds = (memberships || []).map(m => m.business_user_id);
    let profiles = [];
    if (businessIds.length > 0) {
      const { data: profileData } = await supabaseAdmin
        .from('BusinessProfile')
        .select('business_user_id, business_type, categories, is_published, logo_file_id, banner_file_id, description, identity_verification_tier')
        .in('business_user_id', businessIds);
      profiles = profileData || [];
    }

    const profileMap = {};
    for (const p of profiles) {
      profileMap[p.business_user_id] = p;
    }

    // ── Per-business signals for the My businesses cards ────────────────
    //   team             → active seat count + up to 3 member chips
    //   stats.open_chats → the business's own unread, active conversations
    //   stats.bookings_this_week → incoming BusinessBooking rows (last 7d)
    const initialsFrom = (name) => {
      if (!name || typeof name !== 'string') return '?';
      const parts = name.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return '?';
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const teamMap = {};
    const chatMap = {};
    const bookingMap = {};
    if (businessIds.length > 0) {
      const weekAgoISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [seatRows, chatRows, bookingRows] = await Promise.all([
        supabaseAdmin
          .from('BusinessSeat')
          .select('business_user_id, display_name, display_avatar_file_id')
          .in('business_user_id', businessIds)
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
        supabaseAdmin
          .from('ChatParticipant')
          .select('user_id')
          .in('user_id', businessIds)
          .eq('is_active', true)
          .gt('unread_count', 0),
        supabaseAdmin
          .from('BusinessBooking')
          .select('business_user_id')
          .in('business_user_id', businessIds)
          .gte('created_at', weekAgoISO),
      ]);

      for (const seat of (seatRows.data || [])) {
        const team = teamMap[seat.business_user_id]
          || (teamMap[seat.business_user_id] = { count: 0, members: [] });
        team.count += 1;
        if (team.members.length < 3) {
          team.members.push({
            name: seat.display_name || null,
            initials: initialsFrom(seat.display_name),
            avatar_file_id: seat.display_avatar_file_id || null,
          });
        }
      }
      for (const row of (chatRows.data || [])) {
        chatMap[row.user_id] = (chatMap[row.user_id] || 0) + 1;
      }
      for (const row of (bookingRows.data || [])) {
        bookingMap[row.business_user_id] = (bookingMap[row.business_user_id] || 0) + 1;
      }
    }

    const businesses = (memberships || []).map(m => ({
      ...m,
      profile: profileMap[m.business_user_id] || null,
      team: teamMap[m.business_user_id] || { count: 0, members: [] },
      stats: {
        open_chats: chatMap[m.business_user_id] || 0,
        bookings_this_week: bookingMap[m.business_user_id] || 0,
      },
    }));

    res.json({ businesses });
  } catch (err) {
    logger.error('My businesses error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

/**
 * GET /discover — Search published businesses for discovery
 * Query:
 *   q (required, min 2)
 *   limit (default 20, max 50)
 *   offset (default 0)
 */
router.get('/discover', verifyToken, async (req, res) => {
  try {
    const { q = '', limit = 20, offset = 0 } = req.query;
    const viewerId = req.user.id;
    const queryText = String(q || '').trim();
    const normalizedQuery = queryText.toLowerCase();
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean).slice(0, 6);
    const primaryToken = tokens[0] || normalizedQuery;
    const safeLimit = Math.min(parseInt(limit) || 20, 50);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);

    if (queryText.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const fullSearchTerm = `%${queryText}%`;
    const broadSearchTerm = `%${primaryToken}%`;
    const candidateLimit = Math.min(Math.max((safeOffset + safeLimit) * 8, 80), 400);

    // 1) Candidate business users
    const { data: businesses, error: bizErr } = await supabaseAdmin
      .from('User')
      .select('id, username, name, profile_picture_url, city, state, average_rating, review_count')
      .eq('account_type', 'business')
      .or(
        `username.ilike.${fullSearchTerm},name.ilike.${fullSearchTerm},city.ilike.${fullSearchTerm},state.ilike.${fullSearchTerm},username.ilike.${broadSearchTerm},name.ilike.${broadSearchTerm},city.ilike.${broadSearchTerm},state.ilike.${broadSearchTerm}`
      )
      .order('review_count', { ascending: false })
      .range(0, candidateLimit - 1);

    if (bizErr) {
      logger.error('Business discover search error', { error: bizErr.message });
      return res.status(500).json({ error: 'Failed to search businesses' });
    }

    const rows = businesses || [];
    if (rows.length === 0) {
      return res.json({ businesses: [] });
    }

    const businessIds = rows.map((b) => b.id);

    // 2) Profiles + primary location for published businesses
    const [{ data: profiles }, { data: primaryLocations }, { data: follows }] = await Promise.all([
      supabaseAdmin
        .from('BusinessProfile')
        .select('business_user_id, business_type, categories, description, public_phone, website, is_published')
        .in('business_user_id', businessIds)
        .eq('is_published', true),
      supabaseAdmin
        .from('BusinessLocation')
        .select('business_user_id, city, state')
        .in('business_user_id', businessIds)
        .eq('is_primary', true),
      supabaseAdmin
        .from('BusinessFollow')
        .select('business_user_id')
        .eq('user_id', viewerId)
        .in('business_user_id', businessIds),
    ]);

    const profileMap = new Map((profiles || []).map((p) => [p.business_user_id, p]));
    const locationMap = new Map((primaryLocations || []).map((l) => [l.business_user_id, l]));
    const followingSet = new Set((follows || []).map((f) => f.business_user_id));

    const ranked = rows
      .filter((b) => profileMap.has(b.id))
      .map((b) => {
        const p = profileMap.get(b.id);
        const loc = locationMap.get(b.id);
        const city = loc?.city || b.city || null;
        const state = loc?.state || b.state || null;
        const businessType = p?.business_type || null;
        const categories = p?.categories || [];
        const description = p?.description || null;
        const searchable = [
          b.username,
          b.name,
          city,
          state,
          businessType,
          categories.join(' '),
          description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        let score = 4;
        const usernameLc = String(b.username || '').toLowerCase();
        const nameLc = String(b.name || '').toLowerCase();
        if (usernameLc === normalizedQuery || nameLc === normalizedQuery) {
          score = 0;
        } else if (usernameLc.startsWith(normalizedQuery) || nameLc.startsWith(normalizedQuery)) {
          score = 1;
        } else if (searchable.includes(normalizedQuery)) {
          score = 2;
        } else if (tokens.every((token) => searchable.includes(token))) {
          score = 3;
        }

        return {
          id: b.id,
          username: b.username,
          name: b.name,
          profile_picture_url: b.profile_picture_url,
          city,
          state,
          average_rating: b.average_rating || 0,
          review_count: b.review_count || 0,
          business_type: businessType,
          categories,
          description,
          public_phone: p?.public_phone || null,
          website: p?.website || null,
          following: followingSet.has(b.id),
          _searchable: searchable,
          _score: score,
        };
      })
      .filter((b) => tokens.every((token) => b._searchable.includes(token)))
      .sort((a, b) => {
        if (a._score !== b._score) return a._score - b._score;
        if (a.review_count !== b.review_count) return b.review_count - a.review_count;
        return String(a.username || '').localeCompare(String(b.username || ''));
      });

    const result = ranked
      .slice(safeOffset, safeOffset + safeLimit)
      .map(({ _searchable, _score, ...rest }) => rest);

    res.json({ businesses: result });
  } catch (err) {
    logger.error('Business discover error', { error: err.message });
    res.status(500).json({ error: 'Failed to search businesses' });
  }
});


/**
 * GET /:businessId — Get business details (admin or public)
 */
router.get('/:businessId', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    // Check access
    const access = await checkBusinessPermission(businessId, userId);

    // Get User row
    const { data: bizUser, error: userErr } = await supabaseAdmin
      .from('User')
      .select('*')
      .eq('id', businessId)
      .eq('account_type', 'business')
      .single();

    if (userErr || !bizUser) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Get profile
    const { data: profile } = await supabaseAdmin
      .from('BusinessProfile')
      .select('*')
      .eq('business_user_id', businessId)
      .single();

    // Get locations
    const { data: locations } = await supabaseAdmin
      .from('BusinessLocation')
      .select('*')
      .eq('business_user_id', businessId)
      .eq('is_active', true)
      .order('sort_order');

    // Parse PostGIS points
    for (const loc of (locations || [])) {
      if (loc.location) {
        loc.location = parsePostGISPoint(loc.location);
      }
    }

    // Set primary_location_id on profile if available
    if (profile) {
      profile.primary_location = (locations || []).find(l => l.is_primary) || (locations || [])[0] || null;
    }

    res.json({
      business: bizUser,
      profile: profile || null,
      locations: locations || [],
      access: {
        hasAccess: access.hasAccess,
        isOwner: access.isOwner,
        role_base: access.membership?.role_base || null,
      },
    });
  } catch (err) {
    logger.error('Get business error', { error: err.message, businessId: req.params.businessId });
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});


/**
 * GET /:businessId/dashboard — Dashboard aggregate
 */
router.get('/:businessId/dashboard', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access to this business' });
    }

    // Parallel fetch
    const [
      { data: bizUser },
      { data: profile },
      { data: locations },
      { data: teamMembers },
      { data: catalogItems },
      { data: pages },
      profileCompleteness,
    ] = await Promise.all([
      supabaseAdmin.from('User').select('id, username, name, email, profile_picture_url, cover_photo_url, bio, tagline, average_rating, review_count, account_type, gigs_completed, created_at').eq('id', businessId).single(),
      supabaseAdmin.from('BusinessProfile').select('*').eq('business_user_id', businessId).single(),
      supabaseAdmin.from('BusinessLocation').select('*').eq('business_user_id', businessId).eq('is_active', true).order('sort_order'),
      // Firewall-safe: use BusinessSeat (no user data leaked)
      supabaseAdmin.from('BusinessSeat').select(`
        id, display_name, display_avatar_file_id, role_base, contact_method,
        is_active, invite_status, created_at
      `).eq('business_user_id', businessId).eq('is_active', true).order('created_at'),
      supabaseAdmin.from('BusinessCatalogItem').select('id, name, kind, status, is_featured, price_cents, sort_order').eq('business_user_id', businessId).neq('status', 'archived').order('sort_order').limit(50),
      supabaseAdmin.from('BusinessPage').select('id, slug, title, is_default, published_revision, draft_revision').eq('business_user_id', businessId).order('nav_order'),
      calculateProfileCompleteness(businessId),
    ]);

    // Parse PostGIS
    for (const loc of (locations || [])) {
      if (loc.location) loc.location = parsePostGISPoint(loc.location);
    }

    // Check if any location has business hours
    const locationIds = (locations || []).map((l) => l.id);
    let hasHours = false;
    if (locationIds.length > 0) {
      const { count: hoursCount } = await supabaseAdmin
        .from('BusinessHours')
        .select('id', { count: 'exact', head: true })
        .in('location_id', locationIds);
      hasHours = (hoursCount || 0) > 0;
    }

    // Build onboarding checklist
    const checklist = [
      { key: 'account_created', done: true, label: 'Create business account', action: null },
      { key: 'location_added', done: (locations || []).length > 0, label: 'Add a location', action: '/locations' },
      { key: 'hours_set', done: hasHours, label: 'Set business hours', action: '/locations' },
      { key: 'logo_uploaded', done: !!profile?.logo_file_id, label: 'Upload a logo', action: '/profile' },
      { key: 'description_written', done: !!(profile?.description && profile.description.length >= 50), label: 'Write a description (50+ chars)', action: '/profile' },
      { key: 'catalog_item_added', done: (catalogItems || []).length > 0, label: 'Add a service or product', action: '/catalog' },
      { key: 'business_verified', done: !!(profile?.verification_status && profile.verification_status !== 'unverified'), label: 'Verify your business', action: '/settings/verification' },
      { key: 'profile_published', done: profile?.is_published === true, label: 'Publish your profile', action: null },
    ];

    const completedCount = checklist.filter((c) => c.done).length;

    res.json({
      business: bizUser,
      profile,
      locations: locations || [],
      team: teamMembers || [],
      catalog: catalogItems || [],
      pages: pages || [],
      verification_status: profile?.verification_status || 'unverified',
      access: {
        hasAccess: access.hasAccess,
        isOwner: access.isOwner,
        role_base: access.membership?.role_base || null,
      },
      onboarding: {
        checklist,
        completed_count: completedCount,
        total_count: 8,
        profile_completeness: profileCompleteness,
      },
    });
  } catch (err) {
    logger.error('Business dashboard error', { error: err.message, businessId: req.params.businessId });
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});


/**
 * PATCH /:businessId — Update business profile
 */
router.patch('/:businessId', verifyToken, validate(updateBusinessSchema), async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'profile.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit profile' });
    }

    const body = req.body;

    // Separate User-level fields from BusinessProfile fields
    const userFields = {};
    const profileFields = {};

    if (body.name !== undefined) userFields.name = body.name;
    if (body.tagline !== undefined) userFields.tagline = body.tagline;
    if (body.bio !== undefined) userFields.bio = body.bio;

    for (const key of [
      'business_type', 'categories', 'description', 'public_email', 'public_phone',
      'website', 'social_links', 'founded_year', 'employee_count', 'service_area',
      'theme', 'attributes', 'is_published', 'active_from', 'active_until',
    ]) {
      if (body[key] !== undefined) profileFields[key] = body[key];
    }

    // Validate pop-up date range
    if (profileFields.active_from || profileFields.active_until) {
      const from = profileFields.active_from ? new Date(profileFields.active_from) : null;
      const until = profileFields.active_until ? new Date(profileFields.active_until) : null;
      if (from && until) {
        if (until <= from) {
          return res.status(400).json({ error: 'active_until must be after active_from' });
        }
        const maxDuration = 90 * 24 * 60 * 60 * 1000; // 90 days
        if (until.getTime() - from.getTime() > maxDuration) {
          return res.status(400).json({ error: 'Pop-up duration cannot exceed 90 days' });
        }
      }
    }

    // Handle publish timestamp + validation
    if (profileFields.is_published === true) {
      // Check if business is not currently published — validate requirements
      const { data: currentProfile } = await supabaseAdmin
        .from('BusinessProfile')
        .select('is_published, description, categories, business_type, service_area')
        .eq('business_user_id', businessId)
        .single();

      if (currentProfile && !currentProfile.is_published) {
        const entityType = currentProfile.business_type || 'for_profit';
        const requirements = getPublishRequirements(entityType);

        const { data: geoLocations } = await supabaseAdmin
          .from('BusinessLocation')
          .select('id, location')
          .eq('business_user_id', businessId)
          .eq('is_active', true);

        const missing = [];

        for (const req of requirements) {
          switch (req.check) {
            case 'description_length':
              if (!currentProfile.description || currentProfile.description.length < 50) {
                missing.push({ key: req.key, label: req.label });
              }
              break;

            case 'categories_non_empty':
              if (!Array.isArray(currentProfile.categories) || currentProfile.categories.length === 0) {
                missing.push({ key: req.key, label: req.label });
              }
              break;

            case 'geocoded_location':
              if (!(geoLocations || []).some((l) => l.location !== null)) {
                missing.push({ key: req.key, label: req.label });
              }
              break;

            case 'geocoded_location_or_service_area': {
              const hasGeo = (geoLocations || []).some((l) => l.location !== null);
              const sa = currentProfile.service_area;
              const hasServiceArea = sa && typeof sa === 'object' &&
                ((Array.isArray(sa) && sa.length > 0) ||
                 (!Array.isArray(sa) && Object.keys(sa).length > 0));
              if (!hasGeo && !hasServiceArea) {
                missing.push({ key: req.key, label: req.label });
              }
              break;
            }

            case 'catalog_item': {
              const { count: catCount } = await supabaseAdmin
                .from('BusinessCatalogItem')
                .select('id', { count: 'exact', head: true })
                .eq('business_user_id', businessId)
                .eq('status', 'active');
              if ((catCount || 0) === 0) {
                missing.push({ key: req.key, label: req.label });
              }
              break;
            }

            case 'catalog_or_donation_item': {
              const { count: anyCount } = await supabaseAdmin
                .from('BusinessCatalogItem')
                .select('id', { count: 'exact', head: true })
                .eq('business_user_id', businessId)
                .eq('status', 'active');
              if ((anyCount || 0) === 0) {
                missing.push({ key: req.key, label: req.label });
              }
              break;
            }

            case 'future_special_hours': {
              const today = new Date().toISOString().slice(0, 10);
              const locationIds = (geoLocations || []).map(l => l.id);
              let hasFuture = false;
              if (locationIds.length > 0) {
                const { count: shCount } = await supabaseAdmin
                  .from('BusinessSpecialHours')
                  .select('id', { count: 'exact', head: true })
                  .in('location_id', locationIds)
                  .gte('date', today);
                hasFuture = (shCount || 0) > 0;
              }
              if (!hasFuture) {
                missing.push({ key: req.key, label: req.label });
              }
              break;
            }
          }
        }

        if (missing.length > 0) {
          return res.status(400).json({
            error: 'Profile is not ready to publish',
            code: 'PUBLISH_REQUIREMENTS_NOT_MET',
            missing: missing.map(m => m.key),
            missing_details: missing,
            message: 'Please complete: ' + missing.map(m => m.label).join(', '),
          });
        }
      }

      profileFields.published_at = new Date().toISOString();
    }

    // Update User
    if (Object.keys(userFields).length > 0) {
      userFields.updated_at = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from('User')
        .update(userFields)
        .eq('id', businessId);
      if (error) {
        logger.error('Error updating business user', { error: error.message });
        return res.status(500).json({ error: 'Failed to update business' });
      }
    }

    // Update BusinessProfile
    if (Object.keys(profileFields).length > 0) {
      profileFields.updated_at = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from('BusinessProfile')
        .update(profileFields)
        .eq('business_user_id', businessId);
      if (error) {
        logger.error('Error updating business profile', { error: error.message });
        return res.status(500).json({ error: 'Failed to update profile' });
      }
    }

    // If business_type changed, apply entity-type side effects (fee override, nonprofit flags)
    if (profileFields.business_type) {
      applyEntityTypeSideEffects(businessId, profileFields.business_type, {
        actorUserId: userId,
        isTypeChange: true,
      }).catch((err) => {
        logger.error('Post-update entity type side effects failed', { businessId, error: err.message });
      });
    }

    await writeAuditLog(businessId, userId, 'update_profile', 'BusinessProfile', businessId, {
      fields: [...Object.keys(userFields), ...Object.keys(profileFields)],
    });

    // Recalculate profile completeness after profile mutation
    calculateAndStoreCompleteness(businessId).catch((err) => {
      logger.error('Post-update completeness calculation failed', { businessId, error: err.message });
    });

    // Fire neighborhood signal on first publish (non-blocking)
    if (profileFields.published_at) {
      generateNewBusinessSignal(businessId).catch((err) => {
        logger.error('Post-publish signal generation failed', { businessId, error: err.message });
      });
    }

    res.json({ message: 'Business updated' });
  } catch (err) {
    logger.error('Update business error', { error: err.message });
    res.status(500).json({ error: 'Failed to update business' });
  }
});

/**
 * POST /:businessId/publish — Publish business profile
 */
router.post('/:businessId/publish', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'profile.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to publish profile' });
    }

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('BusinessProfile')
      .update({
        is_published: true,
        published_at: now,
        updated_at: now,
      })
      .eq('business_user_id', businessId);

    if (error) {
      logger.error('Publish business error', { error: error.message, businessId, userId });
      return res.status(500).json({ error: 'Failed to publish business profile' });
    }

    await writeAuditLog(businessId, userId, 'publish', 'BusinessProfile', businessId, {});

    // Fire neighborhood signal on publish (non-blocking, idempotent)
    generateNewBusinessSignal(businessId).catch((err) => {
      logger.error('Post-publish signal generation failed', { businessId, error: err.message });
    });

    res.json({ message: 'Business profile published' });
  } catch (err) {
    logger.error('Publish business exception', { error: err.message, businessId: req.params.businessId });
    res.status(500).json({ error: 'Failed to publish business profile' });
  }
});

/**
 * POST /:businessId/unpublish — Unpublish business profile
 */
router.post('/:businessId/unpublish', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'profile.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to unpublish profile' });
    }

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('BusinessProfile')
      .update({
        is_published: false,
        updated_at: now,
      })
      .eq('business_user_id', businessId);

    if (error) {
      logger.error('Unpublish business error', { error: error.message, businessId, userId });
      return res.status(500).json({ error: 'Failed to unpublish business profile' });
    }

    await writeAuditLog(businessId, userId, 'unpublish', 'BusinessProfile', businessId, {});
    res.json({ message: 'Business profile unpublished' });
  } catch (err) {
    logger.error('Unpublish business exception', { error: err.message, businessId: req.params.businessId });
    res.status(500).json({ error: 'Failed to unpublish business profile' });
  }
});


/**
 * DELETE /:businessId — Delete business (owner only)
 */
router.delete('/:businessId', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId);
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only the owner can delete a business' });
    }

    // Soft-delete: unpublish + deactivate seats and team
    await supabaseAdmin
      .from('BusinessProfile')
      .update({ is_published: false, updated_at: new Date().toISOString() })
      .eq('business_user_id', businessId);

    // Deactivate all seats
    await supabaseAdmin
      .from('BusinessSeat')
      .update({ is_active: false, deactivated_at: new Date().toISOString(), deactivated_reason: 'Business deleted' })
      .eq('business_user_id', businessId);

    // Remove all seat bindings for this business
    const { data: seats } = await supabaseAdmin
      .from('BusinessSeat')
      .select('id')
      .eq('business_user_id', businessId);
    if (seats && seats.length > 0) {
      await supabaseAdmin
        .from('SeatBinding')
        .delete()
        .in('seat_id', seats.map(s => s.id));
    }

    // Dual-write: also deactivate legacy BusinessTeam
    await supabaseAdmin
      .from('BusinessTeam')
      .update({ is_active: false, left_at: new Date().toISOString() })
      .eq('business_user_id', businessId);

    // Mark the User row as deleted (soft)
    await supabaseAdmin
      .from('User')
      .update({ account_type: 'individual', updated_at: new Date().toISOString() })
      .eq('id', businessId);

    await writeAuditLog(businessId, userId, 'delete_business', 'User', businessId, {});

    res.json({ message: 'Business deleted' });
  } catch (err) {
    logger.error('Delete business error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete business' });
  }
});


// ================================================================
//  LOCATIONS
// ================================================================

/**
 * POST /:businessId/validate-address — Validate a business address
 *
 * Runs the address through the Decision Engine pipeline without creating a
 * location. Returns the verdict so the frontend can route to the correct UI
 * (suite prompt, CMRA warning, conflict resolution, etc.).
 */
router.post('/:businessId/validate-address', verifyToken, addressValidationLimiter, validate(validateAddressSchema), async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'locations.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to manage locations' });
    }

    // Manual entry bypass — skip pipeline, return ok with manual_entry flag
    if (req.body.force_manual) {
      const manualVerdict = {
        canonical_address_id: null,
        normalized: {
          line1: req.body.address,
          line2: req.body.address2 || '',
          city: req.body.city,
          state: req.body.state || '',
          zip: req.body.zipcode || '',
          plus4: '',
        },
        coordinates: null,
        decision: {
          status: 'ok',
          business_location_type: 'unknown',
          capabilities: { map_pin: false, show_in_nearby: false, receive_mail: true, enable_payouts: false },
          required_verification: ['photo_verification'],
          manual_entry: true,
        },
        reasons: ['MANUAL_ENTRY'],
      };
      return res.json({ verdict: manualVerdict });
    }

    const verdict = await validateBusinessAddress({
      address: req.body.address,
      address2: req.body.address2 || '',
      city: req.body.city,
      state: req.body.state || '',
      zipcode: req.body.zipcode || '',
      country: req.body.country || 'US',
      place_id: req.body.place_id || null,
      location_intent: req.body.location_intent || null,
      business_user_id: businessId,
    });

    // Strip raw validation data — never expose to client
    delete verdict.raw_validation_response;

    res.json({ verdict });
  } catch (err) {
    logger.error('Validate address error', { error: err.message });
    res.status(500).json({ error: 'Failed to validate address' });
  }
});

/**
 * POST /:businessId/locations — Create a new business location
 *
 * Enhanced with the Business Address Decision Engine. Runs the address through
 * validation before persisting and stores decision metadata on the location.
 * Backward-compatible: existing clients that omit new fields still work.
 */
router.post('/:businessId/locations', verifyToken, validate(createLocationSchema), async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'locations.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to manage locations' });
    }

    const body = req.body;

    // ── Run Decision Engine ──────────────────────────────────
    const verdict = await validateBusinessAddress({
      address: body.address,
      address2: body.address2 || '',
      city: body.city,
      state: body.state || '',
      zipcode: body.zipcode || '',
      country: body.country || 'US',
      place_id: body.place_id || null,
      location_intent: body.location_intent || null,
      business_user_id: businessId,
    });

    const status = verdict.decision.status;

    // Block on hard failures
    if (['need_suite', 'undeliverable', 'service_error'].includes(status)) {
      return res.status(422).json({
        error: `Address validation failed: ${status}`,
        verdict: stripRawData(verdict),
      });
    }

    // Block CMRA/PO Box unless explicitly mailing_only (which should use /mailing-address)
    if (['cmra_detected', 'po_box'].includes(status)) {
      return res.status(422).json({
        error: `Address detected as ${status === 'cmra_detected' ? 'CMRA/virtual mailbox' : 'PO Box'}. Use the mailing address endpoint instead.`,
        verdict: stripRawData(verdict),
      });
    }

    // Block on conflicts
    if (status === 'conflict') {
      return res.status(409).json({
        error: 'This location is already claimed by another business',
        verdict: stripRawData(verdict),
      });
    }

    // Passthrough statuses: ok, mixed_use, high_risk, place_mismatch, low_confidence, multiple_matches
    // These allow creation but store the decision metadata for review.

    // ── Build location row ───────────────────────────────────
    const locationData = {
      business_user_id: businessId,
      label: body.label || 'Main',
      is_primary: body.is_primary || false,
      address: body.address,
      address2: body.address2 || null,
      city: body.city,
      state: body.state || null,
      zipcode: body.zipcode || null,
      country: body.country || 'US',
      timezone: body.timezone || null,
      phone: body.phone || null,
      email: body.email || null,
      // Decision engine fields
      address_id: verdict.canonical_address_id || null,
      address_hash: computeAddressHash(
        body.address, body.address2 || '', body.city,
        body.state || '', body.zipcode || '', body.country || 'US',
      ),
      location_type: verdict.decision.business_location_type || body.location_type || 'unknown',
      is_customer_facing: body.is_customer_facing ?? (verdict.decision.business_location_type === 'storefront'),
      decision_status: status,
      decision_reasons: verdict.decision.reasons || [],
      capabilities: verdict.decision.allowed_capabilities || { map_pin: false, show_in_nearby: false, receive_mail: true, enable_payouts: false },
      required_verification: verdict.decision.required_verification || [],
      location_verification_tier: status === 'ok' ? 'bl1_deliverable' : 'bl0_none',
      service_area: body.service_area || null,
    };

    // Use coordinates from decision engine, or fall back to client-provided / geocoded
    let resolvedProvider = body.geocode_provider || 'mapbox';
    let resolvedAccuracy = body.geocode_accuracy || 'address';
    if (verdict.coordinates) {
      locationData.location = formatLocationForDB(verdict.coordinates.lat, verdict.coordinates.lng);
      resolvedProvider = verdict.validation_provider || 'google_validation';
      resolvedAccuracy = verdict.geocode_accuracy || 'rooftop';
    } else if (body.latitude != null && body.longitude != null) {
      locationData.location = formatLocationForDB(body.latitude, body.longitude);
    } else {
      const geo = await geocodeAddress(body.address, body.city, body.state, body.zipcode, body.country);
      if (geo) {
        locationData.location = formatLocationForDB(geo.latitude, geo.longitude);
        resolvedProvider = 'mapbox';
        resolvedAccuracy = 'address';
        logger.info('Server-side geocoding succeeded for new location', { businessId, lat: geo.latitude, lon: geo.longitude });
      } else {
        logger.warn('Geocoding returned no result — location will be invisible in map discovery', { businessId, address: body.address, city: body.city });
      }
    }

    // Geocode provenance
    locationData.geocode_provider = resolvedProvider;
    locationData.geocode_mode = 'permanent';
    locationData.geocode_accuracy = resolvedAccuracy;
    locationData.geocode_place_id = body.geocode_place_id || null;
    locationData.geocode_source_flow = 'business_onboarding';
    locationData.geocode_created_at = new Date().toISOString();

    // If marking as primary, unset any existing primary
    if (locationData.is_primary) {
      await supabaseAdmin
        .from('BusinessLocation')
        .update({ is_primary: false })
        .eq('business_user_id', businessId)
        .eq('is_primary', true);
    }

    const { data: location, error } = await supabaseAdmin
      .from('BusinessLocation')
      .insert(locationData)
      .select()
      .single();

    if (error) {
      logger.error('Error creating location', { error: error.message });
      return res.status(500).json({ error: 'Failed to create location' });
    }

    // Generate fuzzy display_location for home_based_private (non-blocking)
    if (locationData.location_type === 'home_based_private' && locationData.location) {
      try {
        const parsed = parsePostGISPoint(locationData.location);
        if (parsed && parsed.latitude && parsed.longitude) {
          const { generateFuzzyCoordinates } = require('../utils/fuzzyCoordinates');
          const fuzzy = generateFuzzyCoordinates(parsed.latitude, parsed.longitude);
          await supabaseAdmin
            .from('BusinessLocation')
            .update({ display_location: formatLocationForDB(fuzzy.lat, fuzzy.lng) })
            .eq('id', location.id);
        }
      } catch (fuzzyErr) {
        logger.error('Failed to generate fuzzy coordinates', { error: fuzzyErr.message, locationId: location.id });
      }
    }

    // Set as primary_location_id on profile if first location
    const { data: existingLocs } = await supabaseAdmin
      .from('BusinessLocation')
      .select('id')
      .eq('business_user_id', businessId)
      .eq('is_active', true);

    if ((existingLocs || []).length === 1) {
      await supabaseAdmin
        .from('BusinessProfile')
        .update({ primary_location_id: location.id })
        .eq('business_user_id', businessId);
    }

    if (location.location) {
      location.location = parsePostGISPoint(location.location);
    }

    await writeAuditLog(businessId, userId, 'create_location', 'BusinessLocation', location.id, { label: body.label });

    // Recalculate profile completeness after location mutation
    calculateAndStoreCompleteness(businessId).catch((err) => {
      logger.error('Post-location-create completeness calculation failed', { businessId, error: err.message });
    });

    res.status(201).json({ location, verdict: stripRawData(verdict) });
  } catch (err) {
    logger.error('Create location error', { error: err.message });
    res.status(500).json({ error: 'Failed to create location' });
  }
});


router.get('/:businessId/locations', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'locations.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access' });
    }

    const { data: locations, error } = await supabaseAdmin
      .from('BusinessLocation')
      .select('*')
      .eq('business_user_id', businessId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      logger.error('Error fetching locations', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch locations' });
    }

    for (const loc of (locations || [])) {
      if (loc.location) loc.location = parsePostGISPoint(loc.location);
    }

    res.json({ locations: locations || [] });
  } catch (err) {
    logger.error('Get locations error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});


router.patch('/:businessId/locations/:locationId', verifyToken, validate(updateLocationSchema), async (req, res) => {
  try {
    const { businessId, locationId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'locations.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit locations' });
    }

    const body = req.body;
    const updateData = { ...body, updated_at: new Date().toISOString() };

    // Fetch existing geocode_mode to guard verified coordinates
    const { data: existingLoc } = await supabaseAdmin
      .from('BusinessLocation')
      .select('geocode_mode')
      .eq('id', locationId)
      .eq('business_user_id', businessId)
      .single();

    let locationChanging = false;

    // Handle coordinates
    if (body.latitude != null && body.longitude != null) {
      const incomingMode = body.geocode_mode || 'permanent';
      const block = shouldBlockCoordinateOverwrite(existingLoc, { geocode_mode: incomingMode }, 'PATCH /api/businesses/:id/locations/:locationId');
      if (!block.blocked) {
        updateData.location = formatLocationForDB(body.latitude, body.longitude);
        updateData.geocode_provider = body.geocode_provider || 'mapbox';
        updateData.geocode_accuracy = body.geocode_accuracy || 'address';
        locationChanging = true;
      } else {
        logger.warn('BusinessLocation coordinate overwrite blocked', { businessId, locationId, reason: block.reason });
      }
      delete updateData.latitude;
      delete updateData.longitude;
    } else if (body.address || body.city || body.state || body.zipcode) {
      // Address fields changed but no explicit coordinates — geocode server-side
      const block = shouldBlockCoordinateOverwrite(existingLoc, { geocode_mode: 'permanent' }, 'PATCH /api/businesses/:id/locations/:locationId (geocode)');
      if (!block.blocked) {
        const geo = await geocodeAddress(
          body.address || undefined,
          body.city || undefined,
          body.state || undefined,
          body.zipcode || undefined,
          body.country || undefined
        );
        if (geo) {
          updateData.location = formatLocationForDB(geo.latitude, geo.longitude);
          updateData.geocode_provider = 'mapbox';
          updateData.geocode_accuracy = 'address';
          locationChanging = true;
          logger.info('Server-side geocoding succeeded for location update', { businessId, locationId, lat: geo.latitude, lon: geo.longitude });
        } else {
          logger.warn('Geocoding returned no result on location update', { businessId, locationId });
        }
      } else {
        logger.warn('BusinessLocation geocode overwrite blocked (verified)', { businessId, locationId });
      }
    }

    // Geocode provenance (update when location changes)
    if (locationChanging) {
      updateData.geocode_mode = 'permanent';
      updateData.geocode_place_id = body.geocode_place_id || null;
      updateData.geocode_source_flow = 'business_location_edit';
      updateData.geocode_created_at = new Date().toISOString();
    }

    // Handle primary flag
    if (updateData.is_primary) {
      await supabaseAdmin
        .from('BusinessLocation')
        .update({ is_primary: false })
        .eq('business_user_id', businessId)
        .eq('is_primary', true);
    }

    const { data: location, error } = await supabaseAdmin
      .from('BusinessLocation')
      .update(updateData)
      .eq('id', locationId)
      .eq('business_user_id', businessId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating location', { error: error.message });
      return res.status(500).json({ error: 'Failed to update location' });
    }

    // Regenerate fuzzy display_location when coordinates change for home_based_private
    if (locationChanging && location?.location_type === 'home_based_private' && !location?.show_exact_location) {
      try {
        const coords = parsePostGISPoint(location.location);
        if (coords && coords.latitude && coords.longitude) {
          const { generateFuzzyCoordinates } = require('../utils/fuzzyCoordinates');
          const fuzzy = generateFuzzyCoordinates(coords.latitude, coords.longitude);
          await supabaseAdmin
            .from('BusinessLocation')
            .update({ display_location: formatLocationForDB(fuzzy.lat, fuzzy.lng) })
            .eq('id', locationId);
        }
      } catch (fuzzyErr) {
        logger.error('Failed to regenerate fuzzy coordinates', { error: fuzzyErr.message, locationId });
      }
    }

    if (location?.location) {
      location.location = parsePostGISPoint(location.location);
    }

    // Recalculate profile completeness after location mutation
    calculateAndStoreCompleteness(businessId).catch((err) => {
      logger.error('Post-location-update completeness calculation failed', { businessId, error: err.message });
    });

    res.json({ location });
  } catch (err) {
    logger.error('Update location error', { error: err.message });
    res.status(500).json({ error: 'Failed to update location' });
  }
});


router.delete('/:businessId/locations/:locationId', verifyToken, async (req, res) => {
  try {
    const { businessId, locationId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'locations.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to manage locations' });
    }

    // Soft-delete
    const { error } = await supabaseAdmin
      .from('BusinessLocation')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', locationId)
      .eq('business_user_id', businessId);

    if (error) {
      logger.error('Error deleting location', { error: error.message });
      return res.status(500).json({ error: 'Failed to delete location' });
    }

    await writeAuditLog(businessId, userId, 'delete_location', 'BusinessLocation', locationId, {});
    res.json({ message: 'Location deleted' });
  } catch (err) {
    logger.error('Delete location error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete location' });
  }
});


/**
 * POST /:businessId/mailing-address — Set or replace the business mailing address
 *
 * Runs the Decision Engine for CMRA/PO Box detection (informational — does not
 * block creation). Stores the result in BusinessMailingAddress and links it
 * to BusinessProfile.
 */
router.post('/:businessId/mailing-address', verifyToken, validate(createMailingAddressSchema), async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'locations.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to manage locations' });
    }

    const body = req.body;

    // Run decision engine for CMRA/PO Box detection (informational only)
    const verdict = await validateBusinessAddress({
      address: body.address,
      address2: body.address2 || '',
      city: body.city,
      state: body.state,
      zipcode: body.zipcode,
      country: body.country || 'US',
      place_id: null,
      location_intent: 'MAILING_ONLY',
      business_user_id: businessId,
    });

    const mailingData = {
      business_user_id: businessId,
      address_id: verdict.canonical_address_id || null,
      address_line1: body.address,
      address_line2: body.address2 || '',
      city: body.city,
      state: body.state,
      postal_code: body.zipcode,
      country: body.country || 'US',
      is_cmra: verdict.decision.reasons.includes('CMRA_FLAG'),
      is_po_box: verdict.decision.reasons.includes('PO_BOX'),
      is_primary: true,
    };

    // Deactivate any existing primary mailing address for this business
    await supabaseAdmin
      .from('BusinessMailingAddress')
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq('business_user_id', businessId)
      .eq('is_primary', true);

    const { data: mailingAddress, error } = await supabaseAdmin
      .from('BusinessMailingAddress')
      .insert(mailingData)
      .select()
      .single();

    if (error) {
      logger.error('Error creating mailing address', { error: error.message });
      return res.status(500).json({ error: 'Failed to create mailing address' });
    }

    // Link to BusinessProfile
    await supabaseAdmin
      .from('BusinessProfile')
      .update({ mailing_address_id: mailingAddress.id, updated_at: new Date().toISOString() })
      .eq('business_user_id', businessId);

    await writeAuditLog(businessId, userId, 'create_mailing_address', 'BusinessMailingAddress', mailingAddress.id, {
      is_cmra: mailingData.is_cmra,
      is_po_box: mailingData.is_po_box,
    });

    res.status(201).json({ mailing_address: mailingAddress });
  } catch (err) {
    logger.error('Create mailing address error', { error: err.message });
    res.status(500).json({ error: 'Failed to create mailing address' });
  }
});


// ================================================================
//  HOURS
// ================================================================

/**
 * PUT /:businessId/locations/:locationId/hours — Bulk set weekly hours
 */
router.put('/:businessId/locations/:locationId/hours', verifyToken, validate(weeklyHoursSchema), async (req, res) => {
  try {
    const { businessId, locationId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'hours.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit hours' });
    }

    // Verify location belongs to business
    const { data: loc } = await supabaseAdmin
      .from('BusinessLocation')
      .select('id')
      .eq('id', locationId)
      .eq('business_user_id', businessId)
      .single();

    if (!loc) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Delete existing hours for this location
    await supabaseAdmin
      .from('BusinessHours')
      .delete()
      .eq('location_id', locationId);

    // Insert new hours
    const hoursRows = req.body.hours.map(h => ({
      location_id: locationId,
      day_of_week: h.day_of_week,
      open_time: h.is_closed ? null : h.open_time,
      close_time: h.is_closed ? null : h.close_time,
      is_closed: h.is_closed,
      notes: h.notes || null,
    }));

    const { data: hours, error } = await supabaseAdmin
      .from('BusinessHours')
      .insert(hoursRows)
      .select();

    if (error) {
      logger.error('Error saving hours', { error: error.message });
      return res.status(500).json({ error: 'Failed to save hours' });
    }

    // Recalculate profile completeness after hours mutation
    calculateAndStoreCompleteness(businessId).catch((err) => {
      logger.error('Post-hours-update completeness calculation failed', { businessId, error: err.message });
    });

    res.json({ hours: hours || [] });
  } catch (err) {
    logger.error('Set hours error', { error: err.message });
    res.status(500).json({ error: 'Failed to save hours' });
  }
});


router.get('/:businessId/locations/:locationId/hours', verifyToken, async (req, res) => {
  try {
    const { businessId, locationId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'hours.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access' });
    }

    const { data: hours, error } = await supabaseAdmin
      .from('BusinessHours')
      .select('*')
      .eq('location_id', locationId)
      .order('day_of_week');

    if (error) {
      logger.error('Error fetching hours', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch hours' });
    }

    res.json({ hours: hours || [] });
  } catch (err) {
    logger.error('Get hours error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch hours' });
  }
});


router.post('/:businessId/locations/:locationId/special-hours', verifyToken, validate(specialHoursSchema), async (req, res) => {
  try {
    const { businessId, locationId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'hours.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit hours' });
    }

    const body = req.body;
    const { data: specialHour, error } = await supabaseAdmin
      .from('BusinessSpecialHours')
      .insert({
        location_id: locationId,
        date: body.date,
        label: body.label || null,
        open_time: body.is_closed ? null : body.open_time,
        close_time: body.is_closed ? null : body.close_time,
        is_closed: body.is_closed,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating special hours', { error: error.message });
      return res.status(500).json({ error: 'Failed to create special hours' });
    }

    res.status(201).json({ specialHour });
  } catch (err) {
    logger.error('Create special hours error', { error: err.message });
    res.status(500).json({ error: 'Failed to create special hours' });
  }
});


router.get('/:businessId/locations/:locationId/special-hours', verifyToken, async (req, res) => {
  try {
    const { businessId, locationId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'hours.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access' });
    }

    const { data: specialHours, error } = await supabaseAdmin
      .from('BusinessSpecialHours')
      .select('*')
      .eq('location_id', locationId)
      .order('date');

    if (error) {
      logger.error('Error fetching special hours', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch special hours' });
    }

    res.json({ specialHours: specialHours || [] });
  } catch (err) {
    logger.error('Get special hours error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch special hours' });
  }
});


router.delete('/:businessId/locations/:locationId/special-hours/:shId', verifyToken, async (req, res) => {
  try {
    const { businessId, locationId, shId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'hours.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit hours' });
    }

    const { error } = await supabaseAdmin
      .from('BusinessSpecialHours')
      .delete()
      .eq('id', shId)
      .eq('location_id', locationId);

    if (error) {
      logger.error('Error deleting special hours', { error: error.message });
      return res.status(500).json({ error: 'Failed to delete special hours' });
    }

    res.json({ message: 'Special hours deleted' });
  } catch (err) {
    logger.error('Delete special hours error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete special hours' });
  }
});


// ================================================================
//  CATALOG
// ================================================================

// --- Categories ---

router.post('/:businessId/catalog/categories', verifyToken, validate(createCategorySchema), async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'catalog.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to manage catalog' });
    }

    const { data: category, error } = await supabaseAdmin
      .from('BusinessCatalogCategory')
      .insert({
        business_user_id: businessId,
        ...req.body,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating catalog category', { error: error.message });
      return res.status(500).json({ error: 'Failed to create category' });
    }

    res.status(201).json({ category });
  } catch (err) {
    logger.error('Create category error', { error: err.message });
    res.status(500).json({ error: 'Failed to create category' });
  }
});


router.get('/:businessId/catalog/categories', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'catalog.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access' });
    }

    const { data: categories, error } = await supabaseAdmin
      .from('BusinessCatalogCategory')
      .select('*')
      .eq('business_user_id', businessId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      logger.error('Error fetching categories', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }

    res.json({ categories: categories || [] });
  } catch (err) {
    logger.error('Get categories error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});


router.patch('/:businessId/catalog/categories/:catId', verifyToken, async (req, res) => {
  try {
    const { businessId, catId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'catalog.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to manage catalog' });
    }

    const { data: category, error } = await supabaseAdmin
      .from('BusinessCatalogCategory')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', catId)
      .eq('business_user_id', businessId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating category', { error: error.message });
      return res.status(500).json({ error: 'Failed to update category' });
    }

    res.json({ category });
  } catch (err) {
    logger.error('Update category error', { error: err.message });
    res.status(500).json({ error: 'Failed to update category' });
  }
});


router.delete('/:businessId/catalog/categories/:catId', verifyToken, async (req, res) => {
  try {
    const { businessId, catId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'catalog.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to manage catalog' });
    }

    // Soft-delete
    const { error } = await supabaseAdmin
      .from('BusinessCatalogCategory')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', catId)
      .eq('business_user_id', businessId);

    if (error) {
      logger.error('Error deleting category', { error: error.message });
      return res.status(500).json({ error: 'Failed to delete category' });
    }

    res.json({ message: 'Category deleted' });
  } catch (err) {
    logger.error('Delete category error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// --- Items ---

router.post('/:businessId/catalog/items', verifyToken, validate(createCatalogItemSchema), async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'catalog.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit catalog' });
    }

    // Donation items must use open-amount or suggested amounts — no fixed price
    if (req.body.kind === 'donation' && req.body.price_cents != null) {
      return res.status(400).json({
        error: 'Donation items cannot have a fixed price. Use suggested_amounts for preset options or leave blank for open-amount.',
        code: 'DONATION_NO_FIXED_PRICE',
      });
    }

    const { data: item, error } = await supabaseAdmin
      .from('BusinessCatalogItem')
      .insert({
        business_user_id: businessId,
        ...req.body,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating catalog item', { error: error.message });
      return res.status(500).json({ error: 'Failed to create item' });
    }

    await writeAuditLog(businessId, userId, 'create_catalog_item', 'BusinessCatalogItem', item.id, { name: req.body.name });

    // Recalculate profile completeness after catalog mutation
    calculateAndStoreCompleteness(businessId).catch((err) => {
      logger.error('Post-catalog-create completeness calculation failed', { businessId, error: err.message });
    });

    res.status(201).json({ item });
  } catch (err) {
    logger.error('Create catalog item error', { error: err.message });
    res.status(500).json({ error: 'Failed to create item' });
  }
});


router.get('/:businessId/catalog/items', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'catalog.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access' });
    }

    const { kind, category_id, status, is_featured, limit = 100, offset = 0 } = req.query;

    let query = supabaseAdmin
      .from('BusinessCatalogItem')
      .select('*, category:category_id (id, name, slug)')
      .eq('business_user_id', businessId)
      .order('sort_order')
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (kind) query = query.eq('kind', kind);
    if (category_id) query = query.eq('category_id', category_id);
    if (status) query = query.eq('status', status);
    if (is_featured === 'true') query = query.eq('is_featured', true);

    const { data: items, error } = await query;

    if (error) {
      logger.error('Error fetching catalog items', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch items' });
    }

    res.json({ items: items || [] });
  } catch (err) {
    logger.error('Get catalog items error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});


router.patch('/:businessId/catalog/items/:itemId', verifyToken, validate(updateCatalogItemSchema), async (req, res) => {
  try {
    const { businessId, itemId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'catalog.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit catalog' });
    }

    // Donation items must use open-amount or suggested amounts — no fixed price
    if (req.body.kind === 'donation' && req.body.price_cents != null) {
      return res.status(400).json({
        error: 'Donation items cannot have a fixed price. Use suggested_amounts for preset options or leave blank for open-amount.',
        code: 'DONATION_NO_FIXED_PRICE',
      });
    }

    const { data: item, error } = await supabaseAdmin
      .from('BusinessCatalogItem')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('business_user_id', businessId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating catalog item', { error: error.message });
      return res.status(500).json({ error: 'Failed to update item' });
    }

    // Recalculate profile completeness after catalog mutation
    calculateAndStoreCompleteness(businessId).catch((err) => {
      logger.error('Post-catalog-update completeness calculation failed', { businessId, error: err.message });
    });

    res.json({ item });
  } catch (err) {
    logger.error('Update catalog item error', { error: err.message });
    res.status(500).json({ error: 'Failed to update item' });
  }
});


router.delete('/:businessId/catalog/items/:itemId', verifyToken, async (req, res) => {
  try {
    const { businessId, itemId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'catalog.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to manage catalog' });
    }

    // Soft-delete (archive)
    const { error } = await supabaseAdmin
      .from('BusinessCatalogItem')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('business_user_id', businessId);

    if (error) {
      logger.error('Error deleting catalog item', { error: error.message });
      return res.status(500).json({ error: 'Failed to delete item' });
    }

    await writeAuditLog(businessId, userId, 'delete_catalog_item', 'BusinessCatalogItem', itemId, {});
    res.json({ message: 'Item archived' });
  } catch (err) {
    logger.error('Delete catalog item error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete item' });
  }
});


/**
 * POST /:businessId/catalog/items/reorder — Bulk update sort_order
 * Body: { items: [{ id, sort_order }] }
 */
router.post('/:businessId/catalog/items/reorder', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const access = await checkBusinessPermission(businessId, userId, 'catalog.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit catalog' });
    }

    // Update each item's sort_order
    const updates = items.map(({ id, sort_order }) =>
      supabaseAdmin
        .from('BusinessCatalogItem')
        .update({ sort_order, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('business_user_id', businessId)
    );

    await Promise.all(updates);

    await writeAuditLog(businessId, userId, 'reorder_catalog', 'BusinessCatalogItem', null, {
      count: items.length,
    });

    res.json({ message: 'Reorder saved', count: items.length });
  } catch (err) {
    logger.error('Reorder catalog items error', { error: err.message });
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});


/**
 * POST /:businessId/catalog/:itemId/donate — Create a donation payment intent
 * Body: { amount_cents: number, donor_user_id?: string }
 */
const donateSchema = Joi.object({
  amount_cents: Joi.number().integer().min(100).required()
    .messages({ 'number.min': 'Minimum donation is $1.00' }),
  donor_user_id: Joi.string().uuid().optional(),
});

router.post('/:businessId/catalog/:itemId/donate', verifyToken, validate(donateSchema), async (req, res) => {
  try {
    const { businessId, itemId } = req.params;
    const userId = req.user.id;
    const { amount_cents, donor_user_id } = req.body;

    // Fetch catalog item and confirm it's a donation kind
    const { data: item, error: itemErr } = await supabaseAdmin
      .from('BusinessCatalogItem')
      .select('id, kind, name, tax_deductible, suggested_amounts, business_user_id')
      .eq('id', itemId)
      .eq('business_user_id', businessId)
      .eq('status', 'active')
      .maybeSingle();

    if (itemErr || !item) {
      return res.status(404).json({ error: 'Catalog item not found', code: 'ITEM_NOT_FOUND' });
    }
    if (item.kind !== 'donation') {
      return res.status(400).json({ error: 'This item is not a donation. Use /purchase instead.', code: 'NOT_DONATION' });
    }

    // Get effective fee rate and calculate fees
    const feeRate = await stripeService.getEffectiveFeeRate(businessId);
    const fees = stripeService.calculateFees(amount_cents, feeRate);

    // Create payment intent
    const result = await stripeService.createPaymentIntentForGig({
      payerId: donor_user_id || userId,
      payeeId: businessId,
      gigId: null,
      amount: amount_cents,
      metadata: {
        type: 'catalog_donation',
        catalog_item_id: itemId,
        catalog_item_name: item.name,
        tax_deductible: String(!!item.tax_deductible),
      },
    });

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to create payment', code: 'PAYMENT_FAILED' });
    }

    res.status(201).json({
      client_secret: result.clientSecret,
      payment_intent_id: result.paymentIntentId,
      payment_id: result.paymentId,
      amount_cents,
      fee_cents: fees.platformFee,
      net_to_business: fees.amountToPayee,
      tax_deductible: !!item.tax_deductible,
      item_name: item.name,
    });
  } catch (err) {
    logger.error('Donate endpoint error', { error: err.message });
    res.status(500).json({ error: 'Failed to process donation', code: 'INTERNAL_ERROR' });
  }
});


/**
 * POST /:businessId/catalog/:itemId/purchase — Create a payment intent for a fixed-price catalog item
 * Body: { payment_method_id?: string }
 */
const purchaseSchema = Joi.object({
  payment_method_id: Joi.string().optional(),
});

router.post('/:businessId/catalog/:itemId/purchase', verifyToken, validate(purchaseSchema), async (req, res) => {
  try {
    const { businessId, itemId } = req.params;
    const userId = req.user.id;
    const { payment_method_id } = req.body;

    // Fetch catalog item
    const { data: item, error: itemErr } = await supabaseAdmin
      .from('BusinessCatalogItem')
      .select('id, kind, name, price_cents, tax_deductible, business_user_id')
      .eq('id', itemId)
      .eq('business_user_id', businessId)
      .eq('status', 'active')
      .maybeSingle();

    if (itemErr || !item) {
      return res.status(404).json({ error: 'Catalog item not found', code: 'ITEM_NOT_FOUND' });
    }
    if (item.kind === 'donation') {
      return res.status(400).json({ error: 'Donation items must use the /donate endpoint.', code: 'USE_DONATE_ENDPOINT' });
    }
    if (item.price_cents == null || item.price_cents <= 0) {
      return res.status(400).json({ error: 'Item has no fixed price set.', code: 'NO_PRICE' });
    }

    const feeRate = await stripeService.getEffectiveFeeRate(businessId);
    const fees = stripeService.calculateFees(item.price_cents, feeRate);

    const result = await stripeService.createPaymentIntentForGig({
      payerId: userId,
      payeeId: businessId,
      gigId: null,
      amount: item.price_cents,
      paymentMethodId: payment_method_id || undefined,
      metadata: {
        type: 'catalog_purchase',
        catalog_item_id: itemId,
        catalog_item_name: item.name,
      },
    });

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to create payment', code: 'PAYMENT_FAILED' });
    }

    res.status(201).json({
      client_secret: result.clientSecret,
      payment_intent_id: result.paymentIntentId,
      payment_id: result.paymentId,
      amount_cents: item.price_cents,
      fee_cents: fees.platformFee,
      net_to_business: fees.amountToPayee,
      item_name: item.name,
    });
  } catch (err) {
    logger.error('Purchase endpoint error', { error: err.message });
    res.status(500).json({ error: 'Failed to process purchase', code: 'INTERNAL_ERROR' });
  }
});


/**
 * POST /:businessId/catalog/:itemId/request — Create a booking request (gig) from a catalog item
 */
router.post('/:businessId/catalog/:itemId/request', verifyToken, async (req, res) => {
  try {
    const { businessId, itemId } = req.params;
    const actorUserId = req.user.id;

    // Fetch catalog item
    const { data: item, error: itemErr } = await supabaseAdmin
      .from('BusinessCatalogItem')
      .select('id, name, description, kind, price_cents, price_unit, status')
      .eq('id', itemId)
      .eq('business_user_id', businessId)
      .eq('status', 'active')
      .single();

    if (itemErr || !item) {
      return res.status(404).json({ error: 'Catalog item not found' });
    }

    if (!['service', 'class'].includes(item.kind)) {
      return res.status(400).json({ error: 'Only service and class items support booking requests' });
    }

    // Get business name
    const { data: bizUser } = await supabaseAdmin
      .from('User')
      .select('name')
      .eq('id', businessId)
      .single();

    // Get avg response time
    const { data: profile } = await supabaseAdmin
      .from('BusinessProfile')
      .select('avg_response_minutes')
      .eq('business_user_id', businessId)
      .single();

    // Persist the booking request. item_name / price_cents are frozen on the
    // row so the booking stays self-describing if the catalog item changes.
    const bookingData = {
      business_user_id: businessId,
      requester_id: actorUserId,
      catalog_item_id: itemId,
      item_name: item.name,
      price_cents: item.price_cents ?? null,
      note: typeof req.body?.note === 'string' ? req.body.note.slice(0, 1000) : null,
      status: 'pending',
    };

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('BusinessBooking')
      .insert(bookingData)
      .select('id')
      .single();

    if (bookingErr) {
      logger.error('Failed to create booking', { error: bookingErr.message, businessId, itemId });
      return res.status(500).json({ error: 'Failed to create booking request' });
    }

    await writeAuditLog(businessId, actorUserId, 'catalog_booking_request', 'BusinessBooking', booking.id, {
      item_id: itemId,
      item_name: item.name,
    });

    res.status(201).json({
      booking_id: booking.id,
      item_name: item.name,
      business_name: bizUser?.name || 'Business',
      avg_response_minutes: profile?.avg_response_minutes || null,
    });
  } catch (err) {
    logger.error('Catalog booking request error', { error: err.message });
    res.status(500).json({ error: 'Failed to create booking request' });
  }
});

/**
 * GET /:businessId/bookings — Incoming booking requests for a business.
 * Owner read path for the bookings pipeline. Any team member with access can
 * read; results newest-first.
 * Query: ?status=pending|accepted|declined|cancelled|completed (optional)
 *        ?limit (default 50, max 100)
 */
router.get('/:businessId/bookings', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this business' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    let query = supabaseAdmin
      .from('BusinessBooking')
      .select('id, requester_id, catalog_item_id, item_name, price_cents, note, status, created_at')
      .eq('business_user_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);

    const validStatuses = ['pending', 'accepted', 'declined', 'cancelled', 'completed'];
    if (req.query.status && validStatuses.includes(req.query.status)) {
      query = query.eq('status', req.query.status);
    }

    const { data: bookings, error } = await query;
    if (error) {
      logger.error('Error fetching business bookings', { error: error.message, businessId });
      return res.status(500).json({ error: 'Failed to fetch bookings' });
    }

    res.json({ bookings: bookings || [] });
  } catch (err) {
    logger.error('Business bookings error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});


// ================================================================
//  PAGES & BLOCKS
// ================================================================

router.post('/:businessId/pages', verifyToken, validate(createPageSchema), async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'pages.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to manage pages' });
    }

    // Check slug uniqueness for this business
    const { data: existing } = await supabaseAdmin
      .from('BusinessPage')
      .select('id')
      .eq('business_user_id', businessId)
      .eq('slug', req.body.slug)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Page slug already exists for this business' });
    }

    // If marking as default, unset existing default
    if (req.body.is_default) {
      await supabaseAdmin
        .from('BusinessPage')
        .update({ is_default: false })
        .eq('business_user_id', businessId)
        .eq('is_default', true);
    }

    const { data: page, error } = await supabaseAdmin
      .from('BusinessPage')
      .insert({
        business_user_id: businessId,
        ...req.body,
        draft_revision: 1,
        published_revision: 0,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating page', { error: error.message });
      return res.status(500).json({ error: 'Failed to create page' });
    }

    await writeAuditLog(businessId, userId, 'create_page', 'BusinessPage', page.id, { slug: req.body.slug });
    res.status(201).json({ page });
  } catch (err) {
    logger.error('Create page error', { error: err.message });
    res.status(500).json({ error: 'Failed to create page' });
  }
});


router.get('/:businessId/pages', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'pages.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access' });
    }

    const { data: pages, error } = await supabaseAdmin
      .from('BusinessPage')
      .select('*')
      .eq('business_user_id', businessId)
      .order('nav_order');

    if (error) {
      logger.error('Error fetching pages', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch pages' });
    }

    res.json({ pages: pages || [] });
  } catch (err) {
    logger.error('Get pages error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});


router.patch('/:businessId/pages/:pageId', verifyToken, validate(updatePageSchema), async (req, res) => {
  try {
    const { businessId, pageId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'pages.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit pages' });
    }

    // If changing slug, check uniqueness
    if (req.body.slug) {
      const { data: existing } = await supabaseAdmin
        .from('BusinessPage')
        .select('id')
        .eq('business_user_id', businessId)
        .eq('slug', req.body.slug)
        .neq('id', pageId)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'Page slug already in use' });
      }
    }

    // Handle default flag
    if (req.body.is_default) {
      await supabaseAdmin
        .from('BusinessPage')
        .update({ is_default: false })
        .eq('business_user_id', businessId)
        .eq('is_default', true);
    }

    const { data: page, error } = await supabaseAdmin
      .from('BusinessPage')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', pageId)
      .eq('business_user_id', businessId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating page', { error: error.message });
      return res.status(500).json({ error: 'Failed to update page' });
    }

    res.json({ page });
  } catch (err) {
    logger.error('Update page error', { error: err.message });
    res.status(500).json({ error: 'Failed to update page' });
  }
});


router.delete('/:businessId/pages/:pageId', verifyToken, async (req, res) => {
  try {
    const { businessId, pageId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'pages.manage');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to manage pages' });
    }

    // Don't delete default page
    const { data: page } = await supabaseAdmin
      .from('BusinessPage')
      .select('is_default')
      .eq('id', pageId)
      .eq('business_user_id', businessId)
      .single();

    if (page?.is_default) {
      return res.status(400).json({ error: 'Cannot delete the default page' });
    }

    // Delete blocks first, then page
    await supabaseAdmin
      .from('BusinessPageBlock')
      .delete()
      .eq('page_id', pageId);

    await supabaseAdmin
      .from('BusinessPageRevision')
      .delete()
      .eq('page_id', pageId);

    const { error } = await supabaseAdmin
      .from('BusinessPage')
      .delete()
      .eq('id', pageId)
      .eq('business_user_id', businessId);

    if (error) {
      logger.error('Error deleting page', { error: error.message });
      return res.status(500).json({ error: 'Failed to delete page' });
    }

    await writeAuditLog(businessId, userId, 'delete_page', 'BusinessPage', pageId, {});
    res.json({ message: 'Page deleted' });
  } catch (err) {
    logger.error('Delete page error', { error: err.message });
    res.status(500).json({ error: 'Failed to delete page' });
  }
});


/**
 * GET /:businessId/pages/:pageId/blocks — Get blocks
 * ?revision=draft (default) or ?revision=published
 */
router.get('/:businessId/pages/:pageId/blocks', verifyToken, async (req, res) => {
  try {
    const { businessId, pageId } = req.params;
    const userId = req.user.id;
    const revisionMode = req.query.revision || 'draft';

    const access = await checkBusinessPermission(businessId, userId, 'pages.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access' });
    }

    // Get page to find revision number
    const { data: page } = await supabaseAdmin
      .from('BusinessPage')
      .select('draft_revision, published_revision')
      .eq('id', pageId)
      .eq('business_user_id', businessId)
      .single();

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const revisionNum = revisionMode === 'published' ? page.published_revision : page.draft_revision;

    if (revisionNum === 0 && revisionMode === 'published') {
      return res.json({ blocks: [], revision: 0, status: 'never_published' });
    }

    const { data: blocks, error } = await supabaseAdmin
      .from('BusinessPageBlock')
      .select('*')
      .eq('page_id', pageId)
      .eq('revision', revisionNum)
      .order('sort_order');

    if (error) {
      logger.error('Error fetching blocks', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch blocks' });
    }

    res.json({
      blocks: blocks || [],
      revision: revisionNum,
      draft_revision: page.draft_revision,
      published_revision: page.published_revision,
    });
  } catch (err) {
    logger.error('Get blocks error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch blocks' });
  }
});


/**
 * PUT /:businessId/pages/:pageId/blocks — Save draft blocks
 *
 * Replaces all blocks at the current draft_revision.
 * Bumps draft_revision if blocks already exist for current revision.
 */
router.put('/:businessId/pages/:pageId/blocks', verifyToken, validate(saveDraftBlocksSchema), async (req, res) => {
  try {
    const { businessId, pageId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'pages.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit pages' });
    }

    // Get page
    const { data: page } = await supabaseAdmin
      .from('BusinessPage')
      .select('draft_revision, published_revision')
      .eq('id', pageId)
      .eq('business_user_id', businessId)
      .single();

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    let draftRevision = page.draft_revision;

    // If draft_revision == published_revision, bump to avoid overwriting published blocks
    if (draftRevision === page.published_revision && page.published_revision > 0) {
      draftRevision = page.published_revision + 1;
      await supabaseAdmin
        .from('BusinessPage')
        .update({ draft_revision: draftRevision, updated_at: new Date().toISOString() })
        .eq('id', pageId);
    }

    // Delete existing draft blocks at this revision
    await supabaseAdmin
      .from('BusinessPageBlock')
      .delete()
      .eq('page_id', pageId)
      .eq('revision', draftRevision);

    // Insert new blocks
    const blockRows = req.body.blocks.map((b, idx) => ({
      page_id: pageId,
      revision: draftRevision,
      block_type: b.block_type,
      schema_version: b.schema_version || 1,
      sort_order: b.sort_order ?? idx,
      data: b.data,
      settings: b.settings || {},
      location_id: b.location_id || null,
      show_from: b.show_from || null,
      show_until: b.show_until || null,
      is_visible: b.is_visible !== false,
    }));

    const { data: blocks, error } = await supabaseAdmin
      .from('BusinessPageBlock')
      .insert(blockRows)
      .select();

    if (error) {
      logger.error('Error saving draft blocks', { error: error.message });
      return res.status(500).json({ error: 'Failed to save blocks' });
    }

    // Update page updated_at
    await supabaseAdmin
      .from('BusinessPage')
      .update({ draft_revision: draftRevision, updated_at: new Date().toISOString() })
      .eq('id', pageId);

    res.json({
      blocks: blocks || [],
      draft_revision: draftRevision,
    });
  } catch (err) {
    logger.error('Save draft blocks error', { error: err.message });
    res.status(500).json({ error: 'Failed to save blocks' });
  }
});


/**
 * POST /:businessId/pages/:pageId/publish — Publish draft
 *
 * Copies current draft blocks into a revision snapshot and sets published_revision.
 */
router.post('/:businessId/pages/:pageId/publish', verifyToken, async (req, res) => {
  try {
    const { businessId, pageId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'pages.publish');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to publish pages' });
    }

    // Get page
    const { data: page } = await supabaseAdmin
      .from('BusinessPage')
      .select('draft_revision, published_revision')
      .eq('id', pageId)
      .eq('business_user_id', businessId)
      .single();

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    if (page.draft_revision === page.published_revision) {
      return res.status(400).json({ error: 'No new draft to publish' });
    }

    // Get draft blocks
    const { data: draftBlocks } = await supabaseAdmin
      .from('BusinessPageBlock')
      .select('*')
      .eq('page_id', pageId)
      .eq('revision', page.draft_revision)
      .order('sort_order');

    if (!draftBlocks || draftBlocks.length === 0) {
      return res.status(400).json({ error: 'Draft has no blocks' });
    }

    // Create revision snapshot
    const { error: revErr } = await supabaseAdmin
      .from('BusinessPageRevision')
      .insert({
        page_id: pageId,
        revision: page.draft_revision,
        blocks_snapshot: draftBlocks,
        published_by: userId,
        notes: req.body?.notes || null,
      });

    if (revErr) {
      logger.error('Error creating revision snapshot', { error: revErr.message });
      return res.status(500).json({ error: 'Failed to publish' });
    }

    // Update page
    const { error: pageErr } = await supabaseAdmin
      .from('BusinessPage')
      .update({
        published_revision: page.draft_revision,
        published_at: new Date().toISOString(),
        published_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pageId);

    if (pageErr) {
      logger.error('Error publishing page', { error: pageErr.message });
      return res.status(500).json({ error: 'Failed to publish' });
    }

    await writeAuditLog(businessId, userId, 'publish_page', 'BusinessPage', pageId, {
      revision: page.draft_revision,
    });

    res.json({
      message: 'Page published',
      published_revision: page.draft_revision,
    });
  } catch (err) {
    logger.error('Publish page error', { error: err.message });
    res.status(500).json({ error: 'Failed to publish' });
  }
});


/**
 * GET /:businessId/pages/:pageId/revisions — List revision history
 */
router.get('/:businessId/pages/:pageId/revisions', verifyToken, async (req, res) => {
  try {
    const { businessId, pageId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'pages.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access' });
    }

    const { data: revisions, error } = await supabaseAdmin
      .from('BusinessPageRevision')
      .select(`
        id, page_id, revision, published_at, notes,
        publisher:published_by (id, username, name, profile_picture_url)
      `)
      .eq('page_id', pageId)
      .order('revision', { ascending: false });

    if (error) {
      logger.error('Error fetching revisions', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch revisions' });
    }

    res.json({ revisions: revisions || [] });
  } catch (err) {
    logger.error('Get revisions error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch revisions' });
  }
});


/**
 * POST /:businessId/pages/:pageId/revisions/:rev/restore
 * Restore a previous revision's blocks to the current draft.
 */
router.post('/:businessId/pages/:pageId/revisions/:rev/restore', verifyToken, async (req, res) => {
  try {
    const { businessId, pageId, rev } = req.params;
    const userId = req.user.id;
    const revisionNum = parseInt(rev, 10);

    const access = await checkBusinessPermission(businessId, userId, 'pages.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit pages' });
    }

    // Get the revision snapshot
    const { data: revision, error: revErr } = await supabaseAdmin
      .from('BusinessPageRevision')
      .select('blocks_snapshot')
      .eq('page_id', pageId)
      .eq('revision', revisionNum)
      .single();

    if (revErr || !revision) {
      return res.status(404).json({ error: 'Revision not found' });
    }

    // Get current page state
    const { data: page } = await supabaseAdmin
      .from('BusinessPage')
      .select('draft_revision, published_revision')
      .eq('id', pageId)
      .eq('business_user_id', businessId)
      .single();

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Bump draft revision to avoid overwriting published blocks
    let newDraftRevision = page.draft_revision + 1;

    // Delete any existing blocks at the new draft revision
    await supabaseAdmin
      .from('BusinessPageBlock')
      .delete()
      .eq('page_id', pageId)
      .eq('revision', newDraftRevision);

    // Insert restored blocks from the snapshot
    const snapshot = revision.blocks_snapshot || [];
    if (snapshot.length > 0) {
      const blockRows = snapshot.map((b, idx) => ({
        page_id: pageId,
        revision: newDraftRevision,
        block_type: b.block_type,
        schema_version: b.schema_version || 1,
        sort_order: b.sort_order ?? idx,
        data: b.data,
        settings: b.settings || {},
        location_id: b.location_id || null,
        show_from: b.show_from || null,
        show_until: b.show_until || null,
        is_visible: b.is_visible !== false,
      }));

      const { error: insertErr } = await supabaseAdmin
        .from('BusinessPageBlock')
        .insert(blockRows);

      if (insertErr) {
        logger.error('Error restoring blocks', { error: insertErr.message });
        return res.status(500).json({ error: 'Failed to restore blocks' });
      }
    }

    // Update page draft_revision
    await supabaseAdmin
      .from('BusinessPage')
      .update({ draft_revision: newDraftRevision, updated_at: new Date().toISOString() })
      .eq('id', pageId);

    await writeAuditLog(businessId, userId, 'restore_revision', 'BusinessPage', pageId, {
      restored_revision: revisionNum,
      new_draft_revision: newDraftRevision,
    });

    res.json({
      message: 'Revision restored to draft',
      restored_revision: revisionNum,
      draft_revision: newDraftRevision,
    });
  } catch (err) {
    logger.error('Restore revision error', { error: err.message });
    res.status(500).json({ error: 'Failed to restore revision' });
  }
});


// ================================================================
//  PUBLIC BUSINESS PROFILE (no auth required)
// ================================================================

/**
 * GET /public/:username — Public business profile
 */
router.get('/public/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Get user
    const { data: bizUser, error: userErr } = await supabaseAdmin
      .from('User')
      .select('id, username, name, email, profile_picture_url, cover_photo_url, bio, tagline, average_rating, review_count, account_type')
      .eq('username', username)
      .eq('account_type', 'business')
      .single();

    if (userErr || !bizUser) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Get published profile
    const { data: profile } = await supabaseAdmin
      .from('BusinessProfile')
      .select('business_type, categories, description, logo_file_id, banner_file_id, public_email, public_phone, website, social_links, founded_year, employee_count, service_area, theme, attributes, founding_badge, founding_benefit_expires_at, personal_user_id, active_from, active_until')
      .eq('business_user_id', bizUser.id)
      .eq('is_published', true)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Business profile not published' });
    }

    // Get active locations
    const { data: locations } = await supabaseAdmin
      .from('BusinessLocation')
      .select('id, label, is_primary, address, address2, city, state, zipcode, country, location, display_location, location_type, show_exact_location, timezone, phone, email')
      .eq('business_user_id', bizUser.id)
      .eq('is_active', true)
      .order('sort_order');

    for (const loc of (locations || [])) {
      // For home_based_private: use display_location for map, hide exact address
      if (loc.location_type === 'home_based_private' && !loc.show_exact_location) {
        if (loc.display_location) {
          loc.location = parsePostGISPoint(loc.display_location);
        } else if (loc.location) {
          loc.location = parsePostGISPoint(loc.location);
        }
        // Strip exact street address — only show city/area
        loc.address = null;
        loc.address2 = null;
        loc.is_home_based = true;
      } else {
        if (loc.location) loc.location = parsePostGISPoint(loc.location);
      }
      // Clean internal fields from public response
      delete loc.display_location;
      delete loc.location_type;
      delete loc.show_exact_location;
    }

    // Get hours for all locations
    const locationIds = (locations || []).map(l => l.id);
    let allHours = [];
    if (locationIds.length > 0) {
      const { data: hours } = await supabaseAdmin
        .from('BusinessHours')
        .select('*')
        .in('location_id', locationIds)
        .order('day_of_week');
      allHours = hours || [];
    }

    // Get published pages
    const { data: pages } = await supabaseAdmin
      .from('BusinessPage')
      .select('id, slug, title, description, is_default, show_in_nav, icon_key, nav_order, published_revision')
      .eq('business_user_id', bizUser.id)
      .gt('published_revision', 0)
      .order('nav_order');

    // Get published blocks for default page
    const defaultPage = (pages || []).find(p => p.is_default) || (pages || [])[0];
    let defaultBlocks = [];
    if (defaultPage && defaultPage.published_revision > 0) {
      const { data: blocks } = await supabaseAdmin
        .from('BusinessPageBlock')
        .select('id, block_type, schema_version, sort_order, data, settings, location_id, show_from, show_until, is_visible')
        .eq('page_id', defaultPage.id)
        .eq('revision', defaultPage.published_revision)
        .eq('is_visible', true)
        .order('sort_order');
      defaultBlocks = blocks || [];

      // Filter by schedule
      const now = new Date();
      defaultBlocks = defaultBlocks.filter(b => {
        if (b.show_from && new Date(b.show_from) > now) return false;
        if (b.show_until && new Date(b.show_until) <= now) return false;
        return true;
      });
    }

    // Get featured catalog items
    const { data: featuredItems } = await supabaseAdmin
      .from('BusinessCatalogItem')
      .select('id, name, description, kind, price_cents, price_max_cents, price_unit, currency, image_url, image_file_id, is_featured, tags')
      .eq('business_user_id', bizUser.id)
      .eq('status', 'active')
      .order('sort_order')
      .limit(20);

    // Get founding slot number if this is a founding business
    let foundingSlot = null;
    if (profile.founding_badge) {
      const { data: slot } = await supabaseAdmin
        .from('FoundingBusinessSlot')
        .select('slot_number, claimed_at')
        .eq('business_user_id', bizUser.id)
        .eq('status', 'active')
        .maybeSingle();
      foundingSlot = slot;
    }

    // Sole proprietor: inherit verified resident badge from personal account
    let verifiedResident = null;
    if (profile.personal_user_id) {
      const { data: homeVerification } = await supabaseAdmin
        .from('Home')
        .select('county, verification_tier')
        .eq('user_id', profile.personal_user_id)
        .eq('is_active', true)
        .maybeSingle();
      if (homeVerification && homeVerification.verification_tier && homeVerification.verification_tier !== 'none') {
        verifiedResident = {
          county: homeVerification.county,
          verification_tier: homeVerification.verification_tier,
        };
      }
    }

    res.json({
      business: bizUser,
      profile,
      locations: locations || [],
      hours: allHours,
      pages: pages || [],
      defaultPage: defaultPage ? {
        ...defaultPage,
        blocks: defaultBlocks,
      } : null,
      catalog: featuredItems || [],
      founding_slot: foundingSlot,
      verified_resident: verifiedResident,
    });
  } catch (err) {
    logger.error('Public business profile error', { error: err.message, username: req.params.username });
    res.status(500).json({ error: 'Failed to fetch business profile' });
  }
});


// ============ BUSINESS REVIEWS ============

/**
 * GET /:businessId/reviews
 * Get all reviews where reviewee_id = businessId. Requires reviews.view permission.
 */
router.get('/:businessId/reviews', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    // Permission check
    const access = await checkBusinessPermission(businessId, userId, 'reviews.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to view reviews' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;
    const ratingFilter = req.query.rating ? parseInt(req.query.rating) : null;

    // For sole_proprietor: include reviews from personal gigs (reviewee_id = personal_user_id)
    const { data: bizProfile } = await supabaseAdmin
      .from('BusinessProfile')
      .select('personal_user_id')
      .eq('business_user_id', businessId)
      .single();

    const revieweeIds = [businessId];
    if (bizProfile?.personal_user_id) {
      revieweeIds.push(bizProfile.personal_user_id);
    }

    let query = supabaseAdmin
      .from('Review')
      .select('*', { count: 'exact' })
      .in('reviewee_id', revieweeIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
      query = query.eq('rating', ratingFilter);
    }

    const { data: reviews, error, count } = await query;

    if (error) {
      logger.error('Business reviews fetch error', { error: error.message, businessId });
      return res.status(500).json({ error: 'Failed to fetch reviews' });
    }

    // Hydrate reviewer info
    const reviewerIds = [...new Set((reviews || []).map(r => r.reviewer_id))];
    let reviewerMap = {};
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabaseAdmin
        .from('User')
        .select('id, username, name, first_name, last_name, profile_picture_url')
        .in('id', reviewerIds);
      (reviewers || []).forEach(u => { reviewerMap[u.id] = u; });
    }

    // Hydrate gig info
    const gigIds = [...new Set((reviews || []).map(r => r.gig_id).filter(Boolean))];
    let gigMap = {};
    if (gigIds.length > 0) {
      const { data: gigs } = await supabaseAdmin
        .from('Gig')
        .select('id, title')
        .in('id', gigIds);
      (gigs || []).forEach(g => { gigMap[g.id] = g; });
    }

    const enriched = (reviews || []).map(r => ({
      ...r,
      reviewer: reviewerMap[r.reviewer_id] || null,
      reviewer_name: reviewerMap[r.reviewer_id]?.name ||
                     reviewerMap[r.reviewer_id]?.first_name ||
                     reviewerMap[r.reviewer_id]?.username || 'Anonymous',
      reviewer_avatar: reviewerMap[r.reviewer_id]?.profile_picture_url || null,
      gig_title: gigMap[r.gig_id]?.title || null,
    }));

    // Compute average
    const { data: allRatings } = await supabaseAdmin
      .from('Review')
      .select('rating')
      .eq('reviewee_id', businessId);

    const totalRating = (allRatings || []).reduce((sum, r) => sum + r.rating, 0);
    const avgRating = allRatings && allRatings.length > 0
      ? Math.round((totalRating / allRatings.length) * 100) / 100
      : 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (allRatings || []).forEach(r => { distribution[r.rating] = (distribution[r.rating] || 0) + 1; });

    res.json({
      reviews: enriched,
      total: count || 0,
      average_rating: avgRating,
      distribution,
      page,
      limit,
    });
  } catch (err) {
    logger.error('Business reviews error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});


/**
 * POST /:businessId/reviews/:reviewId/respond
 * Save or update owner_response on a review. Requires reviews.respond permission.
 */
router.post('/:businessId/reviews/:reviewId/respond', verifyToken, async (req, res) => {
  try {
    const { businessId, reviewId } = req.params;
    const userId = req.user.id;
    const { response } = req.body;

    if (!response || typeof response !== 'string' || response.trim().length === 0) {
      return res.status(400).json({ error: 'Response text is required' });
    }

    if (response.length > 2000) {
      return res.status(400).json({ error: 'Response must be under 2000 characters' });
    }

    // Permission check
    const access = await checkBusinessPermission(businessId, userId, 'reviews.respond');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to respond to reviews' });
    }

    // Verify the review belongs to this business
    const { data: review, error: reviewErr } = await supabaseAdmin
      .from('Review')
      .select('id, reviewee_id')
      .eq('id', reviewId)
      .single();

    if (reviewErr || !review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.reviewee_id !== businessId) {
      return res.status(403).json({ error: 'This review does not belong to this business' });
    }

    // Update with owner response
    const { error: updateErr } = await supabaseAdmin
      .from('Review')
      .update({
        owner_response: response.trim(),
        owner_responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateErr) {
      logger.error('Review respond error', { error: updateErr.message, reviewId });
      return res.status(500).json({ error: 'Failed to save response' });
    }

    // Audit log
    await writeAuditLog(businessId, userId, 'review.responded', 'review', reviewId, {
      response_preview: response.trim().substring(0, 100),
    });

    logger.info('Review response saved', { businessId, reviewId, responderId: userId });
    res.json({ message: 'Response saved successfully' });
  } catch (err) {
    logger.error('Review respond error', { error: err.message });
    res.status(500).json({ error: 'Failed to save response' });
  }
});


// ============ FOLLOW / UNFOLLOW ============

/**
 * POST /:businessId/follow — Follow a business
 */
router.post('/:businessId/follow', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    if (userId === businessId) {
      return res.status(400).json({ error: 'Cannot follow your own business' });
    }

    // Verify business exists
    const { data: biz } = await supabaseAdmin
      .from('User')
      .select('id')
      .eq('id', businessId)
      .eq('account_type', 'business')
      .single();
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    // Upsert (ignore conflict on duplicate follow)
    const { error } = await supabaseAdmin
      .from('BusinessFollow')
      .upsert({ user_id: userId, business_user_id: businessId }, { onConflict: 'user_id,business_user_id' });
    if (error) throw error;

    res.json({ following: true });
  } catch (err) {
    logger.error('Follow error', { error: err.message });
    res.status(500).json({ error: 'Failed to follow business' });
  }
});

/**
 * DELETE /:businessId/follow — Unfollow a business
 */
router.delete('/:businessId/follow', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    await supabaseAdmin
      .from('BusinessFollow')
      .delete()
      .eq('user_id', userId)
      .eq('business_user_id', businessId);

    res.json({ following: false });
  } catch (err) {
    logger.error('Unfollow error', { error: err.message });
    res.status(500).json({ error: 'Failed to unfollow business' });
  }
});

/**
 * GET /:businessId/follow/status — Check follow status + follower count
 */
router.get('/:businessId/follow/status', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const [followCheck, countResult] = await Promise.all([
      supabaseAdmin
        .from('BusinessFollow')
        .select('user_id')
        .eq('user_id', userId)
        .eq('business_user_id', businessId)
        .maybeSingle(),
      supabaseAdmin
        .from('BusinessFollow')
        .select('user_id', { count: 'exact', head: true })
        .eq('business_user_id', businessId),
    ]);

    res.json({
      following: !!followCheck.data,
      follower_count: countResult.count || 0,
    });
  } catch (err) {
    logger.error('Follow status error', { error: err.message });
    res.status(500).json({ error: 'Failed to get follow status' });
  }
});

// ============ BUSINESS PRIVATE (LEGAL / FINANCE) ============

/**
 * GET /:businessId/private — Get sensitive business data
 * Requires sensitive.view permission (owner only by default)
 */
router.get('/:businessId/private', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'sensitive.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to view sensitive data' });
    }

    const { data: privateData, error } = await supabaseAdmin
      .from('BusinessPrivate')
      .select('*')
      .eq('business_user_id', businessId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching business private data', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch private data' });
    }

    res.json({ private: privateData || {} });
  } catch (err) {
    logger.error('Get business private error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch private data' });
  }
});

/**
 * PATCH /:businessId/private — Update sensitive business data
 * Requires sensitive.view permission (owner only by default)
 */
router.patch('/:businessId/private', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'sensitive.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No permission to edit sensitive data' });
    }

    const allowed = ['legal_name', 'tax_id_last4', 'support_email', 'banking_info', 'legal_doc_ids'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    // Upsert — create if missing
    const { data: existing } = await supabaseAdmin
      .from('BusinessPrivate')
      .select('business_user_id')
      .eq('business_user_id', businessId)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('BusinessPrivate')
        .update(updates)
        .eq('business_user_id', businessId)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('BusinessPrivate')
        .insert({ business_user_id: businessId, ...updates })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    await writeAuditLog(businessId, userId, 'update_private', 'BusinessPrivate', businessId, {
      fields: Object.keys(updates).filter(k => k !== 'updated_at'),
    });

    res.json({ private: result });
  } catch (err) {
    logger.error('Update business private error', { error: err.message });
    res.status(500).json({ error: 'Failed to update private data' });
  }
});

// ============ PROFILE VIEWS ============

/**
 * POST /:businessId/views — Log a profile view
 * No auth required — accepts optional viewer context.
 */
router.post('/:businessId/views', optionalAuth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user?.id || null;
    const source = req.body.source || 'direct_link';
    const viewerHomeId = req.body.viewer_home_id || null;

    // Don't log views from the business owner viewing their own profile
    if (userId && userId === businessId) {
      return res.json({ logged: false });
    }

    const { error } = await supabaseAdmin
      .from('BusinessProfileView')
      .insert({
        business_user_id: businessId,
        viewer_user_id: userId,
        viewer_home_id: viewerHomeId,
        source,
      });
    if (error) throw error;

    res.json({ logged: true });
  } catch (err) {
    logger.error('Profile view log error', { error: err.message });
    res.status(500).json({ error: 'Failed to log view' });
  }
});

// ============ BUSINESS INBOX ============

/**
 * POST /:businessId/inbox/start — Start an inquiry chat with a business
 */
router.post('/:businessId/inbox/start', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;
    const { subject } = req.body;

    // Verify business exists
    const { data: biz } = await supabaseAdmin
      .from('User')
      .select('id, name')
      .eq('id', businessId)
      .eq('account_type', 'business')
      .single();
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    // Check if there's already a direct chat between this user and business
    const { data: existingRooms } = await supabaseAdmin
      .from('ChatParticipant')
      .select('room_id')
      .eq('user_id', userId);

    if (existingRooms && existingRooms.length > 0) {
      const roomIds = existingRooms.map(r => r.room_id);
      const { data: bizRooms } = await supabaseAdmin
        .from('ChatParticipant')
        .select('room_id')
        .eq('user_id', businessId)
        .in('room_id', roomIds);

      if (bizRooms && bizRooms.length > 0) {
        // Check if any is a direct chat
        const { data: directRoom } = await supabaseAdmin
          .from('ChatRoom')
          .select('id')
          .in('id', bizRooms.map(r => r.room_id))
          .eq('type', 'direct')
          .limit(1)
          .maybeSingle();

        if (directRoom) {
          return res.json({ roomId: directRoom.id, existing: true });
        }
      }
    }

    // Create new chat room
    const { data: room, error: roomErr } = await supabaseAdmin
      .from('ChatRoom')
      .insert({
        type: 'direct',
        name: subject || `Inquiry to ${biz.name}`,
        created_by: userId,
      })
      .select('id')
      .single();
    if (roomErr) throw roomErr;

    // Add participants
    await supabaseAdmin
      .from('ChatParticipant')
      .insert([
        { room_id: room.id, user_id: userId, role: 'member' },
        { room_id: room.id, user_id: businessId, role: 'member' },
      ]);

    res.json({ roomId: room.id, existing: false });
  } catch (err) {
    logger.error('Business inbox start error', { error: err.message });
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// ============ INSIGHTS / ANALYTICS ============

/**
 * GET /:businessId/insights — Profile views, followers, review trends
 * Query: ?period=7d|30d|90d (default 30d)
 */
router.get('/:businessId/insights', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    // Permission check
    const access = await checkBusinessPermission(businessId, userId, 'analytics.view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to view insights' });
    }

    const periodMap = { '7d': 7, '30d': 30, '90d': 90 };
    const periodKey = req.query.period || '30d';
    const days = periodMap[periodKey] || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    // Previous period for comparison
    const prevSince = new Date();
    prevSince.setDate(prevSince.getDate() - days * 2);
    const prevSinceISO = prevSince.toISOString();

    // Run all queries in parallel
    const [
      viewsResult,
      prevViewsResult,
      followersResult,
      prevFollowersResult,
      totalFollowersResult,
      reviewsResult,
      prevReviewsResult,
      viewsByDayResult,
      viewsBySourceResult,
    ] = await Promise.all([
      // Views in current period
      supabaseAdmin
        .from('BusinessProfileView')
        .select('id', { count: 'exact', head: true })
        .eq('business_user_id', businessId)
        .gte('viewed_at', sinceISO),

      // Views in previous period
      supabaseAdmin
        .from('BusinessProfileView')
        .select('id', { count: 'exact', head: true })
        .eq('business_user_id', businessId)
        .gte('viewed_at', prevSinceISO)
        .lt('viewed_at', sinceISO),

      // New followers in current period
      supabaseAdmin
        .from('BusinessFollow')
        .select('user_id', { count: 'exact', head: true })
        .eq('business_user_id', businessId)
        .gte('created_at', sinceISO),

      // New followers in previous period
      supabaseAdmin
        .from('BusinessFollow')
        .select('user_id', { count: 'exact', head: true })
        .eq('business_user_id', businessId)
        .gte('created_at', prevSinceISO)
        .lt('created_at', sinceISO),

      // Total followers
      supabaseAdmin
        .from('BusinessFollow')
        .select('user_id', { count: 'exact', head: true })
        .eq('business_user_id', businessId),

      // Reviews in current period
      supabaseAdmin
        .from('Review')
        .select('id, rating', { count: 'exact' })
        .eq('reviewee_id', businessId)
        .gte('created_at', sinceISO),

      // Reviews in previous period
      supabaseAdmin
        .from('Review')
        .select('id', { count: 'exact', head: true })
        .eq('reviewee_id', businessId)
        .gte('created_at', prevSinceISO)
        .lt('created_at', sinceISO),

      // Views by day (for chart)
      supabaseAdmin
        .from('BusinessProfileView')
        .select('viewed_at')
        .eq('business_user_id', businessId)
        .gte('viewed_at', sinceISO)
        .order('viewed_at'),

      // Views by source
      supabaseAdmin
        .from('BusinessProfileView')
        .select('source')
        .eq('business_user_id', businessId)
        .gte('viewed_at', sinceISO),
    ]);

    // Aggregate views by day → array of { date, count }
    const viewsByDayMap = {};
    for (const v of (viewsByDayResult.data || [])) {
      const day = v.viewed_at.substring(0, 10); // YYYY-MM-DD
      viewsByDayMap[day] = (viewsByDayMap[day] || 0) + 1;
    }
    const viewsByDay = Object.entries(viewsByDayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Aggregate views by source → array of { source, count }
    const viewsBySourceMap = {};
    for (const v of (viewsBySourceResult.data || [])) {
      const src = v.source || 'direct_link';
      viewsBySourceMap[src] = (viewsBySourceMap[src] || 0) + 1;
    }
    const viewsBySource = Object.entries(viewsBySourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate average rating for period reviews
    const periodReviews = reviewsResult.data || [];
    const avgRating = periodReviews.length > 0
      ? periodReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / periodReviews.length
      : null;

    // Calculate trend percentages
    const calcTrend = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const views = viewsResult.count || 0;
    const prevViews = prevViewsResult.count || 0;
    const newFollowers = followersResult.count || 0;
    const prevNewFollowers = prevFollowersResult.count || 0;
    const reviewCount = reviewsResult.count || 0;
    const prevReviewCount = prevReviewsResult.count || 0;

    res.json({
      period: periodKey,
      days,
      views: {
        total: views,
        trend: calcTrend(views, prevViews),
        by_day: viewsByDay,
        by_source: viewsBySource,
      },
      followers: {
        total: totalFollowersResult.count || 0,
        new: newFollowers,
        trend: calcTrend(newFollowers, prevNewFollowers),
      },
      reviews: {
        count: reviewCount,
        trend: calcTrend(reviewCount, prevReviewCount),
        average_rating: avgRating,
      },
    });
  } catch (err) {
    logger.error('Insights error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// ============ BUSINESS POSTS ============

/**
 * POST /:businessId/posts
 * Create a post as the business identity. Requires editor-level seat.
 * Body accepts the same fields as the regular post creation endpoint.
 * Automatically sets business_author_id = businessId.
 */
router.post('/:businessId/posts', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    // Check editor-level access
    const access = await checkBusinessPermission(businessId, userId, 'profile.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You need at least editor role to post as this business' });
    }

    // Forward to the standard post creation with business context pre-set
    // We'll directly create the post here with business_author_id
    const {
      content, title, mediaUrls, mediaTypes, postType,
      visibility, tags, audience, targetPlaceId,
      eventDate, eventEndDate, eventVenue,
      dealExpiresAt, dealBusinessName,
      serviceCategory, latitude, longitude, locationName, locationAddress,
    } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Get business location for post coordinates if not provided
    let effectiveLat = latitude;
    let effectiveLon = longitude;
    let effectiveLocationName = locationName;
    let effectiveLocationAddress = locationAddress;

    if (effectiveLat == null || effectiveLon == null) {
      const { data: primaryLoc } = await supabaseAdmin
        .from('BusinessLocation')
        .select('address, city, state, location')
        .eq('business_user_id', businessId)
        .eq('is_primary', true)
        .eq('is_active', true)
        .maybeSingle();

      if (primaryLoc?.location) {
        const coords = primaryLoc.location;
        if (coords.coordinates) {
          effectiveLon = coords.coordinates[0];
          effectiveLat = coords.coordinates[1];
        }
        if (!effectiveLocationAddress) {
          effectiveLocationAddress = [primaryLoc.address, primaryLoc.city, primaryLoc.state].filter(Boolean).join(', ');
        }
      }
    }

    // Get business name for locationName default
    const { data: bizUser } = await supabaseAdmin
      .from('User')
      .select('name, username')
      .eq('id', businessId)
      .single();

    const postData = {
      user_id: userId,
      business_id: businessId,
      business_author_id: businessId,
      title: title || null,
      content: content.trim(),
      media_urls: mediaUrls || [],
      media_types: mediaTypes || [],
      post_type: postType || 'local_update',
      post_format: 'standard',
      visibility: visibility || 'neighborhood',
      visibility_scope: 'neighborhood',
      location_precision: 'approx_area',
      latitude: effectiveLat ?? null,
      longitude: effectiveLon ?? null,
      location_name: effectiveLocationName || bizUser?.name || null,
      location_address: effectiveLocationAddress || null,
      tags: tags || [],
      post_as: 'business',
      audience: audience || 'nearby',
      target_place_id: targetPlaceId || null,
      distribution_targets: ['place'],
      event_date: eventDate || null,
      event_end_date: eventEndDate || null,
      event_venue: eventVenue || null,
      deal_expires_at: dealExpiresAt || null,
      deal_business_name: dealBusinessName || bizUser?.name || null,
      service_category: serviceCategory || null,
      purpose: postType === 'deal' ? 'promote' : (postType === 'event' ? 'invite' : 'inform'),
      profile_visibility_scope: 'public',
      show_on_profile: true,
      is_visitor_post: false,
      state: 'open',
    };

    const { data: post, error } = await supabaseAdmin
      .from('Post')
      .insert(postData)
      .select('*')
      .single();

    if (error) {
      logger.error('Error creating business post', { error: error.message, businessId });
      return res.status(500).json({ error: 'Failed to create post' });
    }

    // Attach business author info to response
    post.business_author = bizUser ? {
      id: businessId,
      name: bizUser.name,
      username: bizUser.username,
    } : null;

    await writeAuditLog(businessId, userId, 'create_post', 'Post', post.id, {
      post_type: post.post_type,
    });

    res.status(201).json({
      message: 'Post created as business',
      post,
    });
  } catch (err) {
    logger.error('Business post creation error', { error: err.message, businessId: req.params.businessId });
    res.status(500).json({ error: 'Failed to create business post' });
  }
});

/**
 * GET /:businessId/posts
 * Get posts authored by this business.
 */
router.get('/:businessId/posts', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access to this business' });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 20, 1), 50);

    const { data: posts, error, count } = await supabaseAdmin
      .from('Post')
      .select('id, title, content, post_type, like_count, comment_count, created_at, media_urls', { count: 'exact' })
      .eq('business_author_id', businessId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      logger.error('Error fetching business posts', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch posts' });
    }

    res.json({
      posts: posts || [],
      pagination: {
        page,
        page_size: pageSize,
        total_count: count || 0,
        total_pages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (err) {
    logger.error('Business posts fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch business posts' });
  }
});

/**
 * GET /:businessId/matched-posts
 * Get posts that mention or match this business (via PostMatchedBusiness columns).
 */
router.get('/:businessId/matched-posts', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access to this business' });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 20, 1), 50);

    const { data: posts, error, count } = await supabaseAdmin
      .from('Post')
      .select('id, title, content, post_type, like_count, comment_count, created_at, user_id, creator:user_id (id, name, username, profile_picture_url)', { count: 'exact' })
      .contains('matched_business_ids', [businessId])
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      logger.error('Error fetching matched posts', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch matched posts' });
    }

    res.json({
      posts: posts || [],
      pagination: {
        page,
        page_size: pageSize,
        total_count: count || 0,
        total_pages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (err) {
    logger.error('Matched posts fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch matched posts' });
  }
});

// ============ BUSINESS STRIPE CONNECT ============

/**
 * POST /:businessId/stripe/connect
 * Create a Stripe Connect account linked to the business_user_id.
 */
router.post('/:businessId/stripe/connect', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'payments.manage');
    if (!access.hasAccess || !access.isOwner) {
      return res.status(403).json({ error: 'Only the business owner can connect a Stripe account' });
    }

    // Get business user email
    const { data: bizUser } = await supabaseAdmin
      .from('User')
      .select('email, name')
      .eq('id', businessId)
      .single();

    if (!bizUser) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const result = await stripeService.createConnectAccount(businessId, {
      email: bizUser.email,
      country: req.body.country || 'US',
      business_type: req.body.businessType || 'company',
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    await writeAuditLog(businessId, userId, 'stripe_connect', 'StripeAccount', result.account?.id, {});

    res.status(201).json({
      message: 'Business Stripe Connect account created',
      account: result.account,
      stripeAccountId: result.stripeAccountId,
    });
  } catch (err) {
    logger.error('Business Stripe connect error', { error: err.message, businessId: req.params.businessId });
    if (err.message?.includes('signed up for Connect')) {
      return res.status(503).json({
        error: 'Stripe Connect is not enabled',
        code: 'connect_not_enabled',
      });
    }
    res.status(500).json({ error: 'Failed to create business Stripe account' });
  }
});

/**
 * GET /:businessId/stripe/account
 * Get the business's Stripe Connect account status.
 */
router.get('/:businessId/stripe/account', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access to this business' });
    }

    const result = await stripeService.getConnectAccount(businessId);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({ account: result.account });
  } catch (err) {
    logger.error('Business Stripe account error', { error: err.message });
    res.status(500).json({ error: 'Failed to get business Stripe account' });
  }
});

/**
 * POST /:businessId/stripe/refresh-link
 * Refresh the onboarding link for the business's Stripe account.
 */
router.post('/:businessId/stripe/refresh-link', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'payments.manage');
    if (!access.hasAccess || !access.isOwner) {
      return res.status(403).json({ error: 'Only the business owner can manage Stripe' });
    }

    const clientUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3000';
    const returnUrl = `${clientUrl}/app/businesses/${businessId}?tab=payments&onboarding=success`;
    const refreshUrl = `${clientUrl}/app/businesses/${businessId}?tab=payments&onboarding=refresh`;

    const result = await stripeService.createAccountLink(businessId, returnUrl, refreshUrl);

    res.json({ accountLink: result.url, expiresAt: result.expiresAt });
  } catch (err) {
    logger.error('Business Stripe refresh link error', { error: err.message });
    res.status(500).json({ error: 'Failed to create onboarding link' });
  }
});

/**
 * POST /:businessId/stripe/dashboard-link
 * Create an Express dashboard link for the business's Stripe account.
 */
router.post('/:businessId/stripe/dashboard-link', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access to this business' });
    }

    const result = await stripeService.createLoginLink(businessId);

    res.json({ dashboardUrl: result.url });
  } catch (err) {
    logger.error('Business Stripe dashboard link error', { error: err.message });
    res.status(500).json({ error: 'Failed to create dashboard link' });
  }
});

// ============ BUSINESS INVOICES ============
// IMPORTANT: Literal routes (/invoices/received, /invoices/:id/pay, /invoices/:id)
// must be defined BEFORE parameterized routes (/:businessId/invoices) to prevent
// Express from matching "invoices" as a businessId parameter.

const createInvoiceSchema = Joi.object({
  recipient_user_id: Joi.string().uuid().required(),
  gig_id: Joi.string().uuid().allow(null).optional(),
  line_items: Joi.array().items(Joi.object({
    description: Joi.string().max(255).required(),
    amount_cents: Joi.number().integer().positive().required(),
    quantity: Joi.number().integer().min(1).default(1),
  })).min(1).max(50).required(),
  due_date: Joi.date().iso().allow(null).optional(),
  memo: Joi.string().max(1000).allow('', null).optional(),
});

/**
 * GET /invoices/received — List invoices received by the current user
 * Must be defined before /:businessId/invoices to avoid "invoices" matching as businessId.
 */
router.get('/invoices/received', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.page_size) || 20));

    const { data: invoices, error, count } = await supabaseAdmin
      .from('BusinessInvoice')
      .select('*, business:business_user_id(id, name, username, profile_picture_url)', { count: 'exact' })
      .eq('recipient_user_id', userId)
      .in('status', ['sent', 'viewed', 'overdue', 'paid'])
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      logger.error('List received invoices error', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch invoices' });
    }

    res.json({
      invoices: invoices || [],
      pagination: { page, page_size: pageSize, total: count || 0 },
    });
  } catch (err) {
    logger.error('List received invoices error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch invoices', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /invoices/:invoiceId — Get a single invoice (recipient view)
 * Returns the invoice if the caller is the recipient.
 * Must be defined before /:businessId/invoices/:invoiceId.
 */
router.get('/invoices/:invoiceId', verifyToken, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;

    const { data: invoice, error } = await supabaseAdmin
      .from('BusinessInvoice')
      .select('*, business:business_user_id(id, name, username, profile_picture_url)')
      .eq('id', invoiceId)
      .eq('recipient_user_id', userId)
      .maybeSingle();

    if (error || !invoice) {
      return res.status(404).json({ error: 'Invoice not found', code: 'NOT_FOUND' });
    }

    res.json({ invoice });
  } catch (err) {
    logger.error('Get received invoice error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch invoice', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /invoices/:invoiceId/pay — Pay an invoice (called by recipient)
 * Must be defined before /:businessId/invoices.
 *
 * Payment flow:
 *   1. Validate invoice is payable and caller is recipient.
 *   2. Create Stripe PaymentIntent (not yet captured).
 *   3. Store the PI reference on the invoice (status stays "viewed").
 *   4. Return client_secret so the client can confirm payment.
 *   5. On successful Stripe webhook (payment_intent.succeeded), a
 *      separate handler marks the invoice as "paid". If no webhook
 *      handler exists yet the client should call a confirm endpoint.
 */
router.post('/invoices/:invoiceId/pay', verifyToken, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;
    const { payment_method_id } = req.body;

    // Fetch invoice
    const { data: invoice, error: fetchErr } = await supabaseAdmin
      .from('BusinessInvoice')
      .select('*')
      .eq('id', invoiceId)
      .maybeSingle();

    if (fetchErr || !invoice) {
      return res.status(404).json({ error: 'Invoice not found', code: 'NOT_FOUND' });
    }

    // Only the recipient can pay
    if (invoice.recipient_user_id !== userId) {
      return res.status(403).json({ error: 'Only the invoice recipient can pay', code: 'NOT_RECIPIENT' });
    }

    // Check payable status
    if (invoice.status === 'void') {
      return res.status(400).json({ error: 'This invoice has been voided', code: 'INVOICE_VOID' });
    }
    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'This invoice has already been paid', code: 'ALREADY_PAID' });
    }
    if (!['sent', 'viewed', 'overdue'].includes(invoice.status)) {
      return res.status(400).json({ error: 'Invoice is not payable', code: 'NOT_PAYABLE' });
    }

    // Create payment intent
    const result = await stripeService.createPaymentIntentForGig({
      payerId: userId,
      payeeId: invoice.business_user_id,
      gigId: invoice.gig_id || null,
      amount: invoice.total_cents,
      paymentMethodId: payment_method_id || undefined,
      metadata: {
        type: 'invoice_payment',
        invoice_id: invoiceId,
      },
    });

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to create payment', code: 'PAYMENT_FAILED' });
    }

    // Store the payment reference and mark as "viewed" (not "paid" yet —
    // the invoice transitions to "paid" only after Stripe confirms capture).
    const { error: updateErr } = await supabaseAdmin
      .from('BusinessInvoice')
      .update({
        status: 'viewed',
        payment_id: result.paymentId,
        stripe_payment_intent_id: result.paymentIntentId,
      })
      .eq('id', invoiceId);

    if (updateErr) {
      logger.error('Failed to update invoice payment reference', { invoiceId, error: updateErr.message });
    }

    res.json({
      client_secret: result.clientSecret,
      payment_intent_id: result.paymentIntentId,
      payment_id: result.paymentId,
      amount_cents: invoice.total_cents,
      fee_cents: invoice.fee_cents,
    });
  } catch (err) {
    logger.error('Pay invoice error', { error: err.message });
    res.status(500).json({ error: 'Failed to process payment', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /invoices/:invoiceId/confirm — Confirm invoice payment succeeded
 * Called by the client after Stripe PaymentIntent confirmation succeeds.
 * Marks the invoice as "paid" with a timestamp.
 */
router.post('/invoices/:invoiceId/confirm', verifyToken, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user.id;

    const { data: invoice, error: fetchErr } = await supabaseAdmin
      .from('BusinessInvoice')
      .select('id, status, recipient_user_id, stripe_payment_intent_id')
      .eq('id', invoiceId)
      .maybeSingle();

    if (fetchErr || !invoice) {
      return res.status(404).json({ error: 'Invoice not found', code: 'NOT_FOUND' });
    }
    if (invoice.recipient_user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized', code: 'NOT_RECIPIENT' });
    }
    if (invoice.status === 'paid') {
      return res.json({ invoice }); // Idempotent
    }
    if (!invoice.stripe_payment_intent_id) {
      return res.status(400).json({ error: 'No payment initiated for this invoice', code: 'NO_PAYMENT' });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('BusinessInvoice')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateErr) {
      logger.error('Failed to confirm invoice payment', { invoiceId, error: updateErr.message });
      return res.status(500).json({ error: 'Failed to update invoice status' });
    }

    res.json({ invoice: updated });
  } catch (err) {
    logger.error('Confirm invoice payment error', { error: err.message });
    res.status(500).json({ error: 'Failed to confirm payment', code: 'INTERNAL_ERROR' });
  }
});

// ─── Parameterized /:businessId/invoices routes (must come AFTER literal /invoices/* routes) ───

/**
 * POST /:businessId/invoices — Create and send an invoice
 */
router.post('/:businessId/invoices', verifyToken, validate(createInvoiceSchema), async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'profile.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Editor role or above required to create invoices' });
    }

    const { recipient_user_id, gig_id, line_items, due_date, memo } = req.body;

    // Validate recipient exists
    const { data: recipient } = await supabaseAdmin
      .from('User')
      .select('id, name, username')
      .eq('id', recipient_user_id)
      .maybeSingle();
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found', code: 'RECIPIENT_NOT_FOUND' });
    }

    // Calculate totals — fee is deducted from business payout, not added to customer total
    const subtotal_cents = line_items.reduce(
      (sum, item) => sum + item.amount_cents * (item.quantity || 1), 0
    );

    const feeRate = await stripeService.getEffectiveFeeRate(businessId);
    const fees = stripeService.calculateFees(subtotal_cents, feeRate);
    const fee_cents = fees.platformFee;
    const total_cents = subtotal_cents; // Customer pays subtotal; fee deducted from business share

    const { data: invoice, error: insertErr } = await supabaseAdmin
      .from('BusinessInvoice')
      .insert({
        business_user_id: businessId,
        recipient_user_id,
        gig_id: gig_id || null,
        line_items,
        subtotal_cents,
        fee_cents,
        total_cents,
        currency: 'usd',
        status: 'sent',
        due_date: due_date || null,
        memo: memo || null,
      })
      .select()
      .single();

    if (insertErr) {
      logger.error('Invoice creation failed', { error: insertErr.message });
      return res.status(500).json({ error: 'Failed to create invoice', code: 'INSERT_FAILED' });
    }

    // Fetch business name for notification
    const { data: bizUser } = await supabaseAdmin
      .from('User')
      .select('name, username')
      .eq('id', businessId)
      .maybeSingle();

    // Send notification to recipient (non-blocking)
    supabaseAdmin.from('Notification').insert({
      user_id: recipient_user_id,
      type: 'invoice_received',
      title: 'Invoice Received',
      body: `${bizUser?.name || bizUser?.username || 'A business'} sent you an invoice for $${(total_cents / 100).toFixed(2)}`,
      data: { invoice_id: invoice.id, business_id: businessId, amount_cents: total_cents },
    }).then(() => {}).catch(() => {});

    res.status(201).json({ invoice });
  } catch (err) {
    logger.error('Create invoice error', { error: err.message });
    res.status(500).json({ error: 'Failed to create invoice', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /:businessId/invoices — List invoices with pagination and status filter
 */
router.get('/:businessId/invoices', verifyToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access to this business' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.page_size) || 20));
    const statusFilter = req.query.status;

    let query = supabaseAdmin
      .from('BusinessInvoice')
      .select('*, recipient:recipient_user_id(id, name, username, profile_picture_url)', { count: 'exact' })
      .eq('business_user_id', businessId)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data: invoices, error, count } = await query;

    if (error) {
      logger.error('List invoices error', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch invoices' });
    }

    res.json({
      invoices: invoices || [],
      pagination: { page, page_size: pageSize, total: count || 0 },
    });
  } catch (err) {
    logger.error('List invoices error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch invoices', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /:businessId/invoices/:invoiceId — Single invoice detail (business view)
 */
router.get('/:businessId/invoices/:invoiceId', verifyToken, async (req, res) => {
  try {
    const { businessId, invoiceId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'No access to this business' });
    }

    const { data: invoice, error } = await supabaseAdmin
      .from('BusinessInvoice')
      .select('*, recipient:recipient_user_id(id, name, username, profile_picture_url)')
      .eq('id', invoiceId)
      .eq('business_user_id', businessId)
      .maybeSingle();

    if (error || !invoice) {
      return res.status(404).json({ error: 'Invoice not found', code: 'NOT_FOUND' });
    }

    res.json({ invoice });
  } catch (err) {
    logger.error('Get invoice error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch invoice', code: 'INTERNAL_ERROR' });
  }
});

/**
 * PATCH /:businessId/invoices/:invoiceId — Void an invoice
 */
router.patch('/:businessId/invoices/:invoiceId', verifyToken, async (req, res) => {
  try {
    const { businessId, invoiceId } = req.params;
    const userId = req.user.id;

    const access = await checkBusinessPermission(businessId, userId, 'profile.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Editor role or above required' });
    }

    const { status } = req.body;
    if (status !== 'void') {
      return res.status(400).json({ error: 'Only voiding is supported via PATCH', code: 'INVALID_STATUS' });
    }

    const { data: invoice, error: fetchErr } = await supabaseAdmin
      .from('BusinessInvoice')
      .select('id, status')
      .eq('id', invoiceId)
      .eq('business_user_id', businessId)
      .maybeSingle();

    if (fetchErr || !invoice) {
      return res.status(404).json({ error: 'Invoice not found', code: 'NOT_FOUND' });
    }
    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Cannot void a paid invoice', code: 'ALREADY_PAID' });
    }
    if (invoice.status === 'void') {
      return res.status(400).json({ error: 'Invoice is already voided', code: 'ALREADY_VOID' });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('BusinessInvoice')
      .update({ status: 'void' })
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to void invoice' });
    }

    res.json({ invoice: updated });
  } catch (err) {
    logger.error('Void invoice error', { error: err.message });
    res.status(500).json({ error: 'Failed to void invoice', code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
