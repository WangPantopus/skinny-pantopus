// One saved stop command owns the assignment and any release/refund. Read APIs
// expose receipts only; provider mutations require an explicit same-ID command.
const db = require('../config/supabaseAdmin');
const { createHash } = require('node:crypto');
const { getStripeClient } = require('../stripe/getStripeClient');
const { assertIntentBinding, providerId } = require('../stripe/gigPaymentProof');
const refunds = require('./paymentRefundService');
const { deliverStoredGigNotification, createNotification } = require('./notificationService');
const logger = require('../utils/logger');
const { sendAlert, SEVERITY } = require('./alertingService');
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
const noteFingerprint = note => createHash('sha256').update(note, 'utf8').digest('hex');
function reasonDetails(value) {
  if (typeof value === 'string' && value.startsWith('other: ')) {
    return { reason: 'other', reasonNoteHash: noteFingerprint(value.slice(7)) };
  }
  return { reason: value || null };
}
async function originalReason({ gigId, actorId, requestId, reason, reasonNote, reasonNoteHash }) {
  if (reasonNote == null && reasonNoteHash == null) return reason;
  if (reason !== 'other' || typeof reasonNoteHash !== 'string' || !/^[a-f0-9]{64}$/.test(reasonNoteHash)) {
    throw fail('STOP_REASON_INVALID', 'The cancellation explanation could not be verified.', 400);
  }
  if (reasonNote != null) {
    if (typeof reasonNote !== 'string' || !reasonNote.trim() || reasonNote.trim().length > 1000
        || noteFingerprint(reasonNote.trim()) !== reasonNoteHash) {
      throw fail('STOP_REASON_INVALID', 'The cancellation explanation could not be verified.', 400);
    }
    // The existing text column already binds immutable retry identity under
    // begin_gig_stop's lock. finish_gig_stop publishes only the Other category.
    return `other: ${reasonNote.trim()}`;
  }
  // A client can recover a saved request using its nonsecret fingerprint;
  // free text is never required in native or browser receipt-identity storage.
  const saved = await rpc('read_gig_stop_request', { p_gig_id: gigId, p_actor_id: actorId, p_request_id: requestId });
  if (reasonDetails(saved.request?.reason).reasonNoteHash !== reasonNoteHash) {
    throw fail('STOP_REASON_CHANGED', 'The original cancellation explanation changed. Reopen this request.');
  }
  return saved.request.reason;
}
function project(data) {
  const r = data.request;
  if (!r?.id || !r.terms) throw fail('STOP_RECEIPT_UNKNOWN', 'The saved stop request is unavailable.', 503);
  const financialStatus = r.state === 'completed' ? r.receipt?.financialStatus
    : r.state === 'needs_review' ? 'needs_review' : r.financial_action === 'release' ? 'release_pending'
      : r.financial_action === 'refund' ? 'refund_pending' : r.financial_action === 'fee' ? 'fee_pending' : 'none';
  return { requestId: r.id, action: r.action, status: r.state, financialStatus,
    canRetry: data.canRetry === true && r.state === 'pending',
    request: { requestId: r.id, gigId: r.gig_id, actorId: r.actor_id, action: r.action,
      terms: r.terms, ...reasonDetails(r.reason), rollbackMode: r.rollback_mode || null, financialAction: r.financial_action },
    receipt: r.state === 'completed' ? r.receipt : null };
}
async function preview({ gigId, actorId, action }) {
  const data = await rpc('read_gig_stop_preview', { p_gig_id: gigId, p_actor_id: actorId, p_action: action });
  return { action, terms: data.terms, eligible: data.eligible === true, unavailableReason: data.unavailableReason || null,
    financialAction: data.financialAction, activeRequestId: data.activeRequestId || null,
    // A policy fee below the provider's 50-cent minimum is not charged; the preview says why.
    ...(data.feeReason ? { feeStatus: data.feeStatus, feeReason: data.feeReason } : {}) };
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
// Poster-fault fee: only the fee is captured from the existing hold and Stripe
// releases the rest. A fresh exact read decides every step: a live hold may be
// captured, an exact prior fee capture is adopted, a canceled hold proves that
// nothing can be charged, and anything else stays for review (never recaptured).
async function readFeeProof(payment, feeCents) {
  const intent = assertIntentBinding(payment, await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id));
  if (intent.status === 'canceled') return readReleaseProof(payment);
  if (intent.status === 'requires_capture') {
    if (intent.amount_received !== 0 || intent.amount_capturable !== payment.amount_total) {
      throw fail('STOP_PROVIDER_REVIEW', 'The current payment cannot be confirmed as an uncaptured hold.');
    }
    return { status: 'requires_capture' };
  }
  const chargeId = providerId(intent.latest_charge) || null;
  if (intent.status !== 'succeeded' || !Number.isSafeInteger(feeCents) || intent.amount_received !== feeCents
      || intent.amount_capturable !== 0 || !chargeId) {
    throw fail('STOP_PROVIDER_REVIEW', 'The captured amount does not match this fee.');
  }
  const charge = await stripe.charges.retrieve(chargeId);
  if (!/^ch_[a-zA-Z0-9]+$/.test(chargeId) || charge?.id !== chargeId || providerId(charge.payment_intent) !== intent.id
      || providerId(charge.customer) !== payment.stripe_customer_id || charge.amount !== payment.amount_total
      || charge.currency !== 'usd' || charge.captured !== true || charge.amount_captured !== feeCents
      || charge.refunded !== false || charge.amount_refunded !== 0 || typeof charge.disputed !== 'boolean') {
    throw fail('STOP_PROVIDER_REVIEW', 'The exact Charge does not prove this fee capture.');
  }
  return { id: intent.id, customer: providerId(intent.customer), amount: intent.amount, currency: intent.currency,
    capture_method: intent.capture_method, status: intent.status, amount_received: intent.amount_received,
    amount_capturable: intent.amount_capturable, charge_id: chargeId, charge_amount: charge.amount,
    amount_captured: charge.amount_captured, charge_captured: charge.captured, charge_refunded: charge.refunded,
    charge_amount_refunded: charge.amount_refunded, charge_disputed: charge.disputed, payer_id: intent.metadata.payer_id,
    payee_id: intent.metadata.payee_id, gig_id: intent.metadata.gig_id,
    acceptance_attempt_id: intent.metadata.acceptance_attempt_id || null };
}
async function captureFee(payment, feeCents) {
  // One stable key per payment and fee; a retry can only replay this capture.
  try {
    await stripe.paymentIntents.capture(payment.stripe_payment_intent_id, { amount_to_capture: feeCents },
      { idempotencyKey: `gig-fee:${payment.id}:${payment.stripe_payment_intent_id}` });
  } catch (_) { /* A fresh exact provider read may prove a lost response. */ }
  return readFeeProof(payment, feeCents);
}
function logUncharged(kind, payment) {
  logger.warn('Poster-fault fee not charged: the payment hold is unavailable', {
    kind, paymentId: payment.id, gigId: payment.gig_id, reason: 'HOLD_UNAVAILABLE' });
}
async function execute({ gigId, actorId, sessionScope, requestId, action, expectedTerms, reason = null,
  reasonNote = null, reasonNoteHash = null, rollbackMode = null }) {
  const original = await originalReason({ gigId, actorId, requestId, reason, reasonNote, reasonNoteHash });
  let data = await rpc('begin_gig_stop', { p_gig_id: gigId, p_actor_id: actorId, p_session_scope: sessionScope,
    p_request_id: requestId, p_action: action, p_expected: expectedTerms, p_reason: original, p_rollback_mode: rollbackMode });
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
    if (data.request.financial_action === 'fee') {
      const feeCents = data.request.terms.policyFeeCents;
      let proof = await readFeeProof(data.payment, feeCents);
      if (proof.status === 'requires_capture') {
        data = await rpc('claim_gig_stop', args);
        if (data.request.state === 'completed') return project(data);
        leaseId = data.request.lease_id;
        proof = await captureFee(data.payment, feeCents);
        if (proof.status !== 'succeeded') throw fail('STOP_PROVIDER_PENDING', 'The cancellation fee remains pending.', 503);
      } else if (proof.status === 'canceled') logUncharged('late_cancel', data.payment);
      await rpc('record_gig_stop_evidence', { p_request_id: requestId, p_proof: proof });
      return project(await rpc('finish_gig_stop', { ...args, p_proof: proof }));
    }
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
      } else if (data.request.financial_action === 'fee') {
        // Read-only: adopt an exact fee capture or a canceled hold; never capture.
        proof = await readFeeProof(data.payment, data.request.terms.policyFeeCents);
        if (!['succeeded', 'canceled'].includes(proof.status)) continue;
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
// Poster no-show (the worker reports it): reserve → capture only the fee →
// record the capture and cancel the task in one transaction. The Payment's
// capture_pending reservation is the durable retry identity.
const noShowFail = (code, message, statusCode) => Object.assign(new Error(message), { code, statusCode });
const NO_SHOW_ADMISSIONS = new Set(['NO_HOLD', 'FEE_BELOW_MINIMUM']);
const NO_SHOW_MESSAGES = {
  NOT_ELIGIBLE: 'The task changed. Reopen it and check its status.',
  STOP_ACTIVE: 'A cancellation for this task is already in progress. Check its status.',
  FEE_CHANGED: 'A different no-show report for this task is already in progress. Check its status.',
  INVALID_FEE: 'The no-show fee could not be verified. Reopen the task and try again.',
  PAYMENT_CHANGED: 'The task payment changed while the no-show was being recorded. Support will review it.',
  INVALID_PROOF: 'The no-show fee could not be confirmed with the payment provider. Support will review it.',
};
async function noShowRpc(name, args) {
  const { data, error } = await db.rpc(name, args);
  if (error || !data) {
    throw noShowFail('NO_SHOW_FEE_UNKNOWN', 'The no-show fee is not confirmed yet. Report the no-show again to finish.', 503);
  }
  if (NO_SHOW_ADMISSIONS.has(data.error)) return data;
  if (data.error) {
    const status = data.error === 'NOT_FOUND' ? 404 : data.error === 'FORBIDDEN' ? 403 : 409;
    throw noShowFail(`NO_SHOW_${data.error}`, NO_SHOW_MESSAGES[data.error]
      || 'This task payment needs review before a no-show can be reported. Check its status.', status);
  }
  return data;
}
function noShowFeeOutcome(payment) {
  const fee = payment?.metadata?.gig_fee;
  if (fee?.kind !== 'poster_no_show') return null;
  if (fee.state === 'captured') return { status: 'charged', feeCents: fee.fee_cents, releasedCents: fee.released_cents };
  if (fee.state === 'not_charged') return { status: 'not_charged', reason: fee.reason || 'HOLD_UNAVAILABLE', feeCents: 0 };
  return { status: 'pending', feeCents: fee.fee_cents, releasedCents: fee.released_cents };
}
// The SQL admission also writes the report's incident once, under the task lock.
// No capturable hold, or a fee below the provider's 50-cent capture minimum:
// the report proceeds and nothing is charged.
async function reserveNoShowFee({ gigId, actorId, feeCents, description = null, evidenceUrls = [] }) {
  const data = await noShowRpc('prepare_gig_fee_capture', { p_gig_id: gigId, p_actor_id: actorId, p_fee_cents: feeCents,
    p_description: typeof description === 'string' && description ? description : null,
    p_evidence_urls: Array.isArray(evidenceUrls) ? evidenceUrls.filter(url => typeof url === 'string') : [] });
  const incident = data.incident?.id ? data.incident : null;
  if (data.error === 'NO_HOLD') return { noHold: true, incident };
  if (data.error === 'FEE_BELOW_MINIMUM') return { belowMinimum: true, incident };
  return { payment: data.payment, gig: data.gig, incident };
}
async function recordNoShowFee(payment, actorId, proof) {
  if (proof.status === 'canceled') logUncharged('poster_no_show', payment);
  const data = await noShowRpc('record_gig_fee_capture', { p_payment_id: payment.id, p_actor_id: actorId, p_proof: proof });
  return { payment: data.payment, gig: data.gig, reused: data.reused === true, review: data.review || null,
    outcome: noShowFeeOutcome(data.payment) };
}
function providerPending(error) {
  // Provider evidence that proves neither a live hold, the exact fee capture,
  // nor a canceled hold stays reserved for review; it is never captured again.
  if (error.code === 'STOP_PROVIDER_REVIEW' || error.code === 'payment_proof_required') {
    return noShowFail('NO_SHOW_PROVIDER_REVIEW', 'The payment provider shows a different state for this task payment. Support will review it.', 409);
  }
  return noShowFail('NO_SHOW_FEE_UNKNOWN', 'The no-show fee is not confirmed yet. Report the no-show again to finish.', 503);
}
async function chargeNoShowFee({ payment, actorId }) {
  const fee = payment.metadata?.gig_fee;
  if (fee?.state !== 'pending') return { payment, reused: true, outcome: noShowFeeOutcome(payment) };
  let proof;
  try {
    proof = await readFeeProof(payment, fee.fee_cents);
    if (proof.status === 'requires_capture') proof = await captureFee(payment, fee.fee_cents);
  } catch (error) { throw providerPending(error); }
  if (!['succeeded', 'canceled'].includes(proof.status)) throw providerPending({});
  return recordNoShowFee(payment, actorId, proof);
}
// The poster's no-show notice, one per task: the report route and every recovery
// path (webhook, scheduled replay) send the same notice at most once.
async function notifyPosterNoShow({ gigId, posterId, workerId, gigTitle = null, feeCharge = null, incidentId = null }) {
  const [{ data: reporter }, { data: gig }] = await Promise.all([
    db.from('User').select('name, username').eq('id', workerId).maybeSingle(),
    gigTitle ? Promise.resolve({ data: { title: gigTitle } }) : db.from('Gig').select('title').eq('id', gigId).maybeSingle(),
  ]);
  const reporterName = reporter?.name || reporter?.username || 'The other party';
  const chargedCents = feeCharge?.status === 'charged' ? feeCharge.feeCents : 0;
  const feeLine = chargedCents > 0
    ? ` No-show fee $${(chargedCents / 100).toFixed(2)} charged · $${(feeCharge.releasedCents / 100).toFixed(2)} released.` : '';
  return createNotification({
    userId: posterId,
    type: 'no_show_reported',
    title: `No-show reported for "${gig?.title || 'a gig'}"`,
    body: `${reporterName} reported you as a no-show.${feeLine} This affects your reliability score.`,
    icon: '⚠️',
    link: `/gigs/${gigId}`,
    metadata: { gig_id: gigId, ...(incidentId ? { incident_id: incidentId } : {}), fee: chargedCents / 100 },
    idempotencyKey: `gig-no-show:${gigId}:${posterId}`,
  });
}
// Recovery for a reservation whose reporter did not return. Webhooks only record
// an exact provider outcome (the hold captured or canceled). The scheduled replay
// (replay: true) also completes the same reserved capture under its stable key,
// only while the payment is still capture_pending; it never creates a new capture
// or payment. A replay that fails definitively three times is parked for review.
async function reconcileNoShowFee(paymentId, { replay = false } = {}) {
  const { data: payment, error } = await db.from('Payment').select('*').eq('id', paymentId).maybeSingle();
  if (error) throw noShowFail('NO_SHOW_FEE_UNKNOWN', 'The no-show fee could not be checked.', 503);
  const fee = payment?.metadata?.gig_fee;
  if (fee?.kind !== 'poster_no_show' || fee.state !== 'pending'
      || !['capture_pending', 'canceled', 'disputed'].includes(payment.payment_status)) return null;
  if (replay && fee.review) return null;
  try {
    let proof = await readFeeProof(payment, fee.fee_cents);
    if (proof.status === 'requires_capture') {
      if (!replay || payment.payment_status !== 'capture_pending') return null;
      proof = await captureFee(payment, fee.fee_cents);
    }
    if (!['succeeded', 'canceled'].includes(proof.status)) return null;
    const recorded = await recordNoShowFee(payment, fee.actor_id, proof);
    if (!recorded.reused && !recorded.review && recorded.gig?.status === 'cancelled') {
      await notifyPosterNoShow({ gigId: recorded.gig.id, posterId: recorded.gig.user_id, workerId: fee.actor_id,
        gigTitle: recorded.gig.title, feeCharge: recorded.outcome });
    }
    return recorded;
  } catch (failure) {
    if (replay && failure.statusCode && failure.statusCode < 500) await noteReplayFailure(payment, failure);
    throw failure;
  }
}
// A definitive replay failure (the provider or the record cannot prove the
// reserved outcome) is counted; the third parks the reservation for support.
async function noteReplayFailure(payment, failure) {
  const { data, error } = await db.rpc('note_gig_fee_replay_failure', { p_payment_id: payment.id, p_error: failure.code || 'REVIEW' });
  if (error || !data || data.error || !data.parked) return;
  logger.error('Reserved no-show fee parked for support review', {
    paymentId: payment.id, gigId: payment.gig_id, failures: data.failures, code: failure.code || null });
  await sendAlert({ severity: SEVERITY.WARNING, title: 'No-show fee needs support review',
    message: 'A reserved poster no-show fee could not be confirmed after three scheduled attempts. Its task stays held until support resolves it.',
    metadata: { paymentId: payment.id, gigId: payment.gig_id, code: failure.code || null },
    dedup_key: `gig-fee-parked:${payment.id}` }).catch(() => {});
}
// Webhook recovery for a late-cancel fee whose owner request did not finish:
// the same read-only adoption as the scheduled reconciler, for one payment.
async function reconcileFeeStop(paymentId) {
  const { data: request, error } = await db.from('GigStopRequest').select('id,actor_id')
    .eq('payment_id', paymentId).eq('financial_action', 'fee').eq('state', 'pending').maybeSingle();
  if (error) throw fail('STOP_RECEIPT_UNKNOWN', 'The stop request could not be checked.', 503);
  if (!request) return null;
  const args = { p_request_id: request.id, p_actor_id: request.actor_id };
  const data = await rpc('check_gig_stop_current', args);
  if (data.request.state !== 'pending' || data.canRetry !== true) return null;
  const proof = await readFeeProof(data.payment, data.request.terms.policyFeeCents);
  if (!['succeeded', 'canceled'].includes(proof.status)) return null;
  await rpc('record_gig_stop_evidence', { p_request_id: request.id, p_proof: proof });
  return project(await rpc('finish_gig_stop', { ...args, p_proof: proof }));
}
module.exports = { preview, readRequest, execute, readReleaseProof, deliverPending, reconcilePending,
  reserveNoShowFee, chargeNoShowFee, reconcileNoShowFee, reconcileFeeStop, noShowFeeOutcome, notifyPosterNoShow };
