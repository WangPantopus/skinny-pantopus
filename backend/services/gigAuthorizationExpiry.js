// Exact provider reads + a protected cancellation admission. Unknown outcomes
// retain their operation; a local estimate or failed cancel never closes a Gig.
const db = require('../config/supabaseAdmin');
const { getStripeClient } = require('../stripe/getStripeClient');
const { conflict, providerId, assertIntentBinding } = require('../stripe/gigPaymentProof');
const { readGigAuthorizationDeadline } = require('../stripe/gigAuthorizationDeadline');
const { deliverStoredGigNotification } = require('./notificationService');
const stripe = getStripeClient();
async function rpc(name, args = {}) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw Object.assign(new Error('Expiry receipt could not be saved; retry the same operation.'), { code: 'EXPIRY_RECEIPT_UNKNOWN' });
  if (data?.error) throw Object.assign(conflict('The current authorization requires reconciliation.'), { code: `EXPIRY_${data.error}` });
  return data;
}
async function readProof(payment) {
  const intent = assertIntentBinding(payment, await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id));
  const chargeId = providerId(intent.latest_charge);
  if (!/^ch_[a-zA-Z0-9]+$/.test(chargeId || '') || !['requires_capture', 'canceled'].includes(intent.status)
      || intent.amount_received !== 0 || intent.amount_capturable !== (intent.status === 'canceled' ? 0 : payment.amount_total)) {
    throw conflict('A current uncaptured authorization is required.');
  }
  // Always read Charge again, including after cancellation. An earlier expanded
  // object must never prove zero capture after another provider operation.
  const charge = await stripe.charges.retrieve(chargeId);
  const captureBefore = charge?.payment_method_details?.card?.capture_before;
  // Basil represents release without a Refund. Older release reporting can
  // mark the entire uncaptured authorization refunded; neither means capture.
  const refundShape = (charge?.refunded === false && charge.amount_refunded === 0)
    || (intent.status === 'canceled' && charge?.refunded === true && charge.amount_refunded === payment.amount_total);
  if (!charge || charge.id !== chargeId || providerId(charge.payment_intent) !== intent.id
      || providerId(charge.customer) !== payment.stripe_customer_id || charge.amount !== payment.amount_total
      || charge.currency !== 'usd' || charge.paid !== true || charge.captured !== false || charge.amount_captured !== 0
      || !refundShape || charge.payment_method_details?.type !== 'card'
      || !Number.isSafeInteger(captureBefore) || captureBefore <= 0 || captureBefore > 253402300799) {
    throw conflict('The uncaptured Charge and its expiry could not be verified.');
  }
  if (intent.status === 'requires_capture') await readGigAuthorizationDeadline(stripe, payment, { ...intent, latest_charge: charge });
  return { id: intent.id, customer: providerId(intent.customer), amount: intent.amount, currency: intent.currency,
    capture_method: intent.capture_method, status: intent.status, amount_received: intent.amount_received,
    amount_capturable: intent.amount_capturable, amount_captured: charge.amount_captured,
    charge_refunded: charge.refunded, charge_amount_refunded: charge.amount_refunded,
    charge_id: chargeId, capture_before: captureBefore, payer_id: intent.metadata.payer_id,
    payee_id: intent.metadata.payee_id, gig_id: intent.metadata.gig_id,
    acceptance_attempt_id: intent.metadata.acceptance_attempt_id || null };
}
async function recover(paymentId) {
  let data = await rpc('read_gig_authorization_expiry', { p_payment_id: paymentId });
  if (data.complete) return data;
  let proof = await readProof(data.payment);
  if (data.reviewOnly) {
    if (proof.status === 'canceled') return rpc('record_gig_authorization_expiry', { p_payment_id: paymentId, p_expiry_id: data.operation.id, p_proof: proof });
    return { pending: true, needsReview: true, operation: data.operation };
  }
  data = await rpc('begin_gig_authorization_expiry', { p_payment_id: paymentId, p_expected: data.expected, p_proof: proof });
  if (data.notDue || data.complete || data.operation?.state === 'complete') return data;
  const operationId = data.operation.id;
  const args = { p_payment_id: paymentId, p_expiry_id: operationId };
  if (proof.status === 'canceled') return rpc('record_gig_authorization_expiry', { ...args, p_proof: proof });
  // Read again before the final locked admission. Provider mutations are never
  // based only on the proof collected before acquiring the pending barrier.
  proof = await readProof(data.payment);
  if (proof.status === 'canceled') return rpc('record_gig_authorization_expiry', { ...args, p_proof: proof });
  data = await rpc('claim_gig_authorization_expiry', { ...args, p_proof: proof });
  if (data.complete) return data;
  const leaseId = data.operation.lease_id;
  try {
    try {
      await stripe.paymentIntents.cancel(data.operation.intent_id, { cancellation_reason: 'abandoned' }, {
        idempotencyKey: `gig-expiry:${operationId}:${data.operation.intent_id}`,
      });
    } catch (_) {
      // A lost response may already have released the hold. Only a fresh exact
      // provider read can distinguish that from an unresolved operation.
    }
    proof = await readProof(data.payment);
    if (proof.status !== 'canceled') throw Object.assign(new Error('Authorization release remains pending.'), { code: 'EXPIRY_PROVIDER_UNKNOWN' });
    return await rpc('record_gig_authorization_expiry', { ...args, p_proof: proof });
  } catch (error) {
    await rpc('release_gig_expiry_lease', { p_id: operationId, p_lease_id: leaseId, p_error: 'RECONCILIATION_REQUIRED' });
    throw error;
  }
}
async function deliverPending(limit = 25) {
  let delivered = 0;
  for (let index = 0; index < limit; index += 1) {
    const event = await rpc('claim_gig_expiry_delivery');
    if (!event) break;
    const args = { p_id: event.id, p_lease_id: event.lease_id };
    let outcome = 'retry';
    try {
      const current = await rpc('read_gig_expiry_delivery', args);
      if (!current.eligible) outcome = 'suppressed';
      else {
        const receipt = await deliverStoredGigNotification(current.notification);
        if (!Number.isSafeInteger(receipt?.acceptedCount) || receipt.acceptedCount < 0
            || !Number.isSafeInteger(receipt?.unresolvedCount) || receipt.unresolvedCount < 0) {
          throw new Error('Notification transport receipt missing');
        }
        outcome = receipt.unresolvedCount > 0 ? 'retry' : receipt.suppressed ? 'suppressed' : 'done';
      }
    } catch (_) { /* Retain the same event and notification identity. */ }
    const saved = await rpc('finish_gig_expiry_delivery', { ...args, p_outcome: outcome,
      p_error: outcome === 'retry' ? 'DELIVERY_UNRESOLVED' : null });
    if (!saved) throw new Error('Expiry notification acknowledgement changed.');
    if (outcome === 'done') delivered += 1;
  }
  return { delivered };
}
module.exports = { recover, readProof, deliverPending };
