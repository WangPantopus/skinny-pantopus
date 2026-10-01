// ============================================================
// Calendarly — session packages: purchase (stateless Stripe verb, no gig-settlement-pipeline
// changes), credit redemption against a booking, and credit restore on cancel.
// NOTE: settlement of package payments rides the same deferred gig-coupled transfer pipeline as
// booking payments — purchase + credit grant work; payout settlement is the documented deferral.
// ============================================================

const { createHash } = require('node:crypto');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const stripeService = require('../../stripe/stripeService');
const { PAYMENT_STATES } = require('../../stripe/paymentStateMachine');

// A retried purchase offers a priced pack's checkout again only while the buyer still owes it.
const OWED_PAYMENT_STATES = [PAYMENT_STATES.AUTHORIZE_PENDING, PAYMENT_STATES.AUTHORIZATION_FAILED];
const PAID_PAYMENT_STATES = [
  PAYMENT_STATES.AUTHORIZED,
  PAYMENT_STATES.CAPTURE_PENDING,
  PAYMENT_STATES.CAPTURED_HOLD,
  PAYMENT_STATES.TRANSFER_SCHEDULED,
  PAYMENT_STATES.TRANSFER_PENDING,
  PAYMENT_STATES.TRANSFERRED,
];

async function readCredit(creditId) {
  const { data, error } = await supabaseAdmin.from('PackageCredit').select('*').eq('id', creditId).maybeSingle();
  if (error) throw error;
  return data;
}

/** The answer for a purchase whose credit already exists: the first attempt's credit. */
async function answerRetry(credit, pkg, buyerUserId) {
  if (credit.package_id !== pkg.id || credit.buyer_user_id !== buyerUserId) {
    return { success: false, error: 'PURCHASE_REQUEST_REUSED', message: 'This purchase request was already used. Open the package again to buy it.' };
  }
  if (!credit.payment_id) return { success: true, credit, clientSecret: null };
  const { data: payment, error } = await supabaseAdmin
    .from('Payment')
    .select('payment_status, stripe_payment_intent_id')
    .eq('id', credit.payment_id)
    .maybeSingle();
  if (error || !payment) return { success: false, error: 'PAYMENT_UNAVAILABLE', message: 'Could not load this purchase. Please try again.' };
  if (PAID_PAYMENT_STATES.includes(payment.payment_status)) {
    return { success: true, credit, clientSecret: null, paymentId: credit.payment_id };
  }
  if (!OWED_PAYMENT_STATES.includes(payment.payment_status)) {
    return { success: false, error: 'PURCHASE_CLOSED', message: "This purchase didn't go through. Open the package again to buy it." };
  }
  const clientSecret = await stripeService.getPaymentIntentClientSecret(payment.stripe_payment_intent_id);
  return { success: true, credit, clientSecret, paymentId: credit.payment_id };
}

/**
 * Buy a package: grant credits immediately for free packages, else create a PaymentIntent and
 * grant credits tied to that Payment. Requires a signed-in buyer (Stripe customer).
 * A purchase keeps its identity through an uncertain reply: a retry with the same
 * `clientRequestId` answers with the credit the first attempt granted (and a priced pack's
 * unpaid checkout) instead of granting another pack. Scoped to the package and the buyer,
 * using the existing primary key for races.
 * @returns {Promise<{ success, credit?, clientSecret?, paymentId?, error?, message? }>}
 */
async function purchasePackage({ pkg, buyerUserId, clientRequestId }) {
  if (!buyerUserId) return { success: false, error: 'SIGNIN_REQUIRED', message: 'Sign in to buy a package.' };
  if (!pkg || !pkg.is_active) return { success: false, error: 'PACKAGE_UNAVAILABLE' };

  const creditId = clientRequestId ? createHash('sha256')
    .update(`pantopus:package-credit:v1:${pkg.id.toLowerCase()}:${buyerUserId.toLowerCase()}:${clientRequestId.toLowerCase()}`)
    .digest('hex').slice(0, 32) : null;
  if (creditId) {
    const existing = await readCredit(creditId);
    if (existing) return answerRetry(existing, pkg, buyerUserId);
  }
  const grantCredit = (paymentId) => {
    const row = { package_id: pkg.id, buyer_user_id: buyerUserId, total: pkg.sessions_count, remaining: pkg.sessions_count };
    if (paymentId) row.payment_id = paymentId;
    return (creditId
      ? supabaseAdmin.from('PackageCredit').upsert({ ...row, id: creditId }, { onConflict: 'id', ignoreDuplicates: true })
      : supabaseAdmin.from('PackageCredit').insert(row))
      .select('*')
      .maybeSingle();
  };
  // No row back: a concurrent retry of the same purchase granted it first.
  const answerConcurrentRetry = async () => {
    const existing = creditId ? await readCredit(creditId) : null;
    if (existing) return answerRetry(existing, pkg, buyerUserId);
    return { success: false, error: 'GRANT_FAILED', message: 'Could not grant the package.' };
  };

  // Free package — grant credits directly.
  if (!pkg.price_cents || pkg.price_cents <= 0) {
    const { data: credit, error } = await grantCredit(null);
    if (error) return { success: false, error: 'GRANT_FAILED', message: error.message };
    if (!credit) return answerConcurrentRetry();
    return { success: true, credit, clientSecret: null };
  }

  const payeeId = pkg.owner_user_id;
  if (!payeeId) return { success: false, error: 'NO_PAYEE', message: 'This package has no payee configured.' };

  const res = await stripeService.createPaymentIntentForGig({
    payerId: buyerUserId,
    payeeId,
    gigId: null,
    amount: pkg.price_cents,
    currency: pkg.currency || 'USD',
    metadata: { kind: 'package', package_id: pkg.id },
    description: `Pantopus package — ${pkg.name || 'Sessions'}`,
    // One intent per purchase: Stripe answers a retry of this create with the same intent.
    ...(creditId ? { idempotencyKey: `package-buy:${creditId}` } : {}),
  });
  if (!res || !res.success) return { success: false, error: 'PAYMENT_INTENT_FAILED', message: (res && res.error) || 'Could not start payment.' };

  const { error: pErr } = await supabaseAdmin.from('Payment').update({ payment_type: 'package_payment' }).eq('id', res.paymentId);
  if (pErr) logger.error('[packageService] failed to tag package payment', { paymentId: res.paymentId, error: pErr.message });

  const { data: credit, error: cErr } = await grantCredit(res.paymentId);
  if (cErr) return { success: false, error: 'GRANT_FAILED', message: cErr.message };
  if (!credit) return answerConcurrentRetry();

  return { success: true, credit, clientSecret: res.clientSecret, paymentId: res.paymentId };
}

/** Redeem one session credit against a booking (atomic optimistic decrement). */
async function redeemForBooking({ bookingId, creditId, userId }) {
  const { data: credit } = await supabaseAdmin.from('PackageCredit').select('*').eq('id', creditId).maybeSingle();
  if (!credit || credit.buyer_user_id !== userId) return { success: false, error: 'CREDIT_NOT_FOUND' };
  if (credit.remaining <= 0) return { success: false, error: 'NO_CREDIT_REMAINING' };
  // Guarded decrement (remaining unchanged since read) — prevents double-spend under concurrency.
  const { data: dec } = await supabaseAdmin
    .from('PackageCredit')
    .update({ remaining: credit.remaining - 1 })
    .eq('id', creditId)
    .eq('remaining', credit.remaining)
    .select('id');
  if (!dec || !dec.length) return { success: false, error: 'REDEEM_CONFLICT', message: 'Please try again.' };
  // `.is('package_credit_id', null)` makes this write the serialization point for the
  // booking↔credit link. Without it, two concurrent applies both link (the second
  // silently overwrites the first) while both decrements stand — one credit is lost.
  const { data: linked, error: bErr } = await supabaseAdmin
    .from('Booking')
    .update({ package_credit_id: creditId })
    .eq('id', bookingId)
    .is('package_credit_id', null)
    .select('id');
  if (bErr || !linked || !linked.length) {
    // Booking gone, or a credit is already applied — restore the decrement so it isn't lost.
    await supabaseAdmin.from('PackageCredit').update({ remaining: credit.remaining }).eq('id', creditId);
    return { success: false, error: 'ALREADY_APPLIED', message: 'A credit is already applied to this booking.' };
  }
  return { success: true, remaining: credit.remaining - 1 };
}

/** Restore a session credit when a credit-redeemed booking is cancelled. Best-effort. */
async function restoreForBooking(booking) {
  if (!booking || !booking.package_credit_id) return;
  // One credit row is a pack of N sessions shared by many bookings, so concurrent restores
  // (decline + cancel on sibling bookings) are ordinary. CAS + bounded retry mirrors
  // redeemForBooking's guarded decrement; a plain read-add-write drops increments.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: credit } = await supabaseAdmin.from('PackageCredit').select('id, remaining, total').eq('id', booking.package_credit_id).maybeSingle();
    if (!credit || credit.remaining >= credit.total) return;
    const { data: bumped } = await supabaseAdmin
      .from('PackageCredit')
      .update({ remaining: credit.remaining + 1 })
      .eq('id', credit.id)
      .eq('remaining', credit.remaining)
      .select('id');
    if (bumped && bumped.length) return;
  }
  logger.warn('[packageService] credit restore lost CAS race 3x — leaving un-restored', { creditId: booking.package_credit_id, bookingId: booking.id });
}

module.exports = { purchasePackage, redeemForBooking, restoreForBooking };
