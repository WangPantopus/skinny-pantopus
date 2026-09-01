// ============================================================
// authDeviceService — trusted-device registry + refresh binding rules
// (design §2 principles, §5, §6.3, §7, §13; CONTRACT.md).
//
// Security invariants enforced here (do not weaken):
//   * bind device keys ONLY at credential issuance (bindAtIssue /
//     redeemResumeGrant); no bearer-only path creates or rotates a binding
//   * refresh proof is verified against the key bound to THAT session — the
//     session is resolved first (hash → prev hash → sessionId), never "find a
//     device by client id then check the user"
//   * grant-minted sessions are context 'restored'
//   * step-up device_key only for interactively-enrolled keys AND interactive
//     sessions
//
// Stage-2 hooks (routes/users.js, verifyToken, socket) call:
//   bindAtIssue, checkRefresh, recordRefresh, markReuse, logoutLocal,
//   onPasswordChanged, onPasswordReset, onAccountDeleted, sessionRowFromRequest,
//   platformFromRequest
// ============================================================

const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const pushService = require('./pushService');
const authPolicy = require('../config/authPolicy');
const authSessionService = require('./authSessionService');
const authNotifyService = require('./authNotifyService');
const { thumbprintEquals, isPlainP256Jwk, jwkThumbprint } = require('../middleware/dpop');

const {
  hashToken,
  isUuid,
  clientIp,
  userAgent,
  sessionClaimsFromAccessToken,
} = authSessionService;

const HARDWARE_BACKINGS = Object.freeze(['secure_enclave', 'strongbox', 'tee']);
const KEY_BACKINGS = Object.freeze(['secure_enclave', 'strongbox', 'tee', 'software']);
const PLATFORMS = Object.freeze(['ios', 'android']);
const RESUME_BACKINGS = Object.freeze(['tee', 'strongbox']);

function nowIso() {
  return new Date().toISOString();
}

/**
 * Anything minted from a real credential (password, OAuth, native IdP) is an
 * interactive session; only grant-minted sessions are `restored`. Stage-2
 * hooks should pass context 'interactive' for /login and /oauth/*, but the
 * schema also allows 'oauth' — treat it as interactive everywhere.
 */
function isInteractiveContext(context) {
  return context !== 'restored';
}

// C0 + DEL + C1 control characters. Device names / models / versions are
// attacker-chosen strings that end up in log lines, push bodies, e-mail
// subjects and the security-event feed; strip the characters that let them
// forge a second log record or a second mail header there.
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f-\u009f]+/g;

function str(value, max = 200) {
  if (value === undefined || value === null) return null;
  const s = String(value).replace(CONTROL_CHARS_RE, ' ').trim();
  if (!s) return null;
  return s.slice(0, max);
}

// ---------------------------------------------------------------------------
// Device descriptor
// ---------------------------------------------------------------------------

/**
 * Validate + normalise the `device` object from the wire (CONTRACT "Device
 * descriptor"). Returns `{ ok:true, value }` or `{ ok:false, error }`.
 */
function normalizeDeviceDescriptor(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'device descriptor required' };
  }
  const deviceId = str(raw.deviceId, 64);
  if (!isUuid(deviceId)) return { ok: false, error: 'device.deviceId must be a UUID' };
  const platform = str(raw.platform, 16)?.toLowerCase();
  if (!PLATFORMS.includes(platform)) return { ok: false, error: 'device.platform must be ios|android' };
  const keyBackingRaw = str(raw.keyBacking, 32)?.toLowerCase() || 'software';
  if (!KEY_BACKINGS.includes(keyBackingRaw)) return { ok: false, error: 'device.keyBacking invalid' };
  const installId = str(raw.installId, 64);
  if (installId && !/^[a-zA-Z0-9_-]{8,64}$/.test(installId)) {
    return { ok: false, error: 'device.installId invalid' };
  }
  let attestation = null;
  if (raw.attestation !== undefined && raw.attestation !== null) {
    if (typeof raw.attestation !== 'object' || Array.isArray(raw.attestation)) {
      return { ok: false, error: 'device.attestation must be an object' };
    }
    try {
      const json = JSON.stringify(raw.attestation);
      if (json.length > 16 * 1024) return { ok: false, error: 'device.attestation too large' };
      attestation = JSON.parse(json);
    } catch {
      return { ok: false, error: 'device.attestation invalid' };
    }
  }
  return {
    ok: true,
    value: {
      deviceId,
      platform,
      installId,
      name: str(raw.name, 120),
      model: str(raw.model, 120),
      osVersion: str(raw.osVersion, 64),
      appVersion: str(raw.appVersion, 64),
      hasOsLock: raw.hasOsLock === true,
      keyBacking: keyBackingRaw,
      attestation,
    },
  };
}

/** 'ios' | 'android' | null from the X-Client-Platform header. */
function platformFromRequest(req) {
  const raw = typeof req?.get === 'function' ? req.get('x-client-platform') : req?.headers?.['x-client-platform'];
  const v = String(raw || '').trim().toLowerCase();
  if (v.startsWith('ios')) return 'ios';
  if (v.startsWith('android')) return 'android';
  return null;
}

// ---------------------------------------------------------------------------
// Trust
// ---------------------------------------------------------------------------

/**
 * v1 trust evaluation (design §13): hardware-backed key + OS lock ⇒ trusted,
 * else unverified. Attestation verifiers (Phase 3) will raise/lower this.
 */
function evaluateTrustLevel({ keyBacking, hasOsLock } = {}) {
  return HARDWARE_BACKINGS.includes(keyBacking) && hasOsLock === true ? 'trusted' : 'unverified';
}

/** Days of inactivity allowed for a session on this device. */
function inactivityWindowDays(device) {
  return authPolicy.inactivityDays(device?.trust_level === 'trusted' ? 'trusted' : 'unverified');
}

/** True when the session has been idle longer than its window. */
function isInactive(session, device, at = new Date()) {
  if (!session) return false;
  const last = new Date(session.last_refresh_at || session.issued_at);
  if (Number.isNaN(last.getTime())) return false;
  const days = inactivityWindowDays(device);
  return at.getTime() - last.getTime() > days * 24 * 3600 * 1000;
}

// ---------------------------------------------------------------------------
// AuthDevice rows
// ---------------------------------------------------------------------------

async function getDevice(deviceRowId) {
  if (!deviceRowId) return null;
  const { data, error } = await supabaseAdmin
    .from('AuthDevice')
    .select('*')
    .eq('id', deviceRowId)
    .maybeSingle();
  if (error) {
    logger.warn('auth.device.lookup_failed', { deviceRowId, error: error.message });
    return null;
  }
  return data || null;
}

async function findDeviceByClientId(userId, deviceId) {
  const { data, error } = await supabaseAdmin
    .from('AuthDevice')
    .select('*')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle();
  if (error) {
    logger.warn('auth.device.client_lookup_failed', { userId, error: error.message });
    return null;
  }
  return data || null;
}

async function updateDevice(deviceRowId, patch) {
  const { data, error } = await supabaseAdmin
    .from('AuthDevice')
    .update({ ...patch, updated_at: nowIso() })
    .eq('id', deviceRowId)
    .select('*')
    .maybeSingle();
  if (error) {
    logger.error('auth.device.update_failed', { deviceRowId, error: error.message });
    return null;
  }
  return data || null;
}

async function listActiveDevices(userId) {
  const { data, error } = await supabaseAdmin
    .from('AuthDevice')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('last_seen_at', { ascending: false });
  if (error) {
    logger.warn('auth.device.list_failed', { userId, error: error.message });
    return [];
  }
  return data || [];
}

function descriptorPatch(desc, req) {
  return {
    install_id: desc.installId,
    name: desc.name,
    model: desc.model,
    os_version: desc.osVersion,
    app_version: desc.appVersion,
    attestation: desc.attestation,
    last_seen_at: nowIso(),
    last_ip: clientIp(req),
    last_user_agent: userAgent(req),
  };
}

/**
 * Create or update the AuthDevice row for (user, deviceId) with the presented
 * key. ONLY called from credential-issuing paths.
 *
 * `allowRebind` (default true) controls the "same client deviceId, different
 * key" branch, which RETIRES the row's live sessions and moves the binding onto
 * the presenting key. That is a credential-grade operation (fresh login, OAuth
 * pair, redeemed resume grant). Paths that only re-present an existing token —
 * legacy adoption on /refresh — must pass `false`: otherwise a stolen refresh
 * token plus a device id read from `GET /api/auth/devices` would let an attacker
 * rotate a binding, sign the victim's real device out and wipe its enrolled
 * step-up key from a bearer-only endpoint (invariant: bind ONLY at issuance).
 *
 * @returns {Promise<{row:object, isNew:boolean}|null>}
 */
async function upsertDeviceForKey({ userId, descriptor, dpop, req, interactive, resumedFrom = null, allowRebind = true }) {
  const trust = evaluateTrustLevel(descriptor);
  const existing = await findDeviceByClientId(userId, descriptor.deviceId);
  const base = descriptorPatch(descriptor, req);

  if (!existing) {
    const row = {
      user_id: userId,
      device_id: descriptor.deviceId,
      platform: descriptor.platform,
      public_key_jwk: dpop.jwk,
      key_thumbprint: dpop.thumbprint,
      key_backing: descriptor.keyBacking,
      attestation_level: 'none',
      trust_level: trust,
      step_key_jwk: null,
      step_key_enrolled_via: null,
      require_step_up: false,
      trusted_at: interactive ? nowIso() : null,
      last_resumed_at: resumedFrom ? nowIso() : null,
      resumed_from_device: resumedFrom || null,
      revoked_at: null,
      revoked_reason: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      ...base,
    };
    const { data, error } = await supabaseAdmin
      .from('AuthDevice')
      .insert(row)
      .select('*')
      .single();
    if (!error && data) return { row: data, isNew: true };
    if (error && String(error.code) !== '23505') {
      logger.error('auth.device.insert_failed', { userId, error: error.message });
      return null;
    }
    // Lost a race with a concurrent login on the same new device — fall through to update.
  }

  const current = existing || (await findDeviceByClientId(userId, descriptor.deviceId));
  if (!current) return null;

  const sameKey = thumbprintEquals(current.key_thumbprint, dpop.thumbprint);
  const patch = { ...base, platform: descriptor.platform };
  let isNew = false;

  if (!sameKey) {
    if (!allowRebind) {
      // Non-credential path (legacy adoption): never rotate an existing binding.
      logger.warn('auth.device.rebind_refused', { userId, deviceRowId: current.id });
      return null;
    }
    // Same client device id, different key: treat as a brand-new key. Any
    // session still bound to the old key would fail its proof and raise a
    // false DEVICE_MISMATCH alarm — retire them silently instead.
    await authSessionService.revokeSessionsForDevice(current.id, 'superseded', { userId });
    await authSessionService.revokeGrantsForUser(userId, { deviceRowId: current.id });
    Object.assign(patch, {
      public_key_jwk: dpop.jwk,
      key_thumbprint: dpop.thumbprint,
      key_backing: descriptor.keyBacking,
      trust_level: trust,
      trusted_at: interactive ? nowIso() : null,
      step_key_jwk: null,
      step_key_enrolled_via: null,
      require_step_up: false,
      revoked_at: null,
      revoked_reason: null,
      resumed_from_device: resumedFrom || null,
      last_resumed_at: resumedFrom ? nowIso() : current.last_resumed_at || null,
    });
    isNew = true;
  } else {
    if (current.revoked_at) {
      // A revoked device signing back in with a real credential re-enrols.
      Object.assign(patch, { revoked_at: null, revoked_reason: null });
      isNew = true;
    }
    if (interactive) {
      // Fresh interactive login on this key: clear suspicion, re-evaluate.
      Object.assign(patch, {
        require_step_up: false,
        trust_level: current.trust_level === 'suspect' ? trust : (trust === 'trusted' ? 'trusted' : current.trust_level),
        trusted_at: current.trusted_at || nowIso(),
        key_backing: descriptor.keyBacking,
      });
    }
    if (resumedFrom) {
      Object.assign(patch, { last_resumed_at: nowIso(), resumed_from_device: resumedFrom });
    }
  }

  const row = await updateDevice(current.id, patch);
  return row ? { row, isNew } : null;
}

function publicDevice(row, { isNew = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    deviceId: row.device_id,
    isNew,
    trustLevel: row.trust_level,
    trustedAt: row.trusted_at || null,
    requireStepUp: Boolean(row.require_step_up),
  };
}

// ---------------------------------------------------------------------------
// bindAtIssue — called by /login, /oauth/callback, /oauth/token, /oauth/native
// right after the credential succeeded and before the response is written.
// ---------------------------------------------------------------------------

/**
 * Register the freshly issued Supabase session (and bind it to the presenting
 * device key when a `device` descriptor + verified DPoP proof are present).
 * Never throws; a registry failure must not fail the login.
 *
 * @param {object} p
 * @param {string} p.userId
 * @param {object} p.session      Supabase session {access_token, refresh_token, ...}
 * @param {object} [p.device]     wire descriptor (may be undefined for web/legacy)
 * @param {object} [p.dpop]       req.dpop from middleware/dpop.js (null when absent)
 * @param {object} [p.req]
 * @param {string} [p.authMethod] password|oauth_google|oauth_apple|siwa_native|google_native
 * @param {string} [p.context]    'interactive' (default) | 'oauth'
 * @param {boolean} [p.credential] true (default) when a real secret was shown
 *   (password, IdP code, IdP identity token). `/oauth/token` passes false: its
 *   "credential" is an access+refresh pair, which is exactly what a token thief
 *   holds, so it may register a NEW session but never re-point an existing
 *   session's binding nor rotate an existing device row onto another key.
 * @returns {Promise<{sessionId:string, session:{id:string,context:string}, device:object|null,
 *                    sessionRow:object|null, rebindRefused:boolean, boundDevice:object|null}>}
 *   `rebindRefused` ⇒ the caller presented a session that is already bound to a
 *   device key it could not prove; the caller must refuse the request.
 */
async function bindAtIssue({ userId, session, device, dpop, req, authMethod = 'password', context = 'interactive', credential = true }) {
  const claims = sessionClaimsFromAccessToken(session?.access_token);
  let sessionId = claims?.id;
  if (!isUuid(sessionId)) {
    sessionId = crypto.randomUUID();
    logger.warn('auth.bind.no_session_id_claim', { userId, generated: sessionId });
  }
  const mode = authPolicy.deviceBindingMode();
  const result = {
    sessionId,
    session: { id: sessionId, context },
    device: null,
    sessionRow: null,
    rebindRefused: false,
    boundDevice: null,
  };

  let deviceRow = null;
  let isNew = false;
  try {
    // A credential path normally mints a brand-new Supabase session, so there
    // is no registry row yet. A row that ALREADY exists means this session is
    // being re-presented — the only route that can do that is /oauth/token,
    // whose "credential" is an access+refresh pair, i.e. exactly what a token
    // thief holds. Such a re-presentation must never move (or clear) the
    // session's binding: that would let a stolen pair hand the session to an
    // attacker's key, defeat AUTH_DEVICE_BINDING=required, and lock the real
    // device out. Skipped in `off` mode so the kill switch stays a kill switch.
    const existingSession = await authSessionService.getSessionById(sessionId);
    if (mode !== 'off' && existingSession?.device_id) {
      const boundDevice = await getDevice(existingSession.device_id);
      const provesKey = Boolean(dpop?.thumbprint)
        && Boolean(boundDevice)
        && thumbprintEquals(boundDevice.key_thumbprint, dpop.thumbprint);
      if (!provesKey) {
        logger.warn('auth.bind.rebind_refused', {
          userId,
          sessionId,
          deviceRowId: existingSession.device_id,
          hasProof: Boolean(dpop?.thumbprint),
        });
        result.rebindRefused = true;
        result.sessionRow = existingSession;
        result.boundDevice = boundDevice || null;
        return result;
      }
      result.boundDevice = boundDevice;
    }

    if (mode !== 'off' && device && dpop?.thumbprint) {
      const parsed = normalizeDeviceDescriptor(device);
      if (!parsed.ok) {
        logger.warn('auth.bind.bad_device_descriptor', { userId, error: parsed.error });
      } else {
        const upserted = await upsertDeviceForKey({
          userId,
          descriptor: parsed.value,
          dpop,
          req,
          interactive: isInteractiveContext(context),
          // Rotating an existing (user, deviceId) row onto a new key retires
          // the victim's sessions and wipes its enrolled step-up key — a
          // credential-grade operation. A re-presented token pair is not one.
          allowRebind: credential || !existingSession,
        });
        if (upserted) {
          deviceRow = upserted.row;
          isNew = upserted.isNew;
        }
      }
    }

    // Never downgrade an already-registered session: keep its binding when this
    // call produced none, and keep its context unless a real credential was shown
    // (a restored session is only promoted by password/step-up, design §7.10).
    const deviceRowId = deviceRow?.id || existingSession?.device_id || null;
    const sessionContext = existingSession && !credential ? existingSession.context || context : context;
    result.session = { id: sessionId, context: sessionContext };
    result.sessionRow = await authSessionService.insertSession({
      id: sessionId,
      userId,
      deviceRowId,
      context: sessionContext,
      authMethod,
      boundAtIssue: Boolean(deviceRow) || Boolean(existingSession?.bound_at_issue && deviceRowId),
      refreshToken: session?.refresh_token || null,
      req,
    });

    await authSessionService.recordSecurityEvent({
      userId,
      deviceRowId: deviceRow?.id || null,
      sessionId,
      type: authMethod && authMethod.startsWith('oauth') ? 'oauth_login' : 'login',
      req,
      meta: {
        method: authMethod,
        bound: Boolean(deviceRow),
        platform: deviceRow?.platform || (device?.platform ? String(device.platform) : 'web'),
        newDevice: isNew,
      },
    });

    if (deviceRow) {
      result.device = publicDevice(deviceRow, { isNew });
      if (isNew) {
        await authNotifyService.newDeviceLogin({ userId, device: deviceRow, method: authMethod?.startsWith('oauth') ? 'oauth' : 'login', req });
      }
    }
  } catch (err) {
    logger.error('auth.bind.failed', { userId, sessionId, error: err.message, stack: err.stack });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

/**
 * Resolve the AuthSession row for a refresh: refresh-token hash → previous
 * hash → explicit sessionId → session_id claim of an (expired) access token.
 */
async function resolveSessionForRefresh({ refreshToken, sessionId, accessToken } = {}) {
  if (refreshToken) {
    const hash = hashToken(refreshToken);
    const byHash = await authSessionService.findSessionByRefreshHash(hash);
    if (byHash) return { session: byHash, matchedBy: 'hash' };
    const byPrev = await authSessionService.findSessionByPrevRefreshHash(hash);
    if (byPrev) return { session: byPrev, matchedBy: 'prev_hash' };
  }
  if (isUuid(sessionId)) {
    const byId = await authSessionService.getSessionById(sessionId);
    if (byId) return { session: byId, matchedBy: 'session_id' };
  }
  const claims = sessionClaimsFromAccessToken(accessToken);
  if (isUuid(claims?.id)) {
    const byJwt = await authSessionService.getSessionById(claims.id);
    if (byJwt) return { session: byJwt, matchedBy: 'access_token' };
  }
  return { session: null, matchedBy: null };
}

/**
 * Verify a DPoP proof against the key bound to THIS session's device and the
 * refresh token being presented (rth). Pure; no side effects.
 * @returns {{ok:boolean, reason:string|null}}
 */
function verifyRefreshProof(session, device, dpop, refreshToken) {
  if (!session || !device) return { ok: false, reason: 'unbound' };
  if (!dpop?.thumbprint) return { ok: false, reason: 'no_proof' };
  if (!thumbprintEquals(device.key_thumbprint, dpop.thumbprint)) return { ok: false, reason: 'thumbprint' };
  if (refreshToken) {
    if (!dpop.rth) return { ok: false, reason: 'rth_missing' };
    const a = Buffer.from(String(dpop.rth));
    const b = Buffer.from(hashToken(refreshToken));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'rth' };
  }
  return { ok: true, reason: null };
}

/**
 * Markers only a native client sends. Used to deny the `required`-mode web
 * exemption to a caller that declares `X-Token-Transport: cookie` while
 * behaving like an app (see checkRefresh SECURITY note).
 */
function looksNativeRequest(req) {
  if (!req) return false;
  if (platformFromRequest(req) !== null) return true;
  const header = (name) => (typeof req.get === 'function' ? req.get(name) : req.headers?.[name]);
  if (header('x-device-id')) return true;
  if (header('dpop')) return true;
  const body = req.body || {};
  if (typeof body.deviceId === 'string' && body.deviceId) return true;
  if (body.device && typeof body.device === 'object' && !Array.isArray(body.device)) return true;
  return false;
}

/**
 * Whether the STORED session row was issued to a native client. `device_id` /
 * `bound_at_issue` are conclusive; otherwise fall back to the user agent that
 * the genuine client wrote at issuance. Unknown/absent user agents count as
 * non-native so server-side web proxies keep working.
 */
function sessionLooksNative(session) {
  if (!session) return false;
  if (session.device_id || session.bound_at_issue) return true;
  const platform = inferPlatformFromUserAgent(session.user_agent);
  return platform === 'ios' || platform === 'android';
}

function codeForRevokedSession(session) {
  switch (session?.revoked_reason) {
    case 'device_revoked':
    case 'superseded':
      return 'DEVICE_REVOKED';
    case 'reuse':
      return 'TOKEN_REUSE';
    case 'inactivity':
      return 'SESSION_EXPIRED_INACTIVE';
    default:
      return 'SESSION_REVOKED';
  }
}

const SECURITY_MESSAGES = {
  TOKEN_REUSE: 'Session invalidated. Please sign in again.',
  DEVICE_MISMATCH: 'This session is bound to a different device. Please sign in again.',
  DEVICE_REVOKED: 'This device was signed out. Please sign in again.',
  SESSION_REVOKED: 'This session was signed out. Please sign in again.',
  SESSION_EXPIRED_INACTIVE: 'Session expired after inactivity. Please sign in again.',
  DPOP_REQUIRED: 'This app version must prove device possession. Please sign in again.',
};

function fail(code, extra = {}) {
  return { ok: false, status: 401, code, error: SECURITY_MESSAGES[code] || 'Unauthorized', ...extra };
}

/** Flag a device as suspect + force L2 on next launch, revoke its grants. */
async function markDeviceSuspect(userId, deviceRow, reason) {
  if (!deviceRow) return;
  await updateDevice(deviceRow.id, { require_step_up: true, trust_level: 'suspect' });
  await authSessionService.revokeGrantsForUser(userId, { deviceRowId: deviceRow.id });
  logger.warn('auth.device.suspect', { userId, deviceRowId: deviceRow.id, reason });
}

/**
 * Proof mismatch on a bound session: revoke the session, mark the device
 * suspect, event + security email/push.
 */
async function markMismatch({ session, device, req, reason = 'mismatch' }) {
  if (!session) return;
  const userId = session.user_id;
  await authSessionService.revokeSessionRow(session.id, 'mismatch', { userId });
  await markDeviceSuspect(userId, device, reason);
  await authSessionService.recordSecurityEvent({
    userId,
    deviceRowId: device?.id || null,
    sessionId: session.id,
    type: 'device_mismatch',
    req,
    meta: { reason },
  });
  await authNotifyService.securitySignOut({ userId, device, reason: 'mismatch', req });
}

/**
 * GoTrue reported refresh-token reuse for this session (TOKEN_REUSE branch):
 * revoke the row, force step-up on the device, revoke its grants, event,
 * email + push to the other devices. Safe when `session` is null (legacy).
 */
async function markReuse({ session, req }) {
  if (!session) {
    logger.warn('auth.refresh.reuse_unresolved_session', { ip: clientIp(req) });
    return;
  }
  const userId = session.user_id;
  const device = session.device_id ? await getDevice(session.device_id) : null;
  await authSessionService.revokeSessionRow(session.id, 'reuse', { userId });
  await markDeviceSuspect(userId, device, 'reuse');
  await authSessionService.recordSecurityEvent({
    userId,
    deviceRowId: device?.id || null,
    sessionId: session.id,
    type: 'refresh_reuse',
    req,
  });
  await authNotifyService.securitySignOut({ userId, device, reason: 'reuse', req });
}

/**
 * Pre-check for POST /api/users/refresh (design §6.3 order):
 *   resolve session → revoked? → device revoked? → inactivity → bound: verify
 *   proof (rth must match) → unbound: legacy rules.
 * Side effects (revocation, events, notifications) are applied here for
 * mismatch / inactivity so the route only has to translate the result.
 *
 * `cookieTransport` (web, httpOnly refresh cookie): browsers cannot present a
 * DPoP proof, so `required` mode never refuses an unbound web session — the
 * cookie jar + CSRF + the session registry are its binding.
 *
 * SECURITY (`webExemption`): `cookieTransport` is derived from the
 * `X-Token-Transport: cookie` request header, which the *client* chooses. On
 * its own it would hand anyone holding a stolen UNBOUND refresh token an opt-out
 * from `required` mode: send the header, put the token in the `pantopus_refresh`
 * cookie, done. The exemption therefore also requires that nothing says "native
 * client" — neither the request (`X-Client-Platform: ios|android`, `X-Device-Id`,
 * a `DPoP` header, a `device`/`deviceId` in the body) nor the session row, whose
 * `user_agent`/binding were recorded when the genuine client issued it and which
 * an attacker cannot rewrite without first passing this very check.
 *
 * SECURITY (`tokenResolved`): `sessionId` (request body) and `accessToken` are
 * only *hints* — neither is authenticated here (the JWT is decoded, never
 * verified). A session that was found through a hint rather than through the
 * presented refresh token's hash therefore never receives a destructive side
 * effect (revocation, security event, mismatch email/push): otherwise anyone
 * who learns a session UUID could sign that session out and forge a "suspicious
 * activity" alert without holding a single credential. Hints still resolve the
 * row so a rotation we failed to persist can be recovered (and so the row is
 * never clobbered by `recordRefresh`), and a *valid* proof over that row is
 * still accepted — only the failure paths are made inert.
 *
 * @returns {Promise<{ok:true, session:object|null, device:object|null, legacy:boolean, adopt:boolean, matchedBy:string|null, tokenResolved:boolean}
 *                  |{ok:false, status:number, code:string, error:string, tokenResolved:boolean}>}
 */
async function checkRefresh({ refreshToken, sessionId, accessToken, dpop, req, cookieTransport = false }) {
  const mode = authPolicy.deviceBindingMode();
  const { session, matchedBy } = await resolveSessionForRefresh({ refreshToken, sessionId, accessToken });
  // True only when the PRESENTED refresh token hashes to this row (current or
  // previous generation) — i.e. the caller really holds a token of this session.
  const tokenResolved = matchedBy === 'hash' || matchedBy === 'prev_hash';
  // See SECURITY (`webExemption`) above: a client-declared header alone may not
  // buy an opt-out from `required` mode.
  const webExemption = cookieTransport && !looksNativeRequest(req) && !sessionLooksNative(session);
  const enforceProof = mode === 'required' && !webExemption;

  if (!session) {
    // Pre-registry session (issued before migration 160). Accepted while the
    // mode is not `required`; a row is created on success (recordRefresh).
    if (enforceProof) return { ...fail('DPOP_REQUIRED'), tokenResolved };
    return { ok: true, session: null, device: null, legacy: true, adopt: false, matchedBy: null, tokenResolved };
  }

  if (session.revoked_at) {
    return { ...fail(codeForRevokedSession(session), { session }), tokenResolved };
  }

  const device = session.device_id ? await getDevice(session.device_id) : null;
  if (session.device_id && !device) {
    // The row says "bound" but the device could not be loaded (transient DB
    // error — the FK is ON DELETE SET NULL, so a missing row is never
    // legitimate). Fail closed WITHOUT a security code: the client keeps its
    // tokens and retries instead of wiping the session.
    logger.error('auth.refresh.bound_device_unavailable', { sessionId: session.id, deviceRowId: session.device_id });
    return { ok: false, status: 503, code: 'AUTH_UNAVAILABLE', error: 'Could not verify this session right now. Please try again.', session, tokenResolved };
  }
  if (device?.revoked_at) {
    if (tokenResolved) await authSessionService.revokeSessionRow(session.id, 'device_revoked', { userId: session.user_id });
    return { ...fail('DEVICE_REVOKED', { session }), tokenResolved };
  }

  if (isInactive(session, device)) {
    if (tokenResolved) {
      await authSessionService.revokeSessionRow(session.id, 'inactivity', { userId: session.user_id });
      await authSessionService.recordSecurityEvent({
        userId: session.user_id,
        deviceRowId: device?.id || null,
        sessionId: session.id,
        type: 'inactivity_expired',
        req,
        meta: { windowDays: inactivityWindowDays(device) },
      });
    }
    return { ...fail('SESSION_EXPIRED_INACTIVE', { session }), tokenResolved };
  }

  if (mode === 'off') {
    return { ok: true, session, device, legacy: !device, adopt: false, matchedBy, tokenResolved };
  }

  if (device) {
    // Bound session: the proof MUST come from this device's key. A bound
    // session was issued to a DPoP-capable client, so "no proof at all" is as
    // suspicious as a wrong key (design §12: wrong/no key ⇒ DEVICE_MISMATCH,
    // session revoked, event, email).
    const proof = verifyRefreshProof(session, device, dpop, refreshToken);
    if (!proof.ok) {
      if (!tokenResolved) {
        // Hint-resolved only: refuse without touching the row (see SECURITY above).
        logger.warn('auth.refresh.unproven_session_hint', { sessionId: session.id, matchedBy, reason: proof.reason, ip: clientIp(req) });
        return { ok: false, status: 401, code: 'UNAUTHORIZED', error: 'Session expired. Please sign in again.', session, tokenResolved };
      }
      await markMismatch({ session, device, req, reason: proof.reason });
      return { ...fail('DEVICE_MISMATCH', { session }), tokenResolved };
    }
    return { ok: true, session, device, legacy: false, adopt: false, matchedBy, tokenResolved };
  }

  // Unbound row (web, or legacy mobile).
  if (enforceProof) return { ...fail('DPOP_REQUIRED', { session }), tokenResolved };
  const issuedAt = new Date(session.issued_at);
  const adopt =
    // Adoption binds a key to a session, so it needs the real token, not a hint.
    tokenResolved &&
    Boolean(dpop?.thumbprint) &&
    session.bound_at_issue === false &&
    !Number.isNaN(issuedAt.getTime()) &&
    issuedAt.getTime() < authPolicy.dpopCutover().getTime();
  return { ok: true, session, device: null, legacy: true, adopt, matchedBy, tokenResolved };
}

/**
 * Persist a successful refreshSession: hashes, last_refresh/seen/ip, device
 * last_seen; optionally adopt a legacy session onto the presenting key
 * (only when checkRefresh said `adopt` and the client sent a deviceId).
 *
 * @param {object} p
 * @param {object|null} p.session       row from checkRefresh (null ⇒ pre-registry, a row is created)
 * @param {object} p.newSession         Supabase session returned by refreshSession
 * @param {string} p.oldRefreshToken
 * @param {object} [p.dpop]
 * @param {boolean} [p.adopt]
 * @param {string} [p.deviceId]         client device UUID from the body (adoption only)
 * @param {object} [p.device]           optional descriptor (adoption metadata)
 * @param {object} [p.req]
 * @returns {Promise<{sessionId:string, session:{id:string,context:string}, device:object|null}>}
 */
async function recordRefresh({ session, newSession, oldRefreshToken, dpop, adopt = false, deviceId, device, req }) {
  const claims = sessionClaimsFromAccessToken(newSession?.access_token);
  const sessionId = session?.id || (isUuid(claims?.id) ? claims.id : null);
  const context = session?.context || 'interactive';
  const out = { sessionId, session: sessionId ? { id: sessionId, context } : null, device: null };
  if (!sessionId) return out;

  try {
    if (!session) {
      const userId = claims?.sub || null;
      if (userId) {
        await authSessionService.insertSession({
          id: sessionId,
          userId,
          deviceRowId: null,
          context: 'interactive',
          authMethod: 'legacy',
          boundAtIssue: false,
          refreshToken: newSession.refresh_token,
          req,
        });
        await supabaseAdmin
          .from('AuthSession')
          .update({ prev_refresh_token_hash: oldRefreshToken ? hashToken(oldRefreshToken) : null, last_refresh_at: nowIso() })
          .eq('id', sessionId);
      }
      return out;
    }

    let deviceRowId;
    if (adopt && dpop?.thumbprint && isUuid(deviceId)) {
      const platform = platformFromRequest(req) || (device?.platform ? String(device.platform).toLowerCase() : null);
      const parsed = normalizeDeviceDescriptor({
        deviceId,
        platform,
        keyBacking: device?.keyBacking || 'software',
        hasOsLock: device?.hasOsLock === true,
        installId: device?.installId,
        name: device?.name,
        model: device?.model,
        osVersion: device?.osVersion,
        appVersion: device?.appVersion,
      });
      if (parsed.ok) {
        const upserted = await upsertDeviceForKey({
          userId: session.user_id,
          descriptor: parsed.value,
          dpop,
          req,
          // A refresh is not a credential event: it may create the row for a
          // key it has never seen, but it must not mark the device
          // interactively trusted, clear `require_step_up`, or take an
          // existing (user, deviceId) row away from the key it is bound to.
          interactive: false,
          allowRebind: false,
        });
        if (upserted) {
          deviceRowId = upserted.row.id;
          out.device = publicDevice(upserted.row, { isNew: upserted.isNew });
          await authSessionService.recordSecurityEvent({
            userId: session.user_id,
            deviceRowId,
            sessionId,
            type: 'login',
            req,
            meta: { method: 'legacy_adoption', bound: true, platform: parsed.value.platform, newDevice: upserted.isNew },
          });
          if (upserted.isNew) {
            await authNotifyService.newDeviceLogin({ userId: session.user_id, device: upserted.row, method: 'login', req });
          }
        }
      } else {
        logger.info('auth.refresh.adoption_skipped', { sessionId, reason: parsed.error });
      }
    }

    await authSessionService.recordRotation(sessionId, {
      oldRefreshToken,
      newRefreshToken: newSession.refresh_token,
      req,
      deviceRowId,
    });
    if (session.device_id) {
      await updateDevice(session.device_id, { last_seen_at: nowIso(), last_ip: clientIp(req), last_user_agent: userAgent(req) });
    }
  } catch (err) {
    logger.error('auth.refresh.record_failed', { sessionId, error: err.message });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sessions on requests (router / stage-2 helpers)
// ---------------------------------------------------------------------------

function tokenFromRequest(req) {
  const authHeader = typeof req?.get === 'function' ? req.get('authorization') : req?.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim() || null;
  return req?.cookies?.pantopus_access || null;
}

/**
 * The AuthSession row of the token that authenticated `req` (Bearer, else
 * cookie). Uses `req.session.id` when verifyToken (stage 2) already decoded
 * it. Returns null for pre-registry sessions.
 */
async function sessionRowFromRequest(req) {
  let sessionId = req?.session?.id || null;
  if (!sessionId) {
    const claims = sessionClaimsFromAccessToken(tokenFromRequest(req));
    sessionId = claims?.id || null;
  }
  if (!isUuid(sessionId)) return null;
  return authSessionService.getSessionById(sessionId);
}

// ---------------------------------------------------------------------------
// /devices/register — metadata + push linkage + Android grant. Never binds.
// ---------------------------------------------------------------------------

async function getSecurityPrefs(userId) {
  const { data, error } = await supabaseAdmin
    .from('User')
    .select('security_prefs')
    .eq('id', userId)
    .maybeSingle();
  if (error) logger.warn('auth.prefs.lookup_failed', { userId, error: error.message });
  return authNotifyService.normalizePrefs(data?.security_prefs);
}

async function patchSecurityPrefs(userId, patch = {}) {
  const current = await getSecurityPrefs(userId);
  const next = { ...current };
  if (typeof patch.allowRestoreGrants === 'boolean') next.allowRestoreGrants = patch.allowRestoreGrants;
  if (typeof patch.newDeviceEmail === 'boolean') next.newDeviceEmail = patch.newDeviceEmail;
  const { error } = await supabaseAdmin
    .from('User')
    .update({ security_prefs: next, updated_at: nowIso() })
    .eq('id', userId);
  if (error) {
    logger.error('auth.prefs.update_failed', { userId, error: error.message });
    return null;
  }
  if (current.allowRestoreGrants && next.allowRestoreGrants === false) {
    await authSessionService.revokeGrantsForUser(userId);
  }
  return next;
}

/** Whether this device may hold an Android resume grant right now. */
async function grantEligible(userId, deviceRow, prefs) {
  if (!authPolicy.resumeGrantsEnabled()) return false;
  if (!deviceRow || deviceRow.platform !== 'android') return false;
  if (deviceRow.revoked_at) return false;
  if (deviceRow.trust_level !== 'trusted') return false;
  if (!RESUME_BACKINGS.includes(deviceRow.key_backing)) return false;
  const p = prefs || (await getSecurityPrefs(userId));
  return p.allowRestoreGrants !== false;
}

/**
 * @param {object} p
 * @param {string} p.userId
 * @param {object|null} p.sessionRow   from sessionRowFromRequest
 * @param {object} p.dpop              verified proof (required)
 * @param {object} p.device            wire descriptor
 * @param {string} [p.pushToken]
 * @param {string} [p.pushProvider]    'fcm' | 'apns'
 * @param {object} [p.req]
 * @returns {Promise<{ok:true, device:object, resumeGrant:string|null}|{ok:false,status:number,code:string,error:string}>}
 */
async function registerDevice({ userId, sessionRow, dpop, device, pushToken, pushProvider, req }) {
  const parsed = normalizeDeviceDescriptor(device);
  if (!parsed.ok) return { ok: false, status: 400, code: 'BAD_REQUEST', error: parsed.error };
  const desc = parsed.value;

  if (!sessionRow || !sessionRow.device_id) {
    return { ok: false, status: 409, code: 'DEVICE_NOT_BOUND', error: 'This session is not bound to a device key' };
  }
  const deviceRow = await getDevice(sessionRow.device_id);
  if (!deviceRow || deviceRow.user_id !== userId) {
    return { ok: false, status: 409, code: 'DEVICE_NOT_BOUND', error: 'This session is not bound to a device key' };
  }
  if (deviceRow.revoked_at) {
    return { ok: false, status: 401, code: 'DEVICE_REVOKED', error: SECURITY_MESSAGES.DEVICE_REVOKED };
  }
  if (!dpop?.thumbprint || !thumbprintEquals(deviceRow.key_thumbprint, dpop.thumbprint)) {
    await authSessionService.recordSecurityEvent({
      userId,
      deviceRowId: deviceRow.id,
      sessionId: sessionRow.id,
      type: 'device_mismatch',
      req,
      meta: { endpoint: 'devices/register' },
    });
    return { ok: false, status: 401, code: 'DEVICE_MISMATCH', error: SECURITY_MESSAGES.DEVICE_MISMATCH };
  }
  if (desc.deviceId !== deviceRow.device_id) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', error: 'device.deviceId does not match the bound device' };
  }

  const patch = descriptorPatch(desc, req);
  // Descriptive metadata only. Trust/key fields are decided at issuance.
  const updated = (await updateDevice(deviceRow.id, patch)) || deviceRow;

  if (pushToken && typeof pushToken === 'string') {
    try {
      await pushService.saveToken(userId, pushToken, {
        platform: desc.platform,
        provider: pushProvider || undefined,
        deviceId: desc.deviceId,
      });
    } catch (err) {
      logger.warn('auth.register.push_save_failed', { userId, error: err.message });
    }
  }

  let resumeGrant = null;
  const prefs = await getSecurityPrefs(userId);
  if (await grantEligible(userId, updated, prefs)) {
    const minted = await authSessionService.mintResumeGrant(userId, updated.id);
    resumeGrant = minted?.grant || null;
  }

  await authSessionService.touchSession(sessionRow.id, req);

  return { ok: true, device: publicDevice(updated), resumeGrant };
}

// ---------------------------------------------------------------------------
// GET /devices
// ---------------------------------------------------------------------------

function inferPlatformFromUserAgent(ua) {
  const s = String(ua || '').toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('okhttp') || s.includes('android')) return 'android';
  if (s.includes('cfnetwork') || s.includes('darwin') || s.includes('iphone') || s.includes('ipad')) return 'ios';
  if (s.includes('mozilla')) return 'web';
  return 'unknown';
}

/**
 * Devices (with at least one active session, or the current one), unbound
 * sessions (web/legacy) and the last 20 events for "Where you're logged in".
 */
async function listDevices(userId, currentSessionId) {
  const [devices, sessions, events] = await Promise.all([
    listActiveDevices(userId),
    authSessionService.listActiveSessions(userId),
    authSessionService.listSecurityEvents(userId, 20),
  ]);
  const current = sessions.find((s) => s.id === currentSessionId) || null;
  const activeByDevice = new Map();
  for (const s of sessions) {
    if (!s.device_id) continue;
    const arr = activeByDevice.get(s.device_id) || [];
    arr.push(s);
    activeByDevice.set(s.device_id, arr);
  }
  const deviceItems = devices
    .filter((d) => activeByDevice.has(d.id) || (current && current.device_id === d.id))
    .map((d) => {
      const lastSession = (activeByDevice.get(d.id) || []).sort((a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')))[0];
      return {
        id: d.id,
        deviceId: d.device_id,
        platform: d.platform,
        name: d.name || null,
        model: d.model || null,
        osVersion: d.os_version || null,
        appVersion: d.app_version || null,
        isCurrent: Boolean(current && current.device_id === d.id),
        trustLevel: d.trust_level,
        trustedAt: d.trusted_at || null,
        lastSeenAt: d.last_seen_at || lastSession?.last_seen_at || null,
        lastIp: d.last_ip || null,
        createdAt: d.created_at,
        sessions: (activeByDevice.get(d.id) || []).map((s) => ({ id: s.id, context: s.context, issuedAt: s.issued_at, lastSeenAt: s.last_seen_at || null })),
      };
    })
    .sort((a, b) => (a.isCurrent === b.isCurrent ? String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || '')) : a.isCurrent ? -1 : 1));

  const sessionItems = sessions
    .filter((s) => !s.device_id)
    .map((s) => ({
      id: s.id,
      platform: inferPlatformFromUserAgent(s.user_agent),
      userAgent: s.user_agent || null,
      isCurrent: s.id === currentSessionId,
      context: s.context,
      lastSeenAt: s.last_seen_at || null,
      issuedAt: s.issued_at,
    }))
    .sort((a, b) => (a.isCurrent === b.isCurrent ? String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || '')) : a.isCurrent ? -1 : 1));

  const eventItems = events.map((e) => ({
    id: e.id,
    type: e.type,
    createdAt: e.created_at,
    deviceId: e.device_id || null,
    meta: e.meta || null,
  }));

  return { devices: deviceItems, sessions: sessionItems, events: eventItems };
}

// ---------------------------------------------------------------------------
// Revocation
// ---------------------------------------------------------------------------

async function revokeDeviceRow(deviceRow, reason) {
  return updateDevice(deviceRow.id, { revoked_at: nowIso(), revoked_reason: reason, require_step_up: false });
}

/**
 * DELETE /api/auth/devices/:id — revoke one device: its sessions, its push
 * tokens, its grants; socket kick via authEvents; event + "device removed"
 * email + push to the other devices. Best-effort silent push to the device
 * itself BEFORE its tokens are deleted (client only acts after a 401).
 *
 * @returns {Promise<{ok:true, revokedSessions:number, already?:boolean}|{ok:false,status:number,code:string,error:string}>}
 */
async function revokeDevice({ userId, deviceRowId, reason = 'user', req, actorSessionId = null, notify = true }) {
  const row = await getDevice(deviceRowId);
  if (!row || row.user_id !== userId) {
    return { ok: false, status: 404, code: 'NOT_FOUND', error: 'Device not found' };
  }
  if (row.revoked_at) return { ok: true, revokedSessions: 0, already: true };

  try {
    await pushService.sendToDevice(userId, row.device_id, {
      title: 'Signed out',
      body: 'This device was signed out of Pantopus.',
      data: { type: 'session_revoked', reason },
    });
  } catch (err) {
    logger.debug('auth.revoke_device.push_failed', { error: err.message });
  }

  const revokedSessions = await authSessionService.revokeSessionsForDevice(row.id, 'device_revoked', { userId });
  await revokeDeviceRow(row, reason);
  await pushService.removeTokensForDevice(userId, row.device_id);
  await authSessionService.revokeGrantsForUser(userId, { deviceRowId: row.id });
  await authSessionService.recordSecurityEvent({
    userId,
    deviceRowId: row.id,
    sessionId: actorSessionId,
    type: 'device_revoked',
    req,
    meta: { reason, revokedSessions, name: row.name || row.model || null, platform: row.platform },
  });
  if (notify) await authNotifyService.deviceRemoved({ userId, device: row, req, byUser: reason === 'user' });
  return { ok: true, revokedSessions };
}

async function revokeOtherDevices(userId, keepDeviceRowId, reason) {
  const devices = await listActiveDevices(userId);
  let n = 0;
  for (const d of devices) {
    if (keepDeviceRowId && d.id === keepDeviceRowId) continue;
    await revokeDeviceRow(d, reason);
    await pushService.removeTokensForDevice(userId, d.device_id);
    n += 1;
  }
  return n;
}

/**
 * Sign out every OTHER session/device (revoke-others, /logout scope others,
 * password change).
 * @returns {Promise<{revoked:number}>}
 */
async function revokeOthers({ userId, currentSessionId, accessToken, req, reason = 'user', eventType = 'revoke_others' }) {
  await authSessionService.signOutSupabase(accessToken, 'others', { source: eventType, userId });
  const current = currentSessionId ? await authSessionService.getSessionById(currentSessionId) : null;
  const revoked = await authSessionService.revokeSessionsForUser(userId, { exceptSessionId: currentSessionId || null, reason });
  const revokedDevices = await revokeOtherDevices(userId, current?.device_id || null, reason);
  // Grants: keep only the current device's.
  await revokeGrantsExcept(userId, current?.device_id || null);
  await authSessionService.recordSecurityEvent({
    userId,
    deviceRowId: current?.device_id || null,
    sessionId: currentSessionId,
    type: eventType,
    req,
    meta: { revoked, revokedDevices },
  });
  return { revoked, revokedDevices };
}

async function revokeGrantsExcept(userId, keepDeviceRowId) {
  const { data, error } = await supabaseAdmin
    .from('AuthResumeGrant')
    .select('id, device_id')
    .eq('user_id', userId)
    .is('used_at', null)
    .is('revoked_at', null);
  if (error || !data) return 0;
  const ids = data.filter((g) => !keepDeviceRowId || g.device_id !== keepDeviceRowId).map((g) => g.id);
  if (ids.length === 0) return 0;
  await supabaseAdmin.from('AuthResumeGrant').update({ revoked_at: nowIso() }).in('id', ids);
  return ids.length;
}

/**
 * Lockdown / sign out everywhere (revoke-all, /logout scope global, password
 * reset, account deletion): GoTrue global sign-out (when we hold a JWT), all
 * rows revoked, all devices revoked, all push tokens deleted, all grants
 * revoked, sessions_valid_after=now.
 */
async function revokeAll({ userId, accessToken = null, req, reason = 'lockdown', eventType = 'lockdown', notify = true }) {
  if (accessToken) await authSessionService.signOutSupabase(accessToken, 'global', { source: eventType, userId });
  const revoked = await authSessionService.revokeSessionsForUser(userId, { reason });
  const revokedDevices = await revokeOtherDevices(userId, null, reason);
  await pushService.removeAllTokens(userId);
  await authSessionService.revokeGrantsForUser(userId);
  await authSessionService.setSessionsValidAfter(userId, new Date());
  await authSessionService.recordSecurityEvent({
    userId,
    type: eventType,
    req,
    meta: { revoked, revokedDevices },
  });
  if (notify) {
    await authNotifyService.lockdown({ userId, req, cause: reason === 'password_reset' ? 'password_reset' : 'lockdown' });
  }
  return { ok: true, revoked, revokedDevices };
}

// ---------------------------------------------------------------------------
// Stage-2 composite hooks
// ---------------------------------------------------------------------------

/** After POST /password: other sessions/devices/grants revoked + email. */
async function onPasswordChanged({ userId, currentSessionId, accessToken, req }) {
  const result = await revokeOthers({
    userId,
    currentSessionId,
    accessToken,
    req,
    reason: 'password_change',
    eventType: 'password_changed',
  });
  const current = currentSessionId ? await authSessionService.getSessionById(currentSessionId) : null;
  const currentDevice = current?.device_id ? await getDevice(current.device_id) : null;
  await authNotifyService.passwordChangedOtherDevices({ userId, req, currentDevice });
  return result;
}

/**
 * After POST /reset-password: everything revoked + watermark + email.
 * Pass the recovery session's access token when available so GoTrue also
 * performs a global sign-out (the route revokes that recovery session itself
 * afterwards, as today).
 */
async function onPasswordReset({ userId, accessToken = null, req }) {
  return revokeAll({ userId, accessToken, req, reason: 'password_reset', eventType: 'password_reset', notify: true });
}

/** Before admin.deleteUser in DELETE /account. */
async function onAccountDeleted({ userId, accessToken = null, req }) {
  return revokeAll({ userId, accessToken, req, reason: 'account_deleted', eventType: 'account_deleted', notify: false });
}

/**
 * POST /logout scope=local. Cookie clearing + admin.signOut(jwt,'local') stay
 * in the route. Row side effects here, ONLY with proof:
 *   (a) valid Bearer (req.user set by verifyToken/optionalAuth-like check) →
 *       its own AuthSession row is revoked (reason logout); device effects
 *       (push tokens, grants) when that session is bound to `deviceId`;
 *   (b) refreshToken whose hash resolves to a session bound to a device whose
 *       key verifies `dpop` (with rth) → same effects.
 *
 * @param {object} p
 * @param {string|null} p.userId            from a verified Bearer, else null
 * @param {string|null} p.bearerSessionId   session_id claim of that Bearer
 * @param {string} [p.deviceId]             client device UUID
 * @param {string} [p.refreshToken]
 * @param {object} [p.dpop]                 verified proof (rth checked here again)
 * @param {object} [p.req]
 * @returns {Promise<{proof:'bearer'|'refresh'|null, revokedSession:boolean, deviceRowId:string|null}>}
 */
async function logoutLocal({ userId = null, bearerSessionId = null, deviceId, refreshToken, dpop, req }) {
  const out = { proof: null, revokedSession: false, deviceRowId: null };
  let session = null;
  let device = null;

  if (userId && isUuid(bearerSessionId)) {
    const row = await authSessionService.getSessionById(bearerSessionId);
    if (row && row.user_id === userId) {
      session = row;
      out.proof = 'bearer';
      if (row.device_id) {
        const d = await getDevice(row.device_id);
        if (d && (!deviceId || d.device_id === deviceId)) device = d;
      }
    }
  }

  if (!session && refreshToken && dpop?.thumbprint) {
    const { session: byToken } = await resolveSessionForRefresh({ refreshToken });
    if (byToken?.device_id) {
      const d = await getDevice(byToken.device_id);
      const proof = verifyRefreshProof(byToken, d, dpop, refreshToken);
      if (proof.ok) {
        session = byToken;
        device = d;
        out.proof = 'refresh';
      } else {
        logger.warn('auth.logout.refresh_proof_failed', { reason: proof.reason, sessionId: byToken.id });
      }
    }
  }

  if (!session) return out;
  const uid = session.user_id;
  out.revokedSession = await authSessionService.revokeSessionRow(session.id, 'logout', { userId: uid });
  if (device) {
    out.deviceRowId = device.id;
    await pushService.removeTokensForDevice(uid, device.device_id);
    await authSessionService.revokeGrantsForUser(uid, { deviceRowId: device.id });
    await updateDevice(device.id, { last_seen_at: nowIso() });
  }
  await authSessionService.recordSecurityEvent({
    userId: uid,
    deviceRowId: device?.id || null,
    sessionId: session.id,
    type: 'logout',
    req,
    meta: { proof: out.proof, scope: 'local' },
  });
  return out;
}

// ---------------------------------------------------------------------------
// Resume grants (Android reinstall)
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/resume — redeem a single-use grant into a `restored` session
 * bound to the presenting hardware key.
 *
 * @returns {Promise<{ok:true, supabaseSession:object, authUser:object, sessionId:string, sessionRow:object,
 *                    device:object, deviceRow:object, previousDevice:object|null, resumeGrant:string|null}
 *                  |{ok:false,status:number,code:string,error:string}>}
 */
async function redeemResumeGrant({ grant, device, dpop, req }) {
  const invalid = { ok: false, status: 401, code: 'RESUME_GRANT_INVALID', error: 'This sign-in link is no longer valid. Please sign in again.' };
  if (!authPolicy.resumeGrantsEnabled()) return invalid;
  if (!dpop?.thumbprint) return { ok: false, status: 401, code: 'DPOP_REQUIRED', error: 'DPoP proof required' };

  const parsed = normalizeDeviceDescriptor(device);
  if (!parsed.ok) return { ok: false, status: 400, code: 'BAD_REQUEST', error: parsed.error };
  const desc = parsed.value;
  if (desc.platform !== 'android' || !RESUME_BACKINGS.includes(desc.keyBacking)) {
    // Software / non-hardware keys can never redeem a grant (design §7.4).
    return invalid;
  }

  const row = await authSessionService.findResumeGrant(grant);
  if (!authSessionService.isGrantRedeemable(row)) return invalid;
  const userId = row.user_id;

  const prefs = await getSecurityPrefs(userId);
  if (prefs.allowRestoreGrants === false) {
    await authSessionService.revokeGrantsForUser(userId);
    return invalid;
  }

  const authUser = await authSessionService.lookupAuthUser(userId);
  if (!authUser) return invalid;
  if (authUser.banned_until && new Date(authUser.banned_until).getTime() > Date.now()) return invalid;

  // Single-use: whoever flips used_at wins.
  const consumed = await authSessionService.consumeResumeGrant(row.id);
  if (!consumed) return invalid;

  let minted;
  try {
    minted = await authSessionService.mintSessionForUser({ userId, email: authUser.email });
  } catch (err) {
    logger.error('auth.resume.mint_failed', { userId, error: err.message });
    return { ok: false, status: 503, code: 'RESUME_UNAVAILABLE', error: 'Could not restore your session. Please sign in again.' };
  }
  const supabaseSession = minted.session;

  const previousDevice = row.device_id ? await getDevice(row.device_id) : null;
  const upserted = await upsertDeviceForKey({
    userId,
    descriptor: desc,
    dpop,
    req,
    interactive: false,
    resumedFrom: previousDevice && previousDevice.device_id !== desc.deviceId ? previousDevice.id : null,
  });
  if (!upserted) {
    await authSessionService.signOutSupabase(supabaseSession.access_token, 'local', { source: 'resume_device_failed' });
    return { ok: false, status: 503, code: 'RESUME_UNAVAILABLE', error: 'Could not restore your session. Please sign in again.' };
  }
  const deviceRow = upserted.row;

  // The old install's row is superseded (its sessions are dead with the uninstall).
  if (previousDevice && previousDevice.id !== deviceRow.id && !previousDevice.revoked_at) {
    await authSessionService.revokeSessionsForDevice(previousDevice.id, 'superseded', { userId });
    await revokeDeviceRow(previousDevice, 'superseded');
    await pushService.removeTokensForDevice(userId, previousDevice.device_id);
  }

  const claims = sessionClaimsFromAccessToken(supabaseSession.access_token);
  const sessionId = isUuid(claims?.id) ? claims.id : crypto.randomUUID();
  const sessionRow = await authSessionService.insertSession({
    id: sessionId,
    userId,
    deviceRowId: deviceRow.id,
    context: 'restored',
    authMethod: 'resume_grant',
    boundAtIssue: true,
    refreshToken: supabaseSession.refresh_token,
    req,
  });

  const nextGrant = await authSessionService.mintResumeGrant(userId, deviceRow.id);
  await authSessionService.recordSecurityEvent({
    userId,
    deviceRowId: deviceRow.id,
    sessionId,
    type: 'resume',
    req,
    meta: { fromDevice: previousDevice?.id || null, model: desc.model, newDevice: upserted.isNew },
  });
  await authNotifyService.newDeviceLogin({ userId, device: deviceRow, previousDevice, method: 'resume', req });

  return {
    ok: true,
    supabaseSession,
    authUser: minted.user || authUser,
    sessionId,
    sessionRow,
    device: publicDevice(deviceRow, { isNew: upserted.isNew }),
    deviceRow,
    previousDevice,
    resumeGrant: nextGrant?.grant || null,
  };
}

// ---------------------------------------------------------------------------
// Step-up (device key)
// ---------------------------------------------------------------------------

function hasPasswordProvider(authUser) {
  const providers = new Set();
  const p = authUser?.app_metadata?.provider;
  if (typeof p === 'string' && p) providers.add(p);
  if (Array.isArray(authUser?.app_metadata?.providers)) authUser.app_metadata.providers.forEach((x) => typeof x === 'string' && providers.add(x));
  if (Array.isArray(authUser?.identities)) authUser.identities.forEach((i) => typeof i?.provider === 'string' && providers.add(i.provider));
  return providers.has('email');
}

/**
 * Purposes that demand the STRONGEST method the account has (WORKLOG
 * decision 5 / CONTRACT DELETE /account): password when the account has one,
 * `device_key` only for OAuth-only accounts.
 */
const PASSWORD_FIRST_PURPOSES = Object.freeze(['delete_account']);

/**
 * Methods this user/session may use for step-up right now. `purpose` is
 * optional; for PASSWORD_FIRST_PURPOSES an account that has a password is
 * offered password only.
 */
async function availableStepUpMethods({ userId, sessionRow, purpose = null }) {
  const methods = [];
  const authUser = await authSessionService.lookupAuthUser(userId);
  const hasPassword = !authUser || hasPasswordProvider(authUser);
  if (hasPassword) methods.push('password');
  if (hasPassword && purpose && PASSWORD_FIRST_PURPOSES.includes(purpose)) return methods;
  if (sessionRow && isInteractiveContext(sessionRow.context) && sessionRow.device_id) {
    const device = await getDevice(sessionRow.device_id);
    if (device && !device.revoked_at && device.step_key_jwk && device.step_key_enrolled_via === 'interactive') {
      methods.push('device_key');
    }
  }
  return methods;
}

/**
 * POST /api/auth/step-up-key — store the biometry-bound step-up public key on
 * the session's bound device. Requires a bound, interactive session and a
 * DPoP proof from the bound key.
 */
async function enrolStepUpKey({ userId, sessionRow, dpop, publicKeyJwk, keyBacking }) {
  if (!sessionRow || !sessionRow.device_id) {
    return { ok: false, status: 409, code: 'DEVICE_NOT_BOUND', error: 'This session is not bound to a device key' };
  }
  if (!isInteractiveContext(sessionRow.context)) {
    return { ok: false, status: 403, code: 'INTERACTIVE_SESSION_REQUIRED', error: 'Sign in with your password to enrol a step-up key' };
  }
  const device = await getDevice(sessionRow.device_id);
  if (!device || device.user_id !== userId || device.revoked_at) {
    return { ok: false, status: 409, code: 'DEVICE_NOT_BOUND', error: 'This session is not bound to a device key' };
  }
  if (!dpop?.thumbprint || !thumbprintEquals(device.key_thumbprint, dpop.thumbprint)) {
    return { ok: false, status: 401, code: 'DEVICE_MISMATCH', error: SECURITY_MESSAGES.DEVICE_MISMATCH };
  }
  if (!isPlainP256Jwk(publicKeyJwk)) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', error: 'publicKeyJwk must be a public P-256 EC key' };
  }
  const backing = str(keyBacking, 32)?.toLowerCase() || 'software';
  if (!KEY_BACKINGS.includes(backing)) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', error: 'keyBacking invalid' };
  }
  let thumbprint;
  try {
    thumbprint = await jwkThumbprint(publicKeyJwk);
  } catch {
    return { ok: false, status: 400, code: 'BAD_REQUEST', error: 'publicKeyJwk invalid' };
  }
  const stepKey = { kty: 'EC', crv: 'P-256', x: publicKeyJwk.x, y: publicKeyJwk.y, kid: thumbprint, keyBacking: backing };
  const updated = await updateDevice(device.id, { step_key_jwk: stepKey, step_key_enrolled_via: 'interactive' });
  if (!updated) return { ok: false, status: 500, code: 'INTERNAL', error: 'Could not store step-up key' };
  await authSessionService.recordSecurityEvent({
    userId,
    deviceRowId: device.id,
    sessionId: sessionRow.id,
    type: 'step_up_key_enrolled',
    meta: { keyBacking: backing },
  });
  return { ok: true };
}

/** Insert a fresh challenge row; returns `{ challengeId, challenge, expiresAt }`. */
async function createChallenge(purpose) {
  const challengeId = crypto.randomUUID();
  const challenge = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + authPolicy.CHALLENGE_TTL_SEC * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from('AuthChallenge')
    .insert({ id: challengeId, purpose, challenge, expires_at: expiresAt });
  if (error) {
    logger.error('auth.challenge.insert_failed', { purpose, error: error.message });
    return null;
  }
  return { challengeId, challenge, expiresAt };
}

/** Atomically take a challenge (delete + return); null if missing/expired/wrong purpose. */
async function consumeChallenge(challengeId, purpose) {
  if (typeof challengeId !== 'string' || !challengeId) return null;
  const { data, error } = await supabaseAdmin
    .from('AuthChallenge')
    .delete()
    .eq('id', challengeId)
    .eq('purpose', purpose)
    .select('id, purpose, challenge, expires_at');
  if (error) {
    logger.warn('auth.challenge.consume_failed', { challengeId, error: error.message });
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.challenge) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row;
}

/** ES256 (P-256/SHA-256) verify of `signatureB64url` (raw r||s) over `data`. */
function verifyEs256Raw(jwk, data, signatureB64url) {
  try {
    const sig = Buffer.from(String(signatureB64url), 'base64url');
    if (sig.length !== 64) return false;
    const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y }, format: 'jwk' });
    return crypto.verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, sig);
  } catch {
    return false;
  }
}

/**
 * POST /api/auth/step-up {method:'device_key'}: signature over the raw
 * challenge bytes with the device's interactively-enrolled step-up key, from an
 * interactive session on that device.
 * @returns {Promise<{ok:true, deviceRow:object}|{ok:false, reason:string}>}
 */
async function verifyStepUpDeviceKey({ userId, sessionRow, challengeId, signature }) {
  if (!sessionRow || !sessionRow.device_id) return { ok: false, reason: 'unbound' };
  if (sessionRow.user_id !== userId) return { ok: false, reason: 'session_user' };
  if (!isInteractiveContext(sessionRow.context)) return { ok: false, reason: 'restored_session' };
  const device = await getDevice(sessionRow.device_id);
  if (!device || device.user_id !== userId || device.revoked_at) return { ok: false, reason: 'device' };
  if (!device.step_key_jwk || device.step_key_enrolled_via !== 'interactive') return { ok: false, reason: 'no_step_key' };
  const challenge = await consumeChallenge(challengeId, 'step_up');
  if (!challenge) return { ok: false, reason: 'challenge' };
  const data = Buffer.from(challenge.challenge, 'base64url');
  if (!verifyEs256Raw(device.step_key_jwk, data, signature)) return { ok: false, reason: 'signature' };
  return { ok: true, deviceRow: device };
}

/**
 * Flip a restored session to interactive after a real credential was shown
 * (design §7.10). The bound device becomes "trusted_at" on its first
 * interactive credential if it never was.
 */
async function promoteSessionToInteractive(sessionRow) {
  if (!sessionRow || sessionRow.context !== 'restored') return false;
  const flipped = await authSessionService.setSessionContext(sessionRow.id, 'interactive');
  if (flipped && sessionRow.device_id) {
    const device = await getDevice(sessionRow.device_id);
    if (device && !device.trusted_at && !device.revoked_at) {
      await updateDevice(device.id, { trusted_at: nowIso(), require_step_up: false });
    }
  }
  if (flipped) sessionRow.context = 'interactive';
  return flipped;
}

module.exports = {
  // descriptors / trust
  normalizeDeviceDescriptor,
  platformFromRequest,
  evaluateTrustLevel,
  isInactive,
  inactivityWindowDays,
  isInteractiveContext,
  HARDWARE_BACKINGS,
  RESUME_BACKINGS,
  // rows
  getDevice,
  findDeviceByClientId,
  updateDevice,
  listActiveDevices,
  upsertDeviceForKey,
  publicDevice,
  // issuance / refresh
  bindAtIssue,
  resolveSessionForRefresh,
  verifyRefreshProof,
  checkRefresh,
  recordRefresh,
  markReuse,
  markMismatch,
  codeForRevokedSession,
  SECURITY_MESSAGES,
  // requests
  sessionRowFromRequest,
  tokenFromRequest,
  // registry ops
  registerDevice,
  listDevices,
  revokeDevice,
  revokeOthers,
  revokeAll,
  logoutLocal,
  onPasswordChanged,
  onPasswordReset,
  onAccountDeleted,
  // prefs
  getSecurityPrefs,
  patchSecurityPrefs,
  grantEligible,
  // resume
  redeemResumeGrant,
  // step-up
  availableStepUpMethods,
  PASSWORD_FIRST_PURPOSES,
  enrolStepUpKey,
  createChallenge,
  consumeChallenge,
  verifyEs256Raw,
  verifyStepUpDeviceKey,
  promoteSessionToInteractive,
  hasPasswordProvider,
};
