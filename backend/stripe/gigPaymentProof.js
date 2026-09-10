// Proof used at paid-gig boundaries. Client outcomes and local status alone do
// not establish that the exact payer authorized the agreed worker and amount.
function conflict(message = 'Payment does not match this gig') {
  return Object.assign(new Error(message), { statusCode: 409, code: 'payment_proof_required' });
}
function providerId(value) { return typeof value === 'object' ? value?.id : value; }
function assertPaymentTerms(payment, terms) {
  if (!payment || !terms || payment.payment_type !== 'gig_payment'
      || payment.gig_id !== terms.gigId || payment.payer_id !== terms.payerId
      || payment.payee_id !== terms.payeeId || payment.amount_total !== terms.amount
      || !Number.isSafeInteger(terms.amount) || terms.amount < 50
      || String(payment.currency).toLowerCase() !== 'usd'
      || !payment.stripe_customer_id || !payment.stripe_payment_intent_id
      || (payment.refunded_amount || 0) !== 0) throw conflict();
  return payment;
}
function assertIntentBinding(payment, intent) {
  if (!intent || intent.id !== payment.stripe_payment_intent_id
      || intent.capture_method !== 'manual'
      || intent.amount !== payment.amount_total
      || String(intent.currency).toLowerCase() !== String(payment.currency).toLowerCase()
      || providerId(intent.customer) !== payment.stripe_customer_id
      || intent.metadata?.payer_id !== payment.payer_id
      || intent.metadata?.payee_id !== payment.payee_id
      || (payment.gig_id && intent.metadata?.gig_id !== payment.gig_id)
      || (payment.metadata?.acceptance_attempt_id
          && intent.metadata?.acceptance_attempt_id !== payment.metadata.acceptance_attempt_id)) throw conflict();
  return intent;
}
function assertAuthorizedIntent(payment, intent) {
  assertIntentBinding(payment, intent);
  if (intent.status !== 'requires_capture' || intent.amount_capturable !== payment.amount_total) {
    throw conflict('The agreed payment must be authorized before continuing');
  }
  return intent;
}
function assertCapturedIntent(payment, intent) {
  assertIntentBinding(payment, intent);
  if (intent.status !== 'succeeded' || intent.amount_received !== payment.amount_total
      || !providerId(intent.latest_charge)) throw conflict('The agreed payment has not been captured');
  const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
  if (charge && (charge.captured !== true || charge.paid !== true
      || charge.amount !== payment.amount_total || providerId(charge.payment_intent) !== intent.id)) {
    throw conflict('The charge does not prove the agreed capture');
  }
  return intent;
}
module.exports = { conflict, providerId, assertPaymentTerms, assertIntentBinding, assertAuthorizedIntent, assertCapturedIntent };
