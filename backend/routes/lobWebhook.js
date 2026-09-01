/**
 * Lob Webhook Handler
 *
 * Receives postcard lifecycle events from Lob and updates
 * MailVerificationJob + AddressVerificationAttempt records.
 *
 * Mounted at /api/v1/webhooks/lob in app.js with express.raw()
 * middleware (before JSON body parser) for signature verification.
 *
 * Lob event types handled:
 *   postcard.created, postcard.rendered_pdf, postcard.mailed,
 *   postcard.in_transit, postcard.in_local_area,
 *   postcard.processed_for_delivery, postcard.delivered,
 *   postcard.re-routed, postcard.returned_to_sender,
 *   postcard.deleted, postcard.failed
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const lobMailProvider = require('../services/addressValidation/lobMailProvider');
const mailVendorService = require('../services/addressValidation/mailVendorService');

router.post('/', async (req, res) => {
  const rawBody = req.body;
  const timestamp = req.headers['lob-signature-timestamp'];
  const signature = req.headers['lob-signature'];

  // ── 1. Parse the raw body ─────────────────────────────────
  let event;
  try {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);

    // ── 2. Verify signature (skip if secret not configured) ──
    if (lobMailProvider.webhookSecret) {
      if (!timestamp || !signature) {
        logger.warn('Lob webhook: missing signature headers');
        return res.status(400).json({ error: 'Missing signature headers' });
      }

      const valid = lobMailProvider.verifyWebhookSignature(bodyStr, timestamp, signature);
      if (!valid) {
        logger.warn('Lob webhook: invalid signature', { timestamp });
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    event = JSON.parse(bodyStr);
  } catch (err) {
    logger.error('Lob webhook: failed to parse body', { error: err.message });
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  // ── 3. Extract event details ──────────────────────────────
  const eventType = event.event_type?.id || event.type;
  const postcardId = event.body?.id || event.reference_id;

  if (!eventType || !postcardId) {
    logger.warn('Lob webhook: missing event_type or postcard ID', { event });
    return res.status(400).json({ error: 'Missing event_type or postcard ID' });
  }

  logger.info('Lob webhook received', {
    eventType,
    postcardId,
    eventId: event.id,
  });

  // ── 4. Process the event ──────────────────────────────────
  try {
    const result = await mailVendorService.processWebhookEvent(
      postcardId,
      eventType,
      event,
    );

    if (!result.success) {
      // Still return 200 to prevent Lob from retrying for "not found" cases
      logger.warn('Lob webhook: event processing issue', {
        postcardId,
        eventType,
        error: result.error,
      });
    }

    return res.json({ received: true, postcardId, eventType });
  } catch (err) {
    logger.error('Lob webhook: processing error', {
      postcardId,
      eventType,
      error: err.message,
      stack: err.stack,
    });

    // Return 200 to prevent infinite retries
    return res.json({ received: true, error: err.message });
  }
});

module.exports = router;
