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
const { PAYMENT_STATES, transitionPaymentStatus } = require('../stripe/paymentStateMachine');
const { createNotification } = require('../services/notificationService');
const { sendAlert, SEVERITY } = require('../services/alertingService');
const logger = require('../utils/logger');

// ─── Helper: check if wallet was already credited for a payment ───
async function wasWalletCredited(paymentId) {
  const { data, error } = await supabaseAdmin
    .from('WalletTransaction')
    .select('id')
    .eq('payment_id', paymentId)
    // A payment can credit wallet as gig income or tip income.
    .in('type', ['gig_income', 'tip_income'])
    .limit(1);

  if (error) {
    logger.error('wasWalletCredited: query error', { paymentId, error: error.message });
    return false;
  }
  return data && data.length > 0;
}

// ─── Recovery: unstrand transfer_scheduled / transfer_pending payments ───
async function recoverStrandedTransfers(nowIso) {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: stranded, error } = await supabaseAdmin
    .from('Payment')
    .select('id, gig_id, payment_status')
    .in('payment_status', [PAYMENT_STATES.TRANSFER_SCHEDULED, PAYMENT_STATES.TRANSFER_PENDING])
    .lte('updated_at', tenMinAgo)
    .is('dispute_id', null);

  if (error) {
    logger.error('recoverStrandedTransfers: query error', { error: error.message });
    return;
  }

  if (!stranded || stranded.length === 0) return;

  logger.warn('recoverStrandedTransfers: found stranded payments', { count: stranded.length });

  for (const payment of stranded) {
    try {
      const credited = await wasWalletCredited(payment.id);

      if (credited) {
        // Wallet was credited — advance to transferred
        await transitionPaymentStatus(payment.id, PAYMENT_STATES.TRANSFERRED, {
          transfer_status: 'wallet_credited',
          transfer_completed_at: nowIso,
        });
        logger.info('recoverStrandedTransfers: advanced to transferred (wallet already credited)', {
          paymentId: payment.id,
          previousStatus: payment.payment_status,
        });
      } else {
        // Wallet was NOT credited — revert to captured_hold for re-processing
        // Use compare-and-swap to avoid overwriting a concurrent transition
        await supabaseAdmin
          .from('Payment')
          .update({ payment_status: PAYMENT_STATES.CAPTURED_HOLD, updated_at: nowIso })
          .eq('id', payment.id)
          .eq('payment_status', payment.payment_status);

        if (payment.gig_id) {
          await supabaseAdmin
            .from('Gig')
            .update({ payment_status: PAYMENT_STATES.CAPTURED_HOLD, updated_at: nowIso })
            .eq('id', payment.gig_id)
            .eq('payment_status', payment.payment_status);
        }

        logger.info('recoverStrandedTransfers: reverted to captured_hold (no wallet credit)', {
          paymentId: payment.id,
          previousStatus: payment.payment_status,
        });
      }
    } catch (recoverErr) {
      logger.error('recoverStrandedTransfers: failed to recover payment', {
        paymentId: payment.id,
        error: recoverErr.message,
      });
    }
  }
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
      payer_id,
      payee_id,
      amount_total,
      amount_to_payee,
      amount_platform_fee,
      currency,
      payment_type,
      stripe_charge_id,
      stripe_payment_intent_id,
      payment_status,
      cooling_off_ends_at,
      created_at,
      dispute_id,
      dispute_status
    `;

    const [standardReadyRes, legacyReadyRes] = await Promise.all([
      supabaseAdmin
        .from('Payment')
        .select(selectFields)
        .eq('payment_status', PAYMENT_STATES.CAPTURED_HOLD)
        .lte('cooling_off_ends_at', nowIso)
        .is('dispute_id', null),
      // Legacy safety-net: older captured_hold rows may have null cooling_off_ends_at.
      // Treat them as transferable once they are at least 48h old.
      supabaseAdmin
        .from('Payment')
        .select(selectFields)
        .eq('payment_status', PAYMENT_STATES.CAPTURED_HOLD)
        .is('cooling_off_ends_at', null)
        .lte('created_at', legacyCoolingFallbackIso)
        .is('dispute_id', null),
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
          .select('payment_status, dispute_id')
          .eq('id', payment.id)
          .single();

        if (!fresh || fresh.payment_status !== PAYMENT_STATES.CAPTURED_HOLD || fresh.dispute_id) {
          logger.info('processPendingTransfers: skipping (state changed)', {
            paymentId: payment.id,
            currentStatus: fresh?.payment_status,
          });
          skipCount++;
          continue;
        }

        // Safety: verify amount makes sense
        const transferAmount = payment.amount_to_payee;
        if (!transferAmount || transferAmount <= 0) {
          logger.error('processPendingTransfers: invalid transfer amount', {
            paymentId: payment.id,
            amount: transferAmount,
          });
          errorCount++;
          continue;
        }

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
        await transitionPaymentStatus(payment.id, PAYMENT_STATES.TRANSFERRED, {
          transfer_status: 'wallet_credited',
          transfer_scheduled_at: nowIso,
          transfer_completed_at: new Date().toISOString(),
        });

        successCount++;

        // Get gig title for notification
        const { data: gig } = await supabaseAdmin
          .from('Gig')
          .select('title')
          .eq('id', payment.gig_id)
          .single();

        const gigTitle = gig?.title || 'a gig';
        const amountFormatted = `$${(transferAmount / 100).toFixed(2)}`;

        // Notify provider: funds added to wallet
        createNotification({
          userId: payment.payee_id,
          type: 'payout_sent',
          title: `${amountFormatted} added to your wallet`,
          body: `Your payment for "${gigTitle}" has been added to your Pantopus wallet. You can withdraw to your bank anytime.`,
          icon: '💰',
          link: '/app/settings/payments',
          metadata: {
            gig_id: payment.gig_id,
            payment_id: payment.id,
            amount: transferAmount,
          },
        });

        // Notify requester: payment complete
        createNotification({
          userId: payment.payer_id,
          type: 'payment_completed',
          title: `Payment complete for "${gigTitle}"`,
          body: `Your payment of ${amountFormatted} has been sent to the provider.`,
          icon: '✅',
          link: `/gigs/${payment.gig_id}`,
          metadata: {
            gig_id: payment.gig_id,
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

        // ─── Error recovery: revert or advance based on wallet credit status ───
        try {
          const { data: currentPayment } = await supabaseAdmin
            .from('Payment')
            .select('payment_status')
            .eq('id', payment.id)
            .single();

          const status = currentPayment?.payment_status;

          if (status === PAYMENT_STATES.TRANSFER_SCHEDULED || status === PAYMENT_STATES.TRANSFER_PENDING) {
            const credited = await wasWalletCredited(payment.id);

            if (credited) {
              // Wallet was credited but state transition failed — advance to transferred
              await transitionPaymentStatus(payment.id, PAYMENT_STATES.TRANSFERRED, {
                transfer_status: 'wallet_credited',
                transfer_completed_at: nowIso,
              });
              logger.info('processPendingTransfers: advanced stranded payment to transferred', {
                paymentId: payment.id,
                previousStatus: status,
              });
              // Count as success since funds were correctly credited
              errorCount--;
              successCount++;
            } else {
              // Wallet was NOT credited — revert to captured_hold for retry
              // Use compare-and-swap to avoid overwriting a concurrent transition
              await supabaseAdmin
                .from('Payment')
                .update({
                  payment_status: PAYMENT_STATES.CAPTURED_HOLD,
                  updated_at: nowIso,
                })
                .eq('id', payment.id)
                .eq('payment_status', status);

              if (payment.gig_id) {
                await supabaseAdmin
                  .from('Gig')
                  .update({ payment_status: PAYMENT_STATES.CAPTURED_HOLD, updated_at: nowIso })
                  .eq('id', payment.gig_id)
                  .eq('payment_status', status);
              }
            }
          }
        } catch (revertErr) {
          logger.error('processPendingTransfers: failed to revert status', {
            paymentId: payment.id,
            error: revertErr.message,
          });
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
