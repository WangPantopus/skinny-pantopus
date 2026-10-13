/**
 * AI Agent Routes — endpoints for the Pantopus AI assistant.
 *
 * Endpoints:
 *   GET  /health                 — Health check
 *   POST /chat                   — Streaming chat agent (SSE)
 *   POST /draft/listing          — Single-turn listing draft
 *   POST /draft/post             — Single-turn post draft
 *   POST /draft/mail-opening    — Mail opening line suggestion
 *   POST /summarize/mail         — Mail summarization
 *   GET  /place-brief            — Place brief with external data
 *   GET  /property-profile       — Property intelligence profile
 *   GET  /pulse                  — Neighborhood Pulse (cold-start)
 *   GET  /conversations          — List user's AI conversations
 *   DELETE /conversations/:id    — Delete a conversation
 */
const express = require('express');
const Joi = require('joi');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const { aiChatLimiter, aiDraftLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../errorHandler');
const agentService = require('../services/ai/agentService');
const { CHAT_MODEL, DRAFT_MODEL } = require('../config/anthropic');
const propertyIntelligenceService = require('../services/ai/propertyIntelligenceService');
const neighborhoodPulseComposer = require('../services/ai/neighborhoodPulseComposer');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { checkHomePermission } = require('../utils/homePermissions');

function aiErrorStatus(errorCode) {
  if (errorCode === 'AI_UNAVAILABLE') return 503;
  if (errorCode === 'AI_TIMEOUT') return 504;
  return 422;
}

// ─── Validation Schemas ─────────────────────────────────────────────────────

const chatSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required(),
  conversationId: Joi.string().uuid().optional(),
  coarseLocation: Joi.object({
    city: Joi.string().max(100),
    state: Joi.string().max(50),
  }).optional(),
  images: Joi.array().items(Joi.string().uri()).max(5).optional(),
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
  const { message, conversationId, coarseLocation, images } = req.body;
  const userId = req.user.id;

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
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
    { userId, conversationId, message, coarseLocation, images, signal: clientGone.signal },
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
  const conversations = await agentService.listConversations(req.user.id);
  res.json({ conversations });
}));

// A conversation's history, so an app can show it again after a relaunch.
router.get('/conversations/:id/messages', verifyToken, asyncHandler(async (req, res) => {
  const { error: invalid } = Joi.string().uuid().validate(req.params.id);
  if (invalid) return res.status(404).json({ error: 'Conversation not found' });
  const conversation = await agentService.getConversationMessages(req.user.id, req.params.id);
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

// ─── Audio Transcription ─────────────────────────────────────────────────────
// Claude takes no audio, and no speech-to-text service has replaced Whisper, so
// this answers "unavailable" at once rather than buffering a 25 MB upload only
// to refuse it. The voice-note button in the task composer (Open Gigs, a launch
// cut) is its only caller, and it already ignores a failed transcription.
router.post('/transcribe', verifyToken, aiDraftLimiter, (_req, res) => {
  res.status(503).json({ error: 'AI transcription service unavailable' });
});

module.exports = router;
