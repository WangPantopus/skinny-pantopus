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

// A withdrawal's outcome is final: nothing moved, or the request can't go ahead. The client
// should start a new withdrawal (with a new key) next time.
const WITHDRAWAL_NOT_COMPLETED = "The withdrawal didn't go through, and your balance wasn't charged. Please try again later or contact support if it keeps happening.";
// Stripe moves a payment's money into the platform's available balance a few days after the charge (longer for a new
// account); a transfer made before then is refused. The wallet credit comes sooner than that, so say what is going on.
const WITHDRAWAL_FUNDS_CLEARING = "Funds from recent payments are still clearing, so this withdrawal can't go through yet, and your balance wasn't charged. Please try again in a day or two.";

function withdrawalError(code, message) {
  return Object.assign(new Error(message), { code });
}

const WITHDRAWAL_PENDING = 'This withdrawal is still being processed. Check your wallet in a moment.';
// Stripe may prune idempotency keys after 24 hours. Keep unresolved older attempts for review.
const MAX_WITHDRAWAL_RETRY_AGE_MS = 23 * 60 * 60 * 1000;

// Stripe refused the transfer request itself, so the same key and parameters get the same refusal:
// no transfer exists, and none can be made with this key. Any other error (no reply, a timeout, a
// 5xx, rate limiting, the key in use by another request) leaves the transfer's outcome unknown.
const DEFINITE_TRANSFER_FAILURES = new Set([
  'StripeInvalidRequestError',
  'StripeCardError',
  'StripePermissionError',
  'StripeAuthenticationError',
]);

/**
 * Settle a withdrawal whose transfer call failed. A request with the same key may have completed
 * the transfer meanwhile: then the withdrawal is paid out. A refusal for good reverses the debit
 * (the reversal credit has its own key, so it credits once). Anything else keeps the debit: the
 * outcome is unknown, and the next request with this key settles it (503, the client keeps the key).
 */
async function settleFailedTransfer(tx, stripeErr, { userId, amount, idempotencyKey }) {
  const { data: current, error: readErr } = await supabaseAdmin
    .from('WalletTransaction')
    .select('*')
    .eq('id', tx.id)
    .maybeSingle();
  if (readErr) {
    logger.error('withdrawal transfer outcome unknown', { userId, txId: tx.id, error: readErr.message });
    throw withdrawalError('WITHDRAWAL_PENDING', WITHDRAWAL_PENDING);
  }
  if (current?.stripe_transfer_id) return current;
  if (current?.status === 'reversed') throw withdrawalError('WITHDRAWAL_NOT_COMPLETED', WITHDRAWAL_NOT_COMPLETED);
  if (!DEFINITE_TRANSFER_FAILURES.has(stripeErr?.type)) {
    logger.error('withdrawal transfer outcome unknown', {
      userId, amount, txId: tx.id, errorType: stripeErr?.type || null, error: stripeErr?.message,
    });
    throw withdrawalError('WITHDRAWAL_PENDING', WITHDRAWAL_PENDING);
  }

  // supabase-js reports a failed RPC in `error` rather than throwing; only a recorded credit may
  // mark the debit reversed. A credit already recorded under the reversal key (an earlier request
  // reversed it) is refused by the unique key, which also counts as reversed.
  const reversalKey = `${idempotencyKey}:reversal`;
  const { error: reversalError } = await supabaseAdmin.rpc('wallet_credit', {
    p_user_id: userId,
    p_amount: amount,
    p_type: 'withdrawal_reversal',
    // Stripe's own wording stays in the metadata for support; the person sees a plain line in their history.
    p_description: "Reversal: the withdrawal didn't go through",
    p_idempotency_key: reversalKey,
    p_metadata: { original_tx_id: tx.id, error: stripeErr.message },
  });
  if (reversalError) {
    const keyTaken = reversalError.code === '23505' || /WalletTransaction_idempotency_key/.test(reversalError.message || '');
    const earlierReversal = keyTaken ? await findWithdrawalByKey(reversalKey).catch(() => null) : null;
    if (!earlierReversal) {
      // CRITICAL: the debit stands and nothing was paid out. The client keeps its key, and its next
      // request reaches this reversal again.
      logger.error('CRITICAL: Failed to reverse wallet debit after failed withdrawal', {
        userId, amount, txId: tx.id, error: reversalError.message,
      });
      throw withdrawalError('WITHDRAWAL_PENDING', WITHDRAWAL_PENDING);
    }
  }

  const { error: reverseUpdateErr } = await supabaseAdmin
    .from('WalletTransaction')
    .update({ status: 'reversed' })
    .eq('id', tx.id);
  if (reverseUpdateErr) {
    logger.error('Failed to mark WalletTransaction as reversed', { txId: tx.id, error: reverseUpdateErr.message });
  }
  if (stripeErr?.code === 'balance_insufficient') {
    throw withdrawalError('FUNDS_CLEARING', WITHDRAWAL_FUNDS_CLEARING);
  }
  throw withdrawalError('WITHDRAWAL_NOT_COMPLETED', WITHDRAWAL_NOT_COMPLETED);
}

/**
 * Settle a withdrawal request whose key an earlier request already used. wallet_debit returned
 * that earlier attempt's ledger row instead of debiting again, so this request reports that
 * attempt's outcome and never moves money a second time.
 */
async function settleRepeatedWithdrawal(tx, { userId, amount, stripe, stripeAccount, idempotencyKey }) {
  if (Number(tx.amount) !== Number(amount)) {
    throw withdrawalError('WITHDRAWAL_KEY_REUSED', 'This withdrawal request was already used for a different amount. Please start a new withdrawal.');
  }
  if (tx.status === 'reversed') throw withdrawalError('WITHDRAWAL_NOT_COMPLETED', WITHDRAWAL_NOT_COMPLETED);
  if (tx.stripe_transfer_id) return tx;

  const createdAt = typeof tx.created_at === 'string' ? Date.parse(tx.created_at) : NaN;
  const age = Date.now() - createdAt;
  if (!Number.isFinite(age) || age < 0 || age >= MAX_WITHDRAWAL_RETRY_AGE_MS) {
    throw withdrawalError('WITHDRAWAL_PENDING', 'This withdrawal needs support review before it can be retried. Please contact support.');
  }

  // The earlier attempt debited the wallet but hasn't recorded its transfer: it is still running,
  // or it stopped between the two steps. The same transfer call with the same key returns that
  // attempt's transfer, or makes the one it never made.
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
    return { ...tx, stripe_transfer_id: transfer.id };
  } catch (stripeErr) {
    logger.warn('Repeated withdrawal request could not settle yet', { userId, txId: tx.id, errorType: stripeErr?.type || null, error: stripeErr.message });
    return settleFailedTransfer(tx, stripeErr, { userId, amount, idempotencyKey });
  }
}

/** The withdrawal ledger row an earlier request made with this key, if any. */
async function findWithdrawalByKey(idempotencyKey) {
  const { data, error } = await supabaseAdmin
    .from('WalletTransaction')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (error) {
    logger.error('Failed to look up withdrawal by key', { error: error.message });
    throw new Error('Failed to check the withdrawal');
  }
  return data;
}

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

/**
 * Tells the person that money in their wallet went toward what they still owed for a payment refunded or taken back
 * by the payer's bank after it reached the wallet.
 */
async function notifyDebtCollected(userId, { collected, remaining }) {
  const { createNotification } = require('./notificationService');
  // A business's wallet: its primary owner hears of it (a business account has no sign-in).
  const { data: account } = await supabaseAdmin.from('User').select('account_type').eq('id', userId).maybeSingle();
  const businessId = account?.account_type === 'business' ? userId : null;
  const ownerId = businessId ? await require('../utils/businessPermissions').getBusinessPrimaryOwnerId(businessId) : null;
  if (businessId && !ownerId) return;
  await createNotification({
    userId: ownerId || userId,
    type: 'dispute_resolved',
    title: businessId
      ? (remaining > 0 ? `${money(collected)} went toward what the business owes` : 'What the business owed is paid off')
      : (remaining > 0 ? `${money(collected)} went toward what you owe` : 'What you owed is paid off'),
    body: businessId
      ? (remaining > 0
        ? `${money(collected)} of the business's invoice money went toward a payment that was refunded or disputed. `
          + `${money(remaining)} is still owed and comes out of its next invoice payments before they go to its payout account.`
        : `${money(collected)} of the business's invoice money paid off what it owed for a refunded or disputed payment. `
          + 'Its invoice payments go to its payout account again.')
      : (remaining > 0
        ? `${money(collected)} from your wallet went toward a payment that was refunded or disputed after it reached you. `
          + `${money(remaining)} is still owed and comes out of your next earnings; withdrawals wait until then.`
        : `${money(collected)} from your wallet paid off what you owed for a payment that was refunded or disputed after `
          + 'it reached you. You can withdraw again.'),
    icon: '📋',
    link: businessId ? `/app/businesses/${businessId}/dashboard?tab=payments` : '/app/wallet',
    metadata: { collected_cents: collected, remaining_cents: remaining, ...(businessId ? { business_id: businessId } : {}) },
  });
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

  /**
   * Income already credited to this wallet for a payment the payer's bank has since disputed. It leaves the wallet
   * if the dispute is lost, so it stays put until the dispute is settled (a won dispute puts the payment back as
   * released, and the money is free again). A dispute opened before the money reached the wallet holds nothing
   * here: nothing was credited yet.
   * @returns {Promise<{cents: number, count: number}>}
   */
  async getDisputeHold(userId) {
    const { held } = await this.getDisputedPayments(userId);
    return { cents: [...held.values()].reduce((sum, cents) => sum + cents, 0), count: held.size };
  }

  /**
   * Income under an open payment dispute wherever it sits: already credited to this wallet (the hold above) or still
   * waiting for release, which the dispute stops. Neither is pending or withdrawable; the wallet lists it on its own
   * line until the bank decides.
   * @returns {Promise<{cents: number, count: number}>}
   */
  async getDisputedIncome(userId) {
    const { disputed, held } = await this.getDisputedPayments(userId);
    let cents = 0;
    for (const payment of disputed) {
      cents += held.has(payment.id) ? held.get(payment.id) : Number(payment.amount_to_payee || 0);
    }
    return { cents, count: disputed.length };
  }

  /**
   * The payments this user is owed that are under an open dispute, and (per payment id) what was already credited to
   * their wallet for each.
   * @returns {Promise<{disputed: Array<{id: string, amount_to_payee: number}>, held: Map<string, number>}>}
   */
  async getDisputedPayments(userId) {
    const { data, error } = await supabaseAdmin
      .from('Payment')
      .select('id, amount_to_payee')
      .eq('payee_id', userId)
      .eq('payment_status', 'disputed');
    if (error) {
      logger.error('Failed to read disputed payments', { userId, error: error.message });
      throw new Error('Failed to check funds on hold');
    }
    const disputed = data || [];
    const held = new Map();
    if (disputed.length === 0) return { disputed, held };

    const { data: credits, error: creditError } = await supabaseAdmin
      .from('WalletTransaction')
      .select('payment_id, amount')
      .eq('user_id', userId)
      .eq('direction', 'credit')
      .in('type', ['gig_income', 'tip_income'])
      .in('payment_id', disputed.map((payment) => payment.id));
    if (creditError) {
      logger.error('Failed to read credits of disputed payments', { userId, error: creditError.message });
      throw new Error('Failed to check funds on hold');
    }
    for (const credit of credits || []) {
      held.set(credit.payment_id, (held.get(credit.payment_id) || 0) + Number(credit.amount || 0));
    }
    return { disputed, held };
  }

  // ============ WHAT IS OWED (refunded or disputed income) ============

  /**
   * Pays what this user still owes for payments refunded, or lost to a dispute, after the income reached their
   * wallet (PaymentRefundRecovery debts), from the wallet's balance, oldest first. While anything is owed, nothing is
   * withdrawable (founder decision 2026-10-09). The person hears when money went to it, unless the caller says so itself.
   * @returns {Promise<{collected: number, remaining: number, cleared: number}>} cents
   */
  async collectDebts(userId, { notify = true } = {}) {
    const { data, error } = await supabaseAdmin.rpc('collect_wallet_refund_debts', { p_user_id: userId });
    if (error || !data || data.error) {
      logger.error('Wallet debt collection failed', { userId, error: error?.message || data?.error });
      throw new Error('Failed to settle what is owed');
    }
    const result = {
      collected: Number(data.collected) || 0,
      remaining: Number(data.remaining) || 0,
      cleared: Number(data.cleared) || 0,
    };
    if (result.collected > 0) {
      logger.info('Wallet debt collected', { userId, ...result });
      if (notify) {
        notifyDebtCollected(userId, result).catch((err) => {
          logger.warn('Debt collection notice skipped', { userId, error: err.message });
        });
      }
    }
    return result;
  }

  /**
   * What this user still owes for payments refunded, or lost to a dispute, after the income reached their wallet.
   * It comes out of their next income first, so it is not withdrawable. Read-only: collectDebts takes it.
   * @returns {Promise<number>} cents
   */
  async getOpenDebt(userId) {
    const { data, error } = await supabaseAdmin
      .from('PaymentRefundRecovery')
      .select('debt_amount, Payment!inner(payee_id)')
      .eq('kind', 'wallet')
      .gt('debt_amount', 0)
      .eq('Payment.payee_id', userId);
    if (error) {
      logger.error('Failed to read what is owed', { userId, error: error.message });
      throw new Error('Failed to check what is owed');
    }
    return (data || []).reduce((sum, row) => sum + Number(row.debt_amount || 0), 0);
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
    // Marks the ledger row this request creates. For a key used before, wallet_debit returns the
    // earlier row instead, and this request settles on that attempt's outcome.
    const requestNonce = crypto.randomUUID();

    // wallet_debit's own replay check doesn't find an earlier row (`v_tx IS NOT NULL` is false when any
    // column is null), so a repeated key would hit the unique key and fail. Look the row up first.
    const earlier = await findWithdrawalByKey(idempotencyKey);
    if (earlier) return settleRepeatedWithdrawal(earlier, { userId, amount, stripe, stripeAccount, idempotencyKey });

    // What is still owed for refunded or disputed income is paid from the balance first; while any is owed, nothing
    // can be withdrawn.
    const debt = await this.collectDebts(userId);
    if (debt.remaining > 0) {
      throw Object.assign(new Error('Withdrawals wait until what is owed is paid'), {
        code: 'DEBT_OPEN', owedCents: debt.remaining,
      });
    }

    // Money the payer's bank is disputing stays in the wallet until the dispute is settled.
    const hold = await this.getDisputeHold(userId);
    if (hold.cents > 0) {
      const wallet = await this.getWallet(userId);
      const availableCents = Math.max(0, Number(wallet?.balance || 0) - hold.cents);
      if (amount > availableCents) {
        throw Object.assign(new Error('Funds are on hold for a payment dispute'), {
          code: 'FUNDS_ON_HOLD', holdCents: hold.cents, availableCents,
        });
      }
    }

    // Debit wallet first (atomic, will throw if insufficient balance)
    const { data: tx, error } = await supabaseAdmin.rpc('wallet_debit', {
      p_user_id: userId,
      p_amount: amount,
      p_type: 'withdrawal',
      p_description: `Withdrawal of $${(amount / 100).toFixed(2)} to bank account`,
      p_stripe_transfer: null,
      p_idempotency_key: idempotencyKey,
      p_metadata: { stripe_account_id: stripeAccount.stripe_account_id, request_nonce: requestNonce },
    });

    if (error) {
      // A concurrent request with the same key inserted first (unique idempotency_key).
      if (error.code === '23505' || /WalletTransaction_idempotency_key/.test(error.message || '')) {
        const raced = await findWithdrawalByKey(idempotencyKey);
        if (raced) return settleRepeatedWithdrawal(raced, { userId, amount, stripe, stripeAccount, idempotencyKey });
      }
      logger.error('Failed to debit wallet for withdrawal', { userId, amount, error: error.message });
      throw new Error(error.message || 'Insufficient balance');
    }

    if (tx.metadata?.request_nonce !== requestNonce) {
      return settleRepeatedWithdrawal(tx, { userId, amount, stripe, stripeAccount, idempotencyKey });
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
      // Reverse only when Stripe refused the transfer for good; never when it might exist.
      logger.error('Stripe transfer failed', {
        userId, amount, txId: tx.id, errorType: stripeErr?.type || null, error: stripeErr.message,
      });
      return settleFailedTransfer(tx, stripeErr, { userId, amount, idempotencyKey });
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
   * @param {{ description?: string }} [options] - Wording for the wallet history line (an invoice says so)
   * @returns {WalletTransaction}
   */
  async creditGigIncome(payeeId, amount, gigId, paymentId, payerId, { description } = {}) {
    const idempotencyKey = `gig_income:${paymentId}`;

    const { data: tx, error } = await supabaseAdmin.rpc('wallet_credit', {
      p_user_id: payeeId,
      p_amount: amount,
      p_type: 'gig_income',
      p_description: description || `Income from completed gig`,
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
  async getTransactions(userId, { type, unsettledWithdrawal = false, limit = 50, offset = 0, startDate, endDate } = {}) {
    let query = supabaseAdmin
      .from('WalletTransaction')
      .select(unsettledWithdrawal ? 'amount,idempotency_key,created_at' : '*', { count: 'exact' })
      .eq('user_id', userId);

    if (unsettledWithdrawal) {
      query = query.eq('type', 'withdrawal').is('stripe_transfer_id', null).neq('status', 'reversed')
        .order('created_at', { ascending: true, nullsFirst: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }
    query = query.range(offset, offset + limit - 1);

    if (type) query = query.eq('type', type);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch wallet transactions', { userId, error: error.message });
      throw new Error('Failed to fetch transactions');
    }

    const result = { transactions: unsettledWithdrawal ? [] : data || [], total: count || 0 };
    if (unsettledWithdrawal) {
      const pending = data?.[0];
      result.withdrawalRecovery = null;
      if (pending) {
        const prefix = `withdraw:${userId}:`;
        const key = typeof pending.idempotency_key === 'string' && pending.idempotency_key.startsWith(prefix)
          ? pending.idempotency_key.slice(prefix.length) : null;
        const validKey = key && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
        const age = Date.now() - (typeof pending.created_at === 'string' ? Date.parse(pending.created_at) : NaN);
        result.withdrawalRecovery = {
          amountCents: Number(pending.amount),
          idempotencyKey: validKey ? key : null,
          createdAt: pending.created_at || null,
          retryable: Boolean(validKey && Number.isSafeInteger(Number(pending.amount)) && Number(pending.amount) >= 100
            && Number.isFinite(age) && age >= 0 && age < MAX_WITHDRAWAL_RETRY_AGE_MS),
        };
      }
    }
    return result;
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
