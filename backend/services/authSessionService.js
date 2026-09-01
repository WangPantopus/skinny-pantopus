// ============================================================
// authSessionService — low-level session/grant primitives for persistent login
// (design §4/§5/§10). Owns:
//   * JWT payload decoding (session_id / iat) — no verification, callers must
//     only decode tokens that verifyToken / getUser already accepted
//   * AuthSession rows (insert / lookup / revoke), refresh-token hashing
//   * Supabase admin sign-out scopes + the User.sessions_valid_after watermark
//   * mintSessionForUser via admin.generateLink(magiclink) + verifyOtp
//   * resume grants (mint / find / consume / revoke)
//   * AuthSecurityEvent rows
//   * `authEvents` emitter — 'session_revoked' {userId, sessionIds, reason}
//     (socket/chatSocketio.js subscribes in stage 2 to kick sockets)
//
// Everything is service_role (supabaseAdmin). No route logic here.
// ============================================================

const crypto = require('crypto');
const net = require('net');
const { EventEmitter } = require('events');
const supabaseAdmin = require('../config/supabaseAdmin');
const { createServerSupabaseClient } = require('../config/supabaseClient');
const logger = require('../utils/logger');
const authPolicy = require('../config/authPolicy');

const authEvents = new EventEmitter();
authEvents.setMaxListeners(50);

const SUPABASE_AUTH_CLIENT_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false },
};

/** Per-request anon client (same pattern as routes/users.js createAuthClient). */
function createAuthClient() {
  return createServerSupabaseClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    SUPABASE_AUTH_CLIENT_OPTIONS
  );
}

// ---------------------------------------------------------------------------
// Hashing / decoding
// ---------------------------------------------------------------------------

/** sha256 base64url of a token (refresh tokens, resume grants). */
function hashToken(value) {
  return crypto.createHash('sha256').update(String(value)).digest('base64url');
}

/**
 * Decode a JWT payload WITHOUT verifying it. Only call with tokens that were
 * already accepted by supabase.auth.getUser / verifyToken.
 * @returns {object|null}
 */
function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/** `{ id: session_id, iat, exp, sub }` from an access token, or null. */
function sessionClaimsFromAccessToken(accessToken) {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;
  const id = typeof payload.session_id === 'string' ? payload.session_id : null;
  return {
    id,
    iat: typeof payload.iat === 'number' ? payload.iat : null,
    exp: typeof payload.exp === 'number' ? payload.exp : null,
    sub: typeof payload.sub === 'string' ? payload.sub : null,
    aal: typeof payload.aal === 'string' ? payload.aal : null,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * The caller's IP, or null when it is not one.
 *
 * SECURITY/INTEGRITY: `req.ip` is derived from `X-Forwarded-For` whenever
 * `trust proxy` is on, and neither Express nor proxy-addr validates the hop it
 * picks — it hands back whatever token stood there ("unknown", which some CDNs
 * emit, or anything a client can plant when the configured hop count is larger
 * than the real proxy chain). `AuthSession.last_ip`, `AuthDevice.last_ip` and
 * `AuthSecurityEvent.ip` are `inet` columns, so a non-address value makes the
 * whole write fail with 22P02 — silently losing the session row, the rotation
 * hashes or the security event. Store only what Postgres will accept.
 */
function clientIp(req) {
  const raw = req?.ip;
  if (typeof raw !== 'string' || !raw) return null;
  const value = raw.split('%')[0]; // drop an IPv6 zone index (fe80::1%eth0)
  return net.isIP(value) ? value : null;
}

function userAgent(req) {
  const ua = typeof req?.get === 'function' ? req.get('user-agent') : req?.headers?.['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 512) : null;
}

// ---------------------------------------------------------------------------
// AuthSession rows
// ---------------------------------------------------------------------------

/**
 * Insert (or refresh) the AuthSession row for a freshly issued Supabase session.
 * Idempotent on id (a second /oauth/token call with the same pair updates).
 */
async function insertSession({
  id,
  userId,
  deviceRowId = null,
  context = 'interactive',
  authMethod = null,
  boundAtIssue = false,
  refreshToken = null,
  req = null,
}) {
  const row = {
    id,
    user_id: userId,
    device_id: deviceRowId,
    context,
    auth_method: authMethod,
    bound_at_issue: Boolean(boundAtIssue),
    refresh_token_hash: refreshToken ? hashToken(refreshToken) : null,
    prev_refresh_token_hash: null,
    issued_at: nowIso(),
    last_refresh_at: null,
    last_seen_at: nowIso(),
    last_ip: clientIp(req),
    user_agent: userAgent(req),
    revoked_at: null,
    revoked_reason: null,
  };
  const { data, error } = await supabaseAdmin
    .from('AuthSession')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) {
    logger.error('auth.session.insert_failed', { sessionId: id, userId, error: error.message });
    return null;
  }
  return data || row;
}

async function getSessionById(sessionId) {
  if (!sessionId) return null;
  const { data, error } = await supabaseAdmin
    .from('AuthSession')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) {
    logger.warn('auth.session.lookup_failed', { sessionId, error: error.message });
    return null;
  }
  return data || null;
}

async function findSessionByRefreshHash(hash) {
  if (!hash) return null;
  const { data, error } = await supabaseAdmin
    .from('AuthSession')
    .select('*')
    .eq('refresh_token_hash', hash)
    .maybeSingle();
  if (error) {
    logger.warn('auth.session.hash_lookup_failed', { error: error.message });
    return null;
  }
  return data || null;
}

async function findSessionByPrevRefreshHash(hash) {
  if (!hash) return null;
  const { data, error } = await supabaseAdmin
    .from('AuthSession')
    .select('*')
    .eq('prev_refresh_token_hash', hash)
    .maybeSingle();
  if (error) {
    logger.warn('auth.session.prev_hash_lookup_failed', { error: error.message });
    return null;
  }
  return data || null;
}

/** Persist the rotated pair after a successful refreshSession. */
async function recordRotation(sessionId, { oldRefreshToken, newRefreshToken, req, deviceRowId }) {
  const patch = {
    prev_refresh_token_hash: oldRefreshToken ? hashToken(oldRefreshToken) : null,
    refresh_token_hash: newRefreshToken ? hashToken(newRefreshToken) : null,
    last_refresh_at: nowIso(),
    last_seen_at: nowIso(),
    last_ip: clientIp(req),
  };
  const ua = userAgent(req);
  if (ua) patch.user_agent = ua;
  if (deviceRowId !== undefined) patch.device_id = deviceRowId;
  const { error } = await supabaseAdmin
    .from('AuthSession')
    .update(patch)
    .eq('id', sessionId);
  if (error) {
    logger.error('auth.session.rotation_persist_failed', { sessionId, error: error.message });
    return false;
  }
  return true;
}

async function touchSession(sessionId, req) {
  if (!sessionId) return;
  const { error } = await supabaseAdmin
    .from('AuthSession')
    .update({ last_seen_at: nowIso(), last_ip: clientIp(req) })
    .eq('id', sessionId);
  if (error) logger.debug('auth.session.touch_failed', { sessionId, error: error.message });
}

async function setSessionContext(sessionId, context) {
  const { error } = await supabaseAdmin
    .from('AuthSession')
    .update({ context })
    .eq('id', sessionId);
  if (error) logger.warn('auth.session.context_update_failed', { sessionId, error: error.message });
  return !error;
}

// ---------------------------------------------------------------------------
// Cached session state — verifyToken / optionalAuth / socket handshake read
// "is this session revoked?" on every request; a 15-s in-process cache keeps
// that to one AuthSession lookup per session per 15 s (design §6.4). Rows
// revoked in THIS process are evicted immediately via emitRevoked; other
// instances see the change within the TTL (accepted lag for soft reads —
// /refresh always reads the row uncached).
// ---------------------------------------------------------------------------

const SESSION_STATE_TTL_MS = 15_000;
const SESSION_STATE_MAX = 5000;
const _sessionStateCache = new Map(); // sessionId -> { value, ts }

/**
 * @returns {Promise<{known:boolean, revoked:boolean, context:string|null, row:object|null}>}
 *   `known:false` ⇒ pre-registry session (no row) or lookup failure — callers
 *   treat that as "allow" (getUser stays the authority).
 */
async function getSessionStateCached(sessionId) {
  if (!isUuid(sessionId)) return { known: false, revoked: false, context: null, row: null };
  const hit = _sessionStateCache.get(sessionId);
  if (hit && Date.now() - hit.ts <= SESSION_STATE_TTL_MS) return hit.value;
  const row = await getSessionById(sessionId);
  const value = {
    known: Boolean(row),
    revoked: Boolean(row?.revoked_at),
    context: row?.context || null,
    row: row || null,
  };
  if (_sessionStateCache.size >= SESSION_STATE_MAX && !_sessionStateCache.has(sessionId)) {
    const firstKey = _sessionStateCache.keys().next().value;
    _sessionStateCache.delete(firstKey);
  }
  _sessionStateCache.set(sessionId, { value, ts: Date.now() });
  return value;
}

/** Drop cached state for one session (or all when omitted). */
function invalidateSessionStateCache(sessionId) {
  if (sessionId === undefined) _sessionStateCache.clear();
  else _sessionStateCache.delete(sessionId);
}

function emitRevoked(userId, sessionIds, reason) {
  const ids = (sessionIds || []).filter(Boolean);
  if (ids.length === 0) return;
  ids.forEach((id) => _sessionStateCache.delete(id));
  try {
    authEvents.emit('session_revoked', { userId, sessionIds: ids, reason });
  } catch (err) {
    logger.warn('auth.session.emit_failed', { error: err.message });
  }
}

/** Revoke one AuthSession row (no-op if already revoked). Returns true if it flipped. */
async function revokeSessionRow(sessionId, reason, { userId } = {}) {
  if (!sessionId) return false;
  const { data, error } = await supabaseAdmin
    .from('AuthSession')
    .update({ revoked_at: nowIso(), revoked_reason: reason })
    .eq('id', sessionId)
    .is('revoked_at', null)
    .select('id, user_id');
  if (error) {
    logger.error('auth.session.revoke_failed', { sessionId, error: error.message });
    return false;
  }
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length > 0) emitRevoked(userId || rows[0].user_id, rows.map((r) => r.id), reason);
  return rows.length > 0;
}

/**
 * Revoke every unrevoked session of a user, optionally keeping one and/or
 * restricting to one device row. Returns the number revoked.
 */
async function revokeSessionsForUser(userId, { exceptSessionId = null, deviceRowId = undefined, reason = 'user' } = {}) {
  let query = supabaseAdmin
    .from('AuthSession')
    .update({ revoked_at: nowIso(), revoked_reason: reason })
    .eq('user_id', userId)
    .is('revoked_at', null);
  if (exceptSessionId) query = query.neq('id', exceptSessionId);
  if (deviceRowId !== undefined) query = query.eq('device_id', deviceRowId);
  const { data, error } = await query.select('id');
  if (error) {
    logger.error('auth.session.revoke_many_failed', { userId, error: error.message });
    return 0;
  }
  const ids = (data || []).map((r) => r.id);
  emitRevoked(userId, ids, reason);
  return ids.length;
}

async function revokeSessionsForDevice(deviceRowId, reason, { userId } = {}) {
  const { data, error } = await supabaseAdmin
    .from('AuthSession')
    .update({ revoked_at: nowIso(), revoked_reason: reason })
    .eq('device_id', deviceRowId)
    .is('revoked_at', null)
    .select('id, user_id');
  if (error) {
    logger.error('auth.session.revoke_device_failed', { deviceRowId, error: error.message });
    return 0;
  }
  const ids = (data || []).map((r) => r.id);
  emitRevoked(userId || data?.[0]?.user_id, ids, reason);
  return ids.length;
}

async function listActiveSessions(userId) {
  const { data, error } = await supabaseAdmin
    .from('AuthSession')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('issued_at', { ascending: false });
  if (error) {
    logger.warn('auth.session.list_failed', { userId, error: error.message });
    return [];
  }
  return data || [];
}

// ---------------------------------------------------------------------------
// Supabase admin sign-out + watermark
// ---------------------------------------------------------------------------

/**
 * supabaseAdmin.auth.admin.signOut(jwt, scope). 401/403/404 count as
 * "already gone". Returns true when GoTrue-side revocation is in effect.
 */
async function signOutSupabase(accessToken, scope = 'local', context = {}) {
  if (!accessToken || typeof accessToken !== 'string') return false;
  try {
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, scope);
    if (error) {
      const status = Number(error.status);
      if ([401, 403, 404].includes(status)) {
        logger.info('auth.session_revoke_already_invalid', { ...context, scope, status });
        return true;
      }
      logger.warn('auth.session_revoke_failed', { ...context, scope, error: error.message, status });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('auth.session_revoke_error', { ...context, scope, error: err.message });
    return false;
  }
}

/** JWTs with iat < this instant are refused by verifyToken (stage 2). */
async function setSessionsValidAfter(userId, at = new Date()) {
  const { error } = await supabaseAdmin
    .from('User')
    .update({ sessions_valid_after: at.toISOString() })
    .eq('id', userId);
  if (error) {
    logger.error('auth.watermark_failed', { userId, error: error.message });
    return false;
  }
  try {
    // verifyToken folds the watermark into its 60-s role cache; let this
    // process drop the stale entry immediately.
    authEvents.emit('watermark_updated', { userId, at: at.toISOString() });
  } catch (err) {
    logger.warn('auth.watermark_emit_failed', { error: err.message });
  }
  return true;
}

async function getSessionsValidAfter(userId) {
  const { data, error } = await supabaseAdmin
    .from('User')
    .select('sessions_valid_after')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data?.sessions_valid_after) return null;
  const d = new Date(data.sessions_valid_after);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Session minting (resume grants, later passkeys) —
// admin.generateLink({type:'magiclink'}) → verifyOtp on a per-request anon
// client, the exact pattern routes/users.js uses for verification/recovery.
// ---------------------------------------------------------------------------

async function lookupAuthUser(userId) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    return data.user;
  } catch (err) {
    logger.warn('auth.admin_get_user_failed', { userId, error: err.message });
    return null;
  }
}

/**
 * Mint a Supabase session for a user without a credential (server-verified
 * resume grant). Returns `{ session, user }` (Supabase shapes) or throws.
 * The caller decides the AuthSession context (always 'restored' for grants).
 */
async function mintSessionForUser({ userId, email }) {
  let targetEmail = email || null;
  let authUser = null;
  if (!targetEmail || userId) {
    authUser = await lookupAuthUser(userId);
    if (!authUser) throw new Error('auth user not found');
    if (authUser.banned_until && new Date(authUser.banned_until).getTime() > Date.now()) {
      throw new Error('auth user banned');
    }
    targetEmail = targetEmail || authUser.email;
  }
  if (!targetEmail) throw new Error('auth user has no email');

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    throw new Error(`generateLink failed: ${linkError?.message || 'no hashed_token'}`);
  }
  if (linkData.user?.id && userId && linkData.user.id !== userId) {
    throw new Error('generateLink returned a different user');
  }

  const authClient = createAuthClient();
  const { data, error } = await authClient.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });
  if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
    throw new Error(`verifyOtp failed: ${error?.message || 'no session'}`);
  }
  if (userId && data.user?.id && data.user.id !== userId) {
    await signOutSupabase(data.session.access_token, 'local', { source: 'mint_user_mismatch' });
    throw new Error('minted session belongs to a different user');
  }
  return { session: data.session, user: data.user || authUser };
}

// ---------------------------------------------------------------------------
// Resume grants
// ---------------------------------------------------------------------------

/**
 * Mint a new single-use resume grant for (user, device row). Any older unused
 * grant of the same device is revoked (one live grant per device).
 * @returns {Promise<{grant:string, row:object}|null>}
 */
async function mintResumeGrant(userId, deviceRowId) {
  const grant = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + authPolicy.resumeGrantDays() * 24 * 3600 * 1000).toISOString();

  if (deviceRowId) {
    await supabaseAdmin
      .from('AuthResumeGrant')
      .update({ revoked_at: nowIso() })
      .eq('user_id', userId)
      .eq('device_id', deviceRowId)
      .is('used_at', null)
      .is('revoked_at', null);
  }

  const { data, error } = await supabaseAdmin
    .from('AuthResumeGrant')
    .insert({
      user_id: userId,
      device_id: deviceRowId || null,
      grant_hash: hashToken(grant),
      created_at: nowIso(),
      expires_at: expiresAt,
      used_at: null,
      revoked_at: null,
    })
    .select('*')
    .single();
  if (error) {
    logger.error('auth.grant.mint_failed', { userId, error: error.message });
    return null;
  }
  return { grant, row: data };
}

async function findResumeGrant(grant) {
  if (typeof grant !== 'string' || grant.length < 32 || grant.length > 128) return null;
  const { data, error } = await supabaseAdmin
    .from('AuthResumeGrant')
    .select('*')
    .eq('grant_hash', hashToken(grant))
    .maybeSingle();
  if (error) {
    logger.warn('auth.grant.lookup_failed', { error: error.message });
    return null;
  }
  return data || null;
}

/** Whether a grant row can still be redeemed right now. */
function isGrantRedeemable(row, at = new Date()) {
  if (!row) return false;
  if (row.used_at) return false;
  if (row.revoked_at) return false;
  const exp = new Date(row.expires_at);
  if (Number.isNaN(exp.getTime()) || exp.getTime() <= at.getTime()) return false;
  return true;
}

/** Atomically mark a grant used; false if someone else won the race. */
async function consumeResumeGrant(rowId) {
  const { data, error } = await supabaseAdmin
    .from('AuthResumeGrant')
    .update({ used_at: nowIso() })
    .eq('id', rowId)
    .is('used_at', null)
    .is('revoked_at', null)
    .select('id');
  if (error) {
    logger.error('auth.grant.consume_failed', { rowId, error: error.message });
    return false;
  }
  return Array.isArray(data) ? data.length > 0 : Boolean(data);
}

async function revokeGrantsForUser(userId, { deviceRowId = undefined } = {}) {
  let query = supabaseAdmin
    .from('AuthResumeGrant')
    .update({ revoked_at: nowIso() })
    .eq('user_id', userId)
    .is('used_at', null)
    .is('revoked_at', null);
  if (deviceRowId !== undefined) query = query.eq('device_id', deviceRowId);
  const { data, error } = await query.select('id');
  if (error) {
    logger.error('auth.grant.revoke_failed', { userId, error: error.message });
    return 0;
  }
  return (data || []).length;
}

// ---------------------------------------------------------------------------
// Housekeeping — jobs/authRegistryPrune.js
// ---------------------------------------------------------------------------

/**
 * Delete expired DPoP jtis and challenges (both tables are append-mostly and
 * only meaningful until `expires_at`). Returns the number of rows removed.
 */
async function pruneExpiredAuthRows(now = new Date()) {
  const cutoff = now.toISOString();
  const out = { dpopJti: 0, challenges: 0 };
  const { data: jtis, error: jtiErr } = await supabaseAdmin
    .from('AuthDpopJti')
    .delete()
    .lt('expires_at', cutoff)
    .select('jti');
  if (jtiErr) logger.warn('auth.prune.jti_failed', { error: jtiErr.message });
  else out.dpopJti = Array.isArray(jtis) ? jtis.length : 0;

  const { data: chals, error: chalErr } = await supabaseAdmin
    .from('AuthChallenge')
    .delete()
    .lt('expires_at', cutoff)
    .select('id');
  if (chalErr) logger.warn('auth.prune.challenge_failed', { error: chalErr.message });
  else out.challenges = Array.isArray(chals) ? chals.length : 0;
  return out;
}

// ---------------------------------------------------------------------------
// Security events
// ---------------------------------------------------------------------------

async function recordSecurityEvent({ userId, deviceRowId = null, sessionId = null, type, req = null, meta = null }) {
  if (!userId || !type) return null;
  const row = {
    user_id: userId,
    device_id: deviceRowId,
    session_id: isUuid(sessionId) ? sessionId : null,
    type,
    ip: clientIp(req),
    user_agent: userAgent(req),
    meta: meta || null,
    created_at: nowIso(),
  };
  const { data, error } = await supabaseAdmin
    .from('AuthSecurityEvent')
    .insert(row)
    .select('*')
    .single();
  if (error) {
    logger.warn('auth.event.insert_failed', { userId, type, error: error.message });
    return null;
  }
  return data || row;
}

async function listSecurityEvents(userId, limit = 20) {
  const n = Math.max(1, Math.min(200, Number(limit) || 20));
  const { data, error } = await supabaseAdmin
    .from('AuthSecurityEvent')
    .select('id, type, created_at, device_id, session_id, meta')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(n);
  if (error) {
    logger.warn('auth.event.list_failed', { userId, error: error.message });
    return [];
  }
  return (data || []).slice(0, n);
}

module.exports = {
  authEvents,
  createAuthClient,
  hashToken,
  decodeJwtPayload,
  sessionClaimsFromAccessToken,
  isUuid,
  clientIp,
  userAgent,
  // sessions
  insertSession,
  getSessionById,
  findSessionByRefreshHash,
  findSessionByPrevRefreshHash,
  recordRotation,
  touchSession,
  setSessionContext,
  getSessionStateCached,
  invalidateSessionStateCache,
  _sessionStateCache,
  revokeSessionRow,
  revokeSessionsForUser,
  revokeSessionsForDevice,
  listActiveSessions,
  signOutSupabase,
  setSessionsValidAfter,
  getSessionsValidAfter,
  // minting
  lookupAuthUser,
  mintSessionForUser,
  // grants
  mintResumeGrant,
  findResumeGrant,
  isGrantRedeemable,
  consumeResumeGrant,
  revokeGrantsForUser,
  // events
  recordSecurityEvent,
  listSecurityEvents,
  // housekeeping
  pruneExpiredAuthRows,
};
