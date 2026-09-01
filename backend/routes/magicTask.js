/**
 * Magic Task Routes
 * =================
 * AI-powered task posting — the "one sentence to structured task" flow.
 *
 * Mount at: app.use('/api/gigs', require('./routes/magicTask'));
 *
 * Endpoints:
 *   POST   /magic-draft         — Generate structured draft from free text
 *   POST   /magic-post          — AI draft + immediate post (with undo window)
 *   POST   /basic-draft         — Deterministic-only draft (no AI)
 *   POST   /:gigId/undo         — Undo a recently posted gig (within 10s window)
 *   GET    /templates/library   — Smart templates library (static chips)
 *   GET    /templates/saved     — User's saved task templates
 *   POST   /templates/saved     — Save a new task template
 *   DELETE /templates/saved/:id — Delete a saved template
 *   POST   /templates/saved/:id/use — Use a saved template (increment counter)
 */
const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { generateMagicDraft, generateBasicDraft, VALID_CATEGORIES } = require('../services/magicTaskService');
const { inferEngagementMode } = require('../services/offerScoringService');
const {
  careDetailsSchema,
  logisticsDetailsSchema,
  remoteDetailsSchema,
  urgentDetailsSchema,
  eventDetailsSchema,
} = require('../utils/moduleSchemas');
const { fanoutUrgentTask } = require('../services/urgentFanoutService');
const { alertMatchingSavedSearches } = require('../services/savedSearchAlertService');

// ── Undo window duration (ms) ────────────────────────────────
const UNDO_WINDOW_MS = 10_000; // 10 seconds

// ── Validation schemas ───────────────────────────────────────

const magicDraftSchema = Joi.object({
  text: Joi.string().min(3).max(2000).required(),
  context: Joi.object({
    homeId: Joi.string().uuid().allow(null).optional(),
    locationMode: Joi.string().valid('home', 'current', 'address', 'map_pin').optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    businessId: Joi.string().uuid().allow(null).optional(),
    budget: Joi.number().min(0).max(10000).allow(null).optional(),
  }).optional(),
  attachmentUrls: Joi.array().items(Joi.string().uri()).max(10).optional(),
});

const magicPostSchema = Joi.object({
  text: Joi.string().min(3).max(2000).required(),
  draft: Joi.object({
    title: Joi.string().max(255).required(),
    description: Joi.string().max(5000).required(),
    category: Joi.string().max(100).optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(5).optional(),
    pay_type: Joi.string().valid('fixed', 'hourly', 'offers').default('offers'),
    budget_fixed: Joi.number().min(0).max(10000).allow(null).optional(),
    hourly_rate: Joi.number().min(0).max(500).allow(null).optional(),
    estimated_hours: Joi.number().min(0).max(100).allow(null).optional(),
    schedule_type: Joi.string().valid('asap', 'today', 'scheduled', 'flexible').default('asap'),
    time_window_start: Joi.date().iso().allow(null).optional(),
    time_window_end: Joi.date().iso().allow(null).optional(),
    location_mode: Joi.string().valid('home', 'current', 'address', 'map_pin').default('home'),
    privacy_level: Joi.string().valid('approx', 'exact_after_accept', 'exact_immediately').default('exact_after_accept'),
    is_urgent: Joi.boolean().default(false),
    attachments: Joi.array().items(Joi.string().uri()).max(10).optional(),
    items: Joi.array().items(Joi.object({
      name: Joi.string().max(200).required(),
      notes: Joi.string().max(500).allow('', null).optional(),
      budgetCap: Joi.number().min(0).allow(null).optional(),
      preferredStore: Joi.string().max(200).allow('', null).optional(),
    })).max(20).optional(),
    // Power fields
    special_instructions: Joi.string().max(2000).allow('', null).optional(),
    access_notes: Joi.string().max(1000).allow('', null).optional(),
    required_tools: Joi.array().items(Joi.string().max(100)).max(10).optional(),
    language_preference: Joi.string().max(50).allow('', null).optional(),
    preferred_helper_id: Joi.string().uuid().allow(null).optional(),
    cancellation_policy: Joi.string().valid('flexible', 'standard', 'strict').default('standard'),
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
  }).required(),
  location: Joi.object({
    mode: Joi.string().valid('home', 'address', 'current', 'custom').optional(),
    latitude: Joi.number().min(-90).max(90).allow(null).optional(),
    longitude: Joi.number().min(-180).max(180).allow(null).optional(),
    address: Joi.string().max(500).allow('', null).optional(),
    city: Joi.string().allow('', null).optional(),
    state: Joi.string().allow('', null).optional(),
    zip: Joi.string().allow('', null).optional(),
    homeId: Joi.string().uuid().allow(null).optional(),
    place_id: Joi.string().allow('', null).optional(),
  }).allow(null).optional(),
  beneficiary_user_id: Joi.string().uuid().allow(null).optional(),
  source_flow: Joi.string().valid('magic', 'classic', 'template', 'context_shortcut').default('magic'),
  engagement_mode: Joi.string().valid('instant_accept', 'curated_offers', 'quotes').optional(),
  // T6.0b — helper-engagement format (in_person / drop_off / remote / hybrid).
  task_format: Joi.string().valid('in_person', 'drop_off', 'remote', 'hybrid').optional(),
  ai_confidence: Joi.number().min(0).max(1).allow(null).optional(),
  ai_draft_json: Joi.object().allow(null).optional(),
});

const savedTemplateSchema = Joi.object({
  label: Joi.string().min(2).max(200).required(),
  home_id: Joi.string().uuid().allow(null).optional(),
  template: Joi.object({
    title: Joi.string().max(255).optional(),
    description: Joi.string().max(5000).optional(),
    category: Joi.string().max(100).optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(5).optional(),
    pay_type: Joi.string().valid('fixed', 'hourly', 'offers').optional(),
    budget_fixed: Joi.number().min(0).max(10000).allow(null).optional(),
    hourly_rate: Joi.number().min(0).max(500).allow(null).optional(),
    schedule_type: Joi.string().valid('asap', 'today', 'scheduled', 'flexible').optional(),
    is_urgent: Joi.boolean().optional(),
    location_mode: Joi.string().valid('home', 'current', 'address', 'map_pin').optional(),
  }).required(),
});

// ── Helpers ──────────────────────────────────────────────────

function calculateApproxLocation(latitude, longitude) {
  return {
    latitude: Math.round(latitude * 10) / 10,
    longitude: Math.round(longitude * 10) / 10,
  };
}

function formatLocationForDB(latitude, longitude) {
  return `POINT(${longitude} ${latitude})`;
}

function normalizeMagicPostLocation(location) {
  if (!location || typeof location !== 'object') {
    return null;
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const address = typeof location.address === 'string' ? location.address.trim() : '';

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !address) {
    return null;
  }

  return {
    mode: location.mode || 'address',
    latitude,
    longitude,
    address,
    city: location.city || null,
    state: location.state || null,
    zip: location.zip || null,
    homeId: location.homeId || null,
    place_id: location.place_id || null,
  };
}

function mapPrivacyToEnum(privacyLevel) {
  switch (privacyLevel) {
    case 'exact_immediately': return 'exact_place';
    case 'approx': return 'neighborhood_only';
    case 'exact_after_accept':
    default: return 'approx_area';
  }
}

function mapPrivacyToReveal(privacyLevel) {
  switch (privacyLevel) {
    case 'exact_immediately': return 'public';
    case 'approx': return 'never_public';
    case 'exact_after_accept':
    default: return 'after_assignment';
  }
}

// ── SMART TEMPLATES LIBRARY (static, no auth required) ──────

const SMART_TEMPLATES = [
  {
    id: 'move_furniture',
    label: 'Move furniture',
    icon: '🛋️',
    template: {
      title: 'Help moving furniture',
      category: 'Moving',
      tags: ['heavy-lifting', 'indoor'],
      pay_type: 'offers',
      schedule_type: 'asap',
    },
  },
  {
    id: 'mount_tv',
    label: 'Mount TV',
    icon: '📺',
    template: {
      title: 'Mount TV on wall',
      category: 'Handyman',
      tags: ['indoor'],
      pay_type: 'fixed',
      schedule_type: 'today',
    },
  },
  {
    id: 'yard_cleanup',
    label: 'Yard cleanup',
    icon: '🌿',
    template: {
      title: 'Yard cleanup needed',
      category: 'Gardening',
      tags: ['outdoor'],
      pay_type: 'offers',
      schedule_type: 'flexible',
    },
  },
  {
    id: 'grocery_pickup',
    label: 'Pick up groceries',
    icon: '🛒',
    template: {
      title: 'Grocery pickup',
      category: 'Delivery',
      tags: [],
      pay_type: 'fixed',
      schedule_type: 'today',
    },
  },
  {
    id: 'dog_walk',
    label: 'Dog walking',
    icon: '🐕',
    template: {
      title: 'Dog walking needed',
      category: 'Pet Care',
      tags: ['outdoor'],
      pay_type: 'fixed',
      schedule_type: 'today',
    },
  },
  {
    id: 'general_cleaning',
    label: 'House cleaning',
    icon: '🧹',
    template: {
      title: 'House cleaning',
      category: 'Cleaning',
      tags: ['indoor'],
      pay_type: 'hourly',
      schedule_type: 'scheduled',
    },
  },
  {
    id: 'package_delivery',
    label: 'Deliver a package',
    icon: '📦',
    template: {
      title: 'Package delivery',
      category: 'Delivery',
      tags: [],
      pay_type: 'fixed',
      schedule_type: 'asap',
    },
  },
  {
    id: 'tech_help',
    label: 'Tech support',
    icon: '💻',
    template: {
      title: 'Tech support needed',
      category: 'Tech Support',
      tags: ['indoor'],
      pay_type: 'hourly',
      schedule_type: 'today',
    },
  },
  {
    id: 'lawn_mow',
    label: 'Mow lawn',
    icon: '🌱',
    template: {
      title: 'Lawn mowing',
      category: 'Gardening',
      tags: ['outdoor'],
      pay_type: 'fixed',
      schedule_type: 'flexible',
    },
  },
  {
    id: 'babysitting',
    label: 'Babysitting',
    icon: '👶',
    template: {
      title: 'Babysitter needed',
      category: 'Child Care',
      tags: [],
      pay_type: 'hourly',
      schedule_type: 'scheduled',
    },
  },
];

// ──────────────────────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────────────────────

/**
 * GET /api/gigs/templates/library
 * Returns the static smart templates library (quick chips).
 */
router.get('/templates/library', (_req, res) => {
  res.json({ templates: SMART_TEMPLATES });
});

/**
 * POST /api/gigs/magic-draft
 * Generate a structured task draft from free-text input.
 * Returns the draft, confidence score, and optional clarifying question.
 */
router.post('/magic-draft', verifyToken, validate(magicDraftSchema), async (req, res) => {
  const { text, context, attachmentUrls } = req.body;
  const userId = req.user.id;

  logger.info('Magic draft requested', { userId, textLength: text.length });

  try {
    const result = await generateMagicDraft(text, context || {});

    // If attachments were provided, mark them
    if (attachmentUrls && attachmentUrls.length > 0) {
      result.draft.attachments = attachmentUrls;
      result.draft.attachments_suggested = false; // User already provided them
    }

    res.json({
      draft: result.draft,
      confidence: result.confidence,
      fieldConfidence: result.fieldConfidence,
      clarifyingQuestion: result.clarifyingQuestion,
      source: result.source,
      elapsed: result.elapsed,
    });
  } catch (err) {
    logger.error('Magic draft error', { error: err.message, userId });

    // Fallback to basic draft on any error
    try {
      const basic = generateBasicDraft(text, context || {});
      res.json({
        ...basic,
        _fallback: true,
      });
    } catch (fallbackErr) {
      res.status(500).json({ error: 'Failed to generate task draft' });
    }
  }
});

/**
 * POST /api/gigs/basic-draft
 * Generate a draft using only the deterministic parser (no AI).
 */
router.post('/basic-draft', verifyToken, validate(magicDraftSchema), async (req, res) => {
  const { text, context } = req.body;
  const userId = req.user.id;

  try {
    const result = generateBasicDraft(text, context || {});
    res.json(result);
  } catch (err) {
    logger.error('Basic draft error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to generate basic draft' });
  }
});

/**
 * POST /api/gigs/magic-post
 * Create a gig from a magic task draft with an undo window.
 * The gig is inserted immediately but with undo_expires_at set.
 * During the undo window, the gig won't appear in search/feed.
 */
router.post('/magic-post', verifyToken, validate(magicPostSchema), async (req, res) => {
  const { text, draft, location, beneficiary_user_id, source_flow, engagement_mode, task_format, ai_confidence, ai_draft_json } = req.body;
  const userId = req.user.id;

  logger.info('Magic post', { userId, title: draft.title, source_flow });

  try {
    // ── Proxy posting check ──
    let effectiveUserId = userId;
    let createdBy = userId;

    if (beneficiary_user_id && beneficiary_user_id !== userId) {
      const { data: beneficiary } = await supabaseAdmin
        .from('User')
        .select('id, account_type')
        .eq('id', beneficiary_user_id)
        .single();

      if (!beneficiary || beneficiary.account_type !== 'business') {
        return res.status(400).json({ error: 'Beneficiary must be a business account' });
      }

      // Check permission via existing business permissions system
      const { hasPermission } = require('../utils/businessPermissions');
      const canPost = await hasPermission(beneficiary_user_id, userId, 'gigs.post');
      if (!canPost) {
        return res.status(403).json({ error: 'You do not have permission to post tasks for this business' });
      }

      effectiveUserId = beneficiary_user_id;
    }

    // ── Build gig data ──
    const normalizedLocation = normalizeMagicPostLocation(location);
    const approx = normalizedLocation
      ? calculateApproxLocation(normalizedLocation.latitude, normalizedLocation.longitude)
      : null;
    const resolvedEngagementMode = inferEngagementMode(
      draft.category || '',
      draft.schedule_type || 'asap',
      engagement_mode || null,
    );
    const undoExpiresAt = new Date(Date.now() + UNDO_WINDOW_MS).toISOString();

    // Map price: if pay_type is 'offers', price is 0 (or budget_fixed if set)
    let price = 0;
    if (draft.pay_type === 'fixed' && draft.budget_fixed) {
      price = draft.budget_fixed;
    } else if (draft.pay_type === 'hourly' && draft.hourly_rate) {
      price = draft.hourly_rate;
    } else if (draft.budget_fixed) {
      price = draft.budget_fixed;
    }
    // For "offers", fall back to the AI-suggested budget_range midpoint so the gig
    // doesn't display as "$1" — that's the DB constraint floor, not a meaningful price.
    if (price <= 0 && draft.budget_range) {
      const min = Number(draft.budget_range.min);
      const max = Number(draft.budget_range.max);
      if (Number.isFinite(min) && Number.isFinite(max) && max >= min && max > 0) {
        price = Math.round((min + max) / 2);
      }
    }
    // Last-resort default to satisfy the "price > 0" DB constraint.
    if (price <= 0) price = 1;

    const gigData = {
      title: draft.title,
      description: draft.description,
      price,
      category: draft.category || 'Other',
      user_id: effectiveUserId,
      created_by: createdBy,
      beneficiary_user_id: beneficiary_user_id || null,
      status: 'open',
      // New magic task fields
      schedule_type: draft.schedule_type || 'asap',
      pay_type: draft.pay_type || 'offers',
      time_window_start: draft.time_window_start || null,
      time_window_end: draft.time_window_end || null,
      is_urgent: draft.is_urgent || false,
      tags: draft.tags || [],
      attachments: draft.attachments || [],
      items: draft.items ? JSON.stringify(draft.items) : '[]',
      // Location
      origin_mode: normalizedLocation
        ? (normalizedLocation.mode === 'custom' ? 'address' : normalizedLocation.mode) || 'address'
        : null,
      origin_home_id: normalizedLocation?.homeId || null,
      origin_place_id: normalizedLocation?.place_id || null,
      exact_address: normalizedLocation?.address || null,
      exact_city: normalizedLocation?.city || null,
      exact_state: normalizedLocation?.state || null,
      exact_zip: normalizedLocation?.zip || null,
      exact_location: normalizedLocation
        ? formatLocationForDB(normalizedLocation.latitude, normalizedLocation.longitude)
        : null,
      approx_location: approx
        ? formatLocationForDB(approx.latitude, approx.longitude)
        : null,
      // Privacy
      location_precision: normalizedLocation ? mapPrivacyToEnum(draft.privacy_level) : 'none',
      reveal_policy: normalizedLocation ? mapPrivacyToReveal(draft.privacy_level) : 'never_public',
      visibility_scope: 'city',
      radius_miles: 10,
      // Policy defaults
      cancellation_policy: draft.cancellation_policy || 'standard',
      // Power fields
      special_instructions: draft.special_instructions || null,
      access_notes: draft.access_notes || null,
      required_tools: draft.required_tools || [],
      language_preference: draft.language_preference || null,
      preferred_helper_id: draft.preferred_helper_id || null,
      // Source tracking
      source_flow: source_flow || 'magic',
      engagement_mode: resolvedEngagementMode,
      // T6.0b — helper-engagement format. Defaults to in_person via DB.
      task_format: task_format || null,
      ai_confidence: ai_confidence || null,
      ai_draft_json: ai_draft_json || null,
      // Task archetype + module fields
      task_archetype: draft.task_archetype || null,
      starts_asap: draft.starts_asap ?? false,
      response_window_minutes: draft.response_window_minutes || null,
      care_details: draft.care_details || null,
      logistics_details: draft.logistics_details || null,
      remote_details: draft.remote_details || null,
      urgent_details: draft.urgent_details || null,
      event_details: draft.event_details || null,
      // Undo window
      undo_expires_at: undoExpiresAt,
      // Geocode provenance
      geocode_provider: normalizedLocation?.geocode_provider || 'mapbox',
      geocode_mode: 'temporary',
      geocode_accuracy: normalizedLocation?.geocode_accuracy || 'address',
      geocode_place_id: normalizedLocation?.place_id || null,
      geocode_source_flow: 'magic_task_create',
      geocode_created_at: new Date().toISOString(),
    };

    // Duration mapping
    if (draft.estimated_hours) {
      gigData.estimated_duration = draft.estimated_hours;
    }

    // Scheduling: mirror the magic task time_window_start into the canonical Gig.scheduled_start
    // column so the gig detail page (and downstream features that read scheduled_start) can show it.
    // time_window_end becomes deadline, with the same intent.
    if (draft.time_window_start) {
      gigData.scheduled_start = draft.time_window_start;
    }
    if (draft.time_window_end) {
      gigData.deadline = draft.time_window_end;
    }

    const { data: gig, error } = await supabaseAdmin
      .from('Gig')
      .insert(gigData)
      .select('id, title, description, price, category, status, created_at, user_id, created_by, undo_expires_at, schedule_type, pay_type')
      .single();

    if (error) {
      logger.error('Magic post insert error', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to create task' });
    }

    // ── Compute nearby helpers + urgent fanout in parallel (with timeout) ──
    const locationCoords = normalizedLocation
      ? { latitude: normalizedLocation.latitude, longitude: normalizedLocation.longitude }
      : null;

    // P6 — saved-search alerts. Fire-and-forget: a fan-out failure must
    // never fail the post.
    if (locationCoords) {
      alertMatchingSavedSearches(gig, locationCoords).catch(() => {});
    }

    let nearbyHelpers = null;
    let notifiedCount = 0;

    const HELPER_COUNT_TIMEOUT = 2000;

    const nearbyHelpersPromise = (async () => {
      if (!locationCoords) return null;
      try {
        const { data: nearbyHomes, error: homeErr } = await supabaseAdmin.rpc(
          'find_homes_nearby',
          {
            user_lat: locationCoords.latitude,
            user_lon: locationCoords.longitude,
            radius_meters: 10 * 1609,
          },
        );
        if (homeErr || !nearbyHomes || nearbyHomes.length === 0) return 0;

        const homeIds = nearbyHomes.map((h) => h.id);
        const { data: occupants, error: occErr } = await supabaseAdmin
          .from('HomeOccupancy')
          .select('user_id')
          .in('home_id', homeIds)
          .not('user_id', 'eq', userId);

        if (occErr || !occupants) return 0;
        const uniqueUsers = new Set(occupants.map((o) => o.user_id));
        return uniqueUsers.size;
      } catch {
        return null;
      }
    })();

    const fanoutPromise = (gigData.is_urgent || gigData.starts_asap)
      ? fanoutUrgentTask(gig.id, gigData, userId, locationCoords)
      : Promise.resolve(0);

    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve('timeout'), HELPER_COUNT_TIMEOUT),
    );

    const [helpersResult, fanoutResult] = await Promise.allSettled([
      Promise.race([nearbyHelpersPromise, timeoutPromise]),
      Promise.race([fanoutPromise, timeoutPromise]),
    ]);

    if (helpersResult.status === 'fulfilled' && helpersResult.value !== 'timeout') {
      nearbyHelpers = helpersResult.value;
    }
    if (fanoutResult.status === 'fulfilled' && fanoutResult.value !== 'timeout' && typeof fanoutResult.value === 'number') {
      notifiedCount = fanoutResult.value;
    }

    // Increment user's magic task post count (non-critical if this fails).
    try {
      const { error: incError } = await supabaseAdmin.rpc('increment_field', {
        table_name: 'User',
        row_id: userId,
        field_name: 'magic_task_post_count',
        amount: 1,
      });

      if (incError) {
        const { data: userRow, error: userFetchError } = await supabaseAdmin
          .from('User')
          .select('magic_task_post_count')
          .eq('id', userId)
          .single();

        if (userFetchError) {
          logger.warn('Magic post count fallback fetch failed', { userId, error: userFetchError.message });
        } else {
          const nextCount = Number(userRow?.magic_task_post_count || 0) + 1;
          const { error: userUpdateError } = await supabaseAdmin
            .from('User')
            .update({ magic_task_post_count: nextCount })
            .eq('id', userId);
          if (userUpdateError) {
            logger.warn('Magic post count fallback update failed', { userId, error: userUpdateError.message });
          }
        }
      }
    } catch (countErr) {
      logger.warn('Magic post count increment failed', { userId, error: countErr.message });
    }

    logger.info('Magic task posted', {
      gigId: gig.id,
      userId,
      source_flow,
      confidence: ai_confidence,
      undoExpiresAt,
    });

    res.status(201).json({
      message: 'Task posted',
      gig: {
        ...gig,
        undo_window_ms: UNDO_WINDOW_MS,
        can_undo: true,
      },
      nearby_helpers: nearbyHelpers,
      notified_count: notifiedCount,
    });
  } catch (err) {
    logger.error('Magic post error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * POST /api/gigs/:gigId/undo
 * Undo a recently posted gig (within the 10-second undo window).
 * Deletes the gig entirely.
 */
router.post('/:gigId/undo', verifyToken, async (req, res) => {
  const { gigId } = req.params;
  const userId = req.user.id;

  try {
    // Fetch the gig
    const { data: gig, error: fetchError } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, created_by, undo_expires_at, status')
      .eq('id', gigId)
      .single();

    if (fetchError || !gig) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Must be the creator
    if (String(gig.created_by || gig.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'You can only undo your own tasks' });
    }

    // Must be in undo window
    if (!gig.undo_expires_at) {
      return res.status(400).json({ error: 'This task does not have an undo window' });
    }

    const expiresAt = new Date(gig.undo_expires_at);
    if (Date.now() > expiresAt.getTime()) {
      return res.status(400).json({ error: 'Undo window has expired' });
    }

    // Must still be in open status
    if (gig.status !== 'open') {
      return res.status(400).json({ error: 'Cannot undo a task that has already been accepted' });
    }

    // Delete the gig
    const { error: deleteError } = await supabaseAdmin
      .from('Gig')
      .delete()
      .eq('id', gigId);

    if (deleteError) {
      logger.error('Undo delete error', { error: deleteError.message, gigId, userId });
      return res.status(500).json({ error: 'Failed to undo task' });
    }

    logger.info('Magic task undone', { gigId, userId });
    res.json({ message: 'Task undone', gigId });
  } catch (err) {
    logger.error('Undo error', { error: err.message, gigId, userId });
    res.status(500).json({ error: 'Failed to undo task' });
  }
});

// ── SAVED TEMPLATES ─────────────────────────────────────────

/**
 * GET /api/gigs/templates/saved
 * Get user's saved task templates.
 */
router.get('/templates/saved', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const { data: templates, error } = await supabaseAdmin
      .from('SavedTaskTemplate')
      .select('*')
      .eq('user_id', userId)
      .order('use_count', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('Fetch saved templates error', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch templates' });
    }

    res.json({ templates: templates || [] });
  } catch (err) {
    logger.error('Saved templates error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * POST /api/gigs/templates/saved
 * Save a new task template.
 */
router.post('/templates/saved', verifyToken, validate(savedTemplateSchema), async (req, res) => {
  const userId = req.user.id;
  const { label, home_id, template } = req.body;

  try {
    // Cap at 20 templates per user
    const { count } = await supabaseAdmin
      .from('SavedTaskTemplate')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (count >= 20) {
      return res.status(400).json({ error: 'Maximum 20 saved templates reached' });
    }

    const { data: saved, error } = await supabaseAdmin
      .from('SavedTaskTemplate')
      .insert({
        user_id: userId,
        home_id: home_id || null,
        label,
        template,
      })
      .select('*')
      .single();

    if (error) {
      logger.error('Save template error', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to save template' });
    }

    res.status(201).json({ template: saved });
  } catch (err) {
    logger.error('Save template error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to save template' });
  }
});

/**
 * DELETE /api/gigs/templates/saved/:id
 * Delete a saved template.
 */
router.delete('/templates/saved/:id', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('SavedTaskTemplate')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.error('Delete template error', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to delete template' });
    }

    res.json({ message: 'Template deleted' });
  } catch (err) {
    logger.error('Delete template error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * POST /api/gigs/templates/saved/:id/use
 * Record usage of a saved template (increments use_count).
 */
router.post('/templates/saved/:id/use', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    // Fetch to verify ownership
    const { data: tmpl, error: fetchErr } = await supabaseAdmin
      .from('SavedTaskTemplate')
      .select('id, use_count')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !tmpl) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('SavedTaskTemplate')
      .update({
        use_count: (tmpl.use_count || 0) + 1,
        last_used: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update template' });
    }

    res.json({ template: updated });
  } catch (err) {
    logger.error('Use template error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to use template' });
  }
});

/**
 * GET /api/gigs/magic-settings
 * Get user's magic task preferences (instant post mode, post count).
 */
router.get('/magic-settings', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const { data: user, error } = await supabaseAdmin
      .from('User')
      .select('magic_task_instant_post, magic_task_post_count')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }

    res.json({
      instant_post: user?.magic_task_instant_post || false,
      post_count: user?.magic_task_post_count || 0,
      // Suggest instant post after 3 successful magic posts
      suggest_instant: (user?.magic_task_post_count || 0) >= 3 && !user?.magic_task_instant_post,
    });
  } catch (err) {
    logger.error('Magic settings error', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * PATCH /api/gigs/magic-settings
 * Update user's magic task preferences.
 */
router.patch('/magic-settings', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { instant_post } = req.body;

  if (typeof instant_post !== 'boolean') {
    return res.status(400).json({ error: 'instant_post must be a boolean' });
  }

  try {
    await supabaseAdmin
      .from('User')
      .update({ magic_task_instant_post: instant_post })
      .eq('id', userId);

    res.json({ instant_post });
  } catch (err) {
    logger.error('Magic settings update error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
