// ============================================================
// /api/auth — trusted devices, sessions, resume, step-up
// (docs/persistent-login/CONTRACT.md "New router").
//
//   POST   /challenge                none (30/15m/IP)
//   POST   /devices/register         Bearer + DPoP (thumbprint == bound key)
//   GET    /devices                  Bearer
//   DELETE /devices/:id              Bearer + X-Step-Up(revoke_device)
//   POST   /sessions/revoke-others   Bearer + X-Step-Up(revoke_sessions)
//   POST   /sessions/revoke-all      Bearer + X-Step-Up(revoke_sessions)
//   POST   /resume                   none (5/15m/IP + per grant) + DPoP
//   POST   /step-up                  Bearer (10/15m/user)
//   POST   /step-up-key              Bearer + DPoP (bound key), interactive session
//   GET    /security-prefs           Bearer
//   PATCH  /security-prefs           Bearer + X-Step-Up(change_security_prefs)
//   GET    /security-events          Bearer
//
// verifyToken enforces CSRF for cookie transport; Bearer (native) skips it.
// Nothing here creates or rotates a device binding.
// ============================================================

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const { requireDpop } = require('../middleware/dpop');
const { requireStepUp, mintStepUpToken, PURPOSES } = require('../middleware/stepUp');
const authDeviceService = require('../services/authDeviceService');
const authSessionService = require('../services/authSessionService');

const router = express.Router();

// ---------------------------------------------------------------------------
// Rate limiters (in-memory, same style as routes/users.js; move to a shared
// store before flipping AUTH_DEVICE_BINDING=required on a multi-instance fleet)
// ---------------------------------------------------------------------------

const WINDOW_15M = 15 * 60 * 1000;

const challengeLimiter = rateLimit({
  windowMs: WINDOW_15M,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
});

const resumeIpLimiter = rateLimit({
  windowMs: WINDOW_15M,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many resume attempts. Please sign in again.', code: 'RATE_LIMITED' },
});

const resumeGrantLimiter = rateLimit({
  windowMs: WINDOW_15M,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const grant = typeof req.body?.grant === 'string' ? req.body.grant : '';
    return grant ? `grant:${crypto.createHash('sha256').update(grant).digest('base64url').slice(0, 24)}` : `ip:${req.ip}`;
  },
  message: { error: 'Too many resume attempts. Please sign in again.', code: 'RATE_LIMITED' },
});

const stepUpLimiter = rateLimit({
  windowMs: WINDOW_15M,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many verification attempts. Please try again later.', code: 'RATE_LIMITED' },
});

const registerLimiter = rateLimit({
  windowMs: WINDOW_15M,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many device registrations. Please try again later.', code: 'RATE_LIMITED' },
});

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const deviceSchema = Joi.object({
  deviceId: Joi.string().uuid().required(),
  platform: Joi.string().valid('ios', 'android').required(),
  installId: Joi.string().pattern(/^[a-zA-Z0-9_-]{8,64}$/).allow(null, ''),
  name: Joi.string().max(120).allow(null, ''),
  model: Joi.string().max(120).allow(null, ''),
  osVersion: Joi.string().max(64).allow(null, ''),
  appVersion: Joi.string().max(64).allow(null, ''),
  hasOsLock: Joi.boolean(),
  keyBacking: Joi.string().valid('secure_enclave', 'strongbox', 'tee', 'software'),
  attestation: Joi.object().unknown(true).allow(null),
}).unknown(false);

const challengeSchema = Joi.object({
  purpose: Joi.string().valid('step_up', 'resume', 'attestation').required(),
});

const registerSchema = Joi.object({
  device: deviceSchema.required(),
  pushToken: Joi.string().max(4096).allow(null, ''),
  pushProvider: Joi.string().valid('fcm', 'apns').allow(null, ''),
});

const resumeSchema = Joi.object({
  grant: Joi.string().min(32).max(128).required(),
  device: deviceSchema.required(),
});

const stepUpSchema = Joi.object({
  purpose: Joi.string().valid(...PURPOSES).required(),
  method: Joi.string().valid('password', 'device_key').required(),
  password: Joi.string().min(1).max(128).when('method', { is: 'password', then: Joi.required(), otherwise: Joi.forbidden() }),
  challengeId: Joi.string().uuid().when('method', { is: 'device_key', then: Joi.required(), otherwise: Joi.forbidden() }),
  signature: Joi.string().min(40).max(200).when('method', { is: 'device_key', then: Joi.required(), otherwise: Joi.forbidden() }),
});

const stepUpKeySchema = Joi.object({
  publicKeyJwk: Joi.object({
    kty: Joi.string().valid('EC').required(),
    crv: Joi.string().valid('P-256').required(),
    x: Joi.string().max(64).required(),
    y: Joi.string().max(64).required(),
  }).unknown(false).required(),
  keyBacking: Joi.string().valid('secure_enclave', 'strongbox', 'tee', 'software').required(),
});

const securityPrefsSchema = Joi.object({
  allowRestoreGrants: Joi.boolean(),
  newDeviceEmail: Joi.boolean(),
}).min(1);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attach `req.session` (id/context) and `req.sessionRow` for the token that
 * authenticated the request. Stage-2 verifyToken already sets req.session;
 * until then (and for pre-registry sessions) we decode the same JWT.
 */
async function attachSession(req, _res, next) {
  try {
    const row = await authDeviceService.sessionRowFromRequest(req);
    req.sessionRow = row || null;
    if (row) {
      req.session = { ...(req.session || {}), id: row.id, context: row.context };
    } else if (!req.session) {
      const claims = authSessionService.sessionClaimsFromAccessToken(authDeviceService.tokenFromRequest(req));
      req.session = claims?.id ? { id: claims.id, context: null } : null;
    }
  } catch (err) {
    logger.warn('auth.router.attach_session_failed', { error: err.message });
    req.sessionRow = null;
  }
  return next();
}

function sendServiceError(res, result) {
  return res.status(result.status || 400).json({ error: result.error || 'Request failed', code: result.code || 'BAD_REQUEST' });
}

const LOGIN_USER_SELECT = `
  id, email, username, name, first_name, middle_name, last_name, phone_number,
  address, city, state, zipcode, account_type, role, verified, created_at
`;

/** Same user shape as POST /api/users/login. */
async function loadLoginUser(userId, fallbackEmail) {
  const { data, error } = await supabaseAdmin
    .from('User')
    .select(LOGIN_USER_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return { id: userId, email: fallbackEmail || null };
  return {
    id: data.id,
    email: data.email,
    username: data.username,
    name: data.name,
    firstName: data.first_name,
    middleName: data.middle_name,
    lastName: data.last_name,
    phoneNumber: data.phone_number,
    address: data.address,
    city: data.city,
    state: data.state,
    zipcode: data.zipcode,
    accountType: data.account_type,
    role: data.role,
    verified: data.verified,
    createdAt: data.created_at,
  };
}

// ---------------------------------------------------------------------------
// POST /challenge
// ---------------------------------------------------------------------------
router.post('/challenge', challengeLimiter, validate(challengeSchema), async (req, res) => {
  try {
    const created = await authDeviceService.createChallenge(req.body.purpose);
    if (!created) return res.status(500).json({ error: 'Could not create challenge', code: 'INTERNAL' });
    return res.json(created);
  } catch (err) {
    logger.error('auth.challenge.error', { error: err.message });
    return res.status(500).json({ error: 'Could not create challenge', code: 'INTERNAL' });
  }
});

// ---------------------------------------------------------------------------
// POST /devices/register — metadata + push token linkage (+ Android grant).
// Never creates a binding; idempotent.
// ---------------------------------------------------------------------------
router.post(
  '/devices/register',
  verifyToken,
  registerLimiter,
  attachSession,
  validate(registerSchema),
  requireDpop(),
  async (req, res) => {
    try {
      const result = await authDeviceService.registerDevice({
        userId: req.user.id,
        sessionRow: req.sessionRow,
        dpop: req.dpop,
        device: req.body.device,
        pushToken: req.body.pushToken || null,
        pushProvider: req.body.pushProvider || null,
        req,
      });
      if (!result.ok) return sendServiceError(res, result);
      const body = { device: result.device };
      if (result.resumeGrant) body.resumeGrant = result.resumeGrant;
      return res.json(body);
    } catch (err) {
      logger.error('auth.register.error', { userId: req.user?.id, error: err.message, stack: err.stack });
      return res.status(500).json({ error: 'Could not register device', code: 'INTERNAL' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /devices
// ---------------------------------------------------------------------------
router.get('/devices', verifyToken, attachSession, async (req, res) => {
  try {
    const out = await authDeviceService.listDevices(req.user.id, req.session?.id || null);
    return res.json(out);
  } catch (err) {
    logger.error('auth.devices.list_error', { userId: req.user?.id, error: err.message });
    return res.status(500).json({ error: 'Could not load devices', code: 'INTERNAL' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /devices/:id
// ---------------------------------------------------------------------------
router.delete('/devices/:id', verifyToken, attachSession, requireStepUp('revoke_device'), async (req, res) => {
  const deviceRowId = String(req.params.id || '');
  if (!authSessionService.isUuid(deviceRowId)) {
    return res.status(400).json({ error: 'Invalid device id', code: 'BAD_REQUEST' });
  }
  try {
    const result = await authDeviceService.revokeDevice({
      userId: req.user.id,
      deviceRowId,
      reason: 'user',
      req,
      actorSessionId: req.session?.id || null,
    });
    if (!result.ok) return sendServiceError(res, result);
    return res.json({ ok: true, revokedSessions: result.revokedSessions });
  } catch (err) {
    logger.error('auth.devices.revoke_error', { userId: req.user?.id, error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Could not remove device', code: 'INTERNAL' });
  }
});

// ---------------------------------------------------------------------------
// POST /sessions/revoke-others
// ---------------------------------------------------------------------------
router.post('/sessions/revoke-others', verifyToken, attachSession, requireStepUp('revoke_sessions'), async (req, res) => {
  try {
    const result = await authDeviceService.revokeOthers({
      userId: req.user.id,
      currentSessionId: req.session?.id || null,
      accessToken: authDeviceService.tokenFromRequest(req),
      req,
    });
    return res.json({ revoked: result.revoked });
  } catch (err) {
    logger.error('auth.sessions.revoke_others_error', { userId: req.user?.id, error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Could not sign out other devices', code: 'INTERNAL' });
  }
});

// ---------------------------------------------------------------------------
// POST /sessions/revoke-all (Lockdown) — the client signs itself out afterwards
// ---------------------------------------------------------------------------
router.post('/sessions/revoke-all', verifyToken, attachSession, requireStepUp('revoke_sessions'), async (req, res) => {
  try {
    await authDeviceService.revokeAll({
      userId: req.user.id,
      accessToken: authDeviceService.tokenFromRequest(req),
      req,
      reason: 'lockdown',
      eventType: 'lockdown',
    });
    // Web: the httpOnly cookies are dead server-side; clear them too.
    res.clearCookie('pantopus_access', { path: '/' });
    res.clearCookie('pantopus_refresh', { path: '/api/users/refresh' });
    res.clearCookie('pantopus_csrf', { path: '/' });
    res.clearCookie('pantopus_session', { path: '/' });
    return res.json({ ok: true });
  } catch (err) {
    logger.error('auth.sessions.revoke_all_error', { userId: req.user?.id, error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Could not sign out everywhere', code: 'INTERNAL' });
  }
});

// ---------------------------------------------------------------------------
// POST /resume — Android Block Store grant → restored session
// ---------------------------------------------------------------------------
router.post('/resume', resumeIpLimiter, resumeGrantLimiter, validate(resumeSchema), requireDpop(), async (req, res) => {
  try {
    const result = await authDeviceService.redeemResumeGrant({
      grant: req.body.grant,
      device: req.body.device,
      dpop: req.dpop,
      req,
    });
    if (!result.ok) return sendServiceError(res, result);

    const s = result.supabaseSession;
    const user = await loadLoginUser(result.sessionRow?.user_id || result.authUser?.id, result.authUser?.email);
    // Bearer transport only (native); make sure no stale cookie jar shadows the pair.
    res.clearCookie('pantopus_access', { path: '/' });
    res.clearCookie('pantopus_refresh', { path: '/api/users/refresh' });
    return res.json({
      message: 'Session restored',
      accessToken: s.access_token,
      refreshToken: s.refresh_token,
      expiresIn: s.expires_in,
      expiresAt: s.expires_at,
      user,
      sessionId: result.sessionId,
      session: { id: result.sessionId, context: 'restored' },
      device: result.device,
      resumeGrant: result.resumeGrant,
    });
  } catch (err) {
    logger.error('auth.resume.error', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Could not restore your session', code: 'INTERNAL' });
  }
});

// ---------------------------------------------------------------------------
// POST /step-up
// ---------------------------------------------------------------------------
router.post('/step-up', verifyToken, stepUpLimiter, attachSession, validate(stepUpSchema), async (req, res) => {
  const userId = req.user.id;
  const { purpose, method } = req.body;
  const sessionRow = req.sessionRow;
  const sid = req.session?.id || null;

  const refuse = async (status, error, code) => {
    const methods = await authDeviceService.availableStepUpMethods({ userId, sessionRow, purpose });
    return res.status(status).json({ error, code, purpose, methods });
  };

  try {
    if (method === 'password') {
      const email = req.user.email;
      const methods = await authDeviceService.availableStepUpMethods({ userId, sessionRow, purpose });
      if (!email || !methods.includes('password')) {
        // OAuth-only account: advertise what IS available (device_key when enrolled).
        return res.status(403).json({ error: 'Password verification is not available for this account.', code: 'STEP_UP_REQUIRED', purpose, methods });
      }
      const authClient = authSessionService.createAuthClient();
      const { data, error } = await authClient.auth.signInWithPassword({ email, password: req.body.password });
      if (error || !data?.user || !data?.session) {
        logger.warn('auth.stepup.password_failed', { userId });
        return res.status(401).json({ error: 'Invalid password', code: 'UNAUTHORIZED', purpose });
      }
      if (data.user.id !== userId) {
        return res.status(403).json({ error: 'Verification failed', code: 'FORBIDDEN', purpose });
      }
      // Drop the temporary session minted by signInWithPassword.
      let revoked = false;
      try {
        const { error: soErr } = await authClient.auth.signOut({ scope: 'local' });
        revoked = !soErr;
      } catch {
        revoked = false;
      }
      if (!revoked) await authSessionService.signOutSupabase(data.session.access_token, 'local', { source: 'stepup_temp_session', userId });

      // A real credential promotes a restored session to interactive (design §7.10).
      if (sessionRow?.context === 'restored') await authDeviceService.promoteSessionToInteractive(sessionRow);

      const minted = mintStepUpToken({ uid: userId, sid, purpose, method: 'password' });
      await authSessionService.recordSecurityEvent({ userId, sessionId: sid, deviceRowId: sessionRow?.device_id || null, type: 'step_up', req, meta: { purpose, method } });
      return res.json({ stepUpToken: minted.token, expiresAt: minted.expiresAt, purpose });
    }

    // method === 'device_key'
    if (purpose === 'generic') {
      return refuse(403, 'Biometric verification cannot be used for this action.', 'STEP_UP_REQUIRED');
    }
    if (authDeviceService.PASSWORD_FIRST_PURPOSES.includes(purpose)) {
      // Strongest-method rule: an account that has a password must use it here.
      const methods = await authDeviceService.availableStepUpMethods({ userId, sessionRow, purpose });
      if (!methods.includes('device_key')) {
        return res.status(403).json({ error: 'Please verify your password for this action.', code: 'STEP_UP_REQUIRED', purpose, methods });
      }
    }
    const check = await authDeviceService.verifyStepUpDeviceKey({
      userId,
      sessionRow,
      challengeId: req.body.challengeId,
      signature: req.body.signature,
    });
    if (!check.ok) {
      logger.warn('auth.stepup.device_key_failed', { userId, reason: check.reason });
      if (['challenge', 'signature'].includes(check.reason)) {
        return res.status(401).json({ error: 'Verification failed', code: 'UNAUTHORIZED', purpose });
      }
      return refuse(403, 'Biometric verification is not available for this session.', 'STEP_UP_REQUIRED');
    }
    const minted = mintStepUpToken({ uid: userId, sid, purpose, method: 'device_key' });
    await authSessionService.recordSecurityEvent({ userId, sessionId: sid, deviceRowId: check.deviceRow?.id || null, type: 'step_up', req, meta: { purpose, method } });
    return res.json({ stepUpToken: minted.token, expiresAt: minted.expiresAt, purpose });
  } catch (err) {
    logger.error('auth.stepup.error', { userId, error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Verification failed', code: 'INTERNAL' });
  }
});

// ---------------------------------------------------------------------------
// POST /step-up-key
// ---------------------------------------------------------------------------
router.post('/step-up-key', verifyToken, attachSession, validate(stepUpKeySchema), requireDpop(), async (req, res) => {
  try {
    const result = await authDeviceService.enrolStepUpKey({
      userId: req.user.id,
      sessionRow: req.sessionRow,
      dpop: req.dpop,
      publicKeyJwk: req.body.publicKeyJwk,
      keyBacking: req.body.keyBacking,
    });
    if (!result.ok) return sendServiceError(res, result);
    return res.json({ ok: true });
  } catch (err) {
    logger.error('auth.stepup_key.error', { userId: req.user?.id, error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Could not enrol step-up key', code: 'INTERNAL' });
  }
});

// ---------------------------------------------------------------------------
// GET / PATCH /security-prefs
// ---------------------------------------------------------------------------
router.get('/security-prefs', verifyToken, async (req, res) => {
  try {
    const prefs = await authDeviceService.getSecurityPrefs(req.user.id);
    return res.json(prefs);
  } catch (err) {
    logger.error('auth.prefs.get_error', { userId: req.user?.id, error: err.message });
    return res.status(500).json({ error: 'Could not load security preferences', code: 'INTERNAL' });
  }
});

router.patch(
  '/security-prefs',
  verifyToken,
  attachSession,
  requireStepUp('change_security_prefs'),
  validate(securityPrefsSchema),
  async (req, res) => {
    try {
      const prefs = await authDeviceService.patchSecurityPrefs(req.user.id, req.body);
      if (!prefs) return res.status(500).json({ error: 'Could not save security preferences', code: 'INTERNAL' });
      await authSessionService.recordSecurityEvent({ userId: req.user.id, sessionId: req.session?.id || null, type: 'security_prefs_changed', req, meta: req.body });
      return res.json(prefs);
    } catch (err) {
      logger.error('auth.prefs.patch_error', { userId: req.user?.id, error: err.message });
      return res.status(500).json({ error: 'Could not save security preferences', code: 'INTERNAL' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /security-events?limit=50
// ---------------------------------------------------------------------------
router.get('/security-events', verifyToken, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, Number.parseInt(String(req.query.limit || '50'), 10) || 50));
    const events = await authSessionService.listSecurityEvents(req.user.id, limit);
    return res.json({
      events: events.map((e) => ({ id: e.id, type: e.type, createdAt: e.created_at, deviceId: e.device_id || null, sessionId: e.session_id || null, meta: e.meta || null })),
    });
  } catch (err) {
    logger.error('auth.events.error', { userId: req.user?.id, error: err.message });
    return res.status(500).json({ error: 'Could not load security events', code: 'INTERNAL' });
  }
});

module.exports = router;
