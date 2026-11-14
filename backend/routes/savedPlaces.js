const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const Joi = require('joi');
const { geocodeLimiter } = require('../middleware/rateLimiter');

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

// The city around a point, for an area's Today (POST /area/today): { city, state } from the geo provider's reverse
// lookup, both null when it names none (at sea, or a lookup that failed). Like GET /api/geo/reverse, an answer is kept
// in memory for five minutes only: Mapbox's temporary geocoding results are never stored.
const AREA_LOOKUP_TTL_MS = 300_000;
async function areaAt(latitude, longitude) {
  const { geoCache } = require('../utils/geoCache');
  const key = `area:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
  const kept = geoCache.get(key);
  if (kept) return kept;
  try {
    const found = await require('../services/geo').reverseGeocode(latitude, longitude);
    const area = { city: (found?.city || '').trim() || null, state: (found?.state || '').trim() || null };
    geoCache.set(key, area, AREA_LOOKUP_TTL_MS);
    return area;
  } catch (err) {
    const nothingThere = /No address found/.test(err.message || '');
    if (nothingThere) geoCache.set(key, { city: null, state: null }, AREA_LOOKUP_TTL_MS);
    // The point stays out of the log.
    else logger.warn('Area lookup failed', { error: err.message });
    return { city: null, state: null };
  }
}

// What an area is called: "Vancouver, WA"; with no city, its state's name ("Washington"); else "Near you".
function areaLabel({ city, state }) {
  if (city) return [city, state].filter(Boolean).join(', ');
  const { stateName } = require('../utils/usState');
  return stateName(state) || (state && !/^[A-Z]{2,3}$/.test(state) ? state : null) || 'Near you';
}

// POST /api/saved-places/area/today { latitude, longitude } — Today for the city around the person before they have a
// Home, a saved address or a claim (TABCARD section 4): what GET /:id/today answers (weather, air, alerts, sunrise and
// sunset; tier T1) for the point rounded again to two decimal places (about a kilometre), named for its city, plus
// `area` ({ label, city, state, latitude, longitude }) for the apps to keep on the device. It stores nothing: no
// SavedPlace, viewing location or briefing preferences. The point comes in the body, never the URL, and this route logs
// none; the shared composers log only what they log for GET /:id/today.
router.post('/area/today', verifyToken, geocodeLimiter, async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const { latitude, longitude } = req.body || {};
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    return res.status(400).json({ error: 'A valid latitude and longitude are required' });
  }
  const { coordinates } = require('../utils/timezone');
  const point = coordinates(Number(latitude.toFixed(2)), Number(longitude.toFixed(2)));
  // 0, 0 is where a phone with no fix says it is.
  if (!point) return res.status(400).json({ error: 'A valid latitude and longitude are required' });
  try {
    const found = await areaAt(point.latitude, point.longitude);
    const area = { label: areaLabel(found), city: found.city, state: found.state,
      latitude: point.latitude, longitude: point.longitude };
    const { composeSavedPlaceToday } = require('../services/placeIntelligenceService');
    const today = await composeSavedPlaceToday({ label: area.label, latitude: area.latitude, longitude: area.longitude,
      city: area.city, state: area.state });
    return res.json({ ...today, area });
  } catch (err) {
    logger.error('Failed to load area Today:', { error: err.message });
    return res.status(500).json({ error: 'Failed to load today for this area' });
  }
});

// GET /api/saved-places/:id/preview — the public address preview for the
// saved point itself. The web used to look the place up again by its label,
// and a label can be a name ("Gym", "City Hall") that geocodes to another state.
router.get('/:id/preview', verifyToken, async (req, res) => {
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
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    res.setHeader('Cache-Control', 'private, no-store');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.json({ status: 'could_not_place', tier: 'preview', region: null, message: 'This saved place has no location.' });
    }
    const { placePreviewWithBallot } = require('./public');
    return res.json(await placePreviewWithBallot({
      lat, lng, city: place.city || null, state: place.state || null, line: place.label, zipcode: null,
    }));
  } catch (err) {
    logger.error('Failed to load saved place preview:', err);
    return res.status(500).json({ error: 'Failed to load this saved place' });
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
    // New accounts start with both briefings on. Insert only preserves every
    // existing notification choice, including an explicit opt-out.
    const { error: preferencesError } = await supabaseAdmin
      .from('UserNotificationPreferences')
      .upsert({ user_id: req.user.id, daily_briefing_enabled: true, evening_briefing_enabled: true },
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
