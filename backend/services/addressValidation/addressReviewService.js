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
const adminAlerts = require('../adminAlerts');

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

/** The open address-watch case about this person at this home, or about the home itself (userId null). */
async function openWatchCase(homeId, userId) {
  let query = supabaseAdmin
    .from('AddressReviewCase')
    .select('id, reasons')
    .eq('trigger', 'address_watch')
    .eq('home_id', homeId)
    .in('status', OPEN_STATUSES);
  query = userId ? query.eq('user_id', userId) : query.is('user_id', null);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Email the admins about a new address-watch case (the queue has no screen yet). A case about the home always
 * emails. A case about a person doesn't when their home or their account already had an open one, so a flood of
 * accounts at one home is an email for the first of them and one for the home, not one per account.
 */
async function alertNewWatchCase({ caseId, createdAt, homeId, userId, signals }) {
  try {
    if (userId) {
      const { data: others, error } = await supabaseAdmin
        .from('AddressReviewCase')
        .select('id')
        .eq('trigger', 'address_watch')
        .in('status', OPEN_STATUSES)
        .or(`home_id.eq.${homeId},user_id.eq.${userId}`)
        .lt('created_at', createdAt)
        .limit(1);
      if (error) throw error;
      if (others.length) return;
    }
    const { data: home } = await supabaseAdmin.from('Home').select('city, state').eq('id', homeId).maybeSingle();
    adminAlerts.notifyAddressWatchCase({ caseId, homeId, userId, signals, home }).catch(() => {});
  } catch (error) {
    logger.warn('addressReview: address watch alert not sent', { caseId, error: error.message });
  }
}

/**
 * The address watch (homeSecurityPolicy.watchResidencyRequest) found a high-risk request to live at a home: a
 * person should look at it, the way trustAnomalyDetection flags providers. A case is about one person at the home,
 * or, with no userId, about the home itself (many people asking to live there, a mail drop). There is one open case
 * of each (idx_address_review_case_one_open_watch); a later request refreshes it, adding its signals, instead of
 * adding a row. The case has no address_id, so it never takes the slot of the validation case the same person may
 * have open for the address (idx_address_review_case_one_open). A new case emails the admins (alertNewWatchCase).
 *
 * Never throws: the request it watches is already saved. Returns the case id, or null when nothing was written.
 */
async function flagAddressWatch({ homeId, userId = null, signals, source = null }) {
  const refresh = async (open) => {
    const { error } = await supabaseAdmin
      .from('AddressReviewCase')
      .update({ reasons: [...new Set([...(open.reasons || []), ...signals])], updated_at: new Date().toISOString() })
      .eq('id', open.id)
      .in('status', OPEN_STATUSES);
    if (error) throw error;
    logger.info('addressReview: address watch case refreshed', { caseId: open.id, homeId, signals, source });
    return open.id;
  };
  try {
    const open = await openWatchCase(homeId, userId);
    if (open) return await refresh(open);

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
      .select('id, created_at')
      .single();
    if (error?.code === '23505') {
      // A request at the same moment opened it first.
      const winner = await openWatchCase(homeId, userId);
      return winner ? await refresh(winner) : null;
    }
    if (error) throw error;
    logger.warn('addressReview: address watch case opened', { caseId: data.id, homeId, userId, signals, source });
    await alertNewWatchCase({ caseId: data.id, createdAt: data.created_at, homeId, userId, signals });
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
