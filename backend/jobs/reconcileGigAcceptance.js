const db = require('../config/supabaseAdmin');
const stripeService = require('../stripe/stripeService');
const { assertPaymentTerms } = require('../stripe/gigPaymentProof');

// Discover existing provider objects only. Neither list absence nor this job
// can create/cancel/confirm an authorization or assign a worker.
async function reconcileGigAcceptance() {
  const now = new Date();
  const { data: attempts, error } = await db.from('GigPaymentAcceptance').select('*')
    .eq('state', 'initializing').is('payment_id', null).lte('recovery_after', now.toISOString())
    .lt('created_at', new Date(now.getTime() - 30_000).toISOString()).order('recovery_after').limit(10);
  if (error || !Array.isArray(attempts)) throw new Error('Payment recovery queue unavailable');
  let recovered = 0;
  for (const attempt of attempts) {
    const { data: claimed, error: claimError } = await db.from('GigPaymentAcceptance')
      .update({ recovery_after: new Date(now.getTime() + 15 * 60_000).toISOString(), recovery_error: null })
      .eq('id', attempt.id).eq('state', 'initializing').is('payment_id', null)
      .eq('recovery_after', attempt.recovery_after).select('id').maybeSingle();
    if (claimError) throw new Error('Payment recovery claim unavailable');
    if (!claimed) continue;
    let reason = null;
    try {
      const { data: saved, error: savedError } = await db.from('Payment').select('*')
        .eq('gig_id', attempt.gig_id).eq('payer_id', attempt.payer_id)
        .contains('metadata', { acceptance_attempt_id: attempt.id }).maybeSingle();
      if (savedError) throw new Error('Payment recovery read unavailable');
      const payment = saved || await stripeService.recoverGigPayment(attempt);
      if (!payment) reason = 'provider_outcome_unresolved';
      else {
        assertPaymentTerms(payment, { gigId: attempt.gig_id, payerId: attempt.payer_id, payeeId: attempt.payee_id, amount: attempt.amount });
        const { data, error: bindError } = await db.rpc('bind_paid_gig_acceptance', { p_attempt_id: attempt.id, p_payment_id: payment.id });
        if (bindError || !data?.attempt || data.error) throw new Error('Payment recovery bind unavailable');
        recovered += 1;
      }
    } catch {
      reason = 'reconciliation_required';
    }
    if (reason) {
      const { error: saveError } = await db.from('GigPaymentAcceptance').update({ recovery_error: reason })
        .eq('id', attempt.id).eq('state', 'initializing').is('payment_id', null);
      if (saveError) throw new Error('Payment recovery outcome unavailable');
    }
  }
  return { recovered };
}
module.exports = reconcileGigAcceptance;
