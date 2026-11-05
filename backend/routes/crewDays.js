/**
 * Crew Day API (docs/product/crew-day-build/02-contract.md §4): the public invitation, households' bookings and the
 * crew's street days. Every route answers 403 CREW_DAY_UNAVAILABLE while the `crew_day` key is unlisted. Errors are
 * `{ error: <sentence for people>, code: <CODE> }`.
 */

const express = require('express');

const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth');
const { previewLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const { requireCrewDay } = require('../services/crewDay/gate');
const { CrewDayError } = require('../services/crewDay/rules');
const days = require('../services/crewDay/days');
const store = require('../services/crewDay/store');

const router = express.Router();
router.use(requireCrewDay);

function fail(res, err, where, req) {
  if (err instanceof CrewDayError) {
    return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra });
  }
  if (err?.status === 503) {
    return res.status(503).json({ error: err.message || 'Crew Days are taking a moment to load. Please try again.',
      code: 'UNAVAILABLE' });
  }
  logger.error(`crewDays.${where}.error`, { error: err?.message, userId: req.user?.id });
  return res.status(500).json({ error: 'Something went wrong. Please try again.', code: 'SERVER_ERROR' });
}

const handle = (where, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    fail(res, err, where, req);
  }
};

// ── Public (no account) ─────────────────────────────────────────

// GET /api/crew-days/public/:code: the invitation (screen 1). Counts only, never a household or the area's center.
router.get('/public/:code', previewLimiter, optionalAuth, handle('public', async (req, res) => {
  res.json(await days.publicInvitation(req.params.code, req.user));
}));

// ── Crew ───────────────────────────────────────────────────────

// GET /api/crew-days/business/:businessId: readiness, fee, services and the day lists (screen 13).
router.get('/business/:businessId', verifyToken, handle('business', async (req, res) => {
  res.json(await days.listForBusiness(req.params.businessId, req.user.id));
}));

// POST /api/crew-days: New Crew Day (screen 14), as a draft or sent to Pantopus (`submit: true`).
router.post('/', verifyToken, handle('create', async (req, res) => {
  res.status(201).json({ crew_day: await days.create(req.user.id, req.body || {}) });
}));

// GET /api/crew-days/:id/crew: the crew's day (screen 15). Bookings join it as their slices land.
router.get('/:id/crew', verifyToken, handle('crew_day', async (req, res) => {
  const day = await store.getDay(req.params.id);
  await days.requireCrew(day, req.user.id);
  res.json(await days.dayForCrew(day, req.user.id));
}));

// PATCH /api/crew-days/:id: edit within the rules (an open day keeps its street, date and window).
router.patch('/:id', verifyToken, handle('edit', async (req, res) => {
  res.json({ crew_day: await days.edit(req.params.id, req.user.id, req.body || {}) });
}));

// POST /api/crew-days/:id/submit: a draft (or a declined day, edited) goes to Pantopus for approval.
router.post('/:id/submit', verifyToken, handle('submit', async (req, res) => {
  res.json({ crew_day: await days.submit(req.params.id, req.user.id) });
}));

module.exports = router;
