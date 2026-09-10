// One saved stop command owns the assignment and any release/refund. Read APIs
// expose receipts only; provider mutations require an explicit same-ID command.
const db = require('../config/supabaseAdmin');
const { getStripeClient } = require('../stripe/getStripeClient');
const { assertIntentBinding, providerId } = require('../stripe/gigPaymentProof');
const refunds = require('./paymentRefundService');
const { deliverStoredGigNotification } = require('./notificationService');
const stripe = getStripeClient();
const fail = (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });
async function rpc(name, args, allowNull = false) {
  const { data, error } = await db.rpc(name, args);
  if (error || data === undefined || (data === null && !allowNull)) throw fail('STOP_RECEIPT_UNKNOWN', 'Progress could not be saved. Keep and retry the same request.', 503);
  if (data?.error) {
    const error = fail(data.error === 'STOP_ACTIVE' ? 'STOP_ACTIVE' : `STOP_${data.error}`,
      'This task cannot continue with the displayed stop terms. Check its current status.',
      data.error === 'NOT_FOUND' ? 404 : data.error === 'FORBIDDEN' ? 403 : 409);
    if (data.error === 'STOP_ACTIVE') error.activeRequestId = data.requestId || null;
    throw error;
  }
  return data;
}
function project(data) {
  const r = data.request;
  if (!r?.id || !r.terms) throw fail('STOP_RECEIPT_UNKNOWN', 'The saved stop request is unavailable.', 503);
  const financialStatus = r.state === 'completed' ? r.receipt?.financialStatus
    : r.state === 'needs_review' ? 'needs_review' : r.financial_action === 'release' ? 'release_pending'
      : r.financial_action === 'refund' ? 'refund_pending' : 'none';
  return { requestId: r.id, action: r.action, status: r.state, financialStatus,
    canRetry: data.canRetry === true && r.state === 'pending',
    request: { requestId: r.id, gigId: r.gig_id, actorId: r.actor_id, action: r.action,
      terms: r.terms, reason: r.reason || null, rollbackMode: r.rollback_mode || null, financialAction: r.financial_action },
    receipt: r.state === 'completed' ? r.receipt : null };
}
async function preview({ gigId, actorId, action }) {
  const data = await rpc('read_gig_stop_preview', { p_gig_id: gigId, p_actor_id: actorId, p_action: action });
  return { action, terms: data.terms, eligible: data.eligible === true, unavailableReason: data.unavailableReason || null,
    financialAction: data.financialAction, activeRequestId: data.activeRequestId || null };
}
async function readRequest({ gigId, actorId, requestId }) {
  return project(await rpc('read_gig_stop_request', { p_gig_id: gigId, p_actor_id: actorId, p_request_id: requestId }));
}
async function readReleaseProof(payment) {
  const intent = assertIntentBinding(payment, await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id));
  if (!['requires_payment_method', 'requires_confirmation', 'requires_action', 'requires_capture', 'canceled'].includes(intent.status)
      || intent.amount_received !== 0 || !Number.isSafeInteger(intent.amount_capturable)
      || intent.amount_capturable !== (intent.status === 'requires_capture' ? payment.amount_total : 0)) {
    throw fail('STOP_PROVIDER_REVIEW', 'The current payment cannot be confirmed as an uncaptured hold.');
  }
  const chargeId = providerId(intent.latest_charge) || null;
  let charge = null;
  if (chargeId) {
    charge = await stripe.charges.retrieve(chargeId);
    const refundShape = (charge?.refunded === false && charge.amount_refunded === 0)
      || (intent.status === 'canceled' && charge?.refunded === true && charge.amount_refunded === payment.amount_total);
    if (!/^ch_[a-zA-Z0-9]+$/.test(chargeId) || charge?.id !== chargeId
        || providerId(charge.payment_intent) !== intent.id || providerId(charge.customer) !== payment.stripe_customer_id
        || charge.amount !== payment.amount_total || charge.currency !== 'usd'
        || charge.captured !== false || charge.amount_captured !== 0 || !refundShape) {
      throw fail('STOP_PROVIDER_REVIEW', 'The exact Charge does not prove a zero-capture release.');
    }
  } else if (intent.latest_charge !== null || intent.status === 'requires_capture') {
    throw fail('STOP_PROVIDER_REVIEW', 'The provider Charge is unavailable.');
  }
  return { id: intent.id, customer: providerId(intent.customer), amount: intent.amount, currency: intent.currency,
    capture_method: intent.capture_method, status: intent.status, amount_received: intent.amount_received,
    amount_capturable: intent.amount_capturable, charge_id: chargeId, amount_captured: charge?.amount_captured ?? 0,
    charge_captured: charge?.captured ?? false, charge_refunded: charge?.refunded ?? false,
    charge_amount_refunded: charge?.amount_refunded ?? 0, payer_id: intent.metadata.payer_id,
    payee_id: intent.metadata.payee_id, gig_id: intent.metadata.gig_id,
    acceptance_attempt_id: intent.metadata.acceptance_attempt_id || null };
}
async function execute({ gigId, actorId, sessionScope, requestId, action, expectedTerms, reason = null, rollbackMode = null }) {
  let data = await rpc('begin_gig_stop', { p_gig_id: gigId, p_actor_id: actorId, p_session_scope: sessionScope,
    p_request_id: requestId, p_action: action, p_expected: expectedTerms, p_reason: reason, p_rollback_mode: rollbackMode });
  if (data.request.state !== 'pending' || data.canRetry !== true) return project(data);
  const args = { p_request_id: requestId, p_actor_id: actorId };
  let leaseId;
  try {
    if (data.request.financial_action === 'refund') {
      // The stop barrier owns this UUID first. The existing refund service
      // verifies provider history before freezing the remaining amount, then
      // resumes only that exact policy request on later retries.
      await rpc('check_gig_stop_current', args);
      await refunds.create({ paymentId: data.request.payment_id, actorId, actorMode: 'policy', requestId,
        amount: null, reason: 'requested_by_customer', description: null });
      return project(await rpc('finish_gig_stop', args));
    }
    if (data.request.financial_action === 'none') return project(await rpc('finish_gig_stop', args));
    let proof = await readReleaseProof(data.payment);
    if (proof.status !== 'canceled') {
      data = await rpc('claim_gig_stop', args);
      if (data.request.state === 'completed') return project(data);
      leaseId = data.request.lease_id;
      // Unknown cancellation has no new financial identity: retry addresses
      // only this same existing intent with the original stable operation key.
      try {
        await stripe.paymentIntents.cancel(data.payment.stripe_payment_intent_id, { cancellation_reason: 'requested_by_customer' },
          { idempotencyKey: `gig-stop:${requestId}:${data.payment.stripe_payment_intent_id}` });
      } catch (_) { /* A fresh exact provider read may prove a lost response. */ }
      proof = await readReleaseProof(data.payment);
      if (proof.status !== 'canceled') throw fail('STOP_PROVIDER_PENDING', 'Payment release remains pending.', 503);
    }
    await rpc('record_gig_stop_evidence', { p_request_id: requestId, p_proof: proof });
    return project(await rpc('finish_gig_stop', { ...args, p_proof: proof }));
  } catch (error) {
    if (leaseId) await rpc('release_gig_stop_lease', { p_request_id: requestId, p_lease_id: leaseId, p_error: error.code || 'PROVIDER_UNKNOWN' });
    if (error.statusCode === 403 || error.code === 'STOP_TERMS_CHANGED') throw error;
    // Unknown provider/DB outcomes never become terminal client success. The
    // authoritative local status is useful only if this read itself succeeds.
    return { ...await readRequest({ gigId, actorId, requestId }), message: 'The stop request is retained. Check status or retry the same request.' };
  }
}
async function deliverPending(limit = 25) {
  let delivered = 0;
  for (let index = 0; index < limit; index += 1) {
    const event = await rpc('claim_gig_stop_delivery', {}, true);
    if (!event) break;
    const args = { p_id: event.id, p_lease_id: event.lease_id };
    let outcome = 'retry';
    try {
      const current = await rpc('read_gig_stop_delivery', args);
      if (!current.eligible) outcome = 'suppressed';
      else {
        const receipt = await deliverStoredGigNotification(current.notification);
        if (!Number.isSafeInteger(receipt?.acceptedCount) || receipt.acceptedCount < 0
            || !Number.isSafeInteger(receipt?.unresolvedCount) || receipt.unresolvedCount < 0) throw new Error('Missing notification transport receipt');
        outcome = receipt.unresolvedCount > 0 ? 'retry' : receipt.suppressed ? 'suppressed' : 'done';
      }
    } catch (_) { /* Keep the same event and Notification ID for retry. */ }
    if (!await rpc('finish_gig_stop_delivery', { ...args, p_outcome: outcome, p_error: outcome === 'retry' ? 'DELIVERY_UNRESOLVED' : null })) {
      throw new Error('Stop notification acknowledgement changed.');
    }
    if (outcome === 'done') delivered += 1;
  }
  return { delivered };
}
async function reconcilePending(limit = 100) {
  const requests = await rpc('claim_gig_stop_reconciliation', { p_limit: limit });
  let completed = 0;
  for (const candidate of requests) {
    try {
      const args = { p_request_id: candidate.id, p_actor_id: candidate.actor_id };
      const data = await rpc('check_gig_stop_current', args);
      if (data.request.state !== 'pending' || data.canRetry !== true) continue;
      let proof = null;
      if (data.request.financial_action === 'release') {
        proof = await readReleaseProof(data.payment);
        if (proof.status !== 'canceled') continue;
        await rpc('record_gig_stop_evidence', { p_request_id: candidate.id, p_proof: proof });
      } else if (data.request.financial_action === 'refund') {
        // Read-only discovery: the scheduler never creates/cancels a provider
        // payment or issues a new refund on behalf of an absent client.
        await refunds.reconcile(data.request.payment_id);
      }
      if (project(await rpc('finish_gig_stop', { ...args, p_proof: proof })).status === 'completed') completed += 1;
    } catch (_) { /* Fair next scan retains unresolved original operations. */ }
  }
  return { checked: requests.length, completed };
}
module.exports = { preview, readRequest, execute, readReleaseProof, deliverPending, reconcilePending };
