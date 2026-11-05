'use strict';

/**
 * Paying a business invoice: the internals of POST /api/businesses/invoices/:invoiceId/pay and /confirm, shared with
 * Crew Day's charges (services/crewDay/money.js), which pay a booking's invoice off-session with the card the
 * household saved when booking. Only Stripe can say an invoice was paid; the business's owner is told once.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const stripeService = require('../stripe/stripeService');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');
const invoiceBills = require('./invoiceBills');
const { loadChatPeople } = require('./chatPeople');
const { getBusinessPrimaryOwnerId, getBusinessPayoutAccount } = require('../utils/businessPermissions');

const INVOICE_PAID_PAYMENT_STATES = new Set([
  PAYMENT_STATES.CAPTURED_HOLD,
  PAYMENT_STATES.TRANSFER_SCHEDULED,
  PAYMENT_STATES.TRANSFER_PENDING,
  PAYMENT_STATES.TRANSFERRED,
]);

// A payment that has not reached its held state yet (its card was just accepted, perhaps after 3-D Secure).
const INVOICE_SETTLING_PAYMENT_STATES = new Set([
  PAYMENT_STATES.AUTHORIZE_PENDING,
  PAYMENT_STATES.AUTHORIZATION_FAILED,
  PAYMENT_STATES.CAPTURE_PENDING,
]);
const INVOICE_CONFIRM_RECHECKS = 4;
const INVOICE_CONFIRM_RECHECK_MS = 1000;

// A PaymentIntent the payer hasn't completed yet; Pay hands the same one back.
const RESUMABLE_INTENT_STATUSES = new Set(['requires_payment_method', 'requires_confirmation', 'requires_action']);

/**
 * Only Stripe can say an invoice payment went through. Syncs the payment with its intent, captures it
 * if it's authorized (held), and returns its status.
 */
async function captureInvoicePayment(paymentId) {
  const synced = await stripeService.syncPaymentAuthorizationStatus(paymentId);
  if (synced?.payment_status === PAYMENT_STATES.AUTHORIZED) {
    await stripeService.capturePayment(paymentId);
  }
  const { data: payment, error } = await supabaseAdmin
    .from('Payment')
    .select('payment_status')
    .eq('id', paymentId)
    .maybeSingle();
  if (error) throw error;
  return payment?.payment_status || null;
}

/**
 * Tells the business's owner that an invoice was paid, when it is: the money reaches the business's payout account
 * (or, without one, the owner's wallet) after the 48-hour review (processPendingTransfers says so again then), but
 * they should not have to open the app to find out. The payer goes by their Local Profile, as on the invoice list.
 */
async function notifyInvoicePaid(invoice) {
  const ownerId = await getBusinessPrimaryOwnerId(invoice.business_user_id);
  if (!ownerId) return;
  const [people, { data: payment }, { data: business }] = await Promise.all([
    loadChatPeople([invoice.recipient_user_id]),
    invoice.payment_id
      ? supabaseAdmin.from('Payment').select('amount_to_payee, payee_id').eq('id', invoice.payment_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from('User').select('name').eq('id', invoice.business_user_id).maybeSingle(),
  ]);
  const total = `$${(invoice.total_cents / 100).toFixed(2)}`;
  const payerName = people.get(String(invoice.recipient_user_id))?.displayName || 'A customer';
  const net = payment?.amount_to_payee ? `$${(payment.amount_to_payee / 100).toFixed(2)}` : null;
  const toBusiness = payment?.payee_id === invoice.business_user_id;
  const destination = toBusiness ? `${business?.name || "the business"}'s payout account` : 'your wallet';
  await require('./notificationService').createNotification({
    userId: ownerId,
    type: 'invoice_paid',
    title: `Invoice paid: ${total}`,
    body: net
      ? `${payerName} paid your invoice. ${net} will reach ${destination} after a short review.`
      : `${payerName} paid your invoice.`,
    link: toBusiness ? `/app/businesses/${invoice.business_user_id}/dashboard?tab=payments` : '/app/wallet',
    metadata: { invoice_id: invoice.id, business_id: invoice.business_user_id, amount_cents: invoice.total_cents },
    context: 'personal',
    idempotencyKey: `invoice-paid:${invoice.id}`,
  });
}

/** Marks the invoice paid (once) and returns it. */
async function markInvoicePaid(invoiceId) {
  const { data: updatedRows, error } = await supabaseAdmin
    .from('BusinessInvoice')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .neq('status', 'paid')
    .select();
  if (error) throw error;
  // Its bill in the payer's Mail shows Paid and moves to Receipts (Mail tab, SRV-7); never fails the payment.
  void invoiceBills.onInvoicePaid(invoiceId);
  if (updatedRows?.[0]) {
    // Only the request that marked it paid says so; a notice that fails never fails the payment.
    notifyInvoicePaid(updatedRows[0]).catch((err) => {
      logger.warn('Invoice paid notice skipped', { invoiceId, error: err.message });
    });
    // A Crew Day booking charged through this invoice (by its job or by the household paying it) turns paid.
    await require('./crewDay/money').onInvoicePaid(updatedRows[0]).catch((err) => {
      logger.warn('Crew Day invoice paid hook failed', { invoiceId, error: err.message });
    });
    return updatedRows[0];
  }
  // Another request marked it paid first.
  const { data: invoice } = await supabaseAdmin.from('BusinessInvoice').select('*').eq('id', invoiceId).maybeSingle();
  return invoice;
}

/**
 * Starts paying an invoice for its recipient: a manual-capture PaymentIntent to the business's payout account (or,
 * without one, its owner), priced at the business's fee rate, recorded on the invoice (status viewed). With
 * `offSession` the saved `paymentMethodId` is confirmed at once (a declined card throws Stripe's error). Answers
 * `{ refused }` (BUSINESS_CANNOT_RECEIVE, OWN_BUSINESS, PAYMENT_FAILED) or `{ result, feeCents }`.
 */
async function startInvoicePayment(invoice, payerId, { paymentMethodId, offSession = false, idempotencyKey, metadata = {} }) {
  const ownerId = await getBusinessPrimaryOwnerId(invoice.business_user_id);
  if (!ownerId) return { refused: 'BUSINESS_CANNOT_RECEIVE' };
  if (ownerId === payerId) return { refused: 'OWN_BUSINESS' };
  const businessAccount = await getBusinessPayoutAccount(invoice.business_user_id);
  const payeeUserId = businessAccount?.payouts_enabled ? invoice.business_user_id : ownerId;

  // Create payment intent. The key ties it to the payment it replaces, so a double tap makes one.
  const result = await stripeService.createPaymentIntentForGig({
    payerId,
    payeeId: payeeUserId,
    // The invoice's fee was priced for the business (createInvoice), so the payment is too.
    feeRateSubjectId: invoice.business_user_id,
    gigId: invoice.gig_id || null,
    amount: invoice.total_cents,
    paymentMethodId,
    offSession,
    metadata: {
      type: 'invoice_payment',
      invoice_id: invoice.id,
      business_user_id: invoice.business_user_id,
      ...metadata,
    },
    idempotencyKey,
  });

  if (!result.success) return { refused: 'PAYMENT_FAILED' };

  // Store the payment reference and mark as "viewed" (not "paid" yet —
  // the invoice transitions to "paid" only after Stripe confirms capture).
  // The payment is priced at the business's rate now, which can differ from when the invoice was sent (its type
  // was verified since, say); the invoice shows the fee actually taken.
  const paymentFee = result.payment?.amount_platform_fee;
  const feeCents = Number.isInteger(paymentFee) ? paymentFee : invoice.fee_cents;
  const { error: updateErr } = await supabaseAdmin
    .from('BusinessInvoice')
    .update({
      status: 'viewed',
      payment_id: result.paymentId,
      stripe_payment_intent_id: result.paymentIntentId,
      fee_cents: feeCents,
    })
    .eq('id', invoice.id);

  if (updateErr) {
    logger.error('Failed to update invoice payment reference', { invoiceId: invoice.id, error: updateErr.message });
  }
  return { result, feeCents };
}

module.exports = {
  INVOICE_PAID_PAYMENT_STATES,
  INVOICE_SETTLING_PAYMENT_STATES,
  INVOICE_CONFIRM_RECHECKS,
  INVOICE_CONFIRM_RECHECK_MS,
  RESUMABLE_INTENT_STATUSES,
  captureInvoicePayment,
  notifyInvoicePaid,
  markInvoicePaid,
  startInvoicePayment,
};
