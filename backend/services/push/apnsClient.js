/**
 * APNs sender — Apple Push Notification service over HTTP/2 with
 * token-based (.p8 / JWT) authentication.
 *
 * Implemented directly on Node's built-in `http2` plus `jsonwebtoken`
 * (already a backend dependency) rather than pulling in `apns2`, so the
 * migration adds zero new packages and stays trivially mockable. The wire
 * protocol is the same one `apns2` speaks: an ES256 provider JWT in the
 * `authorization` header, POSTed to `/3/device/<token>`.
 *
 * Credentials (see docs/push-native-migration.md / backend/.env.example):
 *   APNS_KEY_ID         — the 10-char Key ID for the .p8 key
 *   APNS_TEAM_ID        — your Apple Developer Team ID
 *   APNS_BUNDLE_ID      — the app bundle id, used as the APNs topic
 *   APNS_PRIVATE_KEY    — the .p8 PEM contents (literal `\n` accepted)
 *   APNS_PRIVATE_KEY_BASE64 — alternative: base64 of the .p8 file
 *   APNS_PRODUCTION     — "true" → api.push.apple.com, else sandbox
 *   APNS_HOST           — optional explicit host override
 */

const http2 = require('http2');
const jwt = require('jsonwebtoken');
const logger = require('../../utils/logger');

const PROD_HOST = 'https://api.push.apple.com';
const SANDBOX_HOST = 'https://api.sandbox.push.apple.com';
const REQUEST_TIMEOUT_MS = 10_000;
// Apple rejects provider tokens older than 1h and throttles minting; we
// refresh well inside that window and reuse the JWT across sends.
const TOKEN_TTL_MS = 45 * 60 * 1000;

let _session = null;
let _cachedToken = null; // { jwt, issuedAt }

/** Normalise a PEM that may arrive with escaped newlines or as base64. */
function readPrivateKey() {
  const b64 = process.env.APNS_PRIVATE_KEY_BASE64;
  if (b64) return Buffer.from(b64, 'base64').toString('utf8');
  const raw = process.env.APNS_PRIVATE_KEY;
  if (!raw) return null;
  return raw.includes('-----BEGIN') ? raw.replace(/\\n/g, '\n') : raw;
}

function getConfig() {
  return {
    keyId: process.env.APNS_KEY_ID || null,
    teamId: process.env.APNS_TEAM_ID || null,
    bundleId: process.env.APNS_BUNDLE_ID || null,
    privateKey: readPrivateKey(),
    host:
      process.env.APNS_HOST ||
      (String(process.env.APNS_PRODUCTION).toLowerCase() === 'true' ? PROD_HOST : SANDBOX_HOST),
  };
}

/** True when every credential needed to mint a provider token is present. */
function isConfigured() {
  const c = getConfig();
  return Boolean(c.keyId && c.teamId && c.bundleId && c.privateKey);
}

/** Mint (and cache) the ES256 provider JWT used as the bearer token. */
function getProviderToken() {
  const now = Date.now();
  if (_cachedToken && now - _cachedToken.issuedAt < TOKEN_TTL_MS) {
    return _cachedToken.jwt;
  }
  const c = getConfig();
  const token = jwt.sign({}, c.privateKey, {
    algorithm: 'ES256',
    issuer: c.teamId,
    keyid: c.keyId,
    expiresIn: '50m',
  });
  _cachedToken = { jwt: token, issuedAt: now };
  return token;
}

/**
 * Build the APNs JSON payload. Custom data fields ride at the top level of
 * the payload alongside `aps`, so the iOS client reads `userInfo["link"]`
 * etc. directly. Pure — exported for tests.
 */
function buildPayload({ title, body, data } = {}) {
  const payload = {
    aps: {
      alert: { title: title || '', body: body || '' },
      sound: 'default',
    },
  };
  for (const [key, value] of Object.entries(data || {})) {
    if (value !== null && value !== undefined && key !== 'aps') {
      payload[key] = value;
    }
  }
  return payload;
}

/**
 * Map an APNs HTTP response to an action. Pure — exported for tests.
 * `invalid` → the device token is dead and should be pruned.
 */
function classifyApnsFailure(status, reason) {
  if (status === 200) return 'ok';
  if (status === 410) return 'invalid'; // Unregistered
  const deadTokenReasons = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic']);
  if (deadTokenReasons.has(reason)) return 'invalid';
  return 'retry';
}

function getSession() {
  const { host } = getConfig();
  if (_session && !_session.closed && !_session.destroyed) return _session;
  _session = http2.connect(host);
  _session.on('error', (err) => {
    logger.warn('APNs HTTP/2 session error', { error: err.message });
    _session = null;
  });
  _session.on('close', () => {
    _session = null;
  });
  return _session;
}

function sendOne(session, token, payloadString, providerToken, bundleId) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const req = session.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${providerToken}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });

    let status = 0;
    let raw = '';
    req.setEncoding('utf8');
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.close(http2.constants.NGHTTP2_CANCEL);
      finish({ token, action: 'retry', status: 0 });
    });
    req.on('response', (headers) => {
      status = Number(headers[':status']) || 0;
    });
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      let reason = null;
      if (raw) {
        try {
          reason = JSON.parse(raw).reason;
        } catch {
          /* non-JSON body — leave reason null */
        }
      }
      finish({ token, action: classifyApnsFailure(status, reason), status, reason });
    });
    req.on('error', (err) => {
      logger.warn('APNs request error', { error: err.message });
      finish({ token, action: 'retry', status: 0 });
    });

    req.end(payloadString);
  });
}

/**
 * Send one payload to many APNs device tokens over a shared HTTP/2 session.
 * Returns the tokens APNs reported as permanently invalid.
 */
async function sendMany(tokens, message) {
  if (!isConfigured() || !tokens || tokens.length === 0) {
    return { invalidTokens: [] };
  }
  const { bundleId } = getConfig();
  const providerToken = getProviderToken();
  const payloadString = JSON.stringify(buildPayload(message));
  const session = getSession();

  const results = await Promise.all(
    tokens.map((token) => sendOne(session, token, payloadString, providerToken, bundleId)),
  );

  const invalidTokens = results.filter((r) => r.action === 'invalid').map((r) => r.token);
  return { invalidTokens };
}

/** Close the shared HTTP/2 session (used on graceful shutdown / tests). */
function close() {
  if (_session && !_session.destroyed) _session.close();
  _session = null;
  _cachedToken = null;
}

module.exports = {
  isConfigured,
  buildPayload,
  classifyApnsFailure,
  getProviderToken,
  sendMany,
  close,
};
