const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// GET /api/saved-places — list user's saved places
router.get('/', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('SavedPlace')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ savedPlaces: data || [] });
  } catch (err) {
    logger.error('Failed to fetch saved places:', err);
    res.status(500).json({ error: 'Failed to fetch saved places' });
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
    res.json({ message: 'Saved place removed' });
  } catch (err) {
    logger.error('Failed to delete saved place:', err);
    res.status(500).json({ error: 'Failed to delete saved place' });
  }
});

module.exports = router;
