/**
 * AI Agent Routes — endpoints for the Pantopus AI assistant.
 *
 * Endpoints:
 *   GET  /health                 — Health check
 *   POST /chat                   — Streaming chat agent (SSE)
 *   POST /draft/listing          — Single-turn listing draft
 *   POST /draft/post             — Single-turn post draft
 *   POST /draft/pickup-schedule  — Pickup days from a flyer photo, for the Today editor
 *   POST /draft/radon-result     — Radon result from a lab report photo or PDF, for the Today radon sheet
 *   POST /draft/mail-opening    — Mail opening line suggestion
 *   POST /summarize/mail         — Mail summarization
 *   GET  /place-brief            — Place brief with external data
 *   GET  /property-profile       — Property intelligence profile
 *   GET  /pulse                  — Neighborhood Pulse (cold-start)
 *   GET  /conversations          — List user's AI conversations
 *   GET  /conversations/:id/messages?cards= — One conversation's turns, with the cards the app can show
 *   DELETE /conversations/:id    — Delete a conversation
 *   POST /nudges/:id/fewer       — "Fewer like this" on a nudge or the morning brief
 *   POST /cards/:cardId/state    — What ran on one of the person's cards (done or dismissed)
 *   GET|POST|DELETE /memory, PATCH|DELETE /memory/:id, POST /memory/reviewed — What Pantopus remembers
 *   GET  /needs-you              — What waits on the person, for Today and the assistant
 *   GET|POST /follow-ups, DELETE /follow-ups/:id — Check-backs ("check back Thursday")
 *   GET  /glance/:topic          — Pickup, today or nearby in a few sentences, for Siri and the launcher
 *   GET|POST /rules, PATCH|DELETE /rules/:id — What Pantopus does for you (standing rules)
 */
const express = require('express');
const Joi = require('joi');
const multer = require('multer');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const { aiChatLimiter, aiDraftLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../errorHandler');
const agentService = require('../services/ai/agentService');
const nudgeEngine = require('../services/ai/nudges/engine');
const cardState = require('../services/ai/cardState');
const memory = require('../services/ai/memory');
const { needsYou } = require('../services/ai/needsYou');
const followUps = require('../services/ai/followUps');
const { glance, GlanceError } = require('../services/ai/glance');
const rules = require('../services/ai/rules');
const radonReport = require('../services/ai/radonReport');
const { CHAT_MODEL, DRAFT_MODEL } = require('../config/anthropic');
const propertyIntelligenceService = require('../services/ai/propertyIntelligenceService');
const neighborhoodPulseComposer = require('../services/ai/neighborhoodPulseComposer');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { checkHomePermission } = require('../utils/homePermissions');
const { getRequestSessionScope } = require('../utils/requestSessionScope');

function aiErrorStatus(errorCode) {
  if (errorCode === 'AI_UNAVAILABLE') return 503;
  if (errorCode === 'AI_TIMEOUT') return 504;
  return 422;
}

// ─── Validation Schemas ─────────────────────────────────────────────────────

// The draft cards this app can show beyond the original ones (e.g. "pickup_schedule",
// "action", "link"). Unknown names are ignored, so older servers and newer apps get along.
const cardsSchema = Joi.array().items(Joi.string().max(40)).max(20);

/** The same list on a GET, comma-separated (`?cards=pickup_schedule,action,link`). */
function cardsQuery(listed) {
  if (listed === undefined) return { value: [] };
  if (typeof listed !== 'string') return { error: new Error('cards must be a comma-separated list') };
  const names = listed.split(',').map((name) => name.trim()).filter(Boolean);
  const { error } = Joi.object({ cards: cardsSchema }).validate({ cards: names });
  return error ? { error } : { value: names };
}

const chatSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required(),
  conversationId: Joi.string().uuid().optional(),
  coarseLocation: Joi.object({
    city: Joi.string().max(100),
    state: Joi.string().max(50),
  }).optional(),
  // The person's own uploads (POST /api/upload/ai-media hands back ai-photo: references) or image URLs.
  images: Joi.array().items(Joi.string().uri()).max(5).optional(),
  cards: cardsSchema.optional(),
  // The screen the person tapped Ask on (docs/product/ai-assistant-phase1-contract-2026-10-20.md §6).
  // Unknown surfaces are ignored; access is checked as that screen checks it.
  context: Joi.object({
    surface: Joi.string().max(40).required(),
    id: Joi.string().uuid().optional().allow(null),
    home_id: Joi.string().uuid().optional().allow(null),
    section: Joi.string().max(40).optional().allow(null),
  }).optional().allow(null),
});

const draftGigSchema = Joi.object({
  text: Joi.string().min(1).max(2000).required(),
  coarseLocation: Joi.object({
    city: Joi.string().max(100),
    state: Joi.string().max(50),
  }).optional(),
  context: Joi.object({
    budgetHint: Joi.string().max(200).optional(),
    timeHint: Joi.string().max(200).optional(),
    category: Joi.string().max(100).optional(),
  }).optional(),
});

const draftListingSchema = Joi.object({
  text: Joi.string().min(1).max(2000).required(),
  coarseLocation: Joi.object({
    city: Joi.string().max(100),
    state: Joi.string().max(50),
  }).optional(),
});

const draftListingVisionSchema = Joi.object({
  images: Joi.array().items(Joi.string()).min(1).max(5).required(),
  text: Joi.string().max(2000).allow('', null),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
});

const draftPostSchema = Joi.object({
  text: Joi.string().min(1).max(2000).required(),
  surface: Joi.string().valid('place', 'connections').optional(),
  coarseLocation: Joi.object({
    city: Joi.string().max(100),
    state: Joi.string().max(50),
  }).optional(),
});

const summarizeMailSchema = Joi.object({
  mailItemId: Joi.string().uuid().required(),
});

const placeBriefSchema = Joi.object({
  placeId: Joi.string().uuid().required(),
});

const propertyProfileSchema = Joi.object({
  homeId: Joi.string().uuid().required(),
});

const pulseSchema = Joi.object({
  homeId: Joi.string().uuid().required(),
});

// ─── Health ─────────────────────────────────────────────────────────────────

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    models: {
      chat: CHAT_MODEL,
      draft: DRAFT_MODEL,
    },
  });
});

// ─── Streaming Chat ─────────────────────────────────────────────────────────

router.post('/chat', verifyToken, aiChatLimiter, validate(chatSchema), asyncHandler(async (req, res) => {
  const { message, conversationId, coarseLocation, images, cards, context } = req.body;
  const userId = req.user.id;
  // Action cards that create household tasks carry this session's scope, as the
  // tasks screen's own requests do (utils/requestSessionScope.js).
  let sessionScope = null;
  try {
    sessionScope = getRequestSessionScope(req).session_scope;
  } catch {
    sessionScope = null;
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    // no-transform: a compressing proxy (the web app's Next server, which forwards /api) would
    // otherwise gzip the stream and hold every event until the turn ends.
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',    // Disable nginx buffering
  });

  // SSE writer helper
  const sseWriter = {
    write(event, data) {
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (err) {
        logger.warn('SSE write failed (client probably disconnected)', { event });
      }
    },
    end() {
      try {
        res.write('event: close\ndata: {}\n\n');
        res.end();
      } catch {
        // Client already disconnected
      }
    },
  };

  // Handle client disconnect: stop the model call rather than pay for a reply
  // nobody is reading. (req 'close' also fires when the request body has been
  // read, so the response is the one to watch.)
  const clientGone = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) clientGone.abort();
  });

  await agentService.streamChat(
    {
      userId, conversationId, message, coarseLocation, images, cards, context, sessionScope,
      user: { id: userId, role: req.user.role || null }, signal: clientGone.signal,
    },
    sseWriter
  );
}));

// ─── Single-turn Draft: Gig ─────────────────────────────────────────────────

router.post('/draft/gig', verifyToken, aiDraftLimiter, validate(draftGigSchema), asyncHandler(async (req, res) => {
  const { text, coarseLocation, context } = req.body;
  const result = await agentService.draftGig({
    text,
    coarseLocation,
    context,
    userId: req.user.id,
  });

  if (result.error) {
    return res.status(aiErrorStatus(result.error)).json(result);
  }

  res.json(result);
}));

// ─── Single-turn Draft: Listing ─────────────────────────────────────────────

router.post('/draft/listing', verifyToken, aiDraftLimiter, validate(draftListingSchema), asyncHandler(async (req, res) => {
  const { text, coarseLocation } = req.body;
  const result = await agentService.draftListing({
    text,
    coarseLocation,
    userId: req.user.id,
  });

  if (result.error) {
    return res.status(aiErrorStatus(result.error)).json(result);
  }

  res.json(result);
}));

// ─── Single-turn Draft: Listing Vision (Snap & Sell) ────────────────────────

router.post('/draft/listing-vision', verifyToken, aiDraftLimiter, validate(draftListingVisionSchema), asyncHandler(async (req, res) => {
  const { images, text, latitude, longitude } = req.body;
  const result = await agentService.draftListingFromImages({
    images,
    text,
    latitude,
    longitude,
    userId: req.user.id,
  });

  if (result.error) {
    return res.status(aiErrorStatus(result.error)).json(result);
  }

  res.json(result);
}));

// ─── Single-turn Draft: Post ────────────────────────────────────────────────

router.post('/draft/post', verifyToken, aiDraftLimiter, validate(draftPostSchema), asyncHandler(async (req, res) => {
  const { text, surface, coarseLocation } = req.body;
  const result = await agentService.draftPost({
    text,
    surface,
    coarseLocation,
    userId: req.user.id,
  });

  if (result.error) {
    return res.status(aiErrorStatus(result.error)).json(result);
  }

  res.json(result);
}));

// ─── Pickup Days from a Flyer ───────────────────────────────────────────────
// Fills the pickup editor; the editor's own Save writes the days.

const draftPickupScheduleSchema = Joi.object({
  // The person's own uploads (POST /api/upload/ai-media).
  images: Joi.array().items(Joi.string().uri()).min(1).max(3),
  text: Joi.string().max(1000),
}).or('images', 'text');

router.post('/draft/pickup-schedule', verifyToken, aiDraftLimiter, validate(draftPickupScheduleSchema), asyncHandler(async (req, res) => {
  const { images, text } = req.body;
  const result = await agentService.readPickupSchedule({ images, text, userId: req.user.id });
  if (result.error) {
    return res.status(aiErrorStatus(result.error)).json(result);
  }
  res.json(result);
}));

// ─── Radon Result from a Lab Report ─────────────────────────────────────────
// Fills the Today radon sheet; the sheet's own Save records the answer. The
// report (one photo or PDF, as `file`) is read in memory and never stored.

const receiveRadonReport = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: radonReport.MAX_REPORT_BYTES, files: 1 },
}).single('file');

function radonReportUpload(req, res, next) {
  receiveRadonReport(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'FILE_TOO_LARGE', message: 'That file is over 10 MB. Try a photo of the report instead.' });
    }
    return res.status(400).json({ error: 'FILE_UNREADABLE', message: "Couldn't read that file. Try a photo or a PDF of the report." });
  });
}

router.post('/draft/radon-result', verifyToken, aiDraftLimiter, radonReportUpload, asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'NO_FILE', message: 'Choose a photo or a PDF of your radon report.' });
  }
  const result = await agentService.readRadonReport({ file: req.file.buffer, userId: req.user.id });
  if (result.error) {
    return res.status(aiErrorStatus(result.error)).json(result);
  }
  res.json(result);
}));

// ─── Mail Opening Suggestion ────────────────────────────────────────────────

const draftMailOpeningSchema = Joi.object({
  intent: Joi.string().valid(
    'personal_note', 'household_notice', 'bill_request',
    'offer_promotion', 'document', 'package_pickup', 'certified_signature'
  ).required(),
  ink: Joi.string().valid('ivory', 'slate', 'forest', 'rose', 'midnight').required(),
  recipientName: Joi.string().min(1).max(200).required(),
  body: Joi.string().max(2000).optional().allow(''),
});

router.post('/draft/mail-opening', verifyToken, aiDraftLimiter, validate(draftMailOpeningSchema), asyncHandler(async (req, res) => {
  const { intent, ink, recipientName, body } = req.body;
  const result = await agentService.draftMailOpening({
    intent,
    ink,
    recipientName,
    body: body || undefined,
    userId: req.user.id,
  });

  // Per spec: AI failures return 200 with suggestion: null
  // so the frontend treats it as "no suggestion available" gracefully
  if (result.error) {
    return res.json({ suggestion: null, error: result.error });
  }

  res.json({ suggestion: result.suggestion });
}));

// ─── Mail Summarization ─────────────────────────────────────────────────────

router.post('/summarize/mail', verifyToken, aiDraftLimiter, validate(summarizeMailSchema), asyncHandler(async (req, res) => {
  const { mailItemId } = req.body;
  const result = await agentService.summarizeMail({
    mailItemId,
    userId: req.user.id,
  });

  if (result.error) {
    const status = result.error === 'MAIL_NOT_FOUND' ? 404
      : aiErrorStatus(result.error);
    return res.status(status).json(result);
  }

  res.json(result);
}));

// ─── Place Brief ────────────────────────────────────────────────────────────

router.get('/place-brief', verifyToken, aiDraftLimiter, asyncHandler(async (req, res) => {
  const { error: validError } = placeBriefSchema.validate(req.query);
  if (validError) {
    return res.status(400).json({ error: 'Validation failed', message: validError.message });
  }

  const result = await agentService.generatePlaceBrief({
    placeId: req.query.placeId,
    userId: req.user.id,
  });

  if (result.error) {
    const status = result.error === 'PLACE_NOT_FOUND' ? 404
      : aiErrorStatus(result.error);
    return res.status(status).json(result);
  }

  res.json(result);
}));

// ─── Property Profile ────────────────────────────────────────────────────────

router.get('/property-profile', verifyToken, asyncHandler(async (req, res) => {
  const { error: validError } = propertyProfileSchema.validate(req.query);
  if (validError) {
    return res.status(400).json({ error: 'Validation failed', message: validError.message });
  }

  const homeId = req.query.homeId;
  const userId = req.user.id;

  const access = await checkHomePermission(homeId, userId, 'home.view');
  if (!access.hasAccess) {
    return res.status(403).json({ error: 'You do not have access to this home' });
  }

  const result = await propertyIntelligenceService.getProfile(homeId);

  if (!result.profile) {
    return res.status(404).json({ error: 'Home not found' });
  }

  res.json(result);
}));

// ─── Neighborhood Pulse ──────────────────────────────────────────────────────

router.get('/pulse', verifyToken, asyncHandler(async (req, res) => {
  const { error: validError } = pulseSchema.validate(req.query);
  if (validError) {
    return res.status(400).json({ error: 'Validation failed', message: validError.message });
  }

  const homeId = req.query.homeId;
  const userId = req.user.id;

  const access = await checkHomePermission(homeId, userId, 'home.view');
  if (!access.hasAccess) {
    return res.status(403).json({ error: 'You do not have access to this home' });
  }

  const result = await neighborhoodPulseComposer.compose({ homeId, userId });

  if (result.error) {
    const status = result.error === 'HOME_NOT_FOUND' ? 404 : 500;
    return res.status(status).json(result);
  }

  res.json(result);
}));

// ─── Conversation Management ────────────────────────────────────────────────

router.get('/conversations', verifyToken, asyncHandler(async (req, res) => {
  const { value: order, error } = Joi.string().valid('newest', 'oldest').default('newest').validate(req.query.order);
  if (error) return res.status(400).json({ error: 'Invalid conversation order' });
  const conversations = await agentService.listConversations(req.user.id, { oldestFirst: order === 'oldest' });
  res.json({ conversations });
}));

// A conversation's history, so an app can show it again after a relaunch. `?cards=` is the
// chat request's list, comma-separated: an app gets back only the cards it can show, so a
// build without action cards never sees one that another build of the same account made.
router.get('/conversations/:id/messages', verifyToken, asyncHandler(async (req, res) => {
  const { error: invalid } = Joi.string().uuid().validate(req.params.id);
  if (invalid) return res.status(404).json({ error: 'Conversation not found' });
  const { value: cards, error: badCards } = cardsQuery(req.query.cards);
  if (badCards) return res.status(400).json({ error: 'Validation failed', message: badCards.message });
  const conversation = await agentService.getConversationMessages(req.user.id, req.params.id, { cards });
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
  res.json(conversation);
}));

router.delete('/conversations/:id', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await agentService.deleteConversation(req.user.id, id);
  if (!deleted) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  res.json({ message: 'Conversation deleted' });
}));

// ─── "Fewer like this" ──────────────────────────────────────────────────────
// The secondary action on every nudge's card (phase 2 contract §3.6): mutes that kind
// of suggestion for 30 days; on the morning brief, the plain briefing comes back.

router.post('/nudges/:notificationId/fewer', verifyToken, asyncHandler(async (req, res) => {
  const result = await nudgeEngine.fewerLikeThis(req.user.id, req.params.notificationId);
  if (!result) return res.status(404).json({ error: 'Suggestion not found' });
  res.json(result);
}));

// ─── Card done states ───────────────────────────────────────────────────────
// Phase 3 contract §4.2: the apps report what ran on a card, so every device (and a
// reinstall) shows it done. The writes limiter verifyToken applies covers it.

const cardStateSchema = Joi.object({
  status: Joi.string().valid('done', 'dismissed').required(),
  action_id: Joi.when('status', {
    is: 'done',
    then: Joi.string().max(40).required(),
    otherwise: Joi.string().max(40).allow(null).optional(),
  }),
  item_id: Joi.string().max(100).allow(null).optional(),
  link: Joi.string().max(500).allow(null, '').optional(),
});

router.post('/cards/:cardId/state', verifyToken, validate(cardStateSchema), asyncHandler(async (req, res) => {
  const result = await cardState.reportState(req.user.id, req.params.cardId, req.body);
  if (result.code) return res.status(result.status).json({ error: result.message, code: result.code });
  res.json(result);
}));

// ─── What Pantopus remembers ────────────────────────────────────────────────
// Phase 3 contract §5.4: the person's own items only. An item is added only from a
// memory_save card they tapped (POST with the card's id), as the card showed it.

function memoryRoute(handler) {
  return asyncHandler(async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof memory.MemoryError) return res.status(err.status).json({ error: err.message, code: err.code });
      throw err;
    }
  });
}

router.get('/memory', verifyToken, memoryRoute(async (req, res) => {
  res.json(await memory.listMemory(req.user.id));
}));

router.post('/memory', verifyToken, validate(Joi.object({ card_id: Joi.string().uuid().required() })), memoryRoute(async (req, res) => {
  const { status, item } = await memory.saveFromCard(req.user.id, req.body.card_id);
  res.status(status).json({ item });
}));

router.post('/memory/reviewed', verifyToken, memoryRoute(async (req, res) => {
  res.json(await memory.markReviewed(req.user.id));
}));

router.patch('/memory/:id', verifyToken, validate(Joi.object({ fact: Joi.string().max(1000).required() })), memoryRoute(async (req, res) => {
  res.json({ item: await memory.editFact(req.user.id, req.params.id, req.body.fact) });
}));

router.delete('/memory/:id', verifyToken, memoryRoute(async (req, res) => {
  await memory.forget(req.user.id, req.params.id);
  res.status(204).end();
}));

router.delete('/memory', verifyToken, memoryRoute(async (req, res) => {
  res.json(await memory.forgetAll(req.user.id));
}));

// ─── Needs you ──────────────────────────────────────────────────────────────
// Phase 3 contract §6.2: read as the person from the screens' own services, each source
// within 1.5 seconds (`partial` when one was left out). No model call, nothing written.

router.get('/needs-you', verifyToken, asyncHandler(async (req, res) => {
  res.json(await needsYou({ userId: req.user.id, user: { id: req.user.id, role: req.user.role || null } }));
}));

// ─── Follow-ups ─────────────────────────────────────────────────────────────
// Phase 3 contract §7.1: set only from a follow_up card the person tapped, as it was shown.

function followUpRoute(handler) {
  return asyncHandler(async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof followUps.FollowUpError) return res.status(err.status).json({ error: err.message, code: err.code });
      throw err;
    }
  });
}

router.get('/follow-ups', verifyToken, followUpRoute(async (req, res) => {
  res.json({ follow_ups: await followUps.listWaiting(req.user.id) });
}));

router.post('/follow-ups', verifyToken, validate(Joi.object({ card_id: Joi.string().uuid().required() })), followUpRoute(async (req, res) => {
  const { status, follow_up: followUp } = await followUps.setFromCard(req.user.id, req.body.card_id);
  res.status(status).json({ follow_up: followUp });
}));

router.delete('/follow-ups/:id', verifyToken, followUpRoute(async (req, res) => {
  res.json(await followUps.cancel(req.user.id, req.params.id));
}));

// ─── Glance answers ─────────────────────────────────────────────────────────
// Phase 3 contract §8.2: written from facts as the person (no model call, nothing written).
// A home_id must be theirs: chosenHome would quietly fall back to the default home.

router.get('/glance/:topic', verifyToken, aiDraftLimiter, asyncHandler(async (req, res) => {
  const homeId = req.query.home_id ?? null;
  try {
    res.json(await glance(req.user.id, req.params.topic, { homeId }));
  } catch (err) {
    if (err instanceof GlanceError) return res.status(404).json({ code: err.code, speech: err.speech, link: err.link });
    throw err;
  }
}));

// ─── Standing rules ─────────────────────────────────────────────────────────
// Phase 3 contract §18.5: the person's own rules only. A rule is turned on only from a
// rule_save card they tapped (POST with the card's id), as the card showed it.

function ruleRoute(handler) {
  return asyncHandler(async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof rules.RuleError) return res.status(err.status).json({ error: err.message, code: err.code });
      throw err;
    }
  });
}

router.get('/rules', verifyToken, ruleRoute(async (req, res) => {
  res.json(await rules.listRules(req.user.id));
}));

router.post('/rules', verifyToken, validate(Joi.object({ card_id: Joi.string().uuid().required() })), ruleRoute(async (req, res) => {
  const { status, rule } = await rules.saveFromCard(req.user.id, req.body.card_id);
  res.status(status).json({ rule });
}));

const ruleChangeSchema = Joi.object({ enabled: Joi.boolean(), extend: Joi.boolean().valid(true) }).or('enabled', 'extend');

router.patch('/rules/:id', verifyToken, validate(ruleChangeSchema), ruleRoute(async (req, res) => {
  res.json(await rules.changeRule({ id: req.user.id, role: req.user.role || null }, req.params.id, req.body));
}));

router.delete('/rules/:id', verifyToken, ruleRoute(async (req, res) => {
  await rules.deleteRule(req.user.id, req.params.id);
  res.status(204).end();
}));

// ─── Audio Transcription ─────────────────────────────────────────────────────
// Claude takes no audio, and no speech-to-text service has replaced Whisper, so
// this answers "unavailable" at once rather than buffering a 25 MB upload only
// to refuse it. The voice-note button in the task composer (Open Gigs, a launch
// cut) is its only caller, and it already ignores a failed transcription.
router.post('/transcribe', verifyToken, aiDraftLimiter, (_req, res) => {
  res.status(503).json({ error: 'AI transcription service unavailable' });
});

module.exports = router;
