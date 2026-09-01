/**
 * Residency Claim Service (Wave 1 — Residency Pass)
 *
 * Scoped, expiring, revocable residency claims: the live, minimal-
 * disclosure sibling of the residency letter. A claim attests exactly one
 * derived fact about a verified resident — "Jane Doe is a verified
 * resident of Camas School District" — behind an unguessable code, and
 * the public check re-verifies AT VIEW TIME that the issuer still holds
 * verified occupancy of the home.
 *
 * Trust model:
 *   issue    — route enforces T4 (verified occupancy). The statement is
 *              derived server-side from the Home row and the cached civic
 *              district resolution, frozen at issue; the client only picks
 *              a scope and a lifetime.
 *   verify   — GET /api/public/residency-claims/:code returns the frozen
 *              statement plus a LIVE status: active only while the claim
 *              is unrevoked, unexpired, AND the issuer's occupancy is
 *              still verified. Nothing beyond the statement is ever
 *              disclosed — only the `address` scope contains the street
 *              address, by construction.
 *   audit    — every public view is logged (timestamp + trimmed UA) and
 *              surfaced to the issuer, who can revoke with one tap.
 *   privacy  — claims are personal documents scoped to the issuing user,
 *              exactly like letters. Scopes are coarser than the address,
 *              so a claim can never narrow a household below what the
 *              address itself reveals.
 */

const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { generateLetterCode, normalizeLetterCode, addressLine1FromHome, webBaseUrl, residentNameFromUser } = require('./residencyLetterService');
const { getActiveOccupancy } = require('../utils/homePermissions');
const { composeCivicDistricts } = require('./placeSectionAdapters');

const CLAIM_SCOPES = ['address', 'city', 'county', 'state', 'school_district', 'congressional_district'];
const EXPIRY_DAYS_CHOICES = [1, 7, 30, 90];
const DEFAULT_EXPIRY_DAYS = 30;
const USER_AGENT_MAX_LEN = 200;
// Per-claim ceiling on stored audit rows; view_count keeps counting past it.
const ACCESS_LOG_ROW_CAP = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'the District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

function stateName(abbr) {
  const key = String(abbr || '').trim().toUpperCase();
  return STATE_NAMES[key] || (key || null);
}

function claimVerifyUrl(code) {
  return `${webBaseUrl()}/verify-claim/${code}`;
}

/** Error whose `code` the route maps to a 4xx instead of a 500. */
class ClaimError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// The letters service owns the display-name derivation — one definition,
// so a claim and a letter can never disagree about who someone is.
const holderNameFromUser = residentNameFromUser;

/**
 * The civic districts for a home, from the (90-day-cached) adapter.
 * Returns [] when the lookup is unavailable — scope derivation then
 * fails closed with SCOPE_UNAVAILABLE rather than guessing.
 */
async function districtsForHome(home) {
  try {
    const [section] = await composeCivicDistricts(home);
    const data = section && section.data;
    return (data && Array.isArray(data.districts)) ? data.districts : [];
  } catch (err) {
    logger.warn('residencyClaim: district lookup failed', { homeId: home.id, error: err.message });
    return [];
  }
}

function districtName(districts, level) {
  const row = districts.find((d) => d && d.level === level && d.name);
  return row ? row.name : null;
}

/**
 * Derive the frozen claim statement for a scope. Throws SCOPE_UNAVAILABLE
 * when the underlying fact cannot be resolved for this home — a claim is
 * never issued on a guess.
 * @returns {{ statement: string, subject: string }} subject = the bare
 *   fact ("Camas School District") for UI labels.
 */
function deriveStatement({ scope, holderName, home, districts }) {
  const is = `${holderName} is a verified resident of`;
  switch (scope) {
    case 'address': {
      const line1 = addressLine1FromHome(home);
      const cityState = [home.city, home.state].filter(Boolean).join(', ');
      const subject = [line1, cityState, home.zipcode].filter(Boolean).join(', ');
      if (!line1) throw new ClaimError('This home has no street address on file.', 'SCOPE_UNAVAILABLE');
      return { statement: `${is} ${subject}.`, subject };
    }
    case 'city': {
      if (!home.city || !home.state) throw new ClaimError('This home has no city on file.', 'SCOPE_UNAVAILABLE');
      const subject = `${home.city}, ${home.state}`;
      return { statement: `${is} ${subject}.`, subject };
    }
    case 'state': {
      const name = stateName(home.state);
      if (!name) throw new ClaimError('This home has no state on file.', 'SCOPE_UNAVAILABLE');
      // DC is not a state — its map entry already reads "the District of
      // Columbia", so it takes no "the state of" prefix.
      const isDc = String(home.state).trim().toUpperCase() === 'DC';
      return { statement: isDc ? `${is} ${name}.` : `${is} the state of ${name}.`, subject: name };
    }
    case 'county': {
      const county = districtName(districts, 'county');
      if (!county) throw new ClaimError('We could not resolve this home\'s county.', 'SCOPE_UNAVAILABLE');
      const subject = [county, home.state].filter(Boolean).join(', ');
      return { statement: `${is} ${subject}.`, subject };
    }
    case 'school_district': {
      const school = districtName(districts, 'school');
      if (!school) throw new ClaimError('We could not resolve this home\'s school district.', 'SCOPE_UNAVAILABLE');
      return { statement: `${is} ${school}.`, subject: school };
    }
    case 'congressional_district': {
      const cd = districtName(districts, 'federal');
      if (!cd) throw new ClaimError('We could not resolve this home\'s congressional district.', 'SCOPE_UNAVAILABLE');
      return { statement: `${holderName} is a verified resident within ${cd}.`, subject: cd };
    }
    default:
      throw new ClaimError('Unknown claim scope.', 'BAD_SCOPE');
  }
}

/** True when this scope's statement would need the civic-district lookup. */
function scopeNeedsDistricts(scope) {
  return scope === 'county' || scope === 'school_district' || scope === 'congressional_district';
}

// Effective status is derived — a stored 'active' can still be expired.
function effectiveStatus(row, now = new Date()) {
  if (row.status === 'revoked') return 'revoked';
  if (row.expires_at && new Date(row.expires_at) <= now) return 'expired';
  return 'active';
}

function serializeClaim(row) {
  return {
    id: row.id,
    home_id: row.home_id,
    scope: row.scope,
    statement: row.statement,
    holder_name: row.holder_name,
    status: effectiveStatus(row),
    claim_code: row.claim_code,
    verify_url: claimVerifyUrl(row.claim_code),
    issued_at: row.issued_at,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    residency_verified_at: row.residency_verified_at,
    view_count: row.view_count || 0,
    last_viewed_at: row.last_viewed_at,
  };
}

// ── Lifecycle ────────────────────────────────────────────────

/**
 * When did this resident's postcard verification actually happen?
 * HomeOccupancy carries only the STATUS; the timestamp lives on the
 * postcard row. Null when verification came through a non-postcard
 * path (household approval, legacy backfill) — the freshness stamp is
 * informational, so absent beats wrong.
 */
async function residencyVerifiedAt(homeId, userId) {
  const { data, error } = await supabaseAdmin
    .from('HomePostcardCode')
    .select('verified_at')
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .eq('status', 'verified')
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.verified_at || null;
}

/**
 * Issue a claim for the (already T4-gated) resident of a home.
 */
async function issueClaim({ homeId, userId, scope, expiresInDays }) {
  if (!CLAIM_SCOPES.includes(scope)) throw new ClaimError('Unknown claim scope.', 'BAD_SCOPE');
  const days = expiresInDays === undefined || expiresInDays === null
    ? DEFAULT_EXPIRY_DAYS
    : Number(expiresInDays);
  if (!EXPIRY_DAYS_CHOICES.includes(days)) {
    throw new ClaimError(`Expiry must be one of ${EXPIRY_DAYS_CHOICES.join(', ')} days.`, 'BAD_EXPIRY');
  }

  const [{ data: home, error: homeErr }, { data: user, error: userErr }] = await Promise.all([
    supabaseAdmin.from('Home').select('id, address, address2, city, state, zipcode, map_center_lat, map_center_lng').eq('id', homeId).maybeSingle(),
    supabaseAdmin.from('User').select('id, first_name, last_name, name, username').eq('id', userId).maybeSingle(),
  ]);
  if (homeErr || !home) throw new Error('Home not found');
  if (userErr || !user) throw new Error('User not found');

  const holderName = holderNameFromUser(user);
  const [districts, verifiedAt] = await Promise.all([
    scopeNeedsDistricts(scope) ? districtsForHome(home) : Promise.resolve([]),
    residencyVerifiedAt(homeId, userId),
  ]);
  const { statement } = deriveStatement({ scope, holderName, home, districts });

  // ONE instant for both stamps: taking Date.now() twice made the claim's
  // lifetime a millisecond or two short of the duration the resident
  // picked, and made the span non-deterministic under load.
  const issuedAt = new Date();
  const nowIso = issuedAt.toISOString();
  const row = {
    id: crypto.randomUUID(),
    home_id: homeId,
    user_id: userId,
    claim_code: generateLetterCode(),
    scope,
    statement,
    holder_name: holderName,
    status: 'active',
    issued_at: nowIso,
    expires_at: new Date(issuedAt.getTime() + days * DAY_MS).toISOString(),
    residency_verified_at: verifiedAt,
  };

  const { data: saved, error } = await supabaseAdmin.from('ResidencyClaim').insert(row).select().single();
  if (error) {
    logger.error('residencyClaim: insert failed', { homeId, userId, error: error.message });
    throw new Error('Could not save the claim');
  }
  logger.info('residencyClaim: issued', { claimId: saved.id, homeId, userId, scope });
  return serializeClaim(saved);
}

/** The caller's claims for a home, newest first. */
async function listClaims({ homeId, userId }) {
  const { data, error } = await supabaseAdmin
    .from('ResidencyClaim')
    .select('id, home_id, scope, statement, holder_name, status, claim_code, issued_at, expires_at, revoked_at, residency_verified_at, view_count, last_viewed_at')
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .order('issued_at', { ascending: false });
  if (error) {
    logger.error('residencyClaim: list failed', { homeId, userId, error: error.message });
    throw new Error('Could not load claims');
  }
  return (data || []).map(serializeClaim);
}

/** The audit trail for one claim — issuer only. Null when not yours. */
async function listClaimViews({ homeId, userId, claimId, limit = 50 }) {
  const { data: claim, error: claimErr } = await supabaseAdmin
    .from('ResidencyClaim')
    .select('id')
    .eq('id', claimId)
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .maybeSingle();
  if (claimErr || !claim) return null;

  const { data, error } = await supabaseAdmin
    .from('ResidencyClaimAccess')
    .select('viewed_at, user_agent')
    .eq('claim_id', claimId)
    .order('viewed_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error('residencyClaim: views failed', { claimId, error: error.message });
    throw new Error('Could not load the view log');
  }
  return (data || []).map((v) => ({ viewed_at: v.viewed_at, user_agent: v.user_agent }));
}

/** Revoke — issuer only. Returns the updated claim, or null when not found/not yours. */
async function revokeClaim({ homeId, userId, claimId }) {
  const { data, error } = await supabaseAdmin
    .from('ResidencyClaim')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', claimId)
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .select()
    .maybeSingle();
  if (error) {
    logger.error('residencyClaim: revoke failed', { claimId, error: error.message });
    throw new Error('Could not revoke the claim');
  }
  return data ? serializeClaim(data) : null;
}

/**
 * The LIVE occupancy re-check: is the issuer still an active, verified
 * occupant of the home the claim points at? Liveness (is_active + time
 * windows) is homePermissions' getActiveOccupancy — the one copy of
 * that rule — with the verification check on top.
 */
async function isStillVerifiedResident(homeId, userId) {
  const occ = await getActiveOccupancy(homeId, userId);
  return Boolean(occ && occ.verification_status === 'verified');
}

/**
 * Public verification by code. Returns the frozen statement plus a LIVE
 * status; logs the view for the issuer's audit trail. Unknown or
 * malformed codes are a uniform { valid: false } (no existence oracle).
 */
async function verifyClaimByCode(code, { userAgent } = {}) {
  const normalized = normalizeLetterCode(code);
  if (!normalized) return { valid: false };

  const { data, error } = await supabaseAdmin
    .from('ResidencyClaim')
    .select('id, home_id, user_id, scope, statement, holder_name, status, issued_at, expires_at, revoked_at, residency_verified_at, view_count')
    .eq('claim_code', normalized)
    .maybeSingle();
  if (error || !data) return { valid: false };

  let status = effectiveStatus(data);
  if (status === 'active' && !(await isStillVerifiedResident(data.home_id, data.user_id))) {
    status = 'no_longer_verified';
  }

  // Audit trail + denormalized counters (best-effort; the read result is
  // what matters). Every view is logged, whatever the status — the issuer
  // should see checks against a revoked claim too. Row inserts stop past
  // a per-claim cap so an anonymous bot polling a code cannot grow the
  // table forever (view_count keeps counting; the cap costs no extra
  // query because the count is already on the row we just read).
  const nowIso = new Date().toISOString();
  const ua = userAgent ? String(userAgent).slice(0, USER_AGENT_MAX_LEN) : null;
  if ((data.view_count || 0) < ACCESS_LOG_ROW_CAP) {
    supabaseAdmin
      .from('ResidencyClaimAccess')
      .insert({ id: crypto.randomUUID(), claim_id: data.id, viewed_at: nowIso, user_agent: ua })
      .then(({ error: insErr }) => {
        if (insErr) logger.warn('residencyClaim: access log failed', { error: insErr.message });
      });
  }
  supabaseAdmin
    .from('ResidencyClaim')
    .update({ view_count: (data.view_count || 0) + 1, last_viewed_at: nowIso })
    .eq('id', data.id)
    .then(({ error: updErr }) => {
      if (updErr) logger.warn('residencyClaim: view_count update failed', { error: updErr.message });
    });

  // Revocation must actually pull the content (the FridgeCard rule).
  // A non-active claim discloses its status and nothing else: the
  // statement is name + street address for the address scope, and a
  // code that sat in someone's chat history must not keep disclosing
  // PII after the resident hit revoke — or after expiry did it for them.
  if (status !== 'active') {
    return {
      valid: true,
      status,
      scope: data.scope,
      issued_at: data.issued_at,
      expires_at: data.expires_at,
      revoked_at: data.revoked_at,
    };
  }

  return {
    valid: true,
    status,
    scope: data.scope,
    statement: data.statement,
    holder_name: data.holder_name,
    issued_at: data.issued_at,
    expires_at: data.expires_at,
    revoked_at: data.revoked_at,
    residency_verified_at: data.residency_verified_at,
  };
}

module.exports = {
  issueClaim,
  listClaims,
  listClaimViews,
  revokeClaim,
  verifyClaimByCode,
  ClaimError,
  CLAIM_SCOPES,
  EXPIRY_DAYS_CHOICES,
  // Exported for testing.
  deriveStatement,
  effectiveStatus,
  stateName,
  scopeNeedsDistricts,
};
