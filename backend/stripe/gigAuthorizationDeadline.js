const { conflict, providerId, assertAuthorizedIntent } = require('./gigPaymentProof');

/** The provider's actual card capture deadline, never a new window starting at reconciliation. */
async function readGigAuthorizationDeadline(stripe, payment, intent) {
  assertAuthorizedIntent(payment, intent);
  const chargeId = providerId(intent.latest_charge);
  if (typeof chargeId !== 'string' || !chargeId.startsWith('ch_')) {
    throw conflict('The authorization deadline could not be verified. Check payment status.');
  }
  const charge = typeof intent.latest_charge === 'object'
    ? intent.latest_charge : await stripe.charges.retrieve(chargeId);
  const deadline = charge?.payment_method_details?.card?.capture_before;
  if (!charge || charge.id !== chargeId || providerId(charge.payment_intent) !== intent.id
      || providerId(charge.customer) !== payment.stripe_customer_id
      || charge.amount !== payment.amount_total || charge.currency !== 'usd'
      || charge.paid !== true || charge.captured !== false || charge.refunded !== false
      || charge.amount_refunded !== 0 || charge.payment_method_details?.type !== 'card'
      || !Number.isSafeInteger(deadline) || deadline <= 0 || deadline > 253402300799) {
    throw conflict('The authorization deadline could not be verified. Check payment status.');
  }
  return { chargeId, captureBefore: deadline, expiresAt: new Date(deadline * 1000).toISOString() };
}
function requireLiveAuthorization(deadline) {
  if (!deadline || deadline.captureBefore * 1000 <= Date.now()) {
    throw conflict('This authorization has expired. Check payment status before continuing.');
  }
  return deadline;
}
module.exports = { readGigAuthorizationDeadline, requireLiveAuthorization };
