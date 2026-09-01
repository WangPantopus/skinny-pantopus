// ============================================================
// LOCATION ENDPOINTS — Viewing Location + Recent Locations
// Manages the user's active "browsing location" that drives
// what content appears in Feed, Gigs, and Discover.
// ============================================================

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { ensureRegionCoverage } = require('../services/seederProvisioningService');

// ============ VALIDATION SCHEMAS ============

const setLocationSchema = Joi.object({
  label: Joi.string().max(255).required(),
  type: Joi.string().valid('gps', 'home', 'business', 'searched', 'recent').required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radiusMiles: Joi.number().valid(1, 3, 10, 25, 100, 1000, 25000).default(100),
  isPinned: Joi.boolean().default(false),
  sourceId: Joi.string().uuid().allow(null).optional(),
  city: Joi.string().max(100).allow(null, '').optional(),
  state: Joi.string().max(50).allow(null, '').optional(),
  zipcode: Joi.string().max(20).allow(null, '').optional(),
});

const pinSchema = Joi.object({
  isPinned: Joi.boolean().required(),
});

const radiusSchema = Joi.object({
  radiusMiles: Joi.number().valid(1, 3, 10, 25, 100, 1000, 25000).required(),
});

// ============ HELPERS ============

/** Extract lat/lng from PostGIS geography column via raw SQL */
function coordsFromGeo(geoStr) {
  // geography columns come as WKB hex or GeoJSON depending on driver
  // supabaseAdmin returns the raw value; we use ST_Y/ST_X in queries instead
  return null;
}

/** Shape a UserViewingLocation row into the API response format */
function formatVL(row) {
  if (!row) return null;
  return {
    label: row.label,
    type: row.type,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMiles: row.radius_miles,
    isPinned: row.is_pinned,
    sourceId: row.source_id || null,
    city: row.city || null,
    state: row.state || null,
    zipcode: row.zipcode || null,
    updatedAt: row.updated_at,
  };
}

/** Shape a UserRecentLocation row into the API response format */
function formatRecent(row) {
  return {
    id: row.id,
    label: row.label,
    type: row.type,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMiles: row.radius_miles,
    sourceId: row.source_id || null,
    city: row.city || null,
    state: row.state || null,
    usedAt: row.used_at,
  };
}

// ============ ROUTES ============

/**
 * GET /api/location
 * Returns the user's current VL, recent locations, homes, and business locations.
 * This is the primary payload the LocationPickerSheet needs.
 */
router.get('/', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Current Viewing Location
    const { data: vlRow } = await supabaseAdmin
      .from('UserViewingLocation')
      .select('*')
      .eq('user_id', userId)
      .single();

    // 2. Recent Locations (up to 5, newest first)
    const { data: recentRows } = await supabaseAdmin
      .from('UserRecentLocation')
      .select('*')
      .eq('user_id', userId)
      .order('used_at', { ascending: false })
      .limit(5);

    // 3. User's homes with coordinates
    //    HomeOccupancy → Home; extract lat/lng with ST_Y / ST_X
    const { data: homeRows } = await supabaseAdmin
      .rpc('get_user_home_locations', { p_user_id: userId });

    // 4. User's business locations
    const { data: bizLocRows } = await supabaseAdmin
      .rpc('get_user_business_locations', { p_user_id: userId });

    res.json({
      viewingLocation: formatVL(vlRow),
      recentLocations: (recentRows || []).map(formatRecent),
      homes: (homeRows || []).map((h) => ({
        id: h.home_id,
        name: h.home_name || h.address,
        city: h.city,
        state: h.state,
        latitude: h.latitude,
        longitude: h.longitude,
      })),
      businessLocations: (bizLocRows || []).map((bl) => ({
        id: bl.location_id,
        businessName: bl.business_name,
        label: bl.location_label,
        city: bl.city,
        state: bl.state,
        latitude: bl.latitude,
        longitude: bl.longitude,
      })),
    });
  } catch (err) {
    logger.error('GET /api/location error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to fetch location data' });
  }
});

/**
 * PUT /api/location
 * Set or update the user's Viewing Location (upsert).
 * Also adds to recent locations (deduped, auto-trimmed to 5).
 */
router.put('/', verifyToken, validate(setLocationSchema), async (req, res) => {
  const userId = req.user.id;
  const { label, type, latitude, longitude, radiusMiles, isPinned, sourceId, city, state, zipcode } = req.body;

  try {
    // 1. Upsert ViewingLocation
    const vlData = {
      user_id: userId,
      label,
      type,
      latitude,
      longitude,
      radius_miles: radiusMiles,
      is_pinned: isPinned,
      source_id: sourceId || null,
      city: city || null,
      state: state || null,
      zipcode: zipcode || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existingVL } = await supabaseAdmin
      .from('UserViewingLocation')
      .select('id')
      .eq('user_id', userId)
      .single();

    let vlRow;
    if (existingVL) {
      // Update
      const { data, error } = await supabaseAdmin
        .from('UserViewingLocation')
        .update(vlData)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (error) throw error;
      vlRow = data;
    } else {
      // Insert
      const { data, error } = await supabaseAdmin
        .from('UserViewingLocation')
        .insert(vlData)
        .select('*')
        .single();
      if (error) throw error;
      vlRow = data;
    }

    // 2. Add to recent locations (dedupe by label + close coordinates)
    //    Delete any existing recent with same label (case-insensitive)
    await supabaseAdmin
      .from('UserRecentLocation')
      .delete()
      .eq('user_id', userId)
      .ilike('label', label);

    // Insert new recent
    await supabaseAdmin
      .from('UserRecentLocation')
      .insert({
        user_id: userId,
        label,
        type,
        latitude,
        longitude,
        radius_miles: radiusMiles,
        source_id: sourceId || null,
        city: city || null,
        state: state || null,
        zipcode: zipcode || null,
        used_at: new Date().toISOString(),
      });
    // The trim trigger handles keeping only 5

    logger.info('Viewing location updated', { userId, label, type, isPinned });

    // Fire-and-forget: check if this location needs a seeder region provisioned
    ensureRegionCoverage({ latitude, longitude, city, state, userId }).catch(() => {});

    res.json({ viewingLocation: formatVL(vlRow) });
  } catch (err) {
    logger.error('PUT /api/location error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to update viewing location' });
  }
});

/**
 * PUT /api/location/pin
 * Toggle the pin status of the current VL.
 */
router.put('/pin', verifyToken, validate(pinSchema), async (req, res) => {
  const userId = req.user.id;
  const { isPinned } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from('UserViewingLocation')
      .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'No viewing location to pin. Set a location first.' });
    }

    logger.info('Pin toggled', { userId, isPinned });
    res.json({ isPinned: data.is_pinned });
  } catch (err) {
    logger.error('PUT /api/location/pin error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to update pin status' });
  }
});

/**
 * PUT /api/location/radius
 * Update the radius of the current VL.
 */
router.put('/radius', verifyToken, validate(radiusSchema), async (req, res) => {
  const userId = req.user.id;
  const { radiusMiles } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from('UserViewingLocation')
      .update({ radius_miles: radiusMiles, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'No viewing location to update. Set a location first.' });
    }

    logger.info('Radius updated', { userId, radiusMiles });
    res.json({ radiusMiles: data.radius_miles });
  } catch (err) {
    logger.error('PUT /api/location/radius error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to update radius' });
  }
});

/**
 * GET /api/location/recents
 * Get the user's recent locations (up to 5).
 */
router.get('/recents', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('UserRecentLocation')
      .select('*')
      .eq('user_id', userId)
      .order('used_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    res.json({ recentLocations: (rows || []).map(formatRecent) });
  } catch (err) {
    logger.error('GET /api/location/recents error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to fetch recent locations' });
  }
});

/**
 * DELETE /api/location/recents/:id
 * Remove a specific recent location.
 */
router.delete('/recents/:id', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('UserRecentLocation')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ message: 'Recent location removed' });
  } catch (err) {
    logger.error('DELETE /api/location/recents error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to remove recent location' });
  }
});

/**
 * GET /api/location/resolve
 * Resolve the default VL using the fallback chain.
 * Used on cold start when no cached VL exists on the client.
 *
 * Fallback order:
 *   1. Pinned VL
 *   2. Last VL updated within 24h
 *   3. User's primary home location
 *   4. User profile city/state
 *   5. null (client shows "Set location")
 */
router.get('/resolve', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Check for existing VL
    const { data: vlRow } = await supabaseAdmin
      .from('UserViewingLocation')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (vlRow) {
      // 1a. If pinned, always use it
      if (vlRow.is_pinned) {
        return res.json({ viewingLocation: formatVL(vlRow) });
      }

      // 1b. If updated within 24 hours, use it
      const updatedAt = new Date(vlRow.updated_at);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (updatedAt > twentyFourHoursAgo) {
        return res.json({ viewingLocation: formatVL(vlRow) });
      }
    }

    // 2. Try user's primary home
    const { data: homeRows } = await supabaseAdmin
      .rpc('get_user_home_locations', { p_user_id: userId });

    if (homeRows && homeRows.length > 0) {
      const home = homeRows[0]; // first home = primary
      if (home.latitude && home.longitude) {
        return res.json({
          viewingLocation: {
            label: [home.city, home.state].filter(Boolean).join(', ') || home.home_name,
            type: 'home',
            latitude: home.latitude,
            longitude: home.longitude,
            radiusMiles: 100,
            isPinned: false,
            sourceId: home.home_id,
            city: home.city || null,
            state: home.state || null,
            zipcode: null,
            updatedAt: null,
          },
        });
      }
    }

    // 3. Try user profile city
    const { data: user } = await supabaseAdmin
      .from('User')
      .select('city, state')
      .eq('id', userId)
      .single();

    if (user && user.city) {
      // We don't have exact coords for profile city, return label only
      // Client will need to geocode or show "Set location"
      return res.json({
        viewingLocation: {
          label: [user.city, user.state].filter(Boolean).join(', '),
          type: 'searched',
          latitude: null,
          longitude: null,
          radiusMiles: 100,
          isPinned: false,
          sourceId: null,
          city: user.city,
          state: user.state || null,
          zipcode: null,
          updatedAt: null,
        },
      });
    }

    // 4. No location resolvable
    res.json({ viewingLocation: null });
  } catch (err) {
    logger.error('GET /api/location/resolve error', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to resolve location' });
  }
});

module.exports = router;
