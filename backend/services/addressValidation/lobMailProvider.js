/**
 * Lob Mail Provider
 *
 * Implements the MailVendorProvider interface using the Lob API
 * (https://docs.lob.com/) to send physical postcards for address
 * verification.
 *
 * Auth: HTTP Basic with LOB_API_KEY (key + ":" base64-encoded).
 * Env:  LOB_API_KEY, LOB_ENV ('test' | 'live'), LOB_WEBHOOK_SECRET.
 *
 * In test mode Lob returns immediately with a test postcard object.
 * In live mode postcards go through rendering → printing → mailing.
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');
const addressConfig = require('../../config/addressVerification');

const LOB_API_URL = 'https://api.lob.com/v1';
const POSTCARD_SIZE = '4x6';
const REQUEST_TIMEOUT_MS = 15000;

// ── Return address (from config) ─────────────────────────────

function getReturnAddress() {
  const from = addressConfig.lob.from;
  return {
    name: from.name,
    address_line1: from.addressLine1,
    address_city: from.city,
    address_state: from.state,
    address_zip: from.zip,
  };
}

// ── Postcard HTML templates ──────────────────────────────────

function buildFrontHtml(recipientName) {
  return `
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; }
    .container { width: 100%; height: 100%; display: flex; flex-direction: column;
                 align-items: center; justify-content: center; background: #f8fafc; }
    .logo { font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
    .header { font-size: 16px; color: #64748b; letter-spacing: 1px; text-transform: uppercase; }
    .recipient { font-size: 13px; color: #94a3b8; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Pantopus</div>
    <div class="header">Address Verification</div>
    <div class="recipient">${recipientName || 'Current Resident'}</div>
  </div>
</body>
</html>`.trim();
}

function buildBackHtml(code, qrUrl) {
  return `
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px;
           background: #ffffff; }
    .code-label { font-size: 12px; color: #64748b; text-transform: uppercase;
                  letter-spacing: 1px; margin-bottom: 4px; text-align: center; }
    .code { font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1e293b;
            text-align: center; margin-bottom: 16px; font-family: 'Courier New', monospace; }
    .divider { border-top: 1px solid #e2e8f0; margin: 12px 0; }
    .instructions { font-size: 11px; color: #64748b; line-height: 1.5; text-align: center; }
    .qr-section { text-align: center; margin-top: 12px; }
    .qr-label { font-size: 10px; color: #94a3b8; margin-top: 4px; }
    .qr-url { font-size: 9px; color: #94a3b8; word-break: break-all; }
  </style>
</head>
<body>
  <div class="code-label">Your Verification Code</div>
  <div class="code">${code}</div>
  <div class="divider"></div>
  <div class="instructions">
    Enter this code in the Pantopus app to verify your address.<br>
    This code expires in 30 days.
  </div>
  <div class="qr-section">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrUrl)}" width="80" height="80" alt="QR Code">
    <div class="qr-label">Or scan this QR code</div>
    <div class="qr-url">${qrUrl}</div>
  </div>
</body>
</html>`.trim();
}

// ── Auth header ──────────────────────────────────────────────

function authHeader(apiKey) {
  return 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
}

// ── Provider implementation ──────────────────────────────────

class LobMailProvider {
  constructor() {
    this.apiKey = addressConfig.lob.apiKey;
    this.env = addressConfig.lob.env;
    this.webhookSecret = addressConfig.lob.webhookSecret;
  }

  /**
   * Whether the provider is configured and ready to send.
   */
  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Send a postcard via the Lob API.
   *
   * @param {object} address - NormalizedAddress { line1, line2?, city, state, zip }
   * @param {string} code    - 6-digit verification code
   * @param {string} [templateId] - optional Lob template ID (falls back to inline HTML)
   * @returns {Promise<{vendorJobId: string, status: string}>}
   */
  async sendPostcard(address, code, templateId) {
    if (!this.isAvailable()) {
      throw new Error('Lob API key not configured');
    }

    const qrUrl = `pantopus://verify?code=${code}`;

    const body = {
      description: 'Pantopus Address Verification',
      to: {
        name: 'Current Resident',
        address_line1: address.line1,
        ...(address.line2 && { address_line2: address.line2 }),
        address_city: address.city,
        address_state: address.state,
        address_zip: address.zip,
      },
      from: getReturnAddress(),
      size: POSTCARD_SIZE,
    };

    // Use Lob template IDs if provided, otherwise inline HTML
    if (templateId) {
      body.front = templateId;
      body.back = templateId;
    } else {
      body.front = buildFrontHtml();
      body.back = buildBackHtml(code, qrUrl);
    }

    if (this.env === 'test') {
      logger.info('LobMailProvider: TEST MODE — code logged for development', {
        code,
        addressLine1: address.line1,
        city: address.city,
        state: address.state,
      });
    }

    const res = await fetch(`${LOB_API_URL}/postcards`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(this.apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error('LobMailProvider.sendPostcard: API error', {
        status: res.status,
        body: text,
      });
      throw new Error(`Lob API error: ${res.status}`);
    }

    const data = await res.json();

    logger.info('LobMailProvider.sendPostcard: created', {
      postcardId: data.id,
      expectedDeliveryDate: data.expected_delivery_date,
    });

    return {
      vendorJobId: data.id,
      status: data.object === 'postcard' ? 'created' : data.status || 'created',
    };
  }

  /**
   * Get the status of a previously-sent postcard.
   *
   * @param {string} vendorJobId - Lob postcard ID (psc_xxx)
   * @returns {Promise<{status: string, metadata: object}>}
   */
  async getJobStatus(vendorJobId) {
    if (!this.isAvailable()) {
      throw new Error('Lob API key not configured');
    }

    const res = await fetch(`${LOB_API_URL}/postcards/${encodeURIComponent(vendorJobId)}`, {
      method: 'GET',
      headers: {
        Authorization: authHeader(this.apiKey),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error('LobMailProvider.getJobStatus: API error', {
        vendorJobId,
        status: res.status,
        body: text,
      });
      throw new Error(`Lob API error: ${res.status}`);
    }

    const data = await res.json();

    return {
      status: this._mapLobStatus(data),
      metadata: {
        id: data.id,
        expected_delivery_date: data.expected_delivery_date,
        date_created: data.date_created,
        send_date: data.send_date,
        carrier: data.carrier,
        tracking_number: data.tracking_number,
        thumbnails: data.thumbnails,
        url: data.url,
      },
    };
  }

  /**
   * Verify a Lob webhook signature.
   *
   * Lob signs webhooks with HMAC-SHA256:
   *   signature = HMAC-SHA256(secret, timestamp + '.' + rawBody)
   *
   * @param {string|Buffer} rawBody
   * @param {string} timestamp  - from lob-signature-timestamp header
   * @param {string} signature  - from lob-signature header
   * @returns {boolean}
   */
  verifyWebhookSignature(rawBody, timestamp, signature) {
    if (!this.webhookSecret) {
      logger.warn('LobMailProvider: LOB_WEBHOOK_SECRET not configured');
      return false;
    }

    const payload = `${timestamp}.${rawBody}`;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8'),
    );
  }

  /**
   * Map a Lob postcard object to a normalized status string.
   * @param {object} lobPostcard
   * @returns {string}
   */
  _mapLobStatus(lobPostcard) {
    // Lob tracking events: In Transit, In Local Area, Processed for Delivery,
    // Re-Routed, Returned to Sender, Delivered
    const tracking = lobPostcard.tracking_events;
    if (tracking && tracking.length > 0) {
      const latest = tracking[tracking.length - 1];
      const type = (latest.type || '').toLowerCase();
      if (type === 'delivered') return 'delivered';
      if (type === 'returned to sender') return 'returned';
      if (type === 're-routed') return 'rerouted';
      return 'in_transit';
    }

    // Fall back to send_date presence
    if (lobPostcard.send_date) return 'mailed';
    return 'created';
  }
}

// Export singleton + class for testing
const instance = new LobMailProvider();
module.exports = instance;
module.exports.LobMailProvider = LobMailProvider;
module.exports.buildFrontHtml = buildFrontHtml;
module.exports.buildBackHtml = buildBackHtml;
module.exports.authHeader = authHeader;
