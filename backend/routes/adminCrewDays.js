/**
 * Crew Day operator API (docs/product/crew-day-build/02-contract.md §4, "Operator"): approving street days, problems
 * and street requests. Mounted before /api/admin so the `crew_day` gate answers first: every route answers 403
 * CREW_DAY_UNAVAILABLE while the key is unlisted, and needs a platform admin otherwise.
 */

const express = require('express');

const verifyToken = require('../middleware/verifyToken');
const logger = require('../utils/logger');
const { requireCrewDay } = require('../services/crewDay/gate');
const { CrewDayError } = require('../services/crewDay/rules');
const admin = require('../services/crewDay/admin');
const days = require('../services/crewDay/days');
const problems = require('../services/crewDay/problems');
const store = require('../services/crewDay/store');

// Platform admins only (the same check as requireAdmin), answered in the Crew Day error shape.
function requireOperator(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ error: 'Only Pantopus staff can open this.', code: 'NOT_OPERATOR' });
}

const router = express.Router();
router.use(requireCrewDay, verifyToken, requireOperator);

function fail(res, err, where, req) {
  if (err instanceof CrewDayError) {
    return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra });
  }
  if (err?.status === 503) {
    return res.status(503).json({ error: err.message || 'Crew Days are taking a moment to load. Please try again.',
      code: 'UNAVAILABLE' });
  }
  logger.error(`adminCrewDays.${where}.error`, { error: err?.message, userId: req.user?.id });
  return res.status(500).json({ error: 'Something went wrong. Please try again.', code: 'SERVER_ERROR' });
}

const handle = (where, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    fail(res, err, where, req);
  }
};

// GET /api/admin/crew-days?tab=waiting|open|today|problems|done|requests (screens 20, 22, 23)
router.get('/', handle('list', async (req, res) => {
  res.json(await admin.list(String(req.query.tab || 'waiting')));
}));

// POST /api/admin/crew-days/bookings/:bookingId/problem { action: note|release|refund|resolve, amount_cents?, note }
router.post('/bookings/:bookingId/problem', handle('problem', async (req, res) => {
  const booking = await problems.operatorAction(req.params.bookingId, req.user.id, req.body || {});
  const people = await admin.households([booking.household_user_id]);
  const day = await store.getDay(booking.crew_day_id);
  res.json({ booking: { ...admin.adminBooking(booking, people.get(String(booking.household_user_id))),
    crew_day: { id: day.id, title: day.title, timezone: day.timezone } } });
}));

// GET /api/admin/crew-days/:id: everything about one day (screen 21); records operator_viewed.
router.get('/:id', handle('detail', async (req, res) => {
  const result = await admin.detail(req.params.id, req.user.id);
  if (!result) return res.status(404).json({ error: "We couldn't find that Crew Day.", code: 'NOT_FOUND' });
  return res.json(result);
}));

// POST /api/admin/crew-days/:id/approve { note? }: open for booking; the crew is told.
router.post('/:id/approve', handle('approve', async (req, res) => {
  const day = await days.review(req.params.id, req.user.id, { approve: true, note: req.body?.note });
  res.json({ crew_day: (await admin.detail(day.id, req.user.id)).day });
}));

// POST /api/admin/crew-days/:id/decline { note }: the note is required and goes to the crew.
router.post('/:id/decline', handle('decline', async (req, res) => {
  const day = await days.review(req.params.id, req.user.id, { approve: false, note: req.body?.note });
  res.json({ crew_day: (await admin.detail(day.id, req.user.id)).day });
}));

module.exports = router;
