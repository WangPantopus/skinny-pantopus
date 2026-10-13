/**
 * Nearby Plans API (build brief §5). Every route is signed in and answers 404
 * while the `plans` flag is off for the viewer. Errors are
 * `{ error: <code>, message: <sentence for people> }`.
 *
 * Privacy lives in services/plans/planService.js: cards carry the area only;
 * the exact place, the host's note and the people going reach only the host
 * and people who are in.
 */

const express = require('express');

const verifyToken = require('../middleware/verifyToken');
const requireFeatureFlag = require('../middleware/requireFeatureFlag');
const logger = require('../utils/logger');
const { recordFunnelEvent } = require('../services/funnelEvents');
const { loadViewer } = require('../services/plans/planViewer');
const planService = require('../services/plans/planService');
const { KINDS, WINDOWS } = require('../services/plans/planRules');

const router = express.Router();
router.use(verifyToken, requireFeatureFlag('plans'));

function fail(res, status, error, message) {
  return res.status(status).json({ error, message });
}

function serverError(res, err, where, req) {
  if (err && err.code === 'BLOCK_CHECK_UNAVAILABLE') {
    return fail(res, 503, 'unavailable', 'Plans are taking a moment to load. Please try again.');
  }
  logger.error(`plans.${where}.error`, { error: err?.message, userId: req.user?.id });
  return fail(res, 500, 'server_error', 'Something went wrong. Please try again.');
}

function number(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pointFromQuery(query, latKey = 'latitude', lngKey = 'longitude') {
  const latitude = number(query[latKey]);
  const longitude = number(query[lngKey]);
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

/** A fresh GPS fix sent as query params (gps_latitude, gps_longitude, gps_timestamp). */
function gpsFromQuery(query) {
  const point = pointFromQuery(query, 'gps_latitude', 'gps_longitude');
  if (!point || !query.gps_timestamp) return null;
  return { ...point, timestamp: String(query.gps_timestamp) };
}

function kindsFromQuery(value) {
  if (!value) return [];
  return String(value).split(',').map((k) => k.trim()).filter((k) => KINDS.includes(k));
}

// GET /api/plans: the list under the map, soonest first, within 5 miles.
router.get('/', async (req, res) => {
  try {
    const point = pointFromQuery(req.query);
    if (!point) return fail(res, 422, 'validation', 'A latitude and longitude are needed to find plans nearby.');
    const window = WINDOWS.includes(req.query.window) ? req.query.window : 'week';
    const viewer = await loadViewer(req.user, { point, gps: gpsFromQuery(req.query) });
    let kinds = kindsFromQuery(req.query.kinds);
    if (!viewer.seesPlaydates) kinds = kinds.filter((k) => k !== 'playdate');
    if (req.query.kinds && kinds.length === 0) return res.json({ items: [], next_cursor: null, nearest_elsewhere: null });
    const result = await planService.listNearby(viewer, { point, window, kinds, cursor: req.query.cursor || null });
    return res.json(result);
  } catch (err) {
    return serverError(res, err, 'list', req);
  }
});

// GET /api/plans/mine: hosting, going, asked, waitlisted, and recent (ended in the last two days).
router.get('/mine', async (req, res) => {
  try {
    const viewer = await loadViewer(req.user, { point: pointFromQuery(req.query), gps: gpsFromQuery(req.query) });
    return res.json(await planService.listMine(viewer));
  } catch (err) {
    return serverError(res, err, 'mine', req);
  }
});

// GET /api/plans/:id: PlanDetail for the host and people who are in, PlanCard for anyone else allowed to see it.
router.get('/:id', async (req, res) => {
  try {
    const viewer = await loadViewer(req.user, { point: pointFromQuery(req.query), gps: gpsFromQuery(req.query) });
    const { plan, body } = await planService.getForViewer(req.params.id, viewer);
    if (!body) {
      // A playdate someone without a verified address opened from a link (J9):
      // say only what the public web page says, so the app can explain why.
      if (plan && plan.kind === 'playdate' && viewer.playdatesFlag && !viewer.verified
        && String(plan.host_user_id) !== viewer.id && plan.status === 'open') {
        return res.status(404).json({
          error: 'needs_verified_address',
          message: 'Playdates are for verified neighbors. Verify your address to see this one.',
          plan: { kind: 'playdate', city: plan.city || null },
        });
      }
      return fail(res, 404, 'not_found', "This plan isn't available.");
    }
    if (body.viewer.role === 'none') {
      recordFunnelEvent('plan_viewed', { userId: viewer.id, meta: { plan_id: body.id, kind: body.kind } });
    }
    return res.json(body);
  } catch (err) {
    return serverError(res, err, 'detail', req);
  }
});

module.exports = router;
