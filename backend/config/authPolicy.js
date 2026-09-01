// ============================================================
// Auth policy / feature flags for persistent login & trusted devices
// (docs/persistent-login/CONTRACT.md "Feature flags / env").
//
// Everything is read lazily from process.env so tests can flip flags per
// case and so a redeploy with a new value takes effect without code changes.
//
//   AUTH_DEVICE_BINDING            off | optional | required   (default optional)
//   AUTH_RESUME_GRANTS             on | off                    (default on)
//   DPOP_CUTOVER                   ISO date; an unbound legacy session may be
//                                  adopted onto a presenting key only when
//                                  `bound_at_issue=false AND issued_at < DPOP_CUTOVER`.
//                                  Default 9999-01-01 (far future) therefore makes
//                                  EVERY unbound legacy session adoptable — the
//                                  accepted status-quo risk of `optional` mode
//                                  (CONTRACT.md "POST /api/users/refresh"). Ops sets
//                                  this to the date the DPoP-capable clients shipped;
//                                  sessions issued after it are never adoptable and
//                                  must re-login when the mode flips to `required`.
//   PUBLIC_API_BASE_URL            optional; DPoP htu is compared against
//                                  PUBLIC_API_BASE_URL + path
//   STEP_UP_SECRET                 HMAC key for X-Step-Up tokens; required in
//                                  production, else falls back to CSRF_SECRET
//                                  with a warning
//   AUTH_INACTIVITY_DAYS_TRUSTED   default 90
//   AUTH_INACTIVITY_DAYS_UNVERIFIED default 30
//   AUTH_RESUME_GRANT_DAYS         default 90
// ============================================================

const crypto = require('crypto');
const logger = require('../utils/logger');

const BINDING_MODES = ['off', 'optional', 'required'];

function readEnum(name, allowed, fallback) {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  return allowed.includes(raw) ? raw : fallback;
}

function readPositiveInt(name, fallback) {
  const n = Number.parseInt(String(process.env[name] || ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 'off' | 'optional' | 'required' */
function deviceBindingMode() {
  return readEnum('AUTH_DEVICE_BINDING', BINDING_MODES, 'optional');
}

/** true when Android resume grants may be minted / redeemed. */
function resumeGrantsEnabled() {
  return readEnum('AUTH_RESUME_GRANTS', ['on', 'off'], 'on') === 'on';
}

/** Date before which unbound legacy sessions may be adopted onto a key. */
function dpopCutover() {
  const raw = String(process.env.DPOP_CUTOVER || '').trim();
  const parsed = raw ? new Date(raw) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  return new Date('9999-01-01T00:00:00.000Z');
}

let _warnedNoBaseUrl = false;
/**
 * Optional public base URL (scheme://host[:port], no trailing slash).
 *
 * SECURITY: when this is unset the DPoP `htu` is compared against the host the
 * *request* claims (`Host` / `X-Forwarded-Host`). A proof a client was tricked
 * into minting for an attacker-controlled host can then be replayed against the
 * real API by spoofing that same Host header, wherever the edge forwards
 * unknown Host values. Pin it in production; we warn once when it is missing.
 */
function publicApiBaseUrl() {
  const raw = String(process.env.PUBLIC_API_BASE_URL || '').trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production' && !_warnedNoBaseUrl) {
      _warnedNoBaseUrl = true;
      logger.warn(
        'PUBLIC_API_BASE_URL is not set: DPoP htu falls back to the request Host header, which the edge may let a client choose. Set it to the API origin clients use.'
      );
    }
    return null;
  }
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

let _stepUpSecret = null;
let _warnedFallback = false;
/**
 * HMAC secret for step-up tokens. In production STEP_UP_SECRET is required;
 * otherwise CSRF_SECRET is used (warned once); as a last resort a per-process
 * random secret (dev/test only — tokens then die with the process).
 */
function stepUpSecret() {
  if (_stepUpSecret) return _stepUpSecret;
  const explicit = String(process.env.STEP_UP_SECRET || '').trim();
  if (explicit) {
    _stepUpSecret = explicit;
    return _stepUpSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'STEP_UP_SECRET environment variable is required in production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  const csrf = String(process.env.CSRF_SECRET || '').trim();
  if (csrf) {
    if (!_warnedFallback) {
      logger.warn('STEP_UP_SECRET not set; falling back to CSRF_SECRET for step-up tokens');
      _warnedFallback = true;
    }
    _stepUpSecret = csrf;
    return _stepUpSecret;
  }
  _stepUpSecret = crypto.randomBytes(32).toString('hex');
  return _stepUpSecret;
}

function inactivityDays(trustLevel) {
  return trustLevel === 'trusted'
    ? readPositiveInt('AUTH_INACTIVITY_DAYS_TRUSTED', 90)
    : readPositiveInt('AUTH_INACTIVITY_DAYS_UNVERIFIED', 30);
}

function resumeGrantDays() {
  return readPositiveInt('AUTH_RESUME_GRANT_DAYS', 90);
}

// Fixed protocol constants (design §13).
const DPOP_IAT_TOLERANCE_SEC = 300;
const DPOP_JTI_TTL_SEC = 10 * 60;
const CHALLENGE_TTL_SEC = 10 * 60;
const STEP_UP_TTL_SEC = 5 * 60;
const SECURITY_DEEP_LINK = 'https://pantopus.com/app/settings/security';

module.exports = {
  deviceBindingMode,
  resumeGrantsEnabled,
  dpopCutover,
  publicApiBaseUrl,
  stepUpSecret,
  inactivityDays,
  resumeGrantDays,
  DPOP_IAT_TOLERANCE_SEC,
  DPOP_JTI_TTL_SEC,
  CHALLENGE_TTL_SEC,
  STEP_UP_TTL_SEC,
  SECURITY_DEEP_LINK,
  // test hook
  _resetForTests() {
    _stepUpSecret = null;
    _warnedFallback = false;
    _warnedNoBaseUrl = false;
  },
};
