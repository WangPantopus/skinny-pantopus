// ============================================================
// JOB: Process Pending Transfers (Escrow Release)
// Runs hourly at :15. For payments in captured_hold state where
// the cooling-off period has ended, credits the provider's
// Pantopus wallet.
//
// Key decisions:
// - Idempotency keys prevent double-transfers on overlap/retry
// - Payee payout-enabled check skips providers not onboarded
// - Disputed/refund-flagged payments are excluded
// - balance_insufficient errors trigger admin alert
//
// Recovery: Stranded payments in transfer_scheduled or
// transfer_pending (older than 10 min) are recovered at the
// start of each run by checking whether the wallet was already
// credited.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const walletService = require('../services/walletService');
const walletSettlement = require('../services/walletSettlementService');
const { getBusinessPrimaryOwnerId } = require('../utils/businessPermissions');
const { capturedFeeCents } = require('../stripe/gigPaymentProof');
const { PAYMENT_STATES, transitionPaymentStatus } = require('../stripe/paymentStateMachine');
const { createNotification } = require('../services/notificationService');
const { sendAlert, SEVERITY } = require('../services/alertingService');
const logger = require('../utils/logger');

/**
 * New income pays what the payee still owes for refunded or disputed payments first (founder decision 2026-10-09).
 * The release already committed; a failure here leaves the debt for the next income or withdrawal, which collect
 * again, so it never fails the release.
 */
async function collectDebtsAfterIncome(payeeId, paymentId) {
  try {
    return (await walletService.collectDebts(payeeId)).collected;
  } catch (err) {
    logger.warn('processPendingTransfers: debt collection after release failed', {
      paymentId, payeeId, error: err.message,
    });
    return 0;
  }
}

// The transaction rechecks exact income proof and serializes with refunds.
async function reconcileWalletRelease(paymentId) {
  const { data, error } = await supabaseAdmin.rpc('reconcile_payment_wallet_release', { p_payment_id: paymentId });
  if (error || !data || data.error) throw new Error('Wallet release requires reconciliation');
  return data.payment;
}
async function recoverStrandedTransfers() {
  const { data, error } = await supabaseAdmin.from('Payment').select('id')
    .in('payment_status', [PAYMENT_STATES.TRANSFER_SCHEDULED, PAYMENT_STATES.TRANSFER_PENDING])
    .lte('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()).or('dispute_id.is.null,dispute_status.eq.won');
  if (error) throw new Error('Wallet release recovery is unavailable');
  for (const payment of data || []) {
    try { await reconcileWalletRelease(payment.id); }
    catch (err) { logger.error('Wallet release remains pending', { paymentId: payment.id, error: err.message }); }
  }
}

// A payment for a business invoice: a gig_payment with no gig, tagged by the invoice route.
function isInvoicePayment(payment) {
  return payment.payment_type === 'gig_payment' && !payment.gig_id && payment.metadata?.type === 'invoice_payment';
}

// The invoice behind an invoice payment must be this payer's, linked to this payment, and not voided. A capture the
// payer's app never confirmed leaves the invoice unpaid; the money is theirs to give, so it is marked paid here.
async function confirmInvoiceForRelease(payment) {
  const invoiceId = payment.metadata?.invoice_id;
  const { data: invoice, error } = invoiceId ? await supabaseAdmin
    .from('BusinessInvoice')
    .select('id, status, payment_id, recipient_user_id')
    .eq('id', invoiceId)
    .maybeSingle() : { data: null, error: null };
  if (error || !invoice || invoice.payment_id !== payment.id || invoice.recipient_user_id !== payment.payer_id
    || invoice.status === 'void') {
    logger.warn('processPendingTransfers: invoice payment does not match its invoice; not released', {
      paymentId: payment.id, invoiceId: invoiceId || null, error: error?.message,
    });
    return false;
  }
  // Paid before invoices went to the owner: the payee is the business account, which has no sign-in and so no
  // wallet anyone can open. Its owner receives the money, never a wallet nobody can reach.
  const { data: payee } = await supabaseAdmin.from('User').select('account_type').eq('id', payment.payee_id).maybeSingle();
  if (payee?.account_type === 'business') {
    const ownerId = await getBusinessPrimaryOwnerId(payment.payee_id);
    const { data: moved, error: moveError } = ownerId ? await supabaseAdmin.from('Payment')
      .update({ payee_id: ownerId, updated_at: new Date().toISOString() })
      .eq('id', payment.id).eq('payee_id', payment.payee_id).eq('payment_status', PAYMENT_STATES.CAPTURED_HOLD)
      .select('id').maybeSingle() : { data: null, error: null };
    if (moveError || !moved) {
      logger.warn('processPendingTransfers: invoice payment has no owner to receive it; not released', {
        paymentId: payment.id, error: moveError?.message,
      });
      return false;
    }
    payment.payee_id = ownerId;
  }
  if (invoice.status !== 'paid') {
    await supabaseAdmin.from('BusinessInvoice')
      .update({ status: 'paid', paid_at: payment.captured_at || new Date().toISOString() })
      .eq('id', invoice.id).neq('status', 'paid').neq('status', 'void');
  }
  return true;
}

async function processPendingTransfers() {
  const now = new Date();
  const nowIso = now.toISOString();
  const legacyCoolingFallbackIso = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  try {
    // ─── Phase 1: Recover stranded transfers from prior runs ───
    await recoverStrandedTransfers(nowIso);

    // ─── Phase 2: Process new transfers ───
    // Criteria:
    //   - payment_status = 'captured_hold'
    //   - cooling_off_ends_at <= now (cooling period has passed)
    //   - No active dispute or refund
    const selectFields = `
      id,
      gig_id,
      booking_id,
      payer_id,
      payee_id,
      amount_total,
      amount_to_payee,
      amount_platform_fee,
      currency,
      payment_type,
      captured_at,
      stripe_customer_id,
      stripe_transfer_id,
      refunded_amount,
      transfer_status,
      transfer_completed_at,
      stripe_charge_id,
      stripe_payment_intent_id,
      payment_status,
      cooling_off_ends_at,
      created_at,
      dispute_id,
      dispute_status,
      metadata
    `;

    const [standardReadyRes, legacyReadyRes] = await Promise.all([
      supabaseAdmin
        .from('Payment')
        .select(selectFields)
        .in('payment_status', [PAYMENT_STATES.CAPTURED_HOLD, PAYMENT_STATES.REFUNDED_PARTIAL, PAYMENT_STATES.REFUNDED_FULL])
        .is('transfer_completed_at', null)
        .lte('cooling_off_ends_at', nowIso)
        .or('dispute_id.is.null,dispute_status.eq.won'),
      // Legacy safety-net: older captured_hold rows may have null cooling_off_ends_at.
      // Treat them as transferable once they are at least 48h old.
      supabaseAdmin
        .from('Payment')
        .select(selectFields)
        .in('payment_status', [PAYMENT_STATES.CAPTURED_HOLD, PAYMENT_STATES.REFUNDED_PARTIAL, PAYMENT_STATES.REFUNDED_FULL])
        .is('transfer_completed_at', null)
        .is('cooling_off_ends_at', null)
        .lte('created_at', legacyCoolingFallbackIso)
        .or('dispute_id.is.null,dispute_status.eq.won'),
    ]);

    if (standardReadyRes.error || legacyReadyRes.error) {
      logger.error('processPendingTransfers: query error', {
        standardError: standardReadyRes.error?.message,
        legacyError: legacyReadyRes.error?.message,
      });
      return;
    }

    const paymentsById = new Map();
    for (const payment of (standardReadyRes.data || [])) paymentsById.set(payment.id, payment);
    for (const payment of (legacyReadyRes.data || [])) paymentsById.set(payment.id, payment);
    const payments = Array.from(paymentsById.values());

    if (!payments || payments.length === 0) {
      logger.info('processPendingTransfers: no payments ready for transfer');
      return;
    }

    logger.info('processPendingTransfers: found eligible payments', { count: payments.length });

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const payment of payments) {
      try {
        // Safety: double-check state hasn't changed (race condition guard)
        const { data: fresh } = await supabaseAdmin
          .from('Payment')
          .select('payment_status, dispute_id, dispute_status')
          .eq('id', payment.id)
          .single();

        // An invoice payment has no task behind it, so the task-bound settlement below (which proves the task was
        // completed and confirmed) can never apply; it is released straight into the owner's wallet.
        const invoicePayment = isInvoicePayment(payment);
        const protectedWalletPayment = ['gig_payment', 'tip'].includes(payment.payment_type) && !invoicePayment;
        const admittedStates = protectedWalletPayment ? ['captured_hold', 'refunded_partial', 'refunded_full'] : ['captured_hold'];
        if (!fresh || !admittedStates.includes(fresh.payment_status) || (fresh.dispute_id && fresh.dispute_status !== 'won')) {
          logger.info('processPendingTransfers: skipping (state changed)', {
            paymentId: payment.id,
            currentStatus: fresh?.payment_status,
          });
          skipCount++;
          continue;
        }

        // Safety: verify amount makes sense
        let transferAmount = payment.amount_to_payee;
        if (!protectedWalletPayment && (!transferAmount || transferAmount <= 0)) {
          logger.error('processPendingTransfers: invalid transfer amount', {
            paymentId: payment.id,
            amount: transferAmount,
          });
          errorCount++;
          continue;
        }

        if (protectedWalletPayment) {
          // A cancelled task's charged poster-fault fee has its own settlement:
          // only the worker share of the fee, never the task payment path. Only
          // a recorded fee capture routes there; any other fee record does not.
          const result = payment.payment_type === 'gig_payment' && capturedFeeCents(payment) !== null
            ? await walletSettlement.settleFee(payment) : await walletSettlement.settle(payment);
          if (result.reused || result.settlement.status === 'no_earnings') { skipCount++; continue; }
          // Money, in-app notices and delivery events committed together. The
          // durable relay sends the same notification after a process restart.
          successCount++;
          await collectDebtsAfterIncome(payment.payee_id, payment.id);
          continue;
        } else {
          if (invoicePayment && !(await confirmInvoiceForRelease(payment))) { skipCount++; continue; }
          // ─── Transition to transfer_scheduled (concurrency guard) ───
          try {
            await transitionPaymentStatus(payment.id, PAYMENT_STATES.TRANSFER_SCHEDULED);
          } catch (transErr) {
            // If transition fails, another process probably got here first
            logger.warn('processPendingTransfers: transition to transfer_scheduled failed (likely race)', {
              paymentId: payment.id,
              error: transErr.message,
            });
            skipCount++;
            continue;
          }

          // ─── Credit provider's WALLET ───
          // Funds sit in the provider's Pantopus wallet balance.
          // Provider can withdraw to bank whenever they want.
          const isTipPayment = payment.payment_type === 'tip';
          if (isTipPayment) {
            await walletService.creditTipIncome(
              payment.payee_id,
              transferAmount,
              payment.gig_id,
              payment.id,
              payment.payer_id,
            );
          } else if (invoicePayment) {
            await walletService.creditGigIncome(
              payment.payee_id,
              transferAmount,
              payment.gig_id,
              payment.id,
              payment.payer_id,
              { description: 'Invoice payment received' },
            );
          } else {
            await walletService.creditGigIncome(
              payment.payee_id,
              transferAmount,
              payment.gig_id,
              payment.id,
              payment.payer_id,
            );
          }

          // ─── Transition directly to transferred ───
          // Wallet credit is synchronous — no need for intermediate
          // transfer_pending state. transfer_pending is reserved for
          // async Stripe Transfers if ever needed in the future.
          const completed = await reconcileWalletRelease(payment.id);
          if (completed?.payment_status !== PAYMENT_STATES.TRANSFERRED) throw new Error('Wallet release state changed');
        }

        successCount++;
        const paidTowardDebt = await collectDebtsAfterIncome(payment.payee_id, payment.id);
        // Money that went straight to what the payee owed isn't withdrawable; its own notice says where it went.
        const withdrawLine = paidTowardDebt > 0 ? '' : ' You can withdraw to your bank anytime.';

        // Booking payments have no gig. Keep their notices on invitee-accessible
        // booking pages instead of producing a /gigs/null destination. An invoice's notices point at the invoice
        // and the wallet.
        const isBooking = payment.payment_type === 'booking_payment';
        const { data: gig } = payment.gig_id ? await supabaseAdmin
          .from('Gig')
          .select('title')
          .eq('id', payment.gig_id)
          .single() : { data: null };

        const gigTitle = gig?.title || 'a gig';
        const amountFormatted = `$${(transferAmount / 100).toFixed(2)}`;
        // What the payer paid, not what the provider keeps after the platform fee.
        const paidFormatted = `$${(payment.amount_total / 100).toFixed(2)}`;
        const invoiceId = invoicePayment ? payment.metadata?.invoice_id : null;
        const subjectMetadata = invoicePayment
          ? { invoice_id: invoiceId }
          : isBooking
            ? { booking_id: payment.booking_id }
            : { gig_id: payment.gig_id };

        // Notify provider: funds added to wallet
        createNotification({
          userId: payment.payee_id,
          type: 'payout_sent',
          title: `${amountFormatted} added to your wallet`,
          body: invoicePayment
            ? `An invoice payment has been added to your Pantopus wallet.${withdrawLine}`
            : isBooking
              ? `Your booking payment has been added to your Pantopus wallet.${withdrawLine}`
              : `Your payment for "${gigTitle}" has been added to your Pantopus wallet.${withdrawLine}`,
          icon: '💰',
          link: invoicePayment ? '/app/wallet' : '/app/settings/payments',
          metadata: {
            ...subjectMetadata,
            payment_id: payment.id,
            amount: transferAmount,
          },
        });

        // Notify requester: payment complete
        createNotification({
          userId: payment.payer_id,
          type: 'payment_completed',
          title: invoicePayment
            ? 'Invoice payment complete'
            : isBooking ? 'Booking payment complete' : `Payment complete for "${gigTitle}"`,
          body: invoicePayment
            ? `Your payment of ${paidFormatted} has been sent to the business.`
            : `Your payment of ${paidFormatted} has been sent to the provider.`,
          icon: '✅',
          link: invoicePayment ? `/app/invoice/${invoiceId}` : isBooking ? '/app/scheduling/my-bookings' : `/gigs/${payment.gig_id}`,
          metadata: {
            ...subjectMetadata,
            payment_id: payment.id,
            amount: payment.amount_total,
          },
        });

        logger.info('processPendingTransfers: wallet credit successful', {
          paymentId: payment.id,
          gigId: payment.gig_id,
          amount: transferAmount,
        });
      } catch (paymentErr) {
        errorCount++;
        const errMessage = paymentErr.message || 'Unknown error';

        logger.error('processPendingTransfers: error processing payment', {
          paymentId: payment.id,
          gigId: payment.gig_id,
          error: errMessage,
        });

        // The paid-gig transaction commits money and receipt together. Its
        // failed/unknown response is retried with the same payment; never run
        // a legacy status repair against a residual receipt.
        if (payment.payment_type === 'gig_payment') continue;
        try { await reconcileWalletRelease(payment.id); }
        catch (revertErr) {
          logger.error('processPendingTransfers: recovery remains pending', { paymentId: payment.id, error: revertErr.message });
        }
      }
    }

    logger.info('processPendingTransfers: batch complete', {
      total: payments.length,
      success: successCount,
      skipped: skipCount,
      errors: errorCount,
    });

    // Alert on repeated failures
    if (errorCount > 0) {
      await sendAlert({
        severity: errorCount >= 3 ? SEVERITY.CRITICAL : SEVERITY.WARNING,
        title: 'Transfer processing errors',
        message: `processPendingTransfers completed with ${errorCount} error(s) out of ${payments.length} payments.`,
        metadata: { total: payments.length, success: successCount, skipped: skipCount, errors: errorCount },
        dedup_key: 'pantopus-transfer-batch-errors',
      });
    }
  } catch (err) {
    logger.error('processPendingTransfers: fatal error', { error: err.message });

    await sendAlert({
      severity: SEVERITY.CRITICAL,
      title: 'processPendingTransfers fatal error',
      message: `Transfer job crashed: ${err.message}`,
      metadata: { error: err.message },
      dedup_key: 'pantopus-transfer-fatal',
    });
  }
}

module.exports = processPendingTransfers;
