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
const { contentCreationLimiter, aiDraftLimiter } = require('../middleware/rateLimiter');
const { recordFunnelEvent } = require('../services/funnelEvents');
const { loadViewer } = require('../services/plans/planViewer');
const planService = require('../services/plans/planService');
const planActions = require('../services/plans/planActions');
const planInvites = require('../services/plans/planInvites');
const planGames = require('../services/plans/planGames');
const planPlaces = require('../services/plans/planPlaces');
const { suggestPlaces } = require('../services/ai/planPlaceSuggest');
const { KINDS, WINDOWS } = require('../services/plans/planRules');

const router = express.Router();
router.use(verifyToken, requireFeatureFlag('plans'));

function fail(res, status, error, message) {
  return res.status(status).json({ error, message });
}

function serverError(res, err, where, req) {
  if (err instanceof planActions.PlanError) {
    return res.status(err.status).json({ error: err.code, message: err.message, ...err.extra });
  }
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

/** The host's homes and fresh fix: their areas' public places start loading now, ready for H6. */
function warmPlaces(viewer) {
  planPlaces.warmAround(viewer.locations.filter((l) => l.kind === 'home' || l.kind === 'gps'));
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
    warmPlaces(viewer);
    let kinds = kindsFromQuery(req.query.kinds);
    if (!viewer.seesPlaydates) kinds = kinds.filter((k) => k !== 'playdate');
    if (req.query.kinds && kinds.length === 0) return res.json({ items: [], next_cursor: null, nearest_elsewhere: null });
    const result = await planService.listNearby(viewer, { point, window, kinds, cursor: req.query.cursor || null });
    return res.json(result);
  } catch (err) {
    return serverError(res, err, 'list', req);
  }
});

// GET /api/plans/mine: hosting, going, asked, waitlisted, invited (not answered yet), and recent (ended in the last
// two days). Email invitations to the person's verified address become theirs first.
router.get('/mine', async (req, res) => {
  try {
    const [viewer] = await Promise.all([
      loadViewer(req.user, { point: pointFromQuery(req.query), gps: gpsFromQuery(req.query) }),
      planInvites.attachEmailInvites(req.user),
    ]);
    warmPlaces(viewer);
    return res.json(await planService.listMine(viewer));
  } catch (err) {
    return serverError(res, err, 'mine', req);
  }
});

// GET /api/plans/games: the next 14 days' games from the checked list (H2's game chips),
// for teams near one of the viewer's places (homes, saved places, a fresh fix, or the point
// the app is looking from).
router.get('/games', async (req, res) => {
  try {
    const viewer = await loadViewer(req.user, { point: pointFromQuery(req.query), gps: gpsFromQuery(req.query) });
    warmPlaces(viewer);
    const near = viewer.origin ? [...viewer.locations, viewer.origin] : viewer.locations;
    if (req.query.v === '2' && viewer.sportsFlag) {
      return res.json(await planGames.gamesForViewer(viewer, req.query.for === 'composer' ? 'composer' : 'sheet'));
    }
    return res.json({ games: planGames.upcomingGames(Date.now(), { near }) });
  } catch (err) {
    return serverError(res, err, 'games', req);
  }
});

router.get('/teams', requireFeatureFlag('plans_sports'), async (req, res) => {
  try {
    const viewer = await loadViewer(req.user, { point: pointFromQuery(req.query), gps: gpsFromQuery(req.query) });
    const { searchTeams, teamById, publicTeam } = require('../services/plans/planTeams');
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const chosen = [...new Set([...(viewer.sports.teams || []), ...(viewer.sports.hidden || [])])].map(teamById).filter(Boolean);
    return res.json({ suggested: planGames.suggestedForViewer(viewer).map(publicTeam), results: (q ? searchTeams(q) : chosen).map(publicTeam) });
  } catch (err) { return serverError(res, err, 'teams', req); }
});

/** The plan's start or end from a query or body value (ISO 8601), or null. */
function isoTime(value) {
  if (typeof value !== 'string' || value.length > 40) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

const PLACES_UNAVAILABLE = "Places near you aren't loading right now. Try again in a minute.";

// GET /api/plans/places/nearby?latitude&longitude[&q][&kind&sport&starts_at&ends_at][&wait=0]:
// public places for H6, nearest first, or with a kind the ones that suit the plan first, each
// with its hours for the plan's time and a few facts. wait=0 only starts gathering a new area
// (the host flow opening) and answers at once.
router.get('/places/nearby', async (req, res) => {
  try {
    const point = pointFromQuery(req.query);
    if (!point) return fail(res, 422, 'validation', 'A latitude and longitude are needed to find places nearby.');
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 60) : '';
    const kind = KINDS.includes(req.query.kind) ? req.query.kind : null;
    const sport = typeof req.query.sport === 'string' ? req.query.sport.slice(0, 30) : null;
    const result = await planPlaces.placesNear({
      ...point,
      q,
      kind,
      sport,
      startsAt: isoTime(req.query.starts_at),
      endsAt: isoTime(req.query.ends_at),
      ...(req.query.wait === '0' ? { waitMs: 0 } : {}),
    });
    // 202 while an area seen for the first time is still loading: ask again in a few seconds.
    return res.status(result.loading ? 202 : 200).json(result);
  } catch (err) {
    logger.warn('plans.places.unavailable', { error: err?.message });
    return fail(res, 503, 'unavailable', PLACES_UNAVAILABLE);
  }
});

// POST /api/plans/places/suggest { latitude, longitude, kind, title?, about?, starts_at?, ends_at?,
// spots?, details?, ask? }: H6's "Suggest places", up to three public places from the same list,
// best first, each with `why`. 202 while the area's places are still loading, as above.
router.post('/places/suggest', aiDraftLimiter, async (req, res) => {
  try {
    const input = body(req);
    const point = pointFromQuery(input);
    if (!point) return fail(res, 422, 'validation', 'A latitude and longitude are needed to find places nearby.');
    if (!KINDS.includes(input.kind)) return fail(res, 422, 'validation', 'Choose what kind of plan it is.');
    const details = input.details && typeof input.details === 'object' && !Array.isArray(input.details) ? input.details : {};
    const spots = Number.isInteger(input.spots) && input.spots > 0 && input.spots <= 50 ? input.spots : null;
    const result = await suggestPlaces({
      userId: req.user.id,
      ...point,
      plan: {
        kind: input.kind,
        title: typeof input.title === 'string' ? input.title : null,
        about: typeof input.about === 'string' ? input.about : null,
        startsAt: isoTime(input.starts_at),
        endsAt: isoTime(input.ends_at),
        spots,
        details,
      },
      ask: typeof input.ask === 'string' ? input.ask.slice(0, 120) : '',
    });
    return res.status(result.loading ? 202 : 200).json(result);
  } catch (err) {
    logger.warn('plans.places.suggest_unavailable', { error: err?.message });
    return fail(res, 503, 'unavailable', PLACES_UNAVAILABLE);
  }
});

// GET /api/plans/invites/next: right after signing in, the newest invitation the person hasn't opened, so the app
// opens that plan ({ plan_id } or { plan_id: null }). An email invitation reaches them by their verified address.
router.get('/invites/next', async (req, res) => {
  try {
    return res.json(await planInvites.nextInvite(req.user));
  } catch (err) {
    return serverError(res, err, 'invites_next', req);
  }
});

// GET /api/plans/:id: PlanDetail for the host and people who are in, PlanCard for anyone else allowed to see it.
// An invitation the person hadn't opened counts as opened.
router.get('/:id', async (req, res) => {
  try {
    const [viewer] = await Promise.all([
      loadViewer(req.user, { point: pointFromQuery(req.query), gps: gpsFromQuery(req.query) }),
      planInvites.attachEmailInvites(req.user),
    ]);
    const { plan, body } = await planService.getForViewer(req.params.id, viewer);
    if (body?.my_invite) planInvites.markOpened(viewer.id, body.id).catch(() => {});
    if (!body) {
      // A playdate someone without a verified address opened from a link (J9):
      // say only what the public web page says, so the app can explain why,
      // and who invited them when they hold an invitation.
      if (plan && plan.kind === 'playdate' && viewer.playdatesFlag && !viewer.verified
        && String(plan.host_user_id) !== viewer.id && plan.status === 'open') {
        const invitedBy = await planInvites.lockedInviteFrom(viewer, plan).catch(() => null);
        return res.status(404).json({
          error: 'needs_verified_address',
          message: 'Playdates are for verified neighbors. Verify your address to see this one.',
          plan: { kind: 'playdate', city: plan.city || null },
          invited_by: invitedBy,
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

function body(req) {
  return req.body && typeof req.body === 'object' ? req.body : {};
}

// POST /api/plans: host a plan. Returns PlanDetail (201).
router.post('/', contentCreationLimiter, async (req, res) => {
  try {
    return res.status(201).json(await planActions.createPlan(req.user, body(req)));
  } catch (err) {
    return serverError(res, err, 'create', req);
  }
});

// PATCH /api/plans/:id: the host changes the plan. Moving the start by more than
// 30 minutes or changing the place asks everyone who's in "Still coming?".
router.patch('/:id', async (req, res) => {
  try {
    return res.json(await planActions.editPlan(req.user, req.params.id, body(req), { io: req.app.get('io') }));
  } catch (err) {
    return serverError(res, err, 'edit', req);
  }
});

// POST /api/plans/:id/cancel { note }
router.post('/:id/cancel', async (req, res) => {
  try {
    return res.json(await planActions.cancelPlan(req.user, req.params.id, body(req)));
  } catch (err) {
    return serverError(res, err, 'cancel', req);
  }
});

// GET /api/plans/:id/requests: the host's pending and waitlisted asks.
router.get('/:id/requests', async (req, res) => {
  try {
    return res.json(await planActions.listRequests(req.user, req.params.id));
  } catch (err) {
    return serverError(res, err, 'requests', req);
  }
});

// POST /api/plans/:id/requests: ask to join (again: updates who's coming while waiting).
router.post('/:id/requests', async (req, res) => {
  try {
    const result = await planActions.askToJoin(req.user, req.params.id, body(req), { io: req.app.get('io') });
    return res.status(result.status).json(result.body);
  } catch (err) {
    return serverError(res, err, 'ask', req);
  }
});

// DELETE /api/plans/:id/requests/mine: withdraw (waiting) or leave (in).
router.delete('/:id/requests/mine', async (req, res) => {
  try {
    return res.json(await planActions.withdrawMine(req.user, req.params.id, { io: req.app.get('io') }));
  } catch (err) {
    return serverError(res, err, 'withdraw', req);
  }
});

// POST /api/plans/:id/requests/:requestId/accept | decline | remove (host).
router.post('/:id/requests/:requestId/:action', async (req, res) => {
  try {
    const { action } = req.params;
    if (!['accept', 'decline', 'remove'].includes(action)) return fail(res, 404, 'not_found', 'Unknown action.');
    return res.json(await planActions.decide(req.user, req.params.id, req.params.requestId, action, body(req), { io: req.app.get('io') }));
  } catch (err) {
    return serverError(res, err, 'decide', req);
  }
});

// POST /api/plans/:id/on-my-way: a line in the chat, no push.
router.post('/:id/on-my-way', async (req, res) => {
  try {
    return res.json(await planActions.onMyWay(req.user, req.params.id));
  } catch (err) {
    return serverError(res, err, 'on_my_way', req);
  }
});

// POST /api/plans/:id/still-coming { coming }: false leaves the plan.
router.post('/:id/still-coming', async (req, res) => {
  try {
    return res.json(await planActions.stillComing(req.user, req.params.id, body(req), { io: req.app.get('io') }));
  } catch (err) {
    return serverError(res, err, 'still_coming', req);
  }
});

// POST /api/plans/:id/feedback { answer: great | ok | not_right, note }
router.post('/:id/feedback', async (req, res) => {
  try {
    return res.json(await planActions.giveFeedback(req.user, req.params.id, body(req)));
  } catch (err) {
    return serverError(res, err, 'feedback', req);
  }
});

// ── Invitations (services/plans/planInvites.js) ─────────────

// GET /api/plans/:id/invites: the host's invitations, each with where it stands.
router.get('/:id/invites', async (req, res) => {
  try {
    return res.json(await planInvites.listForHost(req.user, req.params.id));
  } catch (err) {
    return serverError(res, err, 'invites', req);
  }
});

// GET /api/plans/:id/invites/people?q=: people the host can invite (connections and people who came to their
// plans), with where each stands on this plan.
router.get('/:id/invites/people', requireFeatureFlag('plans_invites'), async (req, res) => {
  try {
    return res.json(await planInvites.peopleToInvite(req.user, req.params.id, req.query.q));
  } catch (err) {
    return serverError(res, err, 'invite_people', req);
  }
});

// POST /api/plans/:id/invites { user_ids?, emails?, confirm_shares_address? }: invite people on Pantopus and by email.
router.post('/:id/invites', requireFeatureFlag('plans_invites'), async (req, res) => {
  try {
    return res.status(201).json(await planInvites.createInvites(req.user, req.params.id, body(req)));
  } catch (err) {
    return serverError(res, err, 'invite', req);
  }
});

// POST /api/plans/:id/invites/link { confirm_shares_address? }: a one-person link for the host to text.
router.post('/:id/invites/link', requireFeatureFlag('plans_invites'), async (req, res) => {
  try {
    return res.status(201).json(await planInvites.createLinkInvite(req.user, req.params.id, body(req)));
  } catch (err) {
    return serverError(res, err, 'invite_link', req);
  }
});

// POST /api/plans/:id/invites/claim { token }: the person opened an email or text invitation.
router.post('/:id/invites/claim', async (req, res) => {
  try {
    return res.json(await planInvites.claimInvite(req.user, req.params.id, body(req).token));
  } catch (err) {
    return serverError(res, err, 'invite_claim', req);
  }
});

// POST /api/plans/:id/invites/decline: "Can't make it". Saying "I'm in" is the ask (POST /:id/requests).
router.post('/:id/invites/decline', async (req, res) => {
  try {
    return res.json(await planInvites.declineInvite(req.user, req.params.id, { io: req.app.get('io') }));
  } catch (err) {
    return serverError(res, err, 'invite_decline', req);
  }
});

// DELETE /api/plans/:id/invites/:inviteId: the host takes back an invitation nobody said yes to.
router.delete('/:id/invites/:inviteId', async (req, res) => {
  try {
    return res.json(await planInvites.cancelInvite(req.user, req.params.id, req.params.inviteId));
  } catch (err) {
    return serverError(res, err, 'invite_cancel', req);
  }
});

// POST /api/plans/:id/report { reason, details }: into the admin report queue.
router.post('/:id/report', async (req, res) => {
  try {
    return res.json(await planActions.reportPlan(req.user, req.params.id, body(req)));
  } catch (err) {
    return serverError(res, err, 'report', req);
  }
});

module.exports = router;
