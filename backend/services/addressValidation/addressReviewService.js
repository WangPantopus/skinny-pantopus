/**
 * Address review queue.
 *
 * SCN-11: `manual_review` is emitted as the next action by six rungs of the
 * decision ladder and was consumed by nothing — no queue, no route, no admin
 * surface. Every escalation was a dead end, which is what made the design's
 * "route to manual review" remedies non-functional (audit 2026-08-22).
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

const OPEN_STATUSES = ['open', 'in_review'];

/** Does this verdict ask for a human? */
function needsReview(verdict) {
  if (!verdict) return false;
  const actions = Array.isArray(verdict.next_actions) ? verdict.next_actions : [];
  return actions.includes('manual_review');
}

/**
 * Open a review case, unless this user already has one open for this address.
 *
 * Never throws: a queue failure must not break the request that triggered it.
 * Returns null when nothing was created.
 */
async function openCase({ addressId, homeId = null, userId, verdict, trigger = null }) {
  if (!needsReview(verdict)) return null;

  const { data, error } = await supabaseAdmin
    .from('AddressReviewCase')
    .insert({
      address_id: addressId || null,
      home_id: homeId,
      user_id: userId || null,
      verdict_status: verdict.status,
      reasons: Array.isArray(verdict.reasons) ? verdict.reasons : [],
      trigger,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) {
    // 23505 is the partial unique index: a case is already open for this
    // (address, user), which is the desired outcome, not a failure.
    if (error.code === '23505') {
      logger.info('addressReview: case already open', { addressId, userId });
      return null;
    }
    logger.error('addressReview: failed to open case', {
      addressId, userId, error: error.message,
    });
    return null;
  }

  logger.info('addressReview: case opened', {
    caseId: data.id, addressId, verdictStatus: verdict.status,
  });

  return data.id;
}

/**
 * The address watch (homeSecurityPolicy.watchResidencyRequest) found a high-risk request to live at a home: a
 * person should look at it, the way trustAnomalyDetection flags providers. One open case per person and home; a
 * later request refreshes its signals instead of adding a row. The case has no address_id, so it never takes the
 * slot of the validation case the same person may have open for the address (idx_address_review_case_one_open).
 *
 * Never throws: the request it watches is already saved. Returns the case id, or null when nothing was written.
 */
async function flagAddressWatch({ homeId, userId, signals, source = null }) {
  try {
    const { data: open, error: readError } = await supabaseAdmin
      .from('AddressReviewCase')
      .select('id')
      .eq('trigger', 'address_watch')
      .eq('home_id', homeId)
      .eq('user_id', userId)
      .in('status', OPEN_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) throw readError;

    if (open) {
      const { error } = await supabaseAdmin
        .from('AddressReviewCase')
        .update({ reasons: signals, updated_at: new Date().toISOString() })
        .eq('id', open.id)
        .in('status', OPEN_STATUSES);
      if (error) throw error;
      logger.info('addressReview: address watch case refreshed', { caseId: open.id, homeId, signals, source });
      return open.id;
    }

    const { data, error } = await supabaseAdmin
      .from('AddressReviewCase')
      .insert({
        home_id: homeId,
        user_id: userId,
        verdict_status: 'ADDRESS_WATCH',
        reasons: signals,
        trigger: 'address_watch',
        status: 'open',
      })
      .select('id')
      .single();
    if (error) throw error;
    logger.warn('addressReview: address watch case opened', { caseId: data.id, homeId, userId, signals, source });
    return data.id;
  } catch (error) {
    logger.error('addressReview: address watch case not written', { homeId, userId, error: error.message });
    return null;
  }
}

/** Oldest-first page of cases awaiting a reviewer. */
async function listOpenCases({ limit = 50, offset = 0, status = null } = {}) {
  let query = supabaseAdmin
    .from('AddressReviewCase')
    .select('*')
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  query = status ? query.eq('status', status) : query.in('status', OPEN_STATUSES);

  const { data, error } = await query;

  if (error) {
    logger.error('addressReview: failed to list cases', { error: error.message });
    return { cases: [], error: error.message };
  }

  return { cases: data || [] };
}

/**
 * Resolve a case.
 *
 * Scoped to an open status so two reviewers acting at once cannot both record
 * an outcome.
 */
async function resolveCase({ caseId, reviewerId, outcome, note = null }) {
  if (!['approved', 'rejected', 'dismissed'].includes(outcome)) {
    return { success: false, error: 'Invalid outcome' };
  }

  const { data, error } = await supabaseAdmin
    .from('AddressReviewCase')
    .update({
      status: outcome,
      resolved_by: reviewerId,
      resolved_at: new Date().toISOString(),
      resolution_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', caseId)
    .in('status', OPEN_STATUSES)
    .select('id');

  if (error) {
    logger.error('addressReview: failed to resolve case', { caseId, error: error.message });
    return { success: false, error: error.message };
  }

  if (!data || data.length === 0) {
    return { success: false, error: 'Case not found or already resolved' };
  }

  logger.info('addressReview: case resolved', { caseId, reviewerId, outcome });
  return { success: true };
}

module.exports = { needsReview, openCase, flagAddressWatch, listOpenCases, resolveCase, OPEN_STATUSES };
