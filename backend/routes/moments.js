// Moments (build brief and CONTRACT in ~/pantopus-moments/coord, approved 2026-11-08): post a photo, a video of up to
// 30 s or a text card where you are; it shows on the Moments map as your profile picture in a ring for 1, 6, 24 or 48
// hours. Every route needs a signed-in person with the `moments` flag on (404 MOMENTS_UNAVAILABLE otherwise).
// The rows are Posts (services/moments/momentStore.js); files sit in private storage (momentMedia.js); a picture check
// runs before a photo or video goes live (momentCheck.js); replies are chat messages (momentChat.js).

const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const { createHash } = require('node:crypto');
const verifyToken = require('../middleware/verifyToken');
const requireFeatureFlag = require('../middleware/requireFeatureFlag');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const feedService = require('../services/feedService');
const store = require('../services/moments/momentStore');
const media = require('../services/moments/momentMedia');
const momentCheck = require('../services/moments/momentCheck');
const momentPlace = require('../services/moments/momentPlace');
const momentChat = require('../services/moments/momentChat');
const { adultStatus, confirmAdult } = require('../services/adultAttestation');
const momentUpload = require('../services/moments/momentUpload');
const momentNotify = require('../services/moments/momentNotify');
const { normalizePostReaction } = require('../utils/postReaction');
const { REPORT_REASONS, filePostReport } = require('../services/postReportService');

const router = express.Router();
router.use(verifyToken, requireFeatureFlag('moments', { error: "Moments aren't available.", code: 'MOMENTS_UNAVAILABLE' }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// How long the upload's answer waits for the picture check; past it the answer says `checking` and the check finishes
// on its own (the cleanup job picks up one that never did).
const CHECK_WAIT_MS = 12 * 1000;

function limiter(windowMs, max) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => req.user?.id || req.ip,
    handler: (req, res) => res.status(429).json({ error: 'Too many requests. Please try again in a minute.', code: 'RATE_LIMITED' }),
    standardHeaders: true,
    legacyHeaders: false,
  });
}
const createLimiter = limiter(15 * 60 * 1000, 60);
const uploadLimiter = limiter(15 * 60 * 1000, 60);
const actionLimiter = limiter(60 * 1000, 120);

function sendError(res, error, what) {
  if (error.status) {
    return res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
  }
  logger.error(`moments.${what}.error`, { error: error.message });
  return res.status(503).json({ error: "Moments couldn't load. Please try again.", code: 'MOMENTS_FAILED' });
}

function parseBody(schema, value) {
  const { error, value: parsed } = schema.validate(value || {}, { abortEarly: true, stripUnknown: true });
  if (error) throw store.fail(400, 'MOMENT_INVALID', error.details[0].message.replace(/"/g, ''));
  return parsed;
}

function momentId(req) {
  if (!UUID.test(String(req.params.id || ''))) throw store.fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
  return req.params.id;
}

async function oneMoment(row, viewerId) {
  return (await store.serializeMoments([row], viewerId))[0];
}

const point = { latitude: Joi.number().min(-90).max(90).required(), longitude: Joi.number().min(-180).max(180).required() };

// ─── 18+ and the Post sheet ─────────────────────────────────────────────────

/** POST /adult-confirm — the one-time 18+ confirmation, shared with Pulse (services/adultAttestation.js). */
router.post('/adult-confirm', actionLimiter, async (req, res) => {
  try {
    const result = await confirmAdult(req.user.id);
    if (!result.found) return res.status(404).json({ error: 'Account not found', code: 'ACCOUNT_NOT_FOUND' });
    if (result.ineligible) return res.status(403).json({ error: 'Moments are for people 18 and older.', code: 'AGE_NOT_ELIGIBLE' });
    res.json({ attested_at: result.attestedAt });
  } catch (error) {
    sendError(res, error, 'adult_confirm');
  }
});

/**
 * POST /place-preview — what the Post sheet shows: the place's label, the area's, the names the author may pick for an
 * exact pin (`places`; the first is the label), the home notice, the 18+ state.
 */
router.post('/place-preview', actionLimiter, async (req, res) => {
  try {
    const { latitude, longitude } = parseBody(Joi.object(point), req.body);
    const [labels, atHome, adult] = await Promise.all([
      momentPlace.labelsAt(latitude, longitude),
      momentPlace.isAtHome(req.user.id, latitude, longitude),
      adultStatus(req.user.id),
    ]);
    res.json({ ...labels, at_home: atHome, adult_confirmed: Boolean(adult.attestedAt) && !adult.ineligible });
  } catch (error) {
    sendError(res, error, 'place_preview');
  }
});

// ─── Posting ────────────────────────────────────────────────────────────────

const createSchema = Joi.object({
  kind: Joi.string().valid(...store.KINDS).required(),
  hours: Joi.number().valid(...store.HOURS).default(24),
  audience: Joi.string().valid(...store.AUDIENCES).default('nearby'),
  show_area: Joi.boolean().default(false),
  caption: Joi.string().trim().max(100).allow('', null),
  text: Joi.string().trim().max(200).allow('', null),
  background: Joi.string().valid(...store.BACKGROUNDS).allow(null),
  location: Joi.alternatives().try(
    Joi.object({ source: Joi.string().valid('gps').required(), ...point, fix_at: Joi.string().isoDate().required() }),
    Joi.object({ source: Joi.string().valid('capture').required(), ...point, taken_at: Joi.string().isoDate().required() }),
  ).required(),
  // A retry of the same Post tap returns the Moment it made (optional).
  client_request_id: Joi.string().uuid().allow(null),
  // The Post sheet's pick among place-preview's `places` (optional): a key, never the place's words.
  place_key: Joi.string().max(40).pattern(/^[a-z0-9_]+$/).allow('', null),
});

// The row id a retry key stands for, so the same tap never makes two Moments.
function retryId(userId, key) {
  if (!key) return null;
  const hex = createHash('sha256').update(`pantopus:moment-create:v1:${userId.toLowerCase()}:${key.toLowerCase()}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** POST / — a new Moment: a text card is live at once; a photo or video waits for its file (POST /:id/media). */
router.post('/', createLimiter, async (req, res) => {
  try {
    const body = parseBody(createSchema, req.body);
    if (body.kind === 'text') {
      if (!body.text) throw store.fail(400, 'MOMENT_INVALID', 'Write something on the card.');
      if (body.caption) throw store.fail(400, 'MOMENT_INVALID', 'A text card has no caption.');
    } else if (body.text || body.background) {
      throw store.fail(400, 'MOMENT_INVALID', 'Only a text card has text and a background.');
    }
    const id = retryId(req.user.id, body.client_request_id);
    if (id) {
      const prior = await store.loadMoment(id);
      if (prior && prior.user_id === req.user.id) return res.status(201).json({ moment: await oneMoment(prior, req.user.id) });
    }
    await store.checkPostingRules(req.user, body);
    const { latitude, longitude } = body.location;
    const [found, atHome] = await Promise.all([
      momentPlace.labelsAt(latitude, longitude),
      momentPlace.isAtHome(req.user.id, latitude, longitude),
    ]);
    // The name the author picked for this point, worked out again here; an area or at-home Moment says the town.
    const labels = { ...found, place_label: momentPlace.pickedLabel(found, body.place_key) || found.place_label };
    const { row, created } = await store.insertMoment(store.newMomentRow({
      userId: req.user.id,
      accountType: req.user.accountType,
      kind: body.kind,
      hours: body.hours,
      audience: body.audience,
      showArea: body.show_area,
      atHome,
      caption: body.caption || null,
      text: body.text || null,
      background: body.background || 'teal',
      location: body.location,
      labels,
    }), id);
    logger.info('moments.created', { momentId: row.id, kind: body.kind, hours: body.hours, audience: body.audience });
    res.status(201).json({ moment: await oneMoment(row, req.user.id) });
    // A text card is live now: its author's connections hear of it (a photo or video when its check finishes). After
    // the answer, and on its own: it never slows or fails the post.
    if (created && body.kind === 'text') momentNotify.notifyConnections(row);
  } catch (error) {
    sendError(res, error, 'create');
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: media.MAX_VIDEO_BYTES, files: 4, fields: 8, parts: 12, fieldSize: 1024, fieldNameSize: 100 },
});
const receive = upload.fields([{ name: 'file', maxCount: 1 }, { name: 'poster', maxCount: 1 },
  { name: 'frames[]', maxCount: 2 }, { name: 'frames', maxCount: 2 }]);

function receiveFiles(req, res, next) {
  receive(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'This file is too large to post.', code: 'MEDIA_TOO_LARGE' });
    }
    return res.status(400).json({ error: 'Send the photo or video as "file", and a video\'s "poster" and "frames[]".', code: 'MOMENT_INVALID' });
  });
}

/** POST /:id/media — the photo or video of the caller's own Moment; the picture check runs, then it goes live. */
router.post('/:id/media', uploadLimiter, receiveFiles, async (req, res) => {
  try {
    const id = momentId(req);
    const row = await store.loadMoment(id);
    if (!row || row.user_id !== req.user.id) throw store.fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
    if (store.momentState(row) === 'ended') throw store.fail(410, 'MOMENT_ENDED', 'This Moment has ended.');
    const kind = store.meta(row).kind;
    if (kind === 'text') throw store.fail(400, 'MOMENT_INVALID', 'A text card has no file.');

    const sentSha = req.files?.file?.[0] ? media.sha256(req.files.file[0].buffer) : null;
    const existing = store.meta(row).media;
    if (existing) {
      // The same file again (a retry after a lost answer) changes nothing.
      if (sentSha && existing.upload_sha256 === sentSha) return res.json({ moment: await oneMoment(row, req.user.id) });
      throw store.fail(409, 'MOMENT_MEDIA_EXISTS', 'This Moment already has its file. Post a new Moment instead.');
    }

    const files = req.files || {};
    const prepared = await momentUpload.prepareFiles(kind, {
      file: files.file?.[0] || null,
      poster: files.poster?.[0] || null,
      frames: [...(files['frames[]'] || []), ...(files.frames || [])],
    });
    const record = await momentUpload.storeFiles(row, prepared);
    const checking = await store.updateMoment(row, {
      moment: { media: record, state: 'checking', checking_since: new Date().toISOString() },
    }, { 'post_metadata->moment->>media': null, archived_at: null });
    if (!checking) {
      // Another upload of this Moment got there first.
      const current = await store.loadMoment(id);
      if (current && store.meta(current).media?.upload_sha256 === prepared.uploadSha) {
        return res.json({ moment: await oneMoment(current, req.user.id) });
      }
      throw store.fail(409, 'MOMENT_MEDIA_EXISTS', 'This Moment already has its file. Post a new Moment instead.');
    }

    const pictures = await Promise.all(momentUpload.checkSources(kind, prepared).map((buffer) => media.checkImage(buffer)));
    const finished = momentCheck.checkPictures(pictures).then((result) => momentCheck.finishUpload(checking, result));
    finished.catch((error) => logger.error('moments.check_finish_failed', { momentId: id, error: error.message }));
    let timer;
    const done = await Promise.race([
      finished.then((updated) => updated || null, () => null),
      new Promise((resolve) => { timer = setTimeout(() => resolve(undefined), CHECK_WAIT_MS); }),
    ]);
    clearTimeout(timer);
    const latest = done || await store.loadMoment(id) || checking;
    res.json({ moment: await oneMoment(latest, req.user.id) });
  } catch (error) {
    sendError(res, error, 'media');
  }
});

// ─── Reading ────────────────────────────────────────────────────────────────

const mapSchema = Joi.object({
  south: Joi.number().min(-90).max(90).required(),
  west: Joi.number().min(-180).max(180).required(),
  north: Joi.number().min(-90).max(90).required(),
  east: Joi.number().min(-180).max(180).required(),
  zoom: Joi.number().min(0).max(25),
});

/** GET /map — the rings in view: live Moments the caller may see, blocks and mutes removed. */
router.get('/map', async (req, res) => {
  try {
    const box = parseBody(mapSchema, req.query);
    if (box.south >= box.north || box.west >= box.east) throw store.fail(400, 'MOMENT_INVALID', 'Send a map area with south < north and west < east.');
    res.json({ rings: await store.mapRings(req.user.id, box) });
  } catch (error) {
    sendError(res, error, 'map');
  }
});

/**
 * GET /unseen — the Moments tab's dot: how many people have a live Moment in the box that the caller may see and
 * hasn't watched, new since `since` (the last time they had the tab open; none: any). Never their own.
 */
router.get('/unseen', async (req, res) => {
  try {
    const { since, ...box } = parseBody(mapSchema.keys({ since: Joi.string().isoDate() }), req.query);
    if (box.south >= box.north || box.west >= box.east) throw store.fail(400, 'MOMENT_INVALID', 'Send a map area with south < north and west < east.');
    res.json({ count: await store.unseenPeople(req.user.id, box, since ? Date.parse(since) : null) });
  } catch (error) {
    sendError(res, error, 'unseen');
  }
});

/** GET /mine — the caller's own Moments that haven't ended, in any state. */
router.get('/mine', async (req, res) => {
  try {
    res.json({ moments: await store.ownMoments(req.user.id) });
  } catch (error) {
    sendError(res, error, 'mine');
  }
});

/** GET /:id — one Moment, with its signed links; 410 once it has ended. */
router.get('/:id', async (req, res) => {
  try {
    const row = await store.openMoment(momentId(req), req.user.id);
    res.json({ moment: await oneMoment(row, req.user.id) });
  } catch (error) {
    sendError(res, error, 'read');
  }
});

/** POST /:id/view — the caller watched it: one view per person; the author's own views aren't counted. */
router.post('/:id/view', actionLimiter, async (req, res) => {
  try {
    const row = await store.openMoment(momentId(req), req.user.id);
    if (row.user_id !== req.user.id) {
      const { error } = await supabaseAdmin.rpc('record_post_unique_view', { p_post_id: row.id, p_user_id: req.user.id });
      if (error) throw new Error(`Failed to record the view: ${error.message}`);
    }
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'view');
  }
});

/** GET /:id/viewers — the author's "Seen by": who watched, newest first, with their reaction and whether they replied. */
router.get('/:id/viewers', async (req, res) => {
  try {
    const row = await store.loadMoment(momentId(req));
    if (!row || row.user_id !== req.user.id) throw store.fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
    if (store.momentState(row) === 'ended') throw store.fail(410, 'MOMENT_ENDED', 'This Moment has ended.');
    res.json(await store.viewersOf(row));
  } catch (error) {
    sendError(res, error, 'viewers');
  }
});

// ─── Acting on someone's Moment ─────────────────────────────────────────────

async function othersMoment(req) {
  const row = await store.openMoment(momentId(req), req.user.id);
  if (row.user_id === req.user.id) throw store.fail(400, 'MOMENT_OWN', 'This is your own Moment.');
  return row;
}

/** PUT /:id/reaction — { emoji } (one of the post reactions) or { emoji: null } to take it back. */
router.put('/:id/reaction', actionLimiter, async (req, res) => {
  try {
    const raw = req.body?.emoji;
    const emoji = raw === null ? null : normalizePostReaction(raw);
    if (raw !== null && !emoji) throw store.fail(400, 'MOMENT_INVALID', 'Choose one of the reactions.');
    const row = await othersMoment(req);
    const { error } = await supabaseAdmin.rpc('set_post_reaction', { p_post_id: row.id, p_user_id: req.user.id, p_reaction: emoji });
    if (error) throw new Error(`Failed to save the reaction: ${error.message}`);
    res.json({ my_reaction: emoji });
  } catch (error) {
    sendError(res, error, 'reaction');
  }
});

/** POST /:id/reply — { text }: a message in the caller's direct chat with the author, naming the Moment. */
router.post('/:id/reply', actionLimiter, async (req, res) => {
  try {
    const { text } = parseBody(Joi.object({ text: Joi.string().trim().min(1).max(1000).required() }), req.body);
    const row = await othersMoment(req);
    const author = (await store.loadAuthors([row.user_id])).get(String(row.user_id));
    res.json(await momentChat.replyToMoment({
      row, author, replierId: req.user.id, text, io: req.app.get('io'), requestId: req.requestId,
    }));
  } catch (error) {
    sendError(res, error, 'reply');
  }
});

/** POST /:id/report — { reason, details? }: into the report queue; two people's reports hold it until reviewed. */
router.post('/:id/report', actionLimiter, async (req, res) => {
  try {
    const { reason, details } = parseBody(Joi.object({
      reason: Joi.string().valid(...REPORT_REASONS).required(),
      details: Joi.string().trim().max(1000).allow('', null),
    }), req.body);
    const row = await othersMoment(req);
    await filePostReport({ postId: row.id, userId: req.user.id, reason, details: details || null });
    await store.holdIfReported(row);
    res.json({ message: 'Thanks. We will review this Moment.' });
  } catch (error) {
    sendError(res, error, 'report');
  }
});

/** DELETE /:id — the author deletes their Moment; its files go unless a review holds them. */
router.delete('/:id', actionLimiter, async (req, res) => {
  try {
    const row = await store.loadMoment(momentId(req));
    if (!row || row.user_id !== req.user.id) throw store.fail(404, 'MOMENT_NOT_FOUND', 'This Moment could not be found.');
    if (!row.archived_at) await store.deleteMoment(row);
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'delete');
  }
});

// ─── Muting a person's Moments ──────────────────────────────────────────────

async function mutedAccount(req) {
  const userId = String(req.params.userId || '');
  if (!UUID.test(userId)) throw store.fail(404, 'USER_NOT_FOUND', 'This person could not be found.');
  if (userId === req.user.id) throw store.fail(400, 'MOMENT_OWN', "You can't mute your own Moments.");
  const { data, error } = await supabaseAdmin.from('User').select('id, account_type').eq('id', userId).maybeSingle();
  if (error) throw new Error(`Failed to load the person: ${error.message}`);
  if (!data) throw store.fail(404, 'USER_NOT_FOUND', 'This person could not be found.');
  return { id: data.id, type: data.account_type === 'business' ? 'business' : 'user' };
}

/** PUT /authors/:userId/mute — hide this person's Moments (only their Moments; Settings lists it to undo). */
router.put('/authors/:userId/mute', actionLimiter, async (req, res) => {
  try {
    const account = await mutedAccount(req);
    const { data: existing, error: readError } = await supabaseAdmin.from('PostMute').select('id')
      .eq('user_id', req.user.id).eq('muted_entity_type', account.type).eq('muted_entity_id', account.id)
      .eq('surface', 'moments').limit(1);
    if (readError) throw new Error(`Failed to read mutes: ${readError.message}`);
    if (!existing?.length) {
      const { error } = await supabaseAdmin.from('PostMute').insert({
        user_id: req.user.id, muted_entity_type: account.type, muted_entity_id: account.id, surface: 'moments',
      });
      if (error && String(error.code) !== '23505') throw new Error(`Failed to mute: ${error.message}`);
    }
    feedService.invalidateFilterCache(req.user.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'mute');
  }
});

/** DELETE /authors/:userId/mute — show this person's Moments again. */
router.delete('/authors/:userId/mute', actionLimiter, async (req, res) => {
  try {
    const account = await mutedAccount(req);
    const { error } = await supabaseAdmin.from('PostMute').delete()
      .eq('user_id', req.user.id).eq('muted_entity_id', account.id).eq('surface', 'moments');
    if (error) throw new Error(`Failed to unmute: ${error.message}`);
    feedService.invalidateFilterCache(req.user.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error, 'unmute');
  }
});

module.exports = router;
