const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const Joi = require('joi');

// GET /api/saved-places — list user's saved places
router.get('/', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('SavedPlace')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw error;
    res.json({ savedPlaces: data || [] });
  } catch (err) {
    logger.error('Failed to fetch saved places:', err);
    res.status(500).json({ error: 'Failed to fetch saved places' });
  }
});

// A saved address is the caller's private public-information anchor. It is
// never resolved to a Home at the same coordinates or used as a membership.
router.get('/:id/today', verifyToken, async (req, res) => {
  if (Joi.string().uuid().validate(req.params.id).error) {
    return res.status(400).json({ error: 'Invalid saved place id' });
  }
  try {
    const { data: place, error } = await supabaseAdmin
      .from('SavedPlace')
      .select('id, label, latitude, longitude, city, state')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!place) return res.status(404).json({ error: 'Saved place not found' });
    const { composeSavedPlaceToday } = require('../services/placeIntelligenceService');
    const today = await composeSavedPlaceToday(place);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json(today);
  } catch (err) {
    logger.error('Failed to load saved place Today:', err);
    return res.status(500).json({ error: 'Failed to load today for this saved place' });
  }
});

// POST /api/saved-places — add a saved place
router.post('/', verifyToken, async (req, res) => {
  try {
    const { label, placeType, latitude, longitude, city, state, sourceId,
      geocodeProvider, geocodePlaceId } = req.body;

    if (req.body.expectedUserId && req.body.expectedUserId !== req.user.id) {
      return res.status(409).json({ error: 'Your account changed. Reload before saving this place.' });
    }
    if (typeof label !== 'string' || !label.trim() || label.length > 500 ||
      !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      return res.status(400).json({ error: 'A label and valid latitude and longitude are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('SavedPlace')
      .upsert({
        user_id: req.user.id,
        label: label.trim(),
        place_type: placeType || 'searched',
        latitude,
        longitude,
        city: city || null,
        state: state || null,
        source_id: sourceId || null,
        geocode_provider: geocodeProvider || 'mapbox',
        geocode_mode: 'temporary',
        geocode_accuracy: 'address',
        geocode_place_id: geocodePlaceId || sourceId || null,
        geocode_source_flow: 'saved_place',
        geocode_created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,latitude,longitude' })
      .select()
      .single();

    if (error) throw error;
    require('../services/context/providerOrchestrator').clearHubTodayCache(req.user.id);
    // Insert only: saving an address must never opt a new account into
    // briefings or overwrite an existing account's notification choices.
    const { error: preferencesError } = await supabaseAdmin
      .from('UserNotificationPreferences')
      .upsert({ user_id: req.user.id, daily_briefing_enabled: false, evening_briefing_enabled: false },
        { onConflict: 'user_id', ignoreDuplicates: true });
    if (preferencesError) throw preferencesError;
    res.status(201).json({ savedPlace: data });
  } catch (err) {
    logger.error('Failed to save place:', err);
    res.status(500).json({ error: 'Failed to save place' });
  }
});

// DELETE /api/saved-places/:id — remove a saved place
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('SavedPlace')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    require('../services/context/providerOrchestrator').clearHubTodayCache(req.user.id);
    res.json({ message: 'Saved place removed' });
  } catch (err) {
    logger.error('Failed to delete saved place:', err);
    res.status(500).json({ error: 'Failed to delete saved place' });
  }
});

module.exports = router;
