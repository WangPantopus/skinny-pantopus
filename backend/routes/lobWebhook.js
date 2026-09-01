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
const supabaseAdmin = require('../config/supabaseAdmin');

/** How far a webhook timestamp may be from now before it is treated as a replay. */
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

router.post('/', async (req, res) => {
  const rawBody = req.body;
  const timestamp = req.headers['lob-signature-timestamp'];
  const signature = req.headers['lob-signature'];

  // ── 1. Parse the raw body ─────────────────────────────────
  let event;
  try {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);

    // ── 2. Verify signature — unconditionally ────────────────
    // Fail closed. If the secret is not configured we cannot authenticate the
    // caller, so we must refuse rather than trust an unauthenticated POST.
    if (!lobMailProvider.webhookSecret) {
      logger.error('Lob webhook: LOB_WEBHOOK_SECRET is not configured; rejecting');
      return res.status(503).json({ error: 'Webhook not configured' });
    }

    if (!timestamp || !signature) {
      logger.warn('Lob webhook: missing signature headers');
      return res.status(400).json({ error: 'Missing signature headers' });
    }

    // Reject stale timestamps so a captured request cannot be replayed later.
    const tsMs = Number(timestamp);
    if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > MAX_SIGNATURE_AGE_MS) {
      logger.warn('Lob webhook: timestamp outside the accepted window', { timestamp });
      return res.status(400).json({ error: 'Stale or invalid timestamp' });
    }

    const valid = lobMailProvider.verifyWebhookSignature(bodyStr, timestamp, signature);
    if (!valid) {
      logger.warn('Lob webhook: invalid signature', { timestamp });
      return res.status(401).json({ error: 'Invalid webhook signature' });
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

  // ── 4. De-duplicate ───────────────────────────────────────
  // Lob retries, and events can arrive out of order or more than once. The
  // unique index on lob_event_id makes this a single atomic claim.
  if (event.id) {
    const { error: dupErr } = await supabaseAdmin
      .from('LobWebhookEvent')
      .insert({
        lob_event_id: event.id,
        event_type: eventType,
        postcard_id: postcardId,
      });

    if (dupErr) {
      if (dupErr.code === '23505') {
        logger.info('Lob webhook: duplicate event ignored', { eventId: event.id, eventType });
        return res.json({ received: true, duplicate: true });
      }
      // A failure to record the event means we cannot guarantee
      // at-most-once processing. Ask Lob to retry rather than risk a
      // double transition.
      logger.error('Lob webhook: could not record event', {
        eventId: event.id, error: dupErr.message,
      });
      return res.status(500).json({ error: 'Could not record event' });
    }
  }

  // ── 5. Process the event ──────────────────────────────────
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
