const express = require('express');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { geoCache } = require('../utils/geoCache');
const geoProvider = require('../services/geo');
const router = express.Router();

/** Label for geo provider in log events. */
const providerLabel = 'geo_provider';

/**
 * Hash an IP address for privacy-safe logging.
 */
function hashIp(req) {
  const raw = req.ip || req.connection?.remoteAddress || 'unknown';
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

/**
 * Redact a query string to first 3 characters for privacy.
 */
function redactQuery(q) {
  if (!q || typeof q !== 'string') return '';
  return q.slice(0, 3) + (q.length > 3 ? '***' : '');
}

/**
 * Log a geo response and return elapsed ms.
 */
function logResponse(startTime, fields) {
  const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
  const responseTimeMs = Math.round(elapsed * 100) / 100;
  logger.info('geo_response', { response_time_ms: responseTimeMs, ...fields });
  return responseTimeMs;
}

// ── GET /geo/autocomplete?q=... ──────────────────────────────

router.get('/autocomplete', async (req, res) => {
  const startTime = process.hrtime.bigint();
  const ipHash = hashIp(req);
  const q = (req.query.q || '').toString().trim();

  logger.info('geo_request', {
    endpoint: '/geo/autocomplete',
    method: 'GET',
    query_redacted: redactQuery(q),
    ip_hash: ipHash,
  });

  try {
    if (q.length < 3) {
      logResponse(startTime, {
        endpoint: '/geo/autocomplete',
        status: 200,
        result_count: 0,
        provider: 'none',
        cache_hit: false,
      });
      return res.json({ suggestions: [] });
    }

    // Check route-level cache
    const cacheKey = 'ac:' + q.toLowerCase();
    const cached = geoCache.get(cacheKey);
    if (cached) {
      logResponse(startTime, {
        endpoint: '/geo/autocomplete',
        status: 200,
        result_count: cached.suggestions.length,
        provider: providerLabel,
        cache_hit: true,
      });
      return res.json(cached);
    }

    const result = await geoProvider.autocomplete(q, { limit: 6, country: 'us' });

    // Back-compat: map NormalizedSuggestion → legacy shape so existing
    // clients that expect { place_id, label, center: [lng,lat], context, ... }
    // continue to work during the migration window.
    const legacySuggestions = result.suggestions.map((s) => ({
      place_id: s.suggestion_id,
      label: s.label,
      center: s.center ? [s.center.lng, s.center.lat] : undefined,
      text: s.primary_text,
      // New fields available for updated clients:
      suggestion_id: s.suggestion_id,
      primary_text: s.primary_text,
      secondary_text: s.secondary_text,
      kind: s.kind,
    }));

    const responseBody = { suggestions: legacySuggestions };
    geoCache.set(cacheKey, responseBody, 60_000); // 60s TTL

    logResponse(startTime, {
      endpoint: '/geo/autocomplete',
      status: 200,
      result_count: legacySuggestions.length,
      provider: providerLabel,
      cache_hit: false,
    });

    res.json(responseBody);
  } catch (e) {
    logResponse(startTime, {
      endpoint: '/geo/autocomplete',
      status: 500,
      result_count: 0,
      provider: providerLabel,
      cache_hit: false,
    });
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ── POST /geo/resolve { suggestion_id } ──────────────────────

router.post('/resolve', async (req, res) => {
  const startTime = process.hrtime.bigint();
  const ipHash = hashIp(req);
  const suggestionId = (req.body?.suggestion_id || '').toString().trim();

  logger.info('geo_request', {
    endpoint: '/geo/resolve',
    method: 'POST',
    query_redacted: redactQuery(suggestionId),
    ip_hash: ipHash,
  });

  try {
    if (!suggestionId) {
      logResponse(startTime, {
        endpoint: '/geo/resolve',
        status: 400,
        result_count: 0,
        provider: 'none',
        cache_hit: false,
      });
      return res.status(400).json({ error: 'suggestion_id is required' });
    }

    // Check route-level cache
    const cacheKey = 'rs:' + suggestionId;
    const cached = geoCache.get(cacheKey);
    if (cached) {
      logResponse(startTime, {
        endpoint: '/geo/resolve',
        status: 200,
        result_count: 1,
        provider: providerLabel,
        cache_hit: true,
      });
      return res.json(cached);
    }

    const normalized = await geoProvider.resolve(suggestionId);
    const responseBody = { normalized };
    geoCache.set(cacheKey, responseBody, 600_000); // 600s TTL

    logResponse(startTime, {
      endpoint: '/geo/resolve',
      status: 200,
      result_count: 1,
      provider: providerLabel,
      cache_hit: false,
    });

    res.json(responseBody);
  } catch (e) {
    logResponse(startTime, {
      endpoint: '/geo/resolve',
      status: 500,
      result_count: 0,
      provider: providerLabel,
      cache_hit: false,
    });
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ── GET /geo/reverse?lat=..&lon=.. ───────────────────────────

router.get('/reverse', async (req, res) => {
  const startTime = process.hrtime.bigint();
  const ipHash = hashIp(req);

  logger.info('geo_request', {
    endpoint: '/geo/reverse',
    method: 'GET',
    query_redacted: `lat=${redactQuery(req.query.lat)}&lon=${redactQuery(req.query.lon)}`,
    ip_hash: ipHash,
  });

  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      logResponse(startTime, {
        endpoint: '/geo/reverse',
        status: 400,
        result_count: 0,
        provider: 'none',
        cache_hit: false,
      });
      return res.status(400).json({ error: 'lat and lon are required numbers' });
    }

    // Check cache — round to 4 decimal places (~11m precision)
    const cacheKey = 'rv:' + lat.toFixed(4) + ':' + lon.toFixed(4);
    const cached = geoCache.get(cacheKey);
    if (cached) {
      logResponse(startTime, {
        endpoint: '/geo/reverse',
        status: 200,
        result_count: 1,
        provider: providerLabel,
        cache_hit: true,
      });
      return res.json(cached);
    }

    const normalized = await geoProvider.reverseGeocode(lat, lon);
    const responseBody = { normalized };
    geoCache.set(cacheKey, responseBody, 300_000); // 300s TTL

    logResponse(startTime, {
      endpoint: '/geo/reverse',
      status: 200,
      result_count: 1,
      provider: providerLabel,
      cache_hit: false,
    });

    res.json(responseBody);
  } catch (e) {
    const status = e.message?.includes('No address found') ? 404 : 500;
    logResponse(startTime, {
      endpoint: '/geo/reverse',
      status,
      result_count: 0,
      provider: providerLabel,
      cache_hit: false,
    });
    res.status(status).json({ error: e.message || 'Server error' });
  }
});

// ── GET /geo/places/nearby?lat=..&lng=.. ─────────────────────
// Named places (POIs) + locality around a point for the place-tag picker.

router.get('/places/nearby', async (req, res) => {
  const startTime = process.hrtime.bigint();
  const ipHash = hashIp(req);
  const rawLng = req.query.lng ?? req.query.lon; // accept `lon` alias

  logger.info('geo_request', {
    endpoint: '/geo/places/nearby',
    method: 'GET',
    query_redacted: `lat=${redactQuery(req.query.lat)}&lng=${redactQuery(rawLng)}`,
    ip_hash: ipHash,
  });

  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(rawLng);

    // Range-check too: out-of-range coords would burn two billable Mapbox
    // calls per request (this endpoint is unauthenticated) only to surface
    // an upstream 422 as a 500.
    if (!Number.isFinite(lat) || !Number.isFinite(lng)
      || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      logResponse(startTime, {
        endpoint: '/geo/places/nearby',
        status: 400,
        result_count: 0,
        provider: 'none',
        cache_hit: false,
      });
      return res.status(400).json({ error: 'lat and lng are required numbers' });
    }

    // Check cache — round to 4 decimal places (~11m precision)
    const cacheKey = 'pn:' + lat.toFixed(4) + ':' + lng.toFixed(4);
    const cached = geoCache.get(cacheKey);
    if (cached) {
      logResponse(startTime, {
        endpoint: '/geo/places/nearby',
        status: 200,
        result_count: cached.places.length,
        provider: providerLabel,
        cache_hit: true,
      });
      return res.json(cached);
    }

    const result = await geoProvider.nearbyPlaces(lat, lng, { limit: 10 });
    const responseBody = { places: result.places, locality: result.locality ?? null };
    geoCache.set(cacheKey, responseBody, 120_000); // 120s TTL

    logResponse(startTime, {
      endpoint: '/geo/places/nearby',
      status: 200,
      result_count: responseBody.places.length,
      provider: providerLabel,
      cache_hit: false,
    });

    res.json(responseBody);
  } catch (e) {
    logResponse(startTime, {
      endpoint: '/geo/places/nearby',
      status: 500,
      result_count: 0,
      provider: providerLabel,
      cache_hit: false,
    });
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ── GET /geo/places/search?q=..&lat=..&lng=.. ────────────────
// Place-tag picker search; lat/lng are optional proximity hints.

router.get('/places/search', async (req, res) => {
  const startTime = process.hrtime.bigint();
  const ipHash = hashIp(req);
  const q = (req.query.q || '').toString().trim();

  logger.info('geo_request', {
    endpoint: '/geo/places/search',
    method: 'GET',
    query_redacted: redactQuery(q),
    ip_hash: ipHash,
  });

  try {
    if (q.length < 2) {
      logResponse(startTime, {
        endpoint: '/geo/places/search',
        status: 200,
        result_count: 0,
        provider: 'none',
        cache_hit: false,
      });
      return res.json({ places: [] });
    }

    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng ?? req.query.lon); // accept `lon` alias
    // Proximity is an optional hint — silently drop out-of-range coords
    // instead of forwarding them to Mapbox (which would 4xx the search).
    const hasProximity = Number.isFinite(lat) && Number.isFinite(lng)
      && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

    const cacheKey = 'ps:' + q.toLowerCase()
      + ':' + (hasProximity ? lat.toFixed(4) : '_')
      + ':' + (hasProximity ? lng.toFixed(4) : '_');
    const cached = geoCache.get(cacheKey);
    if (cached) {
      logResponse(startTime, {
        endpoint: '/geo/places/search',
        status: 200,
        result_count: cached.places.length,
        provider: providerLabel,
        cache_hit: true,
      });
      return res.json(cached);
    }

    const result = await geoProvider.searchPlaces(
      q,
      hasProximity ? { lat, lng, limit: 8 } : { limit: 8 },
    );
    const responseBody = { places: result.places };
    geoCache.set(cacheKey, responseBody, 60_000); // 60s TTL

    logResponse(startTime, {
      endpoint: '/geo/places/search',
      status: 200,
      result_count: responseBody.places.length,
      provider: providerLabel,
      cache_hit: false,
    });

    res.json(responseBody);
  } catch (e) {
    logResponse(startTime, {
      endpoint: '/geo/places/search',
      status: 500,
      result_count: 0,
      provider: providerLabel,
      cache_hit: false,
    });
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

module.exports = router;
