// ============================================================
// Calendarly — booking payments orchestration over the existing Stripe Connect stack.
// No new payment tables: we reuse stripeService verbs and tag the Payment row as a booking
// (payment_type='booking_payment', booking_id). Manual-capture hold at create, capture on
// confirm, smart refund on cancel using the policy snapshot frozen on the booking.
//
// NOTE (Phase-2 follow-up): stripeWebhooks.js notification copy/links are still gig-shaped;
// booking payers' webhook-driven notifications fall back to generic copy. Booking lifecycle
// notifications themselves are sent by bookingService, so the booking UX is unaffected in v1.
// ============================================================

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const stripeService = require('../../stripe/stripeService');
const refunds = require('../paymentRefundService');

/** Does this event type require payment at booking time? */
function isPriced(eventType) {
  return !!(eventType && eventType.price_cents && eventType.price_cents > 0);
}

/** The user who gets paid for a booking (business/owner; falls back to the assigned host). */
function resolvePayeeId(booking) {
  return booking.owner_user_id || booking.host_user_id || null;
}

/**
 * Create a manual-capture PaymentIntent for a priced booking and link it to the Payment row.
 * Requires a signed-in invitee (a Stripe customer cannot be created for an anonymous email).
 * @returns {Promise<{ success, clientSecret?, paymentId?, error? }>}
 */
async function createPaymentForBooking({ booking, eventType }) {
  if (!isPriced(eventType)) return { success: true, clientSecret: null, paymentId: null };

  const payerId = booking.invitee_user_id;
  const payeeId = resolvePayeeId(booking);
  if (!payerId) {
    return { success: false, error: 'PAYMENT_REQUIRES_SIGNIN', message: 'Paid bookings require a signed-in guest.' };
  }
  if (!payeeId) {
    return { success: false, error: 'NO_PAYEE', message: 'This booking has no payee configured.' };
  }

  const res = await stripeService.createPaymentIntentForGig({
    payerId,
    payeeId,
    gigId: null,
    amount: eventType.price_cents,
    currency: eventType.currency || 'USD',
    homeId: null,
    metadata: { kind: 'booking', booking_id: booking.id, event_type_id: booking.event_type_id },
    description: `Pantopus booking — ${eventType.name || 'Appointment'}`,
  });

  if (!res || !res.success) {
    return { success: false, error: 'PAYMENT_INTENT_FAILED', message: (res && res.error) || 'Could not start payment.' };
  }

  // Tag the Payment as a booking payment and link both directions. Surface (don't swallow) link
  // failures: the PaymentIntent already exists, so an unlinked Payment must be visible for repair.
  const { error: pErr } = await supabaseAdmin
    .from('Payment')
    .update({ payment_type: 'booking_payment', booking_id: booking.id })
    .eq('id', res.paymentId);
  const { error: bErr } = await supabaseAdmin.from('Booking').update({ payment_id: res.paymentId }).eq('id', booking.id);
  if (pErr || bErr) {
    logger.error('[schedulingPaymentsService] failed to link payment<->booking (PaymentIntent created)', {
      paymentId: res.paymentId,
      bookingId: booking.id,
      paymentErr: pErr && pErr.message,
      bookingErr: bErr && bErr.message,
    });
  }

  return { success: true, clientSecret: res.clientSecret, paymentId: res.paymentId };
}

/** Capture the authorized hold when a booking is confirmed. Best-effort; logs on failure. */
async function captureForBooking(paymentId) {
  if (!paymentId) return { success: true };
  try {
    return await stripeService.capturePayment(paymentId);
  } catch (err) {
    logger.error('[schedulingPaymentsService] capture failed', { paymentId, error: err.message });
    return { success: false, error: err.message };
  }
}

/** Refund amount (cents) for a cancellation/no-show, per the booking's frozen policy. */
function computeRefundCents({ policy, amountTotal, startAtMs, nowMs, noShow }) {
  if (noShow) {
    // No-show: forfeit up to the no_show_fee, refund the rest (never below 0).
    const fee = policy.no_show_fee_cents || 0;
    return Math.max(0, amountTotal - fee);
  }
  const freeWindowMs = (policy.cancellation_window_min || 0) * 60 * 1000;
  if (nowMs <= startAtMs - freeWindowMs) return amountTotal; // cancelled within the free window
  switch (policy.refund_policy) {
    case 'none':
      return 0;
    case 'deposit_only':
      return policy.deposit_refundable ? amountTotal : Math.max(0, amountTotal - (policy.deposit_cents || 0));
    case 'partial':
      return Math.floor(amountTotal / 2);
    case 'full':
    default:
      return amountTotal;
  }
}

/**
 * Refund (or release) a booking's payment per policy. Safe to call for free bookings (no-op).
 * @returns {Promise<{ refunded: boolean, amount?: number }>}
 */
async function refundForBooking({ booking, initiatedBy, reason = 'booking_cancelled', noShow = false }) {
  if (!booking.payment_id) return { refunded: false };
  const { data: payment } = await supabaseAdmin
    .from('Payment')
    .select('id, amount_total, payment_status')
    .eq('id', booking.payment_id)
    .maybeSingle();
  if (!payment) return { refunded: false };

  const policy = booking.policy_snapshot || {};
  const amount = computeRefundCents({
    policy,
    amountTotal: payment.amount_total,
    startAtMs: Date.parse(booking.start_at),
    nowMs: Date.now(),
    noShow,
  });
  if (amount <= 0) {
    logger.info('[schedulingPaymentsService] policy yields no refund', { bookingId: booking.id });
    return { refunded: false, amount: 0 };
  }
  try {
    const result = await stripeService.createSmartRefund(payment.id, amount, reason, initiatedBy || 'system');
    return { refunded: result.success === true, amount, pending: ['pending', 'requires_action'].includes(result.refundRequest?.status),
      refundRequest: result.refundRequest || null };
  } catch (err) {
    logger.error('[schedulingPaymentsService] refund failed', { paymentId: payment.id, error: err.message });
    return { refunded: false, error: err.message };
  }
}

/** Cancel and reserve the existing refund together, before any provider effect. */
async function cancelPaidBooking({ booking, initiatedBy, reason }) {
  const { data: payment, error } = await supabaseAdmin.from('Payment').select('*')
    .eq('id', booking.payment_id).maybeSingle();
  if (error || !payment) throw Object.assign(new Error('Payment details are unavailable. Your booking has not been cancelled. Please retry.'), { statusCode: 503, code: 'CANCEL_PAYMENT_UNAVAILABLE' });
  const decidedAt = new Date();
  const policyAmount = computeRefundCents({ policy: booking.policy_snapshot || {}, amountTotal: payment.amount_total,
    startAtMs: Date.parse(booking.start_at), nowMs: decidedAt.getTime() });
  const amount = Math.max(0, policyAmount - (payment.refunded_amount || 0));
  const { data, error: saveError } = await supabaseAdmin.rpc('cancel_booking_with_refund', {
    p_booking_id: booking.id, p_actor_id: initiatedBy || null, p_reason: reason || null,
    p_expected_updated_at: booking.updated_at, p_payment_id: payment.id,
    p_expected_payment: refunds.snapshot(payment), p_refund_amount: amount, p_decided_at: decidedAt.toISOString(),
  });
  if (saveError || !data?.booking || data.error) {
    throw Object.assign(new Error('Cancellation could not be confirmed. Check your booking and retry.'), { statusCode: 503, code: 'CANCEL_SAVE_UNAVAILABLE' });
  }
  return data;
}

/** Read-only public projection; a manage-page GET must never contact Stripe. */
async function cancellationPayment(booking, retry = false) {
  if (!booking.payment_id || !['cancelled', 'declined'].includes(booking.status)) return null;
  const unavailable = { status: 'unavailable', can_retry: false,
    message: 'Your booking is cancelled. Payment status is temporarily unavailable. Check again before booking another appointment.' };
  try {
    const { data: payment, error } = await supabaseAdmin.from('Payment').select('id, payment_status, amount_total, refunded_amount, metadata')
      .eq('id', booking.payment_id).maybeSingle();
    if (error || !payment) return unavailable;
    const decision = payment.metadata?.booking_cancellation;
    if (decision?.booking_id === booking.id && decision.refund_amount_cents === 0) {
      if (['authorized', 'authorize_pending', 'capture_pending'].includes(payment.payment_status)) {
        return { status: 'needs_review', can_retry: false, message: 'Your booking is cancelled. The cancellation policy has no refund, but a payment authorization is still unresolved. Contact the host or Pantopus support.' };
      }
      return { status: 'not_required', can_retry: false, message: 'Your booking is cancelled. No additional refund is due under the cancellation policy.' };
    }
    const { data: requests, error: readError } = await supabaseAdmin.from('PaymentRefundRequest').select('*')
      .eq('payment_id', payment.id).eq('actor_mode', 'policy').order('created_at', { ascending: false });
    if (readError) return unavailable;
    let request = (requests || []).find(r => r.id === decision?.request_id && decision?.booking_id === booking.id);
    if (retry && request && ['pending', 'requires_action'].includes(request.status)) {
      try { await refunds.recoverRequest(request); }
      catch (err) { logger.warn('[schedulingPaymentsService] cancellation payment remains pending', { bookingId: booking.id, code: err.code }); }
      return cancellationPayment(booking);
    }
    // Preserve verified legacy successes, but do not invent a missing historic
    // cancellation time/amount or create another operation from today's policy.
    if (!request && payment.payment_status === 'canceled') {
      return { status: 'succeeded', operation: 'release', can_retry: false, message: 'Your booking is cancelled. The payment authorization was released; no payment was captured.' };
    }
    if (!request && ['refunded', 'refunded_full'].includes(payment.payment_status)) {
      return { status: 'succeeded', operation: 'refund', can_retry: false, message: 'Your booking is cancelled. Your payment was refunded. Your bank may take time to show it.' };
    }
    if (!request) return { status: 'needs_review', can_retry: false,
      message: 'Your booking is cancelled, but its payment needs review. Contact the host or Pantopus support before booking another appointment.' };
    const release = request.operation === 'release';
    const pending = ['pending', 'requires_action'].includes(request.status);
    const message = request.status === 'succeeded'
      ? (release ? 'Your booking is cancelled. The payment authorization was released; no payment was captured.'
        : 'Your booking is cancelled. Your refund was confirmed. Your bank may take time to show it.')
      : pending ? (release ? 'Your booking is cancelled. Releasing the payment authorization is still pending. We will keep checking; you can also retry here.'
        : 'Your booking is cancelled. Your refund is still pending. We will keep checking; you can also retry here.')
        : 'Your booking is cancelled, but its payment needs review. Contact the host or Pantopus support.';
    return { status: request.status === 'succeeded' ? 'succeeded' : pending ? 'pending' : 'needs_review',
      operation: request.operation, amount_cents: request.amount_cents, can_retry: pending, message };
  } catch (err) {
    logger.warn('[schedulingPaymentsService] cancellation payment lookup unavailable', { bookingId: booking.id, code: err.code });
    return unavailable;
  }
}

module.exports = {
  isPriced,
  createPaymentForBooking,
  captureForBooking,
  refundForBooking,
  computeRefundCents,
  cancelPaidBooking,
  cancellationPayment,
};
