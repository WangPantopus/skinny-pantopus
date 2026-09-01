/**
 * FCM sender — Firebase Cloud Messaging HTTP v1 with service-account
 * (OAuth2) authentication.
 *
 * Implemented on `jsonwebtoken` (already a dependency) + global `fetch`
 * rather than `firebase-admin`, so the migration adds no new packages and
 * the network layer is easy to stub. The flow is the standard one
 * `firebase-admin` performs under the hood: sign a short-lived RS256
 * assertion, exchange it for an access token, then POST to the v1
 * `messages:send` endpoint.
 *
 * Messages are sent **data-only** (no top-level `notification` block) so
 * the Android `PantopusMessagingService.onMessageReceived` fires in every
 * app state and `NotificationDispatcher` owns channel routing + the
 * deep-link tap intent (it reads `data.title/body/type/link`).
 *
 * Credentials (see docs/push-native-migration.md / backend/.env.example):
 *   FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY  (preferred), or
 *   FCM_SERVICE_ACCOUNT_JSON (raw JSON), or
 *   GOOGLE_APPLICATION_CREDENTIALS (path to the service-account JSON file).
 */

const jwt = require('jsonwebtoken');
const logger = require('../../utils/logger');

const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const REQUEST_TIMEOUT_MS = 10_000;

let _cachedAccessToken = null; // { token, expiresAt }

/** Resolve the service-account credentials from whichever env slot is set. */
function getServiceAccount() {
  if (process.env.FCM_PROJECT_ID && process.env.FCM_CLIENT_EMAIL && process.env.FCM_PRIVATE_KEY) {
    const key = process.env.FCM_PRIVATE_KEY;
    return {
      projectId: process.env.FCM_PROJECT_ID,
      clientEmail: process.env.FCM_CLIENT_EMAIL,
      privateKey: key.includes('-----BEGIN') ? key.replace(/\\n/g, '\n') : key,
    };
  }

  const fromJson = (json) => ({
    projectId: json.project_id,
    clientEmail: json.client_email,
    privateKey: json.private_key,
  });

  if (process.env.FCM_SERVICE_ACCOUNT_JSON) {
    try {
      return fromJson(JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON));
    } catch (err) {
      logger.error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON', { error: err.message });
      return null;
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const fs = require('fs');
      return fromJson(JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')));
    } catch (err) {
      logger.error('Failed to read GOOGLE_APPLICATION_CREDENTIALS', { error: err.message });
      return null;
    }
  }

  return null;
}

/** True when a usable service account is available. */
function isConfigured() {
  const sa = getServiceAccount();
  return Boolean(sa && sa.projectId && sa.clientEmail && sa.privateKey);
}

/** FCM data values must all be strings; objects are JSON-encoded. Pure. */
function stringifyData(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === null || value === undefined) continue;
    out[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  return out;
}

/**
 * Build the FCM v1 request body for one token. `title`/`body` are folded
 * into the data map (the Android dispatcher reads them from there). Pure —
 * exported for tests.
 */
function buildMessage(token, { title, body, data } = {}) {
  const payload = { ...(data || {}) };
  if (title !== null && title !== undefined) payload.title = title;
  if (body !== null && body !== undefined) payload.body = body;
  return {
    message: {
      token,
      data: stringifyData(payload),
      android: { priority: 'high' },
    },
  };
}

/** Map an FCM v1 response to an action. Pure — exported for tests. */
function classifyFcmFailure(status, body) {
  if (status === 200) return 'ok';
  const errorCode = body && body.error && Array.isArray(body.error.details)
    ? (body.error.details.find((d) => d && d.errorCode) || {}).errorCode
    : null;
  const deadTokenCodes = new Set(['UNREGISTERED', 'SENDER_ID_MISMATCH']);
  if (status === 404 || deadTokenCodes.has(errorCode)) return 'invalid';
  return 'retry';
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Exchange the service-account assertion for a cached OAuth2 access token. */
async function getAccessToken() {
  const now = Date.now();
  if (_cachedAccessToken && now < _cachedAccessToken.expiresAt - 60_000) {
    return _cachedAccessToken.token;
  }
  const sa = getServiceAccount();
  const assertion = jwt.sign(
    { scope: SCOPE },
    sa.privateKey,
    { algorithm: 'RS256', issuer: sa.clientEmail, audience: TOKEN_URI, expiresIn: '1h' },
  );

  const res = await fetchWithTimeout(TOKEN_URI, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`FCM OAuth token request failed: ${res.status}`);
  }
  const json = await res.json();
  _cachedAccessToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in || 3600) * 1000,
  };
  return _cachedAccessToken.token;
}

async function sendOne(url, accessToken, token, message) {
  let res;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(buildMessage(token, message)),
    });
  } catch (err) {
    logger.warn('FCM request error', { error: err.message });
    return { token, action: 'retry' };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty / non-JSON body */
  }
  const action = classifyFcmFailure(res.status, body);
  if (action === 'retry' && res.status !== 200) {
    logger.warn('FCM send non-OK', { status: res.status, error: body && body.error && body.error.status });
  }
  return { token, action };
}

/**
 * Send one message to many FCM tokens. The v1 API is one-token-per-request;
 * we fan out and collect the tokens FCM reported as permanently invalid.
 */
async function sendMany(tokens, message) {
  if (!isConfigured() || !tokens || tokens.length === 0) {
    return { invalidTokens: [] };
  }

  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    logger.error('FCM auth failed — skipping send', { error: err.message });
    return { invalidTokens: [] };
  }

  const sa = getServiceAccount();
  const url = `https://fcm.googleapis.com/v1/projects/${sa.projectId}/messages:send`;
  const results = await Promise.all(tokens.map((token) => sendOne(url, accessToken, token, message)));
  const invalidTokens = results.filter((r) => r.action === 'invalid').map((r) => r.token);
  return { invalidTokens };
}

/** Clear the cached OAuth2 access token (used on shutdown / tests). */
function close() {
  _cachedAccessToken = null;
}

module.exports = {
  isConfigured,
  stringifyData,
  buildMessage,
  classifyFcmFailure,
  getAccessToken,
  sendMany,
  close,
};
