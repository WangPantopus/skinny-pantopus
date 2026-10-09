// ============================================================
// WALLET ROUTES
// API endpoints for earnings wallet: balance, withdrawals,
// and transaction history.
//
// NOTE: This is an "earnings-only" wallet. Users cannot deposit
// funds from a card. Balance comes only from gig income, tips,
// and refunds. Users can withdraw earned funds to their bank.
// This avoids money transmitter / MSB regulatory requirements.
// ============================================================

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const walletService = require('../services/walletService');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const stripeService = require('../stripe/stripeService');
const { publicGigFee } = require('../stripe/gigPaymentProof');

const walletReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many wallet history requests. Please try again shortly.' },
});

// Balances and transaction history are never kept in a device's HTTP cache.
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

// ============ VALIDATION SCHEMAS ============

const withdrawSchema = Joi.object({
  amount: Joi.number().integer().min(100).required(),  // $1 min
  idempotencyKey: Joi.string().uuid().optional(),
});

const transactionFilterSchema = Joi.object({
  type: Joi.string().valid(
    'withdrawal', 'gig_income', 'tip_income',
    'refund', 'adjustment', 'cancellation_fee'
  ).when('unsettledWithdrawal', { is: true, then: Joi.valid(Joi.override, 'withdrawal').required() }).optional(),
  unsettledWithdrawal: Joi.boolean().default(false),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).max(5000).default(0),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
});

// ============ WALLET BALANCE ============

/**
 * GET /api/wallet
 * Get current wallet balance and summary.
 * Creates wallet on first access.
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const wallet = await walletService.getOrCreateWallet(userId);
    // `balance` is what can be withdrawn: money held for an open payment dispute is not in it, nor what is still owed
    // for a refunded or disputed payment (the next withdrawal or income pays that first).
    const [hold, owedCents] = await Promise.all([
      walletService.getDisputeHold(userId),
      walletService.getOpenDebt(userId),
    ]);

    res.json({
      wallet: {
        id: wallet.id,
        balance: Math.max(0, wallet.balance - hold.cents - owedCents),
        held_by_dispute: hold.cents,
        owed_cents: owedCents,
        currency: wallet.currency,
        frozen: wallet.frozen,
        lifetime_withdrawals: wallet.lifetime_withdrawals,
        lifetime_received: wallet.lifetime_received,
      },
    });
  } catch (err) {
    logger.error('Get wallet error', { error: err.message });
    res.status(500).json({ error: 'Failed to get wallet' });
  }
});

// ============ WITHDRAWALS (Earned funds → Bank) ============

/**
 * POST /api/wallet/withdraw
 * Withdraw earned funds from wallet to bank account.
 * Requires a verified Stripe Connect account with payouts enabled.
 */
router.post('/withdraw', verifyToken, validate(withdrawSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, idempotencyKey } = req.body;

    const tx = await walletService.withdraw(userId, amount, { idempotencyKey });

    res.json({
      success: true,
      transaction: tx,
      message: `$${(amount / 100).toFixed(2)} withdrawal initiated. Funds will arrive in your bank account within 2-3 business days.`,
    });
  } catch (err) {
    logger.error('Withdrawal error', { error: err.message, userId: req.user.id });

    if (err.code === 'DEBT_OPEN') {
      return res.status(400).json({
        error: `Withdrawals are paused: $${(err.owedCents / 100).toFixed(2)} is still owed for a payment that was refunded `
          + 'or disputed after it reached your wallet. Your next earnings pay it first.',
        code: 'debt_open',
      });
    }
    if (err.code === 'FUNDS_ON_HOLD') {
      return res.status(400).json({
        error: `$${(err.holdCents / 100).toFixed(2)} of your balance is on hold while a payment dispute is open. `
          + `You can withdraw up to $${(err.availableCents / 100).toFixed(2)}.`,
        code: 'funds_on_hold',
      });
    }
    // wallet_debit raises 'Insufficient wallet balance. Available: <cents>, Required: <cents>'. A second
    // withdrawal racing the first, or a stale balance on another device, lands here.
    if (/insufficient (wallet )?balance/i.test(err.message || '')) {
      const available = Number((err.message.match(/Available:\s*(-?\d+)/) || [])[1]);
      return res.status(400).json({
        error: Number.isFinite(available)
          ? `Your available balance is $${(Math.max(available, 0) / 100).toFixed(2)}.`
          : 'Your available balance is lower than that.',
        code: 'insufficient_balance',
      });
    }
    if (err.message?.includes('payout account') || err.message?.includes('onboarding')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message?.includes('frozen')) {
      return res.status(403).json({ error: 'Wallet is frozen. Please contact support.' });
    }
    if (err.message?.includes('Minimum')) {
      return res.status(400).json({ error: err.message });
    }
    // A repeated request settles on the first attempt's outcome. Final outcomes are 409 (start a new
    // withdrawal); a first attempt still settling is 503 (retry with the same key).
    if (err.code === 'WITHDRAWAL_NOT_COMPLETED' || err.code === 'WITHDRAWAL_KEY_REUSED' || err.code === 'FUNDS_CLEARING') {
      return res.status(409).json({ error: err.message, code: err.code.toLowerCase() });
    }
    if (err.code === 'WITHDRAWAL_PENDING') {
      return res.status(503).json({ error: err.message, code: 'withdrawal_pending' });
    }

    // Don't leak internal Stripe errors to the client
    res.status(500).json({
      error: 'Withdrawal is temporarily unavailable. Your balance is safe — please try again later or contact support if the issue persists.',
    });
  }
});

// ============ TRANSACTION HISTORY ============

/**
 * GET /api/wallet/transactions
 * Get paginated transaction history with optional filters.
 */
router.get('/transactions', verifyToken, walletReadLimiter, async (req, res) => {
  try {
    const userId = req.user.id;

    // Validate query params
    const { error: validationError, value: filters } = transactionFilterSchema.validate(req.query);
    if (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    const result = await walletService.getTransactions(userId, filters);

    res.json({
      transactions: result.transactions,
      total: result.total,
      withdrawalRecovery: result.withdrawalRecovery,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (err) {
    logger.error('Transaction history error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ============ PENDING RELEASE BREAKDOWN ============

/**
 * GET /api/wallet/pending-release
 * Returns breakdown of funds in different stages:
 *   - in_review: captured_hold payments (within cooling-off)
 *   - releasing_soon: captured_hold payments (past cooling-off, awaiting next job run)
 *   - total_pending: sum of above
 *   - in_dispute: income under an open payment dispute, held until the bank decides (not part of pending)
 *
 * This helps users understand why wallet balance differs from total earned.
 */
router.get('/pending-release', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const supabaseAdmin = require('../config/supabaseAdmin');
    const now = new Date().toISOString();

    // Self-heal older tip rows that were left in authorize_pending due to
    // missed webhook delivery before the client-side reconcile path existed.
    await stripeService.reconcilePendingTipsForUser(userId, { payeeOnly: true });

    // Payments where this user is the payee and funds are in hold. A payment whose dispute was won is back in the
    // release pipeline (processPendingTransfers admits it the same way), so it counts here again.
    const { data: holdPayments, error: holdErr } = await supabaseAdmin
      .from('Payment')
      .select('id, amount_total, amount_to_payee, cooling_off_ends_at, payment_status, payment_type, created_at, metadata')
      .eq('payee_id', userId)
      .in('payment_status', ['captured_hold', 'transfer_scheduled', 'transfer_pending'])
      .or('dispute_id.is.null,dispute_status.eq.won');

    if (holdErr) {
      logger.error('Pending release query error', { error: holdErr.message, userId });
      return res.status(500).json({ error: 'Failed to fetch pending release info' });
    }

    let inReviewCents = 0;
    let releasingSoonCents = 0;
    const inReviewItems = [];
    const releasingSoonItems = [];

    for (const p of (holdPayments || [])) {
      // A charged poster-fault fee pays the worker only its share of the fee.
      const amount = publicGigFee(p)?.worker_share_cents ?? (p.amount_to_payee || 0);
      const coolingEnds = p.cooling_off_ends_at ? new Date(p.cooling_off_ends_at) : null;
      const isPastCooling = coolingEnds && coolingEnds <= new Date(now);

      if (isPastCooling || p.payment_status !== 'captured_hold') {
        // Past cooling off or already in transfer pipeline
        releasingSoonCents += amount;
        releasingSoonItems.push({
          payment_id: p.id,
          amount_cents: amount,
          payment_type: p.payment_type,
          status: p.payment_status,
        });
      } else {
        // Still in cooling-off review period
        inReviewCents += amount;
        inReviewItems.push({
          payment_id: p.id,
          amount_cents: amount,
          payment_type: p.payment_type,
          cooling_off_ends_at: p.cooling_off_ends_at,
        });
      }
    }

    // Income under an open payment dispute (credited to the wallet and held there, or stopped before release) is
    // neither pending nor withdrawable; it waits for the bank's decision, so it gets its own line.
    const disputed = await walletService.getDisputedIncome(userId);

    res.json({
      in_review_cents: inReviewCents,
      releasing_soon_cents: releasingSoonCents,
      total_pending_cents: inReviewCents + releasingSoonCents,
      in_review_count: inReviewItems.length,
      releasing_soon_count: releasingSoonItems.length,
      in_dispute_cents: disputed.cents,
      in_dispute_count: disputed.count,
      // Don't include individual items by default (privacy + payload size)
      // Items can be seen via /api/payments?type=received&status=captured_hold
    });
  } catch (err) {
    logger.error('Pending release error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch pending release info' });
  }
});

module.exports = router;
