// ============================================================
// STRIPE IDENTITY WEBHOOKS
// identity.verification_session.* events for home claim identity checks.
//
// A separate endpoint and signing secret from /api/webhooks/stripe: the
// identity key can be live while payments stay in test mode, and a Stripe
// webhook endpoint belongs to one mode. Every event is re-read from Stripe
// before anything is recorded, so a replayed or reordered event only ever
// records the session as it is now.
// ============================================================

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const identity = require('../services/homeClaimIdentityService');

// Mount with express.raw({ type: 'application/json' }) before the JSON parser (see app.js).
router.post('/', async (req, res) => {
  const settings = identity.config();
  if (!settings.available || !settings.webhookSecret) {
    return res.status(503).json({ error: 'Identity webhooks are not configured' });
  }
  if (!(Buffer.isBuffer(req.body) || typeof req.body === 'string')) {
    logger.error('Identity webhook body was parsed before signature verification');
    return res.status(400).send('Webhook Error: expected a raw body');
  }

  let event;
  try {
    event = identity.stripeClient().webhooks.constructEvent(req.body, req.headers['stripe-signature'], settings.webhookSecret);
  } catch (err) {
    logger.warn('Identity webhook signature verification failed', { error: err.message });
    return res.status(400).send('Webhook Error: signature verification failed');
  }

  if (!event.type?.startsWith('identity.verification_session.') || event.livemode !== settings.live) {
    logger.info('Identity webhook event ignored', { type: event.type, livemode: event.livemode });
    return res.json({ received: true, ignored: true });
  }

  try {
    const result = await identity.handleWebhookEvent(event);
    logger.info('Identity webhook processed', { type: event.type, eventId: event.id, handled: result.handled });
    return res.json({ received: true });
  } catch (err) {
    // Stripe retries a failed delivery; recording the same session again is harmless.
    logger.error('Identity webhook processing failed', { type: event.type, eventId: event.id, errorCode: err.code });
    return res.status(err.statusCode === 503 ? 503 : 500).json({ error: 'Webhook handler failed' });
  }
});

module.exports = router;
