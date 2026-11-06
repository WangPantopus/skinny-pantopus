/**
 * Mail Webhook Handler
 *
 * Receives postcard lifecycle events from a printer and updates the mail row
 * the event belongs to. Lob's is mounted at /api/v1/webhooks/lob in app.js with
 * express.raw() middleware (before JSON body parser) for signature verification.
 * Another printer gets the same handler through mailWebhookRouter().
 *
 * Lob event types handled:
 *   postcard.created, postcard.rendered_pdf, postcard.mailed,
 *   postcard.in_transit, postcard.in_local_area,
 *   postcard.processed_for_delivery, postcard.delivered,
 *   postcard.re-routed, postcard.returned_to_sender,
 *   postcard.deleted, postcard.failed, postcard.rejected
 */

const express = require('express');
const logger = require('../utils/logger');
const lobMailProvider = require('../services/addressValidation/lobMailProvider');
const mailVendorService = require('../services/addressValidation/mailVendorService');
const { vendorStatusFor } = require('../services/addressValidation/mailEvents');
const supabaseAdmin = require('../config/supabaseAdmin');
const homePostcardService = require('../services/homePostcardService');

/** How far a webhook timestamp may be from now before it is treated as a replay. */
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;
/** A claim this old with no finished processing lost its worker, so a redelivery may take it. */
const STALE_CLAIM_MS = 2 * 60 * 1000;

/** Lob's signature check. Answers null when the request is authentic. */
function verifyLobRequest(bodyStr, headers) {
  const timestamp = headers['lob-signature-timestamp'];
  const signature = headers['lob-signature'];

  // Fail closed. If the secret is not configured we cannot authenticate the
  // caller, so we must refuse rather than trust an unauthenticated POST.
  if (!lobMailProvider.webhookSecret) {
    logger.error('Lob webhook: LOB_WEBHOOK_SECRET is not configured; rejecting');
    return { status: 503, error: 'Webhook not configured' };
  }

  if (!timestamp || !signature) {
    logger.warn('Lob webhook: missing signature headers');
    return { status: 400, error: 'Missing signature headers' };
  }

  // Reject stale timestamps so a captured request cannot be replayed later.
  const tsMs = Number(timestamp);
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > MAX_SIGNATURE_AGE_MS) {
    logger.warn('Lob webhook: timestamp outside the accepted window', { timestamp });
    return { status: 400, error: 'Stale or invalid timestamp' };
  }

  if (!lobMailProvider.verifyWebhookSignature(bodyStr, timestamp, signature)) {
    logger.warn('Lob webhook: invalid signature', { timestamp });
    return { status: 401, error: 'Invalid webhook signature' };
  }
  return null;
}

/** The flow a piece belongs to, by the reference we printed on it. */
function handlerFor(event) {
  const metadata = event.body?.metadata;
  if (metadata?.pantopus_home_postcard_id) return homePostcardService;
  if (metadata?.pantopus_block_invite_id) return require('../services/blockFoundersService');
  return mailVendorService;
}

/**
 * @param {string} providerName
 * @param {(bodyStr: string, headers: object) => ({status: number, error: string}|null)} verifyRequest
 * @param {(parsed: object) => (object|null)} toEvent - the event in our words, or null for one with no news
 */
function mailWebhookRouter(providerName, verifyRequest, toEvent) {
  const router = express.Router();
  router.post('/', async (req, res) => {
    const rawBody = req.body;

    // ── 1. Parse the raw body ─────────────────────────────────
    let event;
    try {
      const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);

      // ── 2. Verify signature — unconditionally ────────────────
      const refused = verifyRequest(bodyStr, req.headers);
      if (refused) return res.status(refused.status).json({ error: refused.error });

      event = toEvent(JSON.parse(bodyStr));
    } catch (err) {
      logger.error('Mail webhook: failed to parse body', { provider: providerName, error: err.message });
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    if (event === null) return res.json({ received: true });
    event.provider = providerName;

    // ── 3. Extract event details ──────────────────────────────
    const eventType = event.event_type?.id || event.type;
    const postcardId = event.body?.id || event.reference_id;

    if (!eventType || !postcardId) {
      logger.warn('Mail webhook: missing event_type or postcard ID', { provider: providerName });
      return res.status(400).json({ error: 'Missing event_type or postcard ID' });
    }

    logger.info('Mail webhook received', {
      provider: providerName,
      eventType,
      postcardId,
      eventId: event.id,
    });

    // ── 4. De-duplicate ───────────────────────────────────────
    // Printers retry, and events can arrive out of order or more than once. The
    // unique index on lob_event_id makes this a single atomic claim. Another
    // printer's event ids carry its name, so they can't collide with Lob's.
    const claimId = event.id && (providerName === 'lob' ? event.id : `${providerName}:${event.id}`);
    if (claimId) {
      const { error: dupErr } = await supabaseAdmin
        .from('LobWebhookEvent')
        .insert({
          lob_event_id: claimId,
          event_type: eventType,
          postcard_id: postcardId,
          provider: providerName,
          normalized_status: vendorStatusFor(eventType),
          occurred_at: event.date_created || null,
        });

      if (dupErr) {
        if (dupErr.code !== '23505') {
          // A failure to record the event means we cannot guarantee
          // at-most-once processing. Ask the printer to retry rather than risk a
          // double transition.
          logger.error('Mail webhook: could not record event', {
            provider: providerName, eventId: event.id, error: dupErr.message,
          });
          return res.status(500).json({ error: 'Could not record event' });
        }
        // A claim whose worker died never finished, so its redelivery goes through.
        const { data: reclaimed } = await supabaseAdmin
          .from('LobWebhookEvent')
          .update({ received_at: new Date().toISOString() })
          .eq('lob_event_id', claimId)
          .is('processed_at', null)
          .lt('received_at', new Date(Date.now() - STALE_CLAIM_MS).toISOString())
          .select('id');
        if (!reclaimed?.length) {
          logger.info('Mail webhook: duplicate event ignored', { eventId: event.id, eventType });
          return res.json({ received: true, duplicate: true });
        }
      }
    }

    // ── 5. Process the event ──────────────────────────────────
    try {
      const result = await handlerFor(event).processWebhookEvent(
        postcardId,
        eventType,
        event,
      );

      if (!result.success) {
        if (result.retryable) {
          if (claimId) await supabaseAdmin.from('LobWebhookEvent').delete().eq('lob_event_id', claimId);
          return res.status(503).json({ error: 'Mail status could not be saved. Please retry.' });
        }
        // Still return 200 to prevent the printer from retrying for "not found" cases
        logger.warn('Mail webhook: event processing issue', {
          postcardId,
          eventType,
          error: result.error,
        });
      }

      if (claimId) {
        await supabaseAdmin.from('LobWebhookEvent').update({ processed_at: new Date().toISOString() }).eq('lob_event_id', claimId);
      }
      return res.json({ received: true, postcardId, eventType });
    } catch (err) {
      logger.error('Mail webhook: processing error', {
        postcardId,
        eventType,
        error: err.message,
        stack: err.stack,
      });

      // Release this event's claim so the printer can retry a transient processing
      // failure instead of permanently acknowledging a lost receipt.
      if (claimId) await supabaseAdmin.from('LobWebhookEvent').delete().eq('lob_event_id', claimId);
      return res.status(503).json({ error: 'Mail status could not be saved. Please retry.' });
    }
  });
  return router;
}

module.exports = mailWebhookRouter('lob', verifyLobRequest, (event) => event);
module.exports.mailWebhookRouter = mailWebhookRouter;
