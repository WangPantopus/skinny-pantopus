// Durable refunds: provider effects have one frozen operation and local success
// is recorded only from exact provider evidence. GET history never calls Stripe.
const { randomUUID, createHash } = require('crypto');
const db = require('../config/supabaseAdmin');
const { getStripeClient } = require('../stripe/getStripeClient');
const { providerId } = require('../stripe/gigPaymentProof');
const stripe = getStripeClient();
const STATUSES = new Set(['pending', 'requires_action', 'succeeded', 'failed', 'canceled']);
const REASONS = new Set(['duplicate', 'fraudulent', 'requested_by_customer', 'work_not_completed', 'other']);
const fail = (message, statusCode = 409, code = 'refund_conflict') => Object.assign(new Error(message), { statusCode, code });
const { snapshot, readProjection } = require('./walletSettlementService');
async function rpc(name, args) {
  const { data, error } = await db.rpc(name, args);
  if (error || !data) throw fail('Refund progress could not be saved. Retry the same request.', 503, 'refund_save_pending');
  if (data.error) {
    const status = data.error === 'NOT_FOUND' ? 404 : ['FORBIDDEN', 'SUPPORT_REQUIRED'].includes(data.error) ? 403 : 409;
    const err = fail(data.error === 'SUPPORT_REQUIRED' ? 'Payment has been released to the worker. Contact support for a refund.' :
      `Refund could not continue (${data.error}).`, status, data.error);
    if (data.request) { err.refundRequest = publicRequest(data.request); err.refundRow = data.request; }
    throw err;
  }
  return data;
}
async function paymentById(id) {
  const { data, error } = await db.from('Payment').select('*').eq('id', id).maybeSingle();
  if (error) throw fail('Payment recovery is unavailable.', 503);
  if (!data) throw fail('Payment not found.', 404);
  return data;
}
async function assertActor(payment, actorId, actorMode) {
  if (actorMode === 'payer' && actorId === payment.payer_id) return;
  if (actorMode === 'policy') return; // only internal cancellation callers select this mode
  if (actorMode === 'admin') {
    const { data, error } = await db.from('User').select('role').eq('id', actorId).maybeSingle();
    if (error) throw fail('Refund authorization is unavailable.', 503);
    if (data?.role === 'admin') return;
  }
  throw fail('Access denied.', 403);
}
function publicRequest(r, actor = null) {
  const retryActor = actor ? r.actor_id === actor.id && (r.actor_mode === 'payer' || (r.actor_mode === 'admin' && actor.mode === 'admin')) : false;
  return { requestId: r.id, paymentId: r.payment_id, operation: r.operation, amountCents: r.amount_cents,
    currency: r.currency, status: r.status, providerRefundId: r.provider_refund_id || null,
    canRetry: retryActor && (r.requested_amount === null || r.requested_amount >= 50)
      && ['pending', 'requires_action'].includes(r.status), reversalStatus: r.reversal_status,
    // Retain the original input so cold retries do not change an omitted amount
    // into a different explicit-amount operation.
    requestedAmountCents: r.requested_amount, reason: r.reason, description: r.description || null };
}
function publicPayment(p) {
  return { id: p.id, payment_status: p.payment_status, amount_total: p.amount_total,
    refunded_amount: p.refunded_amount || 0, currency: p.currency, captured_at: p.captured_at || null };
}
async function localRecords(payment) {
  const results = await Promise.all([
    db.from('PaymentRefundRequest').select('*').eq('payment_id', payment.id).order('created_at', { ascending: false }),
    db.from('PaymentRefundReceipt').select('*').eq('payment_id', payment.id).order('provider_created_at', { ascending: false }),
  ]);
  if (results.some(r => r.error)) throw fail('Refund recovery is unavailable.', 503);
  return { requests: results[0].data || [], receipts: results[1].data || [] };
}
function legacyReceipt(r) {
  return { stripe_refund_id: r.provider_refund_id, payment_id: r.payment_id, amount: r.amount_cents,
    currency: r.currency, refund_status: r.status, refund_succeeded_at: r.status === 'succeeded' ? r.verified_at : null };
}
async function history(paymentId, actorId, actorMode = 'payer') {
  const payment = await paymentById(paymentId);
  await assertActor(payment, actorId, actorMode);
  const records = await localRecords(payment);
  return { requests: records.requests.map(r => publicRequest(r, { id: actorId, mode: actorMode })), refunds: records.receipts.map(legacyReceipt), payment: { ...publicPayment(payment), ...await readProjection(payment) } };
}
async function response(paymentId, requestId) {
  const payment = await paymentById(paymentId);
  const records = await localRecords(payment);
  const request = records.requests.find(r => r.id === requestId);
  if (!request) throw fail('Refund request recovery is unavailable.', 503);
  const receipt = records.receipts.find(r => r.request_id === requestId);
  return { success: request.status === 'succeeded', refundRequest: publicRequest(request, { id: request.actor_id, mode: request.actor_mode }),
    refund: receipt ? legacyReceipt(receipt) : null, refundId: receipt?.provider_refund_id || null, payment: { ...publicPayment(payment), ...await readProjection(payment) } };
}
function assertIntent(payment, intent) {
  if (!intent || !payment.stripe_customer_id || !payment.stripe_payment_intent_id
    || !Number.isSafeInteger(payment.amount_total) || payment.amount_total < 50
    || !Number.isSafeInteger(payment.amount_to_payee) || payment.amount_to_payee < 0 || payment.amount_to_payee > payment.amount_total
    || intent.id !== payment.stripe_payment_intent_id || intent.amount !== payment.amount_total
    || String(intent.currency).toLowerCase() !== String(payment.currency).toLowerCase()
    || String(intent.currency).toLowerCase() !== 'usd' || providerId(intent.customer) !== payment.stripe_customer_id
    || intent.metadata?.payer_id !== payment.payer_id || intent.metadata?.payee_id !== payment.payee_id
    || (payment.gig_id && intent.metadata?.gig_id !== payment.gig_id)
    || (payment.metadata?.acceptance_attempt_id && intent.metadata?.acceptance_attempt_id !== payment.metadata.acceptance_attempt_id)
    || (payment.payment_type !== 'tip' && intent.capture_method !== 'manual')) throw fail('Provider payment proof does not match.');
  return intent;
}
async function verifyProvider(payment, release = false) {
  const intent = assertIntent(payment, await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id));
  if (release) {
    if (!['requires_capture', 'requires_payment_method', 'requires_confirmation', 'requires_action', 'canceled'].includes(intent.status)
      || (intent.amount_received || 0) !== 0) throw fail('This payment can no longer be released as an authorization hold.');
    return { intent };
  }
  if (intent.status !== 'succeeded' || intent.amount_received !== payment.amount_total
    || !payment.stripe_charge_id || providerId(intent.latest_charge) !== payment.stripe_charge_id) throw fail('The exact payment capture must be reconciled before refunding.');
  const charge = await stripe.charges.retrieve(payment.stripe_charge_id);
  if (!charge || charge.id !== payment.stripe_charge_id || charge.paid !== true || charge.captured !== true
    || charge.amount !== payment.amount_total || providerId(charge.payment_intent) !== intent.id
    || providerId(charge.customer) !== payment.stripe_customer_id || String(charge.currency).toLowerCase() !== 'usd') throw fail('Provider charge proof does not match.');
  return { intent, charge };
}
function verifiedReceipt(payment, refund, requests) {
  if (!refund?.id || providerId(refund.payment_intent) !== payment.stripe_payment_intent_id
    || providerId(refund.charge) !== payment.stripe_charge_id || !Number.isSafeInteger(refund.amount)
    || refund.amount <= 0 || refund.amount > payment.amount_total || String(refund.currency).toLowerCase() !== 'usd'
    || !STATUSES.has(refund.status) || !Number.isSafeInteger(refund.created)) throw fail('Provider refund proof does not match.');
  const requestId = refund.metadata?.refund_request_id || null;
  if (refund.metadata?.payment_id && refund.metadata.payment_id !== payment.id) throw fail('Provider refund belongs to another payment.');
  if (requestId) {
    const request = requests.find(r => r.id === requestId);
    if (!request || request.operation !== 'refund' || request.amount_cents !== refund.amount
      || (request.provider_refund_id && request.provider_refund_id !== refund.id)) throw fail('Provider refund does not match the frozen request.');
  }
  return { id: refund.id, intentId: payment.stripe_payment_intent_id, chargeId: payment.stripe_charge_id,
    amountCents: refund.amount, currency: 'usd', status: refund.status, requestId,
    createdAt: new Date(refund.created * 1000).toISOString() };
}
async function discover(payment, requests) {
  const refunds = []; const seen = new Set(); const requestIds = new Set(); let cursor;
  for (let page = 0; page < 100; page++) {
    const result = await stripe.refunds.list({ payment_intent: payment.stripe_payment_intent_id, limit: 100,
      ...(cursor ? { starting_after: cursor } : {}) });
    if (!Array.isArray(result?.data)) throw fail('Provider refund discovery is unavailable.', 503);
    for (const refund of result.data) {
      if (seen.has(refund.id)) throw fail('Provider refund discovery repeated a receipt.', 503);
      seen.add(refund.id);
      const receipt = verifiedReceipt(payment, refund, requests);
      if (receipt.requestId && requestIds.has(receipt.requestId)) throw fail('Provider returned multiple refunds for the same request.');
      if (receipt.requestId) requestIds.add(receipt.requestId);
      refunds.push(receipt);
    }
    if (!result.has_more) return refunds;
    cursor = result.data.at(-1)?.id;
    if (!cursor) break;
  }
  throw fail('Provider refund history requires reconciliation.', 503);
}
async function reconcile(paymentId) {
  let payment = await paymentById(paymentId);
  await verifyProvider(payment);
  const records = await localRecords(payment);
  const receipts = await discover(payment, records.requests);
  const result = await rpc('record_payment_refund_receipts', { p_payment_id: payment.id,
    p_expected: snapshot(payment), p_receipts: receipts });
  payment = result.payment;
  return { payment, receipts };
}
function legacyRequestId(paymentId, amount, reason, actorId, actorMode) {
  const h = createHash('sha256').update(JSON.stringify(['refund-v1', paymentId, amount ?? null, reason, actorId, actorMode])).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
async function create({ paymentId, amount = null, reason, description = null, actorId, actorMode = 'payer', requestId }) {
  let request;
  try {
    if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0)) throw fail('Refund amount must be a positive integer.', 400);
    if (!REASONS.has(reason)) throw fail('Invalid refund reason.', 400);
    if (!actorId || actorId === 'system') actorId = null;
    description = description || null;
    const id = String(requestId || legacyRequestId(paymentId, amount, reason, actorId, actorMode)).toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw fail('Invalid refund request ID.', 400);
    let payment = await paymentById(paymentId);
    await assertActor(payment, actorId, actorMode);
    let records = await localRecords(payment);
    request = records.requests.find(r => r.id === id);
    // Reconciliation can enroll earlier external/legacy refunds. This is a read
    // at Stripe; exact SQL proof updates accounting before computing remaining.
    const release = request ? request.operation === 'release' : ['authorized', 'authorize_pending'].includes(payment.payment_status);
    if (!request && !release) { await reconcile(paymentId); payment = await paymentById(paymentId); }
    else await verifyProvider(payment, release);
    const reserved = await rpc('reserve_payment_refund', { p_payment_id: paymentId, p_request_key: id,
      p_actor_id: actorId, p_actor_mode: actorMode, p_amount: amount, p_reason: reason, p_description: description,
      p_expected: snapshot(payment), p_operation: release ? 'release' : 'refund' });
    request = reserved.request; payment = reserved.payment;
    if (!['pending', 'requires_action'].includes(request.status)) return response(paymentId, request.id);
    if (!release) {
      const recovered = await reconcile(paymentId);
      records = await localRecords(recovered.payment);
      request = records.requests.find(r => r.id === request.id);
      if (request.provider_refund_id || request.status !== 'pending') return response(paymentId, request.id);
    }
    const { intent } = await verifyProvider(payment, release);
    if (release && intent.status === 'canceled') {
      await rpc('record_payment_refund_release', { p_request_id: request.id, p_expected: snapshot(payment),
        p_intent_id: intent.id, p_provider_status: intent.status });
      return response(paymentId, request.id);
    }
    // A lease protects simultaneous HTTP/job retries. Discovery above always
    // runs, including after the conservative provider idempotency window.
    const claim = await rpc('claim_payment_refund', { p_request_id: request.id, p_actor_id: actorId,
      p_actor_mode: actorMode, p_lease_token: randomUUID() });
    request = claim.request;
    if (!claim.claimed) return response(paymentId, request.id);
    if (Date.now() - Date.parse(request.provider_started_at) > 10 * 60 * 1000) {
      throw fail('The previous provider outcome is unknown. The same request is retained for reconciliation.', 409, 'refund_reconciliation_required');
    }
    if (release) {
      const canceled = assertIntent(payment, await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `refund-release:${request.id}` }));
      if (canceled.status !== 'canceled' || (canceled.amount_received || 0) !== 0) throw fail('Hold release is awaiting provider confirmation.', 503);
      await rpc('record_payment_refund_release', { p_request_id: request.id, p_expected: snapshot(payment),
        p_intent_id: canceled.id, p_provider_status: canceled.status });
    } else {
      const refund = await stripe.refunds.create({ payment_intent: payment.stripe_payment_intent_id, amount: request.amount_cents,
        reason: ['duplicate', 'fraudulent'].includes(reason) ? reason : 'requested_by_customer',
        metadata: { payment_id: payment.id, refund_request_id: request.id } }, { idempotencyKey: `pantopus-refund:${request.id}` });
      const receipt = verifiedReceipt(payment, refund, [request]);
      await rpc('record_payment_refund_receipts', { p_payment_id: payment.id, p_expected: snapshot(payment), p_receipts: [receipt] });
    }
    return response(paymentId, request.id);
  } catch (error) {
    if (error.refundRow || request) error.refundRequest = publicRequest(error.refundRow || request, { id: actorId, mode: actorMode });
    if (error.refundRequest && ['FORBIDDEN', 'DISPUTED', 'SUPPORT_REQUIRED'].includes(error.code)) error.refundRequest.canRetry = false;
    if (!error.statusCode) { error.statusCode = 503; error.code = 'refund_provider_pending'; error.message = 'Refund confirmation is unavailable. Retry the same request.'; }
    throw error;
  }
}
async function reconcileEvent({ paymentIntentId, chargeId }) {
  if (!paymentIntentId && !chargeId) throw fail('Refund event has no payment reference.');
  let query = db.from('Payment').select('*');
  query = paymentIntentId ? query.eq('stripe_payment_intent_id', paymentIntentId) : query.eq('stripe_charge_id', chargeId);
  const { data, error } = await query.maybeSingle();
  if (error) throw fail('Refund event lookup is unavailable.', 503);
  if (!data) return; // unrelated provider account event
  if (chargeId && data.stripe_charge_id !== chargeId) throw fail('Refund event charge does not match.');
  return reconcile(data.id);
}
async function recoverRequest(request) {
  const payment = await paymentById(request.payment_id);
  if (request.operation === 'release') {
    const { intent } = await verifyProvider(payment, true);
    if (intent.status === 'canceled') {
      await rpc('record_payment_refund_release', { p_request_id: request.id, p_expected: snapshot(payment),
        p_intent_id: intent.id, p_provider_status: intent.status });
      return response(payment.id, request.id);
    }
  } else {
    await reconcile(payment.id);
    const current = await response(payment.id, request.id);
    if (current.refundRequest.providerRefundId || !['pending', 'requires_action'].includes(current.refundRequest.status)) return current;
  }
  return create({ paymentId: request.payment_id, requestId: request.id, actorId: request.actor_id,
    actorMode: request.actor_mode, amount: request.requested_amount, reason: request.reason, description: request.description });
}
module.exports = { create, history, reconcile, reconcileEvent, recoverRequest, snapshot, publicRequest,
  _test: { assertIntent, verifiedReceipt, discover, legacyRequestId } };
