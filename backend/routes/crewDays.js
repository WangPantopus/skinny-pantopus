/**
 * Crew Day API (docs/product/crew-day-build/02-contract.md §4): the public invitation, households' bookings and the
 * crew's street days. Every route answers 403 CREW_DAY_UNAVAILABLE while the `crew_day` key is unlisted. Errors are
 * `{ error: <sentence for people>, code: <CODE> }`.
 */

const express = require('express');
const multer = require('multer');

const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth');
const { previewLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const { requireCrewDay } = require('../services/crewDay/gate');
const { CrewDayError } = require('../services/crewDay/rules');
const days = require('../services/crewDay/days');
const store = require('../services/crewDay/store');
const bookings = require('../services/crewDay/bookings');
const reads = require('../services/crewDay/reads');
const dayOf = require('../services/crewDay/dayOf');

// One photo per request, up to 10 MB (JPEG, PNG or HEIC; stored as JPEG or PNG without metadata).
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

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

// POST /api/crew-days/public/:code/quote: this home's price and whether the day reaches it.
router.post('/public/:code/quote', previewLimiter, handle('quote', async (req, res) => {
  res.json(await bookings.quote(req.params.code, req.body || {}));
}));

// ── Household ──────────────────────────────────────────────────

// GET /api/crew-days/mine: Your Crew Days (screen 10).
router.get('/mine', verifyToken, handle('mine', async (req, res) => {
  res.json(await reads.mine(req.user.id));
}));

// GET /api/crew-days/today: the Today cards (screen 9).
router.get('/today', verifyToken, handle('today', async (req, res) => {
  res.json(await reads.today(req.user.id));
}));

// GET /api/crew-days/bookings/:bookingId: the household's booking page (screen 5).
router.get('/bookings/:bookingId', verifyToken, handle('booking', async (req, res) => {
  res.json(await reads.bookingPage(req.params.bookingId, req.user.id));
}));

async function bookingAnswer(req, res, booking) {
  res.json({ booking: await reads.bookingPage(booking.id, req.user.id) });
}

// PATCH /api/crew-days/bookings/:bookingId: the note for the crew, home details before the cutoff, next-season reminder.
router.patch('/bookings/:bookingId', verifyToken, handle('change', async (req, res) => {
  await bookingAnswer(req, res, await bookings.change(req.params.bookingId, req.user.id, req.body || {}));
}));

// POST /api/crew-days/bookings/:bookingId/cancel: free before the cutoff; after it, 409 ASK_THE_CREW.
router.post('/bookings/:bookingId/cancel', verifyToken, handle('cancel', async (req, res) => {
  await bookingAnswer(req, res, await bookings.cancel(req.params.bookingId, req.user.id));
}));

// POST /api/crew-days/bookings/:bookingId/ask-release: inside the cutoff, ask the crew to let the home go.
router.post('/bookings/:bookingId/ask-release', verifyToken, handle('ask_release', async (req, res) => {
  await bookingAnswer(req, res, await bookings.askRelease(req.params.bookingId, req.user.id));
}));

// POST /api/crew-days/bookings/:bookingId/price-answer { approve }: approve the crew's price, or decline it (free).
router.post('/bookings/:bookingId/price-answer', verifyToken, handle('price_answer', async (req, res) => {
  await bookingAnswer(req, res, await bookings.answerPrice(req.params.bookingId, req.user.id, req.body || {}));
}));

// POST /api/crew-days/bookings/:bookingId/gate-ready: on the day, tell the crew the gate is open.
router.post('/bookings/:bookingId/gate-ready', verifyToken, handle('gate_ready', async (req, res) => {
  await bookingAnswer(req, res, await dayOf.gateReady(req.params.bookingId, req.user.id));
}));

// POST /api/crew-days/uploads (multipart: photo, booking_id, purpose done|problem) → { path }: the crew's finished-work
// photos, or the household's problem photos, for that booking only.
router.post('/uploads', verifyToken, (req, res, next) => photoUpload.single('photo')(req, res, (err) => {
  if (!err) return next();
  const tooBig = err.code === 'LIMIT_FILE_SIZE';
  return res.status(tooBig ? 413 : 400).json({ error: tooBig ? 'This photo is over 10 MB. Try a smaller copy.'
    : 'Send one photo at a time.', code: tooBig ? 'PHOTO_TOO_LARGE' : 'VALIDATION' });
}), handle('upload', async (req, res) => {
  res.status(201).json(await dayOf.upload(req.user.id, { bookingId: req.body?.booking_id, purpose: req.body?.purpose || 'done',
    buffer: req.file?.buffer }));
}));

// POST /api/crew-days/:id/bookings: book a home (201), or the same booking again for a repeated client_request_id (200).
router.post('/:id/bookings', verifyToken, handle('book', async (req, res) => {
  const { booking, repeated } = await bookings.book(req.params.id, req.user, req.body || {});
  res.status(repeated ? 200 : 201).json({ booking: await reads.bookingPage(booking.id, req.user.id) });
}));

// POST /api/crew-days/:id/dismiss: "Not for me" on the Today card.
router.post('/:id/dismiss', verifyToken, handle('dismiss', async (req, res) => {
  res.json(await bookings.dismiss(req.params.id, req.user.id));
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
  res.json(await reads.crewDayDetail(day, await days.dayForCrew(day, req.user.id)));
}));

// POST /api/crew-days/:id/bookings/:bookingId/price { price_cents } or { decline: true, note }: the look-first answer.
router.post('/:id/bookings/:bookingId/price', verifyToken, handle('price', async (req, res) => {
  const booking = await bookings.setPrice(req.params.id, req.params.bookingId, req.user.id, req.body || {});
  res.json({ booking: await crewHomeAnswer(booking) });
}));

// POST /api/crew-days/:id/bookings/:bookingId/release: let a home go at no charge.
router.post('/:id/bookings/:bookingId/release', verifyToken, handle('release', async (req, res) => {
  const booking = await bookings.release(req.params.id, req.params.bookingId, req.user.id);
  res.json({ booking: await crewHomeAnswer(booking) });
}));

// GET /api/crew-days/:id/route?date=: the homes on that date in the crew's order (screen 16).
router.get('/:id/route', verifyToken, handle('route', async (req, res) => {
  res.json(await dayOf.route(req.params.id, req.user.id, req.query.date));
}));

// POST /api/crew-days/:id/route/order { booking_ids }: the crew's order for one date.
router.post('/:id/route/order', verifyToken, handle('route_order', async (req, res) => {
  res.json(await dayOf.order(req.params.id, req.user.id, req.body || {}));
}));

// POST /api/crew-days/:id/running-late { minutes: 30|60|90, date }: every home still waiting moves back and is told.
router.post('/:id/running-late', verifyToken, handle('running_late', async (req, res) => {
  res.json(await dayOf.runningLate(req.params.id, req.user.id, req.body || {}));
}));

// POST /api/crew-days/bookings/:bookingId/on-the-way { eta_start, eta_end }: "On my way" (again: a new time).
router.post('/bookings/:bookingId/on-the-way', verifyToken, handle('on_the_way', async (req, res) => {
  res.json({ booking: await crewHomeAnswer(await dayOf.onTheWay(req.params.bookingId, req.user.id, req.body || {})) });
}));

// POST /api/crew-days/bookings/:bookingId/cant-get-in { note }: recorded and sent to the household.
router.post('/bookings/:bookingId/cant-get-in', verifyToken, handle('cant_get_in', async (req, res) => {
  res.json({ booking: await crewHomeAnswer(await dayOf.cantGetIn(req.params.bookingId, req.user.id, req.body || {})) });
}));

// POST /api/crew-days/bookings/:bookingId/done { photo_paths, note? }: done, with the invoice; charged 24 hours later.
router.post('/bookings/:bookingId/done', verifyToken, handle('done', async (req, res) => {
  res.json({ booking: await crewHomeAnswer(await dayOf.markDone(req.params.bookingId, req.user.id, req.body || {})) });
}));

// The crew's view of one home after a change: the same shape as the day's `bookings` items, with its photos.
async function crewHomeAnswer(booking) {
  const day = await store.getDay(booking.crew_day_id);
  const home = (await reads.crewHomes(day)).find((h) => h.id === booking.id);
  const { row, ...rest } = home;
  return (await reads.withPhotos([rest], new Map([[row.id, row]])))[0];
}

// PATCH /api/crew-days/:id: edit within the rules (an open day keeps its street, date and window).
router.patch('/:id', verifyToken, handle('edit', async (req, res) => {
  res.json({ crew_day: await days.edit(req.params.id, req.user.id, req.body || {}) });
}));

// POST /api/crew-days/:id/submit: a draft (or a declined day, edited) goes to Pantopus for approval.
router.post('/:id/submit', verifyToken, handle('submit', async (req, res) => {
  res.json({ crew_day: await days.submit(req.params.id, req.user.id) });
}));

module.exports = router;
