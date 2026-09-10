const db = require('../config/supabaseAdmin');
const stripeService = require('../stripe/stripeService');
const { conflict, assertPaymentTerms } = require('../stripe/gigPaymentProof');

async function rpc(name, args, key) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw Object.assign(new Error('Could not save payment progress. Please retry.'), { statusCode: 503 });
  if (data?.error === 'FORBIDDEN') throw Object.assign(new Error('Your permission to manage this gig has changed.'), { statusCode: 403 });
  if (!data || data.error || (key && !data[key])) {
    throw conflict(data?.error === 'NOT_FOUND' ? 'Payment acceptance not found' : 'Payment acceptance has changed. Please retry.');
  }
  return data;
}
const terms = (gig, payeeId, amount) => ({ gigId: gig.id, payerId: gig.user_id, payeeId, amount });

async function begin(gig, bid, actorId = gig.user_id) {
  const { attempt, reused } = await rpc('begin_paid_gig_acceptance_as_actor', {
    p_gig_id: gig.id, p_bid_id: bid.id, p_payer_id: gig.user_id, p_actor_id: actorId,
  }, 'attempt');
  let result;
  if (attempt.payment_id) {
    // Retrieve the bound intent. Never recreate an intent for a known attempt,
    // even when the provider's idempotency cache could have expired.
    result = await stripeService.resumeGigPayment(attempt.payment_id,
      terms(gig, attempt.payee_id, attempt.amount));
    await verifyActor(gig, actorId);
    return result;
  } else {
    // A saved Payment may outlive a lost binding response. Recover that exact
    // row before considering another provider request, including old attempts.
    const { data: saved, error: savedError } = await db.from('Payment').select('*')
      .eq('gig_id', attempt.gig_id).eq('payer_id', attempt.payer_id)
      .contains('metadata', { acceptance_attempt_id: attempt.id }).maybeSingle();
    if (savedError) throw Object.assign(new Error('Payment recovery is unavailable. Please retry.'), { statusCode: 503 });
    if (saved) {
      result = await stripeService.resumeGigPayment(saved.id, terms(gig, attempt.payee_id, attempt.amount));
      await rpc('bind_paid_gig_acceptance_as_actor', { p_attempt_id: attempt.id, p_payment_id: saved.id, p_actor_id: actorId }, 'attempt');
      return result;
    }
    if (reused) {
      const recovered = await stripeService.recoverGigPayment(attempt);
      if (recovered) {
        await rpc('bind_paid_gig_acceptance_as_actor', { p_attempt_id: attempt.id, p_payment_id: recovered.id, p_actor_id: actorId }, 'attempt');
        if (recovered.payment_status === 'canceled') {
          await abort(gig, bid, actorId);
          throw conflict('The previous authorization was canceled. Please accept the bid again.');
        }
        result = await stripeService.resumeGigPayment(recovered.id, terms(gig, attempt.payee_id, attempt.amount));
        await verifyActor(gig, actorId);
        return result;
      }
    }
    // A provider response may have been lost. Retry the same durable operation
    // inside a conservative window; old unknown outcomes require reconciliation.
    const createdAt = Date.parse(attempt.created_at);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 10 * 60 * 1000) {
      throw conflict('This payment setup needs reconciliation before it can be retried');
    }
    result = await stripeService.createPaymentIntentForGig({
      payerId: attempt.payer_id, payeeId: attempt.payee_id, gigId: attempt.gig_id,
      amount: attempt.amount, currency: attempt.currency, homeId: gig.origin_home_id || null,
      metadata: { acceptance_attempt_id: attempt.id }, idempotencyKey: `gig-accept:${attempt.id}`,
    });
    assertPaymentTerms(result.payment, terms(gig, attempt.payee_id, attempt.amount));
    await rpc('bind_paid_gig_acceptance_as_actor', { p_attempt_id: attempt.id, p_payment_id: result.paymentId, p_actor_id: actorId }, 'attempt');
  }
  // Even a just-created provider intent can be an idempotent prior hold.
  result = await stripeService.resumeGigPayment(result.paymentId, terms(gig, attempt.payee_id, attempt.amount));
  await verifyActor(gig, actorId);
  return result;
}
async function verifyActor(gig, actorId) {
  return rpc('verify_paid_gig_actor', { p_payer_id: gig.user_id, p_actor_id: actorId }, 'allowed');
}
async function finalize(gig, bid, actorId = gig.user_id) {
  // Accepted receipts survive retries and later gig progress. Do not re-send
  // notifications or re-authorize a charge after a lost HTTP response.
  if (bid.status === 'accepted' && gig.payment_id && gig.accepted_by === bid.user_id) {
    return rpc('finalize_paid_gig_acceptance_as_actor', {
      p_gig_id: gig.id, p_bid_id: bid.id, p_payer_id: gig.user_id, p_actor_id: actorId, p_payment_id: gig.payment_id,
    }, 'gig');
  }
  if (gig.status !== 'open' || bid.status !== 'pending_payment' || !bid.pending_payment_intent_id) {
    throw conflict('The bid has no pending payment to authorize');
  }
  const paymentId = bid.pending_payment_intent_id;
  // The old ten-minute UI expiry must not discard a completed provider hold.
  // Current exact provider proof, then the transaction's locked terms, decide.
  await stripeService.verifyGigAuthorization(paymentId,
    terms(gig, bid.user_id, Math.round(Number(bid.bid_amount) * 100)));
  return rpc('finalize_paid_gig_acceptance_as_actor', {
    p_gig_id: gig.id, p_bid_id: bid.id, p_payer_id: gig.user_id, p_actor_id: actorId, p_payment_id: paymentId,
  }, 'gig');
}
async function abort(gig, bid, actorId = gig.user_id) {
  const args = { p_gig_id: gig.id, p_bid_id: bid.id, p_payer_id: gig.user_id, p_actor_id: actorId };
  const { data: active, error: activeError } = await db.from('GigPaymentAcceptance').select('*')
    .eq('gig_id', gig.id).eq('bid_id', bid.id).eq('payer_id', gig.user_id)
    .in('state', ['initializing', 'pending', 'canceling']).maybeSingle();
  if (activeError) throw Object.assign(new Error('Payment recovery is unavailable. Please retry.'), { statusCode: 503 });
  if (active && !active.payment_id) {
    await verifyActor(gig, actorId);
    const { data: saved, error: savedError } = await db.from('Payment').select('*')
      .eq('gig_id', gig.id).eq('payer_id', gig.user_id)
      .contains('metadata', { acceptance_attempt_id: active.id }).maybeSingle();
    if (savedError) throw Object.assign(new Error('Payment recovery is unavailable. Please retry.'), { statusCode: 503 });
    const recovered = saved || await stripeService.recoverGigPayment(active);
    if (!recovered) throw conflict('The previous provider outcome is still unknown. The same checkout has been retained.');
    await rpc('bind_paid_gig_acceptance_as_actor', { p_attempt_id: active.id, p_payment_id: recovered.id, p_actor_id: actorId }, 'attempt');
  }
  const result = await rpc('cancel_paid_gig_acceptance_as_actor', args);
  if (result.reused) return result;
  if (!result.attempt?.payment_id) throw conflict('Cancellation could not be prepared');
  // The cancellation fence blocks finalization until provider cancellation is
  // confirmed. An unknown provider outcome retains the same durable identity.
  await stripeService.cancelAuthorization(result.attempt.payment_id);
  return rpc('cancel_paid_gig_acceptance_as_actor', { ...args, p_complete: true }, 'bid');
}
module.exports = { begin, finalize, abort, terms, rpc };
