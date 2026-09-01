/**
 * Internal email-inbound webhook.
 *
 * Audience-profile design v2 §17 #8 / P2.9. AWS SES (or equivalent)
 * receives mail to *@pantopus.com, parses it in a Lambda, signs the
 * JSON payload with a shared secret, and POSTs to this route. The
 * router then forwards to platform support (or polite-bounces) via
 * services/personaSupportEmailRouter.js.
 *
 * Auth: HMAC-SHA256 of the raw request body, hex-encoded, sent in the
 * `X-Pantopus-Signature` header. Compared with timing-safe equality
 * against the digest computed from EMAIL_INBOUND_HMAC_SECRET.
 *
 * The route is mounted with express.raw() so the signature can be
 * computed over the EXACT bytes the Lambda signed (JSON.stringify
 * round-trips would alter whitespace and break verification).
 *
 * If EMAIL_INBOUND_HMAC_SECRET is unset, the route refuses every
 * request (501) — fail closed, never silently accept unsigned mail.
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const logger = require('../utils/logger');
const { routeInboundPersonaSupportEmail } = require('../jobs/personaSupportEmailRouter');

const SIGNATURE_HEADER = 'x-pantopus-signature';

function getSecret() {
  return process.env.EMAIL_INBOUND_HMAC_SECRET || '';
}

function verifySignature(rawBody, providedSignatureHex) {
  const secret = getSecret();
  if (!secret || !providedSignatureHex) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  let provided;
  let exp;
  try {
    provided = Buffer.from(String(providedSignatureHex), 'hex');
    exp = Buffer.from(expected, 'hex');
  } catch {
    return false;
  }
  if (provided.length !== exp.length) return false;
  return crypto.timingSafeEqual(provided, exp);
}

router.post('/', async (req, res) => {
  // Fail closed if ops hasn't provisioned the shared secret. Returning
  // 501 (not 401) signals "feature not configured" so the Lambda can
  // alert distinctly from "signature mismatch".
  if (!getSecret()) {
    logger.warn('email_inbound.secret_missing');
    return res.status(501).json({ error: 'email inbound not configured' });
  }

  const sigHeader = req.get(SIGNATURE_HEADER);
  const raw = req.body && Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!verifySignature(raw, sigHeader)) {
    logger.warn('email_inbound.signature_mismatch');
    return res.status(401).json({ error: 'invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'invalid json' });
  }

  const { to, from, subject, text, html } = payload || {};
  if (!to || !from) {
    return res.status(400).json({ error: 'missing to/from' });
  }

  try {
    const result = await routeInboundPersonaSupportEmail({ to, from, subject, text, html });
    return res.json(result);
  } catch (err) {
    logger.error('email_inbound.router_failed', { error: err.message });
    return res.status(500).json({ error: 'router failed' });
  }
});

module.exports = router;
