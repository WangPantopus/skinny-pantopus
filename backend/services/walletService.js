// ============================================================
// WALLET SERVICE
// Manages user earnings wallet with atomic operations.
//
// REGULATORY NOTE — This is an "earnings-only" wallet:
//   - Users CANNOT deposit funds from a card (no stored value)
//   - Users CANNOT pay for gigs from wallet (no money transmission)
//   - Balance comes ONLY from: gig income, tips, refunds
//   - Users CAN withdraw earned funds to their bank
//   - This keeps Pantopus out of MSB / money transmitter territory
//
// All balance mutations go through Postgres functions that
// lock the wallet row, validate, update, and insert a ledger
// entry in a single transaction.
// ============================================================

const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

function getStripeClient() {
  const stripeModule = require('stripe');

  // Test environments may provide an already-instantiated mock client object.
  if (stripeModule && typeof stripeModule === 'object' && stripeModule.transfers?.create) {
    return stripeModule;
  }

  const stripeCtor = typeof stripeModule === 'function' ? stripeModule : stripeModule?.default;
  if (typeof stripeCtor !== 'function') {
    throw new TypeError('Stripe SDK module did not export a constructor');
  }

  return stripeCtor(process.env.STRIPE_SECRET_KEY);
}

class WalletService {

  // ============ WALLET LIFECYCLE ============

  /**
   * Get or create wallet for a user.
   * Returns the wallet object with current balance.
   */
  async getOrCreateWallet(userId) {
    const { data, error } = await supabaseAdmin.rpc('get_or_create_wallet', {
      p_user_id: userId,
    });

    if (error) {
      logger.error('Failed to get/create wallet', { userId, error: error.message });
      throw new Error('Failed to get wallet');
    }

    return data;
  }

  /**
   * Get wallet balance for a user.
   * Returns null if no wallet exists.
   */
  async getWallet(userId) {
    const { data: wallet, error } = await supabaseAdmin
      .from('Wallet')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch wallet', { userId, error: error.message });
      throw new Error('Failed to fetch wallet');
    }

    return wallet;
  }

  // ============ WITHDRAWALS (Earned funds → Bank) ============

  /**
   * Withdraw earned funds from wallet to user's bank account via Stripe.
   *
   * Flow:
   *   1. Debit wallet (atomic, checks balance)
   *   2. Create Stripe Transfer to user's Connect account
   *   3. Stripe handles payout to bank per their schedule
   *
   * @param {string} userId
   * @param {number} amount - Amount in cents (min 100 = $1.00)
   * @returns {WalletTransaction}
   */
  async withdraw(userId, amount, { idempotencyKey: clientKey } = {}) {
    if (amount < 100) throw new Error('Minimum withdrawal is $1.00');
    const stripe = getStripeClient();

    // Check user has a Connect account with payouts enabled
    const { data: stripeAccount, error: accountError } = await supabaseAdmin
      .from('StripeAccount')
      .select('stripe_account_id, payouts_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (accountError) {
      logger.error('Failed to fetch Stripe account', { userId, error: accountError.message });
      throw new Error('Failed to verify payout account');
    }

    if (!stripeAccount) {
      throw new Error('No payout account set up. Please connect your Stripe account first.');
    }
    if (!stripeAccount.payouts_enabled) {
      throw new Error('Your payout account is not yet verified. Please complete Stripe onboarding.');
    }

    // Use client-provided key (deduplicates double-taps) or generate a unique one per request
    const requestId = clientKey || crypto.randomUUID();
    const idempotencyKey = `withdraw:${userId}:${requestId}`;

    // Debit wallet first (atomic, will throw if insufficient balance)
    const { data: tx, error } = await supabaseAdmin.rpc('wallet_debit', {
      p_user_id: userId,
      p_amount: amount,
      p_type: 'withdrawal',
      p_description: `Withdrawal of $${(amount / 100).toFixed(2)} to bank account`,
      p_stripe_transfer: null,
      p_idempotency_key: idempotencyKey,
      p_metadata: { stripe_account_id: stripeAccount.stripe_account_id },
    });

    if (error) {
      logger.error('Failed to debit wallet for withdrawal', { userId, amount, error: error.message });
      throw new Error(error.message || 'Insufficient balance');
    }

    // Create Stripe Transfer to their Connect account
    try {
      const transfer = await stripe.transfers.create({
        amount,
        currency: 'usd',
        destination: stripeAccount.stripe_account_id,
        metadata: {
          type: 'wallet_withdrawal',
          user_id: userId,
          wallet_tx_id: tx.id,
        },
      }, {
        idempotencyKey,
      });

      // Update the transaction with the Stripe transfer ID
      const { error: updateErr } = await supabaseAdmin
        .from('WalletTransaction')
        .update({
          stripe_transfer_id: transfer.id,
          metadata: { ...tx.metadata, stripe_transfer_id: transfer.id },
        })
        .eq('id', tx.id);

      if (updateErr) {
        logger.error('Failed to update WalletTransaction with Stripe transfer ID', {
          txId: tx.id, transferId: transfer.id, error: updateErr.message,
        });
      }

      logger.info('Wallet withdrawal completed', {
        userId,
        amount,
        transferId: transfer.id,
        txId: tx.id,
      });

      return { ...tx, stripe_transfer_id: transfer.id };

    } catch (stripeErr) {
      // Stripe transfer failed — reverse the wallet debit
      logger.error('Stripe transfer failed, reversing wallet debit', {
        userId,
        amount,
        error: stripeErr.message,
      });

      try {
        await supabaseAdmin.rpc('wallet_credit', {
          p_user_id: userId,
          p_amount: amount,
          p_type: 'withdrawal_reversal',
          p_description: `Reversal: withdrawal failed — ${stripeErr.message}`,
          p_idempotency_key: `${idempotencyKey}:reversal`,
          p_metadata: { original_tx_id: tx.id, error: stripeErr.message },
        });

        // Mark original tx as reversed
        const { error: reverseUpdateErr } = await supabaseAdmin
          .from('WalletTransaction')
          .update({ status: 'reversed' })
          .eq('id', tx.id);

        if (reverseUpdateErr) {
          logger.error('Failed to mark WalletTransaction as reversed', {
            txId: tx.id, error: reverseUpdateErr.message,
          });
        }

      } catch (reverseErr) {
        // CRITICAL: Wallet was debited but transfer AND reversal failed
        logger.error('CRITICAL: Failed to reverse wallet debit after failed withdrawal', {
          userId,
          amount,
          txId: tx.id,
          error: reverseErr.message,
        });
      }

      throw new Error(`Withdrawal failed: ${stripeErr.message}`);
    }
  }

  // ============ INCOME CREDITS (Platform → Wallet) ============

  /**
   * Credit gig income to provider's wallet.
   * Called by processPendingTransfers job after cooling-off period.
   *
   * @param {string} payeeId - Provider user ID
   * @param {number} amount - Amount in cents (after platform fee)
   * @param {string} gigId
   * @param {string} paymentId
   * @param {string} payerId - For counterparty tracking
   * @returns {WalletTransaction}
   */
  async creditGigIncome(payeeId, amount, gigId, paymentId, payerId) {
    const idempotencyKey = `gig_income:${paymentId}`;

    const { data: tx, error } = await supabaseAdmin.rpc('wallet_credit', {
      p_user_id: payeeId,
      p_amount: amount,
      p_type: 'gig_income',
      p_description: `Income from completed gig`,
      p_payment_id: paymentId,
      p_gig_id: gigId,
      p_counterparty_id: payerId,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      logger.error('Failed to credit gig income', { payeeId, amount, gigId, error: error.message });
      throw new Error(`Failed to credit wallet: ${error.message}`);
    }

    logger.info('Gig income credited to wallet', { payeeId, amount, gigId, paymentId, txId: tx.id });
    return tx;
  }

  /**
   * Credit a tip to provider's wallet.
   */
  async creditTipIncome(payeeId, amount, gigId, paymentId, payerId) {
    const idempotencyKey = `tip_income:${paymentId}`;

    const { data: tx, error } = await supabaseAdmin.rpc('wallet_credit', {
      p_user_id: payeeId,
      p_amount: amount,
      p_type: 'tip_income',
      p_description: `Tip received`,
      p_payment_id: paymentId,
      p_gig_id: gigId,
      p_counterparty_id: payerId,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      logger.error('Failed to credit tip', { payeeId, amount, error: error.message });
      throw new Error(`Failed to credit tip: ${error.message}`);
    }

    return tx;
  }

  /**
   * Refund funds back to user's wallet.
   * Used when a gig is cancelled or a dispute is resolved in user's favor.
   */
  async refundToWallet(userId, amount, gigId, paymentId, description = 'Refund') {
    const idempotencyKey = `refund:${paymentId}`;

    const { data: tx, error } = await supabaseAdmin.rpc('wallet_credit', {
      p_user_id: userId,
      p_amount: amount,
      p_type: 'refund',
      p_description: description,
      p_payment_id: paymentId,
      p_gig_id: gigId,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      logger.error('Failed to refund to wallet', { userId, amount, error: error.message });
      throw new Error(`Failed to refund: ${error.message}`);
    }

    logger.info('Refund credited to wallet', { userId, amount, paymentId, txId: tx.id });
    return tx;
  }

  // ============ TRANSACTION HISTORY ============

  /**
   * Get paginated transaction history for a user.
   */
  async getTransactions(userId, { type, limit = 50, offset = 0, startDate, endDate } = {}) {
    let query = supabaseAdmin
      .from('WalletTransaction')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) query = query.eq('type', type);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch wallet transactions', { userId, error: error.message });
      throw new Error('Failed to fetch transactions');
    }

    return { transactions: data || [], total: count || 0 };
  }

  // ============ ADMIN OPERATIONS ============

  /**
   * Admin adjustment (credit or debit).
   * For support tickets, corrections, promotions, etc.
   */
  async adminAdjustment(userId, amount, description, adminUserId) {
    const direction = amount > 0 ? 'credit' : 'debit';
    const absAmount = Math.abs(amount);
    const idempotencyKey = `admin_adj:${userId}:${crypto.randomUUID()}`;

    let result;
    if (direction === 'credit') {
      result = await supabaseAdmin.rpc('wallet_credit', {
        p_user_id: userId,
        p_amount: absAmount,
        p_type: 'adjustment',
        p_description: description,
        p_idempotency_key: idempotencyKey,
        p_metadata: { admin_user_id: adminUserId },
      });
    } else {
      result = await supabaseAdmin.rpc('wallet_debit', {
        p_user_id: userId,
        p_amount: absAmount,
        p_type: 'adjustment',
        p_description: description,
        p_idempotency_key: idempotencyKey,
        p_metadata: { admin_user_id: adminUserId },
      });
    }

    if (result.error) {
      throw new Error(`Admin adjustment failed: ${result.error.message}`);
    }

    logger.info('Admin wallet adjustment', { userId, amount, description, adminUserId });
    return result.data;
  }
}

module.exports = new WalletService();
