// Recovery for assigned payments created before bid-acceptance receipts existed.
// Provider reads may reconcile an outcome; only a durable lease permits mutation.
const db = require('../config/supabaseAdmin');
const { getStripeClient } = require('../stripe/getStripeClient');
const { conflict, providerId, assertIntentBinding } = require('../stripe/gigPaymentProof');
const { readGigAuthorizationDeadline, requireLiveAuthorization } = require('../stripe/gigAuthorizationDeadline');
const stripe = getStripeClient();
const RETRY_WINDOW_MS = 10 * 60 * 1000;
const SDK_STATES = new Set(['requires_payment_method', 'requires_confirmation', 'requires_action']);

async function rpc(name, args) {
  const { data, error } = await db.rpc(name, args);
  if (error || !data) throw Object.assign(new Error('Authorization progress could not be saved. Check status before retrying.'),
    { statusCode: 503, code: 'authorization_unknown' });
  if (data.error === 'FORBIDDEN') throw Object.assign(new Error('Your permission to manage this gig changed.'), { statusCode: 403 });
  if (data.error === 'BID_RECOVERY') throw Object.assign(conflict('Recover this bid through its existing checkout.'), { code: 'use_bid_payment_recovery' });
  if (data.error) throw Object.assign(conflict('Authorization changed. Check its current status before retrying.'),
    { code: `legacy_authorization_${data.error.toLowerCase()}` });
  return data;
}
async function proof(payment, attempt, intent) {
  assertIntentBinding({ ...payment, stripe_payment_intent_id: attempt.intent_id || intent?.id }, intent);
  if (!intent?.id || (!attempt.adopted && !attempt.discovered_legacy && intent.metadata?.legacy_authorization_id !== attempt.id)
      || ![...SDK_STATES, 'requires_capture', 'processing', 'canceled'].includes(intent.status)) {
    throw conflict('The provider authorization needs reconciliation.');
  }
  const deadline = intent.status === 'requires_capture'
    ? requireLiveAuthorization(await readGigAuthorizationDeadline(stripe, { ...payment, stripe_payment_intent_id: intent.id }, intent)) : null;
  return {
    id: intent.id, customer: providerId(intent.customer), capture_method: intent.capture_method,
    currency: intent.currency, amount: intent.amount, payer_id: intent.metadata.payer_id,
    payee_id: intent.metadata.payee_id, gig_id: intent.metadata.gig_id,
    attempt_id: intent.metadata.legacy_authorization_id || null, status: intent.status,
    capture_before: deadline?.captureBefore || null, charge_id: deadline?.chargeId || null,
    amount_capturable: intent.amount_capturable, discovered_legacy: attempt.discovered_legacy === true,
  };
}
async function discover(payment, attempt) {
  if (attempt.intent_id) return stripe.paymentIntents.retrieve(attempt.intent_id);
  const historical = !attempt.requested_at && !payment.stripe_payment_intent_id;
  if (!attempt.requested_at && !historical) return null;
  const created = Date.parse(historical ? payment.created_at : attempt.created_at);
  if (!Number.isFinite(created)) throw conflict('The authorization operation time needs review.');
  const matches = [];
  let after;
  for (let page = 0; page < 10; page += 1) {
    const batch = await stripe.paymentIntents.list({ customer: payment.stripe_customer_id, limit: 100,
      created: { gte: Math.max(0, Math.floor(created / 1000) - 300) }, ...(after ? { starting_after: after } : {}) });
    if (!Array.isArray(batch?.data)) throw conflict('Provider discovery is incomplete.');
    matches.push(...batch.data.filter(item => item.metadata?.legacy_authorization_id === attempt.id
      || (historical && !item.metadata?.legacy_authorization_id && !item.metadata?.acceptance_attempt_id
        && item.metadata?.gig_id === payment.gig_id && item.metadata?.payer_id === payment.payer_id
        && item.metadata?.payee_id === payment.payee_id)));
    if (matches.length > 1) throw conflict('Multiple matching authorizations require review.');
    if (!batch.has_more) {
      if (!matches.length) return null;
      const found = await stripe.paymentIntents.retrieve(matches[0].id);
      if (historical && !found.metadata?.legacy_authorization_id && !found.metadata?.acceptance_attempt_id) attempt.discovered_legacy = true;
      return found;
    }
    after = batch.data.at(-1)?.id;
    if (!after) break;
  }
  throw conflict('Provider discovery is incomplete.');
}
function withinWindow(attempt) {
  if (!attempt.requested_at) return true;
  const created = Date.parse(attempt.requested_at);
  return Number.isFinite(created) && Date.now() - created <= RETRY_WINDOW_MS;
}
function response(data, intent) {
  const { payment, attempt } = data;
  const cancelPending = attempt.cancel_requested === true;
  const scheduled = Date.parse(data.gig?.scheduled_start);
  const availableAt = !intent && Number.isFinite(scheduled) && scheduled - 24 * 60 * 60 * 1000 > Date.now()
    ? new Date(scheduled - 24 * 60 * 60 * 1000).toISOString() : null;
  const ready = !cancelPending && intent?.status === 'requires_capture' && payment.payment_status === 'authorized';
  const secret = !cancelPending && !ready && SDK_STATES.has(intent?.status) && intent.confirmation_method === 'automatic'
    && typeof intent.client_secret === 'string' && intent.client_secret.length > 0 ? intent.client_secret : null;
  const oldUnknown = !intent && !attempt.requested_at && !payment.stripe_payment_intent_id
    && (payment.payment_status !== 'ready_to_authorize' || payment.payment_attempted_at != null);
  const canRetry = !cancelPending && !availableAt && !oldUnknown && Boolean(secret || intent?.status === 'canceled' || (!intent && withinWindow(attempt)));
  return {
    gigId: payment.gig_id, paymentId: payment.id, payerId: payment.payer_id, payeeId: payment.payee_id, authorizationAttemptId: attempt.id,
    paymentIntentId: intent?.id || attempt.intent_id || null, amountCents: payment.amount_total, currency: 'usd',
    paymentStatus: payment.payment_status, providerStatus: intent?.status || null,
    authorizationReady: ready, alreadyAuthorized: ready,
    cancellationPending: cancelPending, authorizationAvailableAt: availableAt,
    recoveryState: cancelPending || availableAt ? 'pending' : ready ? 'ready' : secret ? 'action_required'
      : intent?.status === 'processing' || (!intent && canRetry) ? 'pending' : 'needs_review',
    canRetry, ...(secret ? { clientSecret: secret } : {}),
  };
}

async function recover({ gigId, actorId, mode = 'check', scheduler = false, expectedPaymentId, expectedTerms }) {
  const args = { p_gig_id: gigId, p_actor_id: actorId || null, p_scheduler: scheduler };
  let data = await rpc('begin_legacy_gig_authorization', { ...args, p_replace: false });
  const checkExpected = () => {
    const p = data.payment;
    if ((expectedPaymentId && p.id !== expectedPaymentId) || (expectedTerms && (
      (expectedTerms.payerId && p.payer_id !== expectedTerms.payerId) || p.payee_id !== expectedTerms.payeeId
      || p.amount_total !== expectedTerms.amount || String(expectedTerms.currency || 'usd').toLowerCase() !== 'usd'))) {
      throw conflict('The assigned payment terms changed.');
    }
  };
  checkExpected();
  let intent = await discover(data.payment, data.attempt);
  let ownedLease = null;
  let paymentChanged = false;
  const record = async () => {
    const previousStatus = data.payment.payment_status;
    const previousIntent = data.payment.stripe_payment_intent_id;
    const receipt = await proof(data.payment, data.attempt, intent);
    data = await rpc('record_legacy_gig_authorization', { ...args, p_attempt_id: data.attempt.id,
      p_expected_verified_at: data.attempt.verified_at, p_proof: receipt, p_lease_id: ownedLease });
    checkExpected();
    paymentChanged ||= previousStatus !== data.payment.payment_status
      || previousIntent !== data.payment.stripe_payment_intent_id;
  };
  const publicResult = () => ({ ...response(data, intent), actorId: scheduler ? null : actorId, paymentChanged });
  if (intent) await record();
  if (mode === 'cancel') {
    if (!scheduler) throw conflict('Automatic cancellation is not available through this action.');
    if (SDK_STATES.has(intent?.status) || (data.attempt.cancel_requested && intent?.status === 'requires_capture')) {
      data = await rpc('claim_legacy_gig_authorization', { ...args, p_attempt_id: data.attempt.id, p_cancel: true });
      checkExpected();
      ownedLease = data.attempt.lease_id;
      await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: `legacy-gig-cancel:${data.attempt.id}` });
      intent = await stripe.paymentIntents.retrieve(intent.id);
      await record();
    }
    if (intent?.status === 'canceled') {
      const cancelled = await rpc('finish_legacy_gig_auto_cancel', { p_gig_id: gigId,
        p_attempt_id: data.attempt.id, p_verified_at: data.attempt.verified_at });
      return { ...publicResult(), cancelled: cancelled.cancelled };
    }
    return publicResult();
  }
  if (data.attempt.cancel_requested || (!intent && !response(data,intent).canRetry)
      || mode === 'check' || intent?.status === 'requires_capture' || intent?.status === 'processing') {
    return publicResult();
  }
  if (intent?.status === 'canceled') {
    data = await rpc('begin_legacy_gig_authorization', { ...args, p_replace: true });
    checkExpected();
    intent = null;
  }
  // Existing actionable intents belong to the SDK. Reconfirming/replacing one
  // on the server could lose the payer's active authentication challenge.
  if (intent && (!scheduler || !data.attempt.off_session || intent.status !== 'requires_confirmation')) return publicResult();
  const claimed = await rpc('claim_legacy_gig_authorization', { ...args, p_attempt_id: data.attempt.id });
  data = claimed;
  ownedLease = data.attempt.lease_id;
  checkExpected();
  const p = data.payment;
  const a = data.attempt;
  try {
    if (intent) {
      intent = await stripe.paymentIntents.confirm(intent.id,
        { payment_method: p.stripe_payment_method_id, off_session: true }, { idempotencyKey: `legacy-gig-confirm:${a.id}` });
    } else {
      intent = await stripe.paymentIntents.create({ amount: p.amount_total, currency: 'usd',
        customer: p.stripe_customer_id, capture_method: 'manual', confirmation_method: 'automatic',
        metadata: { payer_id: p.payer_id, payee_id: p.payee_id, gig_id: p.gig_id,
          platform_fee: String(p.amount_platform_fee), legacy_authorization_id: a.id,
          ...(a.off_session ? { off_session: 'true' } : {}) },
        ...(p.stripe_payment_method_id ? { payment_method: p.stripe_payment_method_id } : {}),
        ...(a.off_session ? { off_session: true, confirm: true } : {}),
      }, { idempotencyKey: `legacy-gig-create:${a.id}` });
    }
  } catch (error) {
    // Authentication-required errors can contain a created intent. Retrieve it
    // before binding; neither the error status nor its embedded object is proof.
    const candidate = providerId(error.payment_intent || error.raw?.payment_intent);
    if (!candidate) throw Object.assign(new Error('Authorization outcome is unknown. Check status before retrying.'),
      { statusCode: 503, code: 'authorization_unknown' });
    intent = await stripe.paymentIntents.retrieve(candidate);
  }
  await record();
  return publicResult();
}

module.exports = { recover };
