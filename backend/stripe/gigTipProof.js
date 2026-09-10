// A tip is an automatic, separate platform charge. Provider state is read again
// before recording any result; neither SDK callbacks nor old webhook objects
// establish the current amount or financial outcome.
const { providerId } = require('./gigPaymentProof');

const MINIMUM_TIP_CENTS = 50;
const MAXIMUM_TIP_CENTS = 99999999;
const TIP_PROVIDER_STATES = new Set([
  'requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'canceled',
]);
const fail = () => Object.assign(new Error('The exact tip payment needs verification. Keep the same request.'),
  { statusCode: 409, code: 'TIP_PROVIDER_REVIEW' });
const id = (value, prefix) => typeof value === 'string' && new RegExp(`^${prefix}_[a-zA-Z0-9]+$`).test(value);
const zeroOrAbsent = value => value === null || value === 0;

function expectedTipLiveMode() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (/^(sk|rk)_test_/.test(key || '')) return false;
  if (/^(sk|rk)_live_/.test(key || '')) return true;
  throw Object.assign(new Error('Payment provider configuration is unavailable.'), { statusCode: 503, code: 'TIP_PROVIDER_UNAVAILABLE' });
}

function assertTipTerms(payment, request, expectedLive) {
  const amount = payment?.amount_total;
  if (!payment?.id || payment.payment_type !== 'tip' || !payment.gig_id || !payment.payer_id || !payment.payee_id
      || !Number.isSafeInteger(amount) || amount < MINIMUM_TIP_CENTS || amount > MAXIMUM_TIP_CENTS
      || payment.amount_subtotal !== amount || payment.tip_amount !== amount
      || payment.amount_platform_fee !== 0 || payment.amount_to_payee !== amount
      || !Number.isSafeInteger(payment.amount_processing_fee) || payment.amount_processing_fee < 0
      || String(payment.currency).toLowerCase() !== 'usd' || !id(payment.stripe_customer_id, 'cus')
      || request?.payment_id !== payment.id || request.gig_id !== payment.gig_id
      || request.payer_id !== payment.payer_id || request.payee_id !== payment.payee_id
      || request.amount_cents !== amount || request.currency !== 'usd'
      || typeof expectedLive !== 'boolean' || request.livemode !== expectedLive) throw fail();
  return amount;
}

function assertTipIntent(payment, request, intent, expectedLive) {
  const amount = assertTipTerms(payment, request, expectedLive);
  const metadata = intent?.metadata || {};
  const intentId = request.intent_id || payment.stripe_payment_intent_id;
  const modern = request.source !== 'legacy';
  if (!id(intentId, 'pi') || intent?.id !== intentId || intent.livemode !== expectedLive
      || providerId(intent.customer) !== payment.stripe_customer_id || intent.amount !== amount || intent.currency !== 'usd'
      || !['automatic', 'automatic_async'].includes(intent.capture_method) || intent.confirmation_method !== 'automatic'
      || !TIP_PROVIDER_STATES.has(intent.status) || intent.amount_capturable !== 0
      || !Number.isSafeInteger(intent.amount_received) || intent.amount_received < 0 || intent.amount_received > amount
      || intent.transfer_data !== null || intent.on_behalf_of !== null || !zeroOrAbsent(intent.application_fee_amount)
      || metadata.payer_id !== payment.payer_id || metadata.payee_id !== payment.payee_id || metadata.gig_id !== payment.gig_id
      || metadata.payment_type !== 'tip' || metadata.platform_fee !== '0'
      || (modern && (metadata.tip_request_id !== request.id || metadata.payment_id !== payment.id
        || !id(request.stripe_account_id, 'acct') || metadata.payee_stripe_account !== request.stripe_account_id))
      || (!modern && (metadata.tip_request_id || metadata.payment_id))) throw fail();
  if (intent.status === 'succeeded' && intent.amount_received !== amount) throw fail();
  if (!['succeeded', 'processing'].includes(intent.status) && intent.amount_received !== 0) throw fail();
  return amount;
}

function assertTipCharge(payment, request, intent, charge, expectedLive) {
  const chargeId = providerId(intent.latest_charge);
  if (intent.latest_charge === null) {
    if (intent.status === 'succeeded' || charge !== null || intent.amount_received !== 0) throw fail();
    return;
  }
  const amount = payment.amount_total;
  if (!id(chargeId, 'ch') || charge?.id !== chargeId || charge.livemode !== expectedLive
      || providerId(charge.payment_intent) !== intent.id || providerId(charge.customer) !== payment.stripe_customer_id
      || charge.amount !== amount || charge.currency !== 'usd' || charge.on_behalf_of !== null
      || charge.transfer !== null || charge.destination !== null || !zeroOrAbsent(charge.application_fee_amount)
      || charge.application_fee !== null || typeof charge.paid !== 'boolean' || typeof charge.captured !== 'boolean'
      || !Number.isSafeInteger(charge.amount_captured) || charge.amount_captured < 0 || charge.amount_captured > amount
      || !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > amount
      || typeof charge.refunded !== 'boolean' || typeof charge.disputed !== 'boolean') throw fail();
  if (intent.status === 'succeeded') {
    if (charge.paid !== true || charge.captured !== true || charge.amount_captured !== amount
        || charge.refunded !== (charge.amount_refunded === amount)) throw fail();
  } else if (intent.status !== 'processing') {
    const releasedRefund = intent.status === 'canceled' && charge.refunded === true && charge.amount_refunded === amount;
    if (charge.captured !== false || charge.amount_captured !== 0
        || (!releasedRefund && (charge.refunded !== false || charge.amount_refunded !== 0))) throw fail();
  }
}

async function readTipProof(stripe, payment, request, expectedLive) {
  const intentId = request?.intent_id || payment?.stripe_payment_intent_id;
  if (!id(intentId, 'pi')) throw fail();
  const intent = await stripe.paymentIntents.retrieve(intentId);
  assertTipIntent(payment, request, intent, expectedLive);
  const chargeId = providerId(intent.latest_charge);
  const charge = chargeId ? await stripe.charges.retrieve(chargeId) : null;
  assertTipCharge(payment, request, intent, charge, expectedLive);
  const capturedAt = intent.status === 'succeeded' && Number.isSafeInteger(charge?.created) && charge.created > 0
    ? new Date(charge.created * 1000).toISOString() : null;
  if (intent.status === 'succeeded' && capturedAt === null) throw fail();
  return { intent, charge, proof: {
    id: intent.id, customer: providerId(intent.customer), livemode: intent.livemode,
    amount: intent.amount, currency: intent.currency, status: intent.status,
    capture_method: intent.capture_method, confirmation_method: intent.confirmation_method,
    amount_received: intent.amount_received, amount_capturable: intent.amount_capturable,
    payer_id: intent.metadata.payer_id, payee_id: intent.metadata.payee_id, gig_id: intent.metadata.gig_id,
    payment_type: intent.metadata.payment_type, platform_fee: intent.metadata.platform_fee,
    request_id: intent.metadata.tip_request_id || null, payment_id: intent.metadata.payment_id || null,
    stripe_account_id: intent.metadata.payee_stripe_account || null,
    transfer_data: null, on_behalf_of: null, application_fee_amount: intent.application_fee_amount,
    charge_id: chargeId || null, charge_paid: charge?.paid ?? false, charge_captured: charge?.captured ?? false,
    charge_amount_captured: charge?.amount_captured ?? 0, charge_amount_refunded: charge?.amount_refunded ?? 0,
    charge_refunded: charge?.refunded ?? false, charge_disputed: charge?.disputed ?? false,
    charge_dispute_id: providerId(charge?.dispute) || null,
    charge_transfer: null, charge_destination: null, charge_application_fee: null,
    charge_application_fee_amount: charge?.application_fee_amount ?? null,
    payment_method_id: providerId(intent.payment_method) || null, captured_at: capturedAt,
  } };
}

async function verifyTipCustomer(stripe, payerId, customerId, expectedLive) {
  if (!id(customerId, 'cus')) throw fail();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer?.id !== customerId || customer.deleted === true || customer.livemode !== expectedLive
      || customer.metadata?.user_id !== payerId) throw fail();
  return customer;
}

module.exports = { MINIMUM_TIP_CENTS, MAXIMUM_TIP_CENTS, expectedTipLiveMode,
  assertTipTerms, assertTipIntent, readTipProof, verifyTipCustomer };
