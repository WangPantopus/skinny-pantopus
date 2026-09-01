/**
 * Professional Profile Routes
 *
 * Professional = User mode, NOT a separate entity.
 * Implemented via UserProfessionalProfile table.
 *
 * If profile exists → user is a professional.
 * If is_public = true → discoverable on map/search.
 * If verified → ranking boost.
 *
 * Routes:
 *   POST   /api/professional/profile            - Enable/create professional profile
 *   GET    /api/professional/profile/me          - Get my professional profile (200, profile null if not enabled)
 *   PATCH  /api/professional/profile/me          - Update my professional profile
 *   DELETE /api/professional/profile/me          - Disable professional mode
 *   GET    /api/professional/:username           - Get public professional profile
 *   GET    /api/professional/discover            - Discover professionals (search/map)
 *   POST   /api/professional/verification/start  - Start verification process
 *   GET    /api/professional/verification/status  - Check verification status
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { canViewProfessionalProfile, isBlocked } = require('../utils/visibilityPolicy');

// ============ VALIDATION ============

const VALID_CATEGORIES = [
  'handyman', 'plumber', 'electrician', 'landscaping', 'cleaning',
  'painting', 'moving', 'pet_care', 'tutoring', 'photography',
  'catering', 'personal_training', 'auto_repair', 'carpentry',
  'roofing', 'hvac', 'pest_control', 'appliance_repair',
  'interior_design', 'event_planning', 'music_lessons',
  'web_development', 'graphic_design', 'writing', 'consulting',
  'childcare', 'elder_care', 'delivery', 'errand_running', 'other',
];

const createProfileSchema = Joi.object({
  headline: Joi.string().max(200).optional(),
  bio: Joi.string().max(2000).optional(),
  categories: Joi.array().items(Joi.string().valid(...VALID_CATEGORIES)).max(5).optional(),
  service_area: Joi.object({
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    radius_km: Joi.number().min(1).max(500).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
  }).optional(),
  pricing_meta: Joi.object({
    hourly_rate: Joi.number().min(0).optional(),
    flat_rate: Joi.number().min(0).optional(),
    currency: Joi.string().length(3).default('USD').optional(),
    pricing_note: Joi.string().max(500).optional(),
  }).optional(),
  is_public: Joi.boolean().default(true),
});

const updateProfileSchema = Joi.object({
  headline: Joi.string().max(200).optional().allow(null, ''),
  bio: Joi.string().max(2000).optional().allow(null, ''),
  categories: Joi.array().items(Joi.string().valid(...VALID_CATEGORIES)).max(5).optional(),
  service_area: Joi.object({
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    radius_km: Joi.number().min(1).max(500).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
  }).optional().allow(null),
  pricing_meta: Joi.object({
    hourly_rate: Joi.number().min(0).optional(),
    flat_rate: Joi.number().min(0).optional(),
    currency: Joi.string().length(3).optional(),
    pricing_note: Joi.string().max(500).optional(),
  }).optional().allow(null),
  is_public: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
});

// ============ ROUTES ============

/**
 * POST /profile - Enable/create professional profile
 */
router.post('/profile', verifyToken, validate(createProfileSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { headline, bio, categories, service_area, pricing_meta, is_public } = req.body;

    // Check if already has a profile
    const { data: existing } = await supabaseAdmin
      .from('UserProfessionalProfile')
      .select('id, is_active')
      .eq('user_id', userId)
      .single();

    if (existing) {
      if (existing.is_active) {
        return res.status(400).json({ error: 'Professional profile already exists. Use PATCH to update.' });
      }

      // Re-activate deactivated profile
      const { data: reactivated, error } = await supabaseAdmin
        .from('UserProfessionalProfile')
        .update({
          is_active: true,
          headline: headline || existing.headline,
          bio: bio || existing.bio,
          categories: categories || existing.categories,
          service_area: service_area || existing.service_area,
          pricing_meta: pricing_meta || existing.pricing_meta,
          is_public: is_public !== undefined ? is_public : true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        logger.error('Error reactivating professional profile', { error: error.message });
        return res.status(500).json({ error: 'Failed to reactivate professional profile' });
      }

      return res.json({ message: 'Professional mode re-enabled', profile: reactivated });
    }

    // Create new profile
    const { data: profile, error } = await supabaseAdmin
      .from('UserProfessionalProfile')
      .insert({
        user_id: userId,
        headline: headline || null,
        bio: bio || null,
        categories: categories || [],
        service_area: service_area || null,
        pricing_meta: pricing_meta || null,
        is_public: is_public !== undefined ? is_public : true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Professional profile already exists' });
      }
      logger.error('Error creating professional profile', { error: error.message });
      return res.status(500).json({ error: 'Failed to create professional profile' });
    }

    res.status(201).json({ message: 'Professional mode enabled', profile });
  } catch (err) {
    logger.error('Create professional profile error', { error: err.message });
    res.status(500).json({ error: 'Failed to create professional profile' });
  }
});

/**
 * GET /profile/me - Get my professional profile
 */
router.get('/profile/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile, error } = await supabaseAdmin
      .from('UserProfessionalProfile')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error('Get my professional profile query error', { error: error.message });
      return res.status(500).json({ error: 'Failed to fetch professional profile' });
    }

    // 200 + null: user has not enabled professional mode (avoid 404 in browser for normal case)
    res.json({ profile: profile ?? null });
  } catch (err) {
    logger.error('Get my professional profile error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch professional profile' });
  }
});

/**
 * PATCH /profile/me - Update my professional profile
 */
router.patch('/profile/me', verifyToken, validate(updateProfileSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = { ...req.body, updated_at: new Date().toISOString() };

    const { data: profile, error } = await supabaseAdmin
      .from('UserProfessionalProfile')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating professional profile', { error: error.message });
      return res.status(500).json({ error: 'Failed to update professional profile' });
    }

    if (!profile) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    res.json({ message: 'Profile updated', profile });
  } catch (err) {
    logger.error('Update professional profile error', { error: err.message });
    res.status(500).json({ error: 'Failed to update professional profile' });
  }
});

/**
 * DELETE /profile/me - Disable professional mode (soft delete)
 */
router.delete('/profile/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile, error } = await supabaseAdmin
      .from('UserProfessionalProfile')
      .update({
        is_active: false,
        is_public: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error disabling professional profile', { error: error.message });
      return res.status(500).json({ error: 'Failed to disable professional mode' });
    }

    if (!profile) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    res.json({ message: 'Professional mode disabled', profile });
  } catch (err) {
    logger.error('Disable professional profile error', { error: err.message });
    res.status(500).json({ error: 'Failed to disable professional mode' });
  }
});

/**
 * GET /discover - Discover professionals (search/map)
 * IMPORTANT: Must be registered before /:username to avoid route collision.
 */
router.get('/discover', async (req, res) => {
  try {
    const { category, city, state, limit = 20, offset = 0 } = req.query;

    let query = supabaseAdmin
      .from('UserProfessionalProfile')
      .select(`
        *,
        user:user_id (id, username, name, first_name, last_name, profile_picture_url, city, state, average_rating)
      `)
      .eq('is_active', true)
      .eq('is_public', true)
      .order('verification_tier', { ascending: false })
      .order('boost_multiplier', { ascending: false })
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (category) {
      query = query.contains('categories', [category]);
    }

    const { data: profiles, error } = await query;

    if (error) {
      logger.error('Error discovering professionals', { error: error.message });
      return res.status(500).json({ error: 'Failed to discover professionals' });
    }

    // Filter by city/state at app level (for flexibility)
    let filtered = profiles || [];
    if (city) {
      filtered = filtered.filter(p =>
        p.user?.city?.toLowerCase().includes(city.toLowerCase()) ||
        p.service_area?.city?.toLowerCase().includes(city.toLowerCase())
      );
    }
    if (state) {
      filtered = filtered.filter(p =>
        p.user?.state?.toLowerCase() === state.toLowerCase() ||
        p.service_area?.state?.toLowerCase() === state.toLowerCase()
      );
    }

    res.json({ professionals: filtered });
  } catch (err) {
    logger.error('Discover professionals error', { error: err.message });
    res.status(500).json({ error: 'Failed to discover professionals' });
  }
});

/**
 * POST /verification/start - Start verification process
 * IMPORTANT: Must be registered before /:username to avoid route collision.
 */
router.post('/verification/start', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tier = 1 } = req.body;

    if (![1, 2].includes(tier)) {
      return res.status(400).json({ error: 'Invalid verification tier. Must be 1 or 2.' });
    }

    // Get current profile
    const { data: profile } = await supabaseAdmin
      .from('UserProfessionalProfile')
      .select('id, verification_tier, verification_status')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Enable professional mode first' });
    }

    if (profile.verification_status === 'pending') {
      return res.status(400).json({ error: 'Verification already in progress' });
    }

    if (profile.verification_tier >= tier && profile.verification_status === 'verified') {
      return res.status(400).json({ error: `Already verified at tier ${profile.verification_tier}` });
    }

    // Update to pending
    const { data: updated, error } = await supabaseAdmin
      .from('UserProfessionalProfile')
      .update({
        verification_status: 'pending',
        verification_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error starting verification', { error: error.message });
      return res.status(500).json({ error: 'Failed to start verification' });
    }

    // TODO: Integrate with external verification provider
    // For now, this creates the pending state for admin review

    res.json({
      message: `Verification process started for tier ${tier}`,
      verification_status: updated.verification_status,
    });
  } catch (err) {
    logger.error('Start verification error', { error: err.message });
    res.status(500).json({ error: 'Failed to start verification' });
  }
});

/**
 * GET /verification/status - Check verification status
 * IMPORTANT: Must be registered before /:username to avoid route collision.
 */
router.get('/verification/status', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile } = await supabaseAdmin
      .from('UserProfessionalProfile')
      .select('verification_tier, verification_status, verification_submitted_at, verification_completed_at')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'No professional profile found' });
    }

    res.json({
      tier: profile.verification_tier,
      status: profile.verification_status,
      submitted_at: profile.verification_submitted_at,
      completed_at: profile.verification_completed_at,
    });
  } catch (err) {
    logger.error('Verification status error', { error: err.message });
    res.status(500).json({ error: 'Failed to check verification status' });
  }
});

/**
 * GET /:username - Get public professional profile
 * IMPORTANT: This route uses a dynamic param, so it must be registered LAST
 * to avoid catching /discover, /verification/*, /profile/* etc.
 */
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Get user by username
    const { data: user } = await supabaseAdmin
      .from('User')
      .select('id, username, name, first_name, last_name, profile_picture_url, city, state, average_rating')
      .eq('username', username)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get professional profile
    const { data: profile } = await supabaseAdmin
      .from('UserProfessionalProfile')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile || !profile.is_active) {
      return res.status(404).json({ error: 'Professional profile not found or inactive' });
    }

    // Check visibility
    const viewerId = req.headers.authorization ? null : null; // Will be populated by optional auth
    if (viewerId) {
      const canView = await canViewProfessionalProfile(viewerId, profile);
      if (!canView) {
        return res.status(403).json({ error: 'Cannot view this profile' });
      }
    } else if (!profile.is_public) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    // Get portfolio items
    const { data: portfolio } = await supabaseAdmin
      .from('UserPortfolio')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_visible', true)
      .order('display_order', { ascending: true })
      .limit(12);

    // Get skills
    const { data: skills } = await supabaseAdmin
      .from('UserSkill')
      .select('skill_name')
      .eq('user_id', user.id);

    // Get review stats
    const { data: reviews } = await supabaseAdmin
      .from('Review')
      .select('rating')
      .eq('reviewee_id', user.id);

    const reviewCount = reviews?.length || 0;
    const avgRating = reviewCount > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 100) / 100
      : 0;

    res.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture_url: user.profile_picture_url,
        city: user.city,
        state: user.state,
      },
      professional: {
        headline: profile.headline,
        bio: profile.bio,
        categories: profile.categories,
        service_area: profile.service_area,
        pricing_meta: profile.pricing_meta,
        verification_tier: profile.verification_tier,
        verification_status: profile.verification_status,
        boost_multiplier: profile.boost_multiplier,
      },
      portfolio: portfolio || [],
      skills: (skills || []).map(s => s.skill_name),
      review_stats: {
        count: reviewCount,
        average: avgRating,
      },
    });
  } catch (err) {
    logger.error('Get public professional profile error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch professional profile' });
  }
});


module.exports = router;
