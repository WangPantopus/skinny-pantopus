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

module.exports = { needsReview, openCase, listOpenCases, resolveCase, OPEN_STATUSES };
