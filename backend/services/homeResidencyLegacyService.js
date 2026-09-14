const db = require('../config/supabaseAdmin');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const FAMILIES = Object.freeze({ renter: 'renter', tenant: 'renter', lease_resident: 'renter',
  household: 'household', member: 'household', family: 'household', roommate: 'household' });
const ROUTES = ['household_review', 'self_bootstrap', 'external_postcard', 'stale_authority_postcard'];
const MESSAGES = {
  RESIDENCY_SUBMISSION_INVALID: 'Check your relationship and residency request details, then try again.',
  RESIDENCY_ACCOUNT_UNAVAILABLE: 'Sign in again to submit your residency request.',
  HOME_NOT_FOUND: 'This Home is no longer available. Check the address again.',
  RESIDENCY_HOME_UNAVAILABLE: 'This Home cannot accept a residency request right now.',
  OWNERSHIP_FLOW_REQUIRED: 'Use ownership verification to manage your ownership request.',
  MEMBERSHIP_RENEWAL_REQUIRED: 'Your previous access needs a new household review before it can be restored.',
  RESIDENCY_ALREADY_VERIFIED: 'Your residency was already verified. Open My Homes to check current access.',
  RESIDENCY_EXISTING_REQUEST: 'Your existing request has different details. Open My Homes to review it.',
};
const CLAIM_FIELDS = ['id', 'home_id', 'user_id', 'status', 'claimed_role', 'claimed_address',
  'claimed_latitude', 'claimed_longitude', 'reviewed_by', 'reviewed_at', 'review_note',
  'created_at', 'updated_at', 'cold_start_mode', 'postcard_auto_routed', 'postcard_code_id'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nullableText = value => value === null || typeof value === 'string';
const nullableDate = value => value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
const nullableId = value => value === null || (typeof value === 'string' && UUID.test(value));
function failure(code = 'RESIDENCY_LEGACY_UNAVAILABLE', statusCode = 503) {
  return Object.assign(new Error(MESSAGES[code] || 'Could not confirm your residency request. Retry with the same details.'), { code, statusCode });
}

async function notifyReviewers(result) {
  if (result.reused || result.routing !== 'household_review') return;
  try {
    // This happens after admission committed. Recheck the exact current claim
    // and real reviewer authority; no profile/address/name lookup is needed.
    const { data, error } = await db.rpc('get_legacy_home_residency_reviewers', {
      p_home_id: result.home_id, p_actor_id: result.actor_id, p_claim_id: result.claim.id,
      p_claim_updated_at: result.claim.updated_at,
    });
    if (error || !object(data) || data.ok !== true || data.home_id !== result.home_id
      || data.actor_id !== result.actor_id || data.claim_id !== result.claim.id
      || !Array.isArray(data.reviewer_ids) || data.reviewer_ids.some(id => typeof id !== 'string'
        || !UUID.test(id) || id === result.actor_id)
      || new Set(data.reviewer_ids).size !== data.reviewer_ids.length || !data.reviewer_ids.length) return;
    await require('./notificationService').createBulkNotifications(data.reviewer_ids.map(userId => ({
      userId, type: 'residency_claim', title: 'New home access request',
      body: 'A residency request is ready for review. Open the Home to review current details.',
      icon: '📩', link: `/homes/${result.home_id}/owners/review-claim`,
      metadata: { home_id: result.home_id, claimant_id: result.actor_id, claim_id: result.claim.id },
    })));
  } catch (_) {
    // This optional notice cannot change the saved outcome. It is not proof
    // of inbox/device delivery, and retries never duplicate the admission.
  }
}

async function submit({ homeId, actorId, intent }) {
  if (![homeId, actorId].every(value => typeof value === 'string' && UUID.test(value))
    || !object(intent) || Object.keys(intent).some(key => !['claimed_role', 'claimed_address'].includes(key))
    || ['claimed_role', 'claimed_address'].some(key => Object.hasOwn(intent, key) && !nullableText(intent[key]))
    || (typeof intent.claimed_address === 'string' && intent.claimed_address.length > 1000)) {
    throw failure('RESIDENCY_SUBMISSION_INVALID', 400);
  }
  const role = typeof intent.claimed_role === 'string' ? intent.claimed_role.trim() : '';
  if (['owner', 'admin', 'manager', 'property_manager'].includes(role)) throw failure('OWNERSHIP_FLOW_REQUIRED', 409);
  if (role && !Object.hasOwn(FAMILIES, role)) throw failure('RESIDENCY_SUBMISSION_INVALID', 400);
  const args = { p_home_id: homeId.toLowerCase(), p_actor_id: actorId.toLowerCase(), p_intent: intent };
  let response;
  try { response = await db.rpc('submit_legacy_home_residency', args); } catch (_) { throw failure(); }
  if (!response || response.error || !object(response.data)) throw failure();
  const result = response.data;
  if (result.ok === false && typeof result.code === 'string' && Object.hasOwn(MESSAGES, result.code)
    && [400, 403, 404, 409, 422].includes(result.status)) {
    throw failure(result.code, result.status);
  }
  const claim = result.claim;
  if (result.ok !== true || result.home_id !== args.p_home_id || result.actor_id !== args.p_actor_id
    || typeof result.occupancy_id !== 'string' || !UUID.test(result.occupancy_id)
    || typeof result.created !== 'boolean' || typeof result.reused !== 'boolean' || (result.created && result.reused)
    || typeof result.routing !== 'string' || !ROUTES.includes(result.routing)
    || !object(claim) || typeof claim.id !== 'string' || !UUID.test(claim.id)
    || claim.home_id !== args.p_home_id || claim.user_id !== args.p_actor_id || claim.status !== 'pending'
    || typeof claim.claimed_role !== 'string' || !Object.hasOwn(FAMILIES, claim.claimed_role)
    || FAMILIES[claim.claimed_role] !== result.claimed_role || (role && FAMILIES[role] !== result.claimed_role)
    || !['claimed_address', 'review_note', 'cold_start_mode'].every(key => nullableText(claim[key]))
    || !['reviewed_by', 'postcard_code_id'].every(key => nullableId(claim[key]))
    || !['created_at', 'updated_at', 'reviewed_at'].every(key => nullableDate(claim[key]))
    || !['claimed_latitude', 'claimed_longitude'].every(key => claim[key] === null || (typeof claim[key] === 'number' && Number.isFinite(claim[key])))
    || (claim.postcard_auto_routed !== null && typeof claim.postcard_auto_routed !== 'boolean')
    || (claim.cold_start_mode || 'household_review') !== result.routing) throw failure();
  // Project only the caller's committed claim. RPC additions cannot leak through
  // the legacy envelope, and no fabricated command or address proof is returned.
  const saved = { ...result, claim: Object.fromEntries(CLAIM_FIELDS.map(key => [key, claim[key]])) };
  await notifyReviewers(saved);
  return saved;
}

function send(res, result) {
  res.set('Cache-Control', 'private, no-store');
  return res.status(result.created ? 201 : 200).json({
    message: 'Your residency request is saved. Open My Homes to check current access and the next verification step.',
    claim: result.claim, verification_needed: true, current_access: 'not_checked',
    routing: result.routing, cold_start: result.routing === 'self_bootstrap',
    next_step: result.routing === 'household_review' ? 'household_review' : 'address_verification',
    postcard_requested: false,
  });
}
function sendError(res, error) {
  res.set('Cache-Control', 'private, no-store');
  const safe = typeof error?.code === 'string' && (Object.hasOwn(MESSAGES, error.code)
    || error.code === 'RESIDENCY_LEGACY_UNAVAILABLE') ? error : failure();
  return res.status(safe.statusCode).json({ code: safe.code, error: safe.message });
}
module.exports = { submit, send, sendError };
