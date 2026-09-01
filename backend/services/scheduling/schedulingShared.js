// ============================================================
// Calendarly — shared helpers: owner resolution, access control, token + email helpers.
// The scheduling engine is owner-polymorphic ((owner_type, owner_id)); this module is the one
// place that maps an owner to its typed FK columns and enforces who may manage it.
// ============================================================

const crypto = require('crypto');
const supabaseAdmin = require('../../config/supabaseAdmin');
const { hasPermission } = require('../../utils/homePermissions');
const logger = require('../../utils/logger');

const OWNER_TYPES = ['user', 'home', 'business'];

/** Map an owner to the typed FK columns used by every owner-scoped table. */
function ownerColumns(ownerType, ownerId) {
  if (ownerType === 'home') {
    return { owner_type: 'home', owner_id: ownerId, owner_user_id: null, home_id: ownerId };
  }
  // user | business — owner_id is a User id in both cases
  return { owner_type: ownerType, owner_id: ownerId, owner_user_id: ownerId, home_id: null };
}

/**
 * Resolve the owner context from a request (query or body), defaulting to the personal pillar.
 * Home is normally addressed via /api/homes/:id/scheduling (homeId from params).
 */
function resolveOwner(req) {
  // Mounted at /api/homes/:homeId/scheduling — a distinct param name so inner :id routes
  // (e.g. /bookings/:id) don't clobber the home id under mergeParams.
  const homeIdParam = req.params && req.params.homeId;
  if (homeIdParam) {
    return { ownerType: 'home', ownerId: homeIdParam };
  }
  const src = { ...(req.query || {}), ...(req.body || {}) };
  const ownerType = src.owner_type || 'user';
  if (!OWNER_TYPES.includes(ownerType)) {
    const err = new Error(`Invalid owner_type: ${ownerType}`);
    err.statusCode = 400;
    throw err;
  }
  if (ownerType === 'user') return { ownerType: 'user', ownerId: req.user.id };
  if (ownerType === 'home') {
    if (!src.owner_id) {
      const err = new Error('owner_id (home id) required for home owner_type');
      err.statusCode = 400;
      throw err;
    }
    return { ownerType: 'home', ownerId: src.owner_id };
  }
  // business
  if (!src.owner_id) {
    const err = new Error('owner_id (business user id) required for business owner_type');
    err.statusCode = 400;
    throw err;
  }
  return { ownerType: 'business', ownerId: src.owner_id };
}

/**
 * Can `userId` manage scheduling for this owner? `level` is 'view' or 'edit'.
 * @returns {Promise<boolean>}
 */
async function canManageOwner(ownerType, ownerId, userId, level = 'edit') {
  if (!userId) return false;
  if (ownerType === 'user') return ownerId === userId;
  if (ownerType === 'home') {
    return hasPermission(ownerId, userId, level === 'edit' ? 'calendar.edit' : 'calendar.view');
  }
  if (ownerType === 'business') {
    if (ownerId === userId) return true; // the business owner
    const { data } = await supabaseAdmin
      .from('BusinessTeam')
      .select('id, role_base')
      .eq('business_user_id', ownerId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    return !!data;
  }
  return false;
}

/** Throws a 403 if the user cannot manage the owner. */
async function assertCanManageOwner(ownerType, ownerId, userId, level = 'edit') {
  const ok = await canManageOwner(ownerType, ownerId, userId, level);
  if (!ok) {
    const err = new Error('You do not have permission to manage scheduling for this owner.');
    err.statusCode = 403;
    throw err;
  }
}

// ---------- tokens (mirrors backend/routes/businessSeats.js) ----------

function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashEmail(email) {
  return crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

/** Is this email on the reminder-suppression list? (transactional confirmations are always sent.) */
/** Suppression is owner-scoped (see the unsubscribe route) — always pass the booking's owner. */
async function isEmailSuppressed(email, ownerType, ownerId) {
  if (!email || !ownerType || !ownerId) return false;
  const { data } = await supabaseAdmin
    .from('EmailSuppression')
    .select('id')
    .eq('email_hash', hashEmail(email))
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .maybeSingle();
  return !!data;
}

module.exports = {
  OWNER_TYPES,
  ownerColumns,
  resolveOwner,
  canManageOwner,
  assertCanManageOwner,
  generateToken,
  hashToken,
  normalizeEmail,
  hashEmail,
  isEmailSuppressed,
};
