/**
 * PostGrid Mail Provider
 *
 * The second printer, for outages and, if it wins the real-mail pilot, more. It stays off
 * until MAIL_PROVIDER or MAIL_FAILOVER_PROVIDER names it. Built from PostGrid's public
 * docs and exercised against scripts/mail-printer-stand-in.cjs: its live answers and
 * event shapes are unproven until a real test account exists.
 *
 * Auth: x-api-key header. Env: POSTGRID_API_KEY, POSTGRID_WEBHOOK_SECRET, POSTGRID_API_URL
 * (the stand-in, locally). A test key mails nothing.
 *
 * Its delivery updates are postcard.updated events carrying a status and, for live US
 * mail, an imbStatus. normalizeEvent turns those into the postcard.* names every flow
 * reads. It has no signal for a re-routed or failed card, so those stay in the mail
 * until their code expires. Its free plan may not report returns at all: ask before
 * relying on them.
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');
const addressConfig = require('../../config/addressVerification');
const { buildFrontHtml, buildBackHtml } = require('./lobMailProvider');

const REQUEST_TIMEOUT_MS = 15000;
const POSTCARD_SIZE = '6x4';
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

function refusedBeforeSending(message) {
  return Object.assign(new Error(message), { definitelyRejected: true });
}

function contact(address, name) {
  return {
    firstName: name,
    addressLine1: address.line1,
    ...(address.line2 && { addressLine2: address.line2 }),
    city: address.city,
    provinceOrState: address.state,
    postalOrZip: address.zip,
    countryCode: 'US',
  };
}

function returnContact() {
  const from = addressConfig.lob.from;
  return { companyName: from.name, addressLine1: from.addressLine1, city: from.city, provinceOrState: from.state, postalOrZip: from.zip, countryCode: 'US' };
}

class PostgridMailProvider {
  constructor() {
    this.name = 'postgrid';
  }

  // Read when used, so a server without this printer's settings loads the same.
  get apiKey() { return process.env.POSTGRID_API_KEY; }

  get webhookSecret() { return process.env.POSTGRID_WEBHOOK_SECRET; }

  get apiUrl() { return process.env.POSTGRID_API_URL || 'https://api.postgrid.com/print-mail/v1'; }

  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * @param {object} address - NormalizedAddress { line1, line2?, city, state, zip }
   * @param {string} code    - 6-digit verification code
   * @param {string} [_templateId] - another printer's template; never used here
   * @param {object} [options] - { jobId } or { homePostcardId, homeId }
   * @returns {Promise<{vendorJobId: string, status: string}>}
   */
  async sendPostcard(address, code, _templateId, options = {}) {
    if (!this.isAvailable()) throw refusedBeforeSending('PostGrid API key not configured');
    if (options.jobId && options.homePostcardId) throw refusedBeforeSending('Conflicting mail correlation IDs');
    const qrUrl = options.homePostcardId && options.homeId
      ? `pantopus://homes/${encodeURIComponent(options.homeId)}/verify-postcard`
      : `pantopus://verify?code=${code}`;
    const key = options.homePostcardId ? `pantopus-home-postcard-${options.homePostcardId}`
      : options.jobId ? `pantopus-verification-${options.jobId}` : null;
    return this._createPostcard({
      description: 'Pantopus Address Verification',
      to: contact(address, 'Current Resident'),
      from: returnContact(),
      size: POSTCARD_SIZE,
      mailingClass: 'first_class',
      frontHTML: buildFrontHtml(),
      backHTML: buildBackHtml(code, qrUrl),
      ...(options.jobId && { metadata: { pantopus_verification_job_id: options.jobId } }),
      ...(options.homePostcardId && { metadata: { pantopus_home_postcard_id: options.homePostcardId } }),
    }, key);
  }

  /**
   * @param {object} address
   * @param {object} card - { description, frontHtml, backHtml, useType, toName? }
   * @param {object} [options] - { inviteId }
   */
  async sendCustomPostcard(address, card, options = {}) {
    if (!this.isAvailable()) throw refusedBeforeSending('PostGrid API key not configured');
    if (!['marketing', 'operational'].includes(card.useType)) {
      throw refusedBeforeSending('Postcard use type must be marketing or operational');
    }
    return this._createPostcard({
      description: card.description || 'Pantopus postcard',
      to: contact(address, card.toName || 'Current Resident'),
      from: returnContact(),
      size: POSTCARD_SIZE,
      mailingClass: 'first_class',
      frontHTML: card.frontHtml,
      backHTML: card.backHtml,
      ...(options.inviteId && { metadata: { pantopus_block_invite_id: options.inviteId } }),
    }, options.inviteId ? `pantopus-block-invite-${options.inviteId}` : null);
  }

  /** Same contract as Lob's: retry this identical request only, and say when nothing could have been accepted. */
  async _createPostcard(body, idempotencyKey) {
    const request = {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
      },
      body: JSON.stringify(body),
    };
    let data;
    let possiblyAccepted = false;
    for (let attempt = 0; attempt < (idempotencyKey ? 3 : 1); attempt += 1) {
      let retryAfterMs = 1000;
      try {
        const res = await fetch(`${this.apiUrl}/postcards`, { ...request, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (!res.ok) {
          await res.body?.cancel();
          const error = new Error(`PostGrid API error: ${res.status}`);
          error.definitelyRejected = [400, 401, 402, 403, 404, 422, 429].includes(res.status);
          error.retryable = res.status === 429 || res.status >= 500;
          if (res.status === 429) retryAfterMs = 5000;
          throw error;
        }
        data = await res.json();
        if (typeof data.id !== 'string' || !data.id.startsWith('postcard_')) {
          throw new Error('PostGrid returned no postcard receipt');
        }
        break;
      } catch (error) {
        possiblyAccepted ||= error.definitelyRejected !== true;
        error.definitelyRejected = !possiblyAccepted && error.definitelyRejected === true;
        if (!idempotencyKey || attempt === 2 || error.retryable === false) throw error;
        if (error.definitelyRejected && !error.retryable) throw error;
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      }
    }
    logger.info('PostgridMailProvider: created', { postcardId: data.id });
    return { vendorJobId: data.id, status: 'created' };
  }

  /** Which pieces PostGrid holds under one of our references. Throws when it can't answer. */
  async findPieces(metadataKey, metadataValue) {
    if (!this.isAvailable()) throw new Error('PostGrid API key not configured');
    const search = encodeURIComponent(JSON.stringify({ [`metadata.${metadataKey}`]: metadataValue }));
    const res = await fetch(`${this.apiUrl}/postcards?limit=2&search=${search}`, {
      headers: { 'x-api-key': this.apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`PostGrid API error: ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data?.data)) throw new Error('PostGrid returned no postcard list');
    return data.data.map((piece) => ({ vendorJobId: piece.id, status: this._status(piece) }));
  }

  /** Pull a piece back before it prints. Best effort. */
  async cancelPiece(vendorJobId) {
    if (!this.isAvailable()) return false;
    const res = await fetch(`${this.apiUrl}/postcards/${encodeURIComponent(vendorJobId)}`, {
      method: 'DELETE',
      headers: { 'x-api-key': this.apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    await res.body?.cancel();
    return res.ok;
  }

  async getJobStatus(vendorJobId) {
    if (!this.isAvailable()) throw new Error('PostGrid API key not configured');
    const res = await fetch(`${this.apiUrl}/postcards/${encodeURIComponent(vendorJobId)}`, {
      headers: { 'x-api-key': this.apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`PostGrid API error: ${res.status}`);
    }
    const data = await res.json();
    return { status: this._status(data), metadata: { id: data.id, send_date: data.sendDate } };
  }

  _status(piece) {
    if (piece.imbStatus === 'returned_to_sender') return 'returned';
    if (piece.status === 'completed') return 'delivered';
    if (piece.imbStatus) return 'in_transit';
    if (piece.status === 'processed_for_delivery') return 'mailed';
    if (piece.status === 'cancelled') return 'canceled';
    return 'created';
  }

  /**
   * PostGrid's signature check: PostGrid-Signature: t=<ms>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">.
   * Answers null when the request is authentic. Fails closed without a secret.
   */
  verifyWebhookRequest(bodyStr, headers) {
    if (!this.webhookSecret) {
      logger.error('PostGrid webhook: POSTGRID_WEBHOOK_SECRET is not configured; rejecting');
      return { status: 503, error: 'Webhook not configured' };
    }
    const parts = Object.fromEntries(String(headers['postgrid-signature'] || '').split(',').map((part) => part.split('=')));
    const tsMs = Number(parts.t);
    if (!parts.v1 || !Number.isFinite(tsMs)) return { status: 400, error: 'Missing signature headers' };
    if (Math.abs(Date.now() - tsMs) > MAX_SIGNATURE_AGE_MS) return { status: 400, error: 'Stale or invalid timestamp' };
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(`${parts.t}.${bodyStr}`).digest('hex');
    const matches = expected.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
    return matches ? null : { status: 401, error: 'Invalid webhook signature' };
  }

  /**
   * The event in our words, or null when it carries no news. A postcard.updated repeats
   * for changes we don't read, so its identity is the piece and the news, not the delivery.
   */
  normalizeEvent(parsed) {
    if (!/^postcard\./.test(String(parsed?.type || ''))) return null;
    const piece = parsed.data;
    if (typeof piece?.id !== 'string') return null;
    const type = this._eventFor(piece);
    return {
      id: `${piece.id}:${type}`,
      type,
      date_created: piece.updatedAt || null,
      body: { id: piece.id, object: 'postcard', metadata: piece.metadata || {} },
    };
  }

  _eventFor(piece) {
    if (piece.imbStatus === 'returned_to_sender') return 'postcard.returned_to_sender';
    if (piece.status === 'cancelled') return 'postcard.deleted';
    if (piece.status === 'completed') return 'postcard.delivered';
    if (piece.imbStatus === 'out_for_delivery') return 'postcard.processed_for_delivery';
    if (piece.imbStatus === 'entered_mail_stream') return 'postcard.in_transit';
    if (piece.status === 'processed_for_delivery') return 'postcard.mailed';
    return 'postcard.created';
  }
}

module.exports = new PostgridMailProvider();
module.exports.PostgridMailProvider = PostgridMailProvider;
