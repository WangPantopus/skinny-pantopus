/**
 * The person's own Wallet and payments, read only (AI expansion): what their Wallet screen and their
 * Payments screen show, so the assistant can answer "what's my balance", "why is money on hold", "what did
 * I pay last month" or "did my refund come through".
 *
 * get_wallet reads what GET /api/wallet shows (routes/wallet.js): the balance they can withdraw is the
 * wallet's balance less money held for an open payment dispute and less what is still owed for a refunded
 * or disputed payment (walletService.getDisputeHold, getOpenDebt). Beside it come the lines of
 * GET /api/wallet/pending-release (without its Stripe tip reconcile), the newest rows of
 * GET /api/wallet/transactions, the unfinished withdrawal the Wallet screen asks about
 * (`unsettledWithdrawal`), the bank payouts GET /api/payments/history lists, and the payout account as the
 * database last stored it (GET /api/payments/connect/account asks Stripe first; this never does).
 *
 * find_payments reads the payments GET /api/payments lists (routes/pays.js: the person as payer or payee),
 * with their amounts, fees and status as that route and GET /api/payments/:id give them, the refunds
 * GET /api/payments/:id/refunds gives the payer (paymentRefundService.history), totals counted the way
 * GET /api/payments/earnings and /spending count them, and the stamp books and review packets they bought
 * from Pantopus ("MailStampPurchase", "AppealPacketPurchase").
 *
 * Read only, strictly: no writes, no RPCs, no Stripe or other network calls, and nothing that opens a
 * wallet (getOrCreateWallet would). Only the person's own rows. No card or bank details, Stripe ids, keys,
 * emails or phone numbers reach the model; other people go by first name (a business by its name), as the
 * Payments screen names them.
 */
const { DateTime } = require('luxon');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const walletService = require('../walletService');
const { publicGigFee, capturedFeeCents, paymentRowAmounts } = require('../../stripe/gigPaymentProof');
const { loadChatPeople } = require('../chatPeople');
const {
  OTHERS_WORDS, isUuid, clip, zoneOr, whenLabel, dayLabel, firstNameOf,
} = require('./assistantKit');

const DEFAULT_DAYS = 90;
const MAX_DAYS = 365;
// Ten, so a full read stays under about 5,000 characters; `more` and the filters reach the rest.
const PAYMENTS_SHOWN = 10;
// Totals count at most this many payments in a period (GET /api/payments/history reads up to 500).
const PERIOD_ROWS = 1000;
const ACTIVITY_SHOWN = 10;
const PAYOUTS_SHOWN = 3;
// The Wallet screen offers "Retry withdrawal" for this long, then says it needs support review
// (walletService MAX_WITHDRAWAL_RETRY_AGE_MS).
const WITHDRAWAL_RETRY_MS = 23 * 60 * 60 * 1000;
// The release job runs every hour at :15 (jobs/index.js) once a payment's 48-hour review is over.
const REVIEW_HOURS = 48;

const STATUS_FILTERS = ['not_charged_yet', 'held', 'completed', 'refunded', 'disputed', 'canceled_or_failed'];

const walletReadToolDefinitions = [
  {
    name: 'get_wallet',
    description: `The person's own Pantopus Wallet, as their Wallet screen shows it: the balance they can withdraw now, money held for a payment dispute, anything still owed for a payment refunded or disputed after it reached them, whether the wallet is frozen, lifetime received and withdrawn; money on its way in (in review, releasing soon, in dispute); whether they can withdraw now and why not; whether payouts are set up; an unfinished withdrawal; recent bank payouts; and the last ${ACTIVITY_SHOWN} wallet moves. Use it for "what's my balance", "why is money on hold", "can I withdraw" or "where's my withdrawal". Read only: you cannot withdraw, pay, refund or change payout settings, and you never see card or bank details; for any of that, send them to their Wallet screen. Read it again each time they ask: money moves.`,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'find_payments',
    description: `Payments the person made or received on Pantopus, newest first, as their Payments screen lists them: tasks, tips, invoices, cancellation and no-show fees, and things they bought from Pantopus (stamp books, the property value review packet). Each has the amount, the status in the screen's words, what it was for, the other person's first name (a business by its name), the day, fees, refunds and disputes, and for money they received whether it has reached their wallet. Also totals for the period. Use it for "what did I pay last month", "did my refund come through" or "did they pay me". Read only: you cannot pay, refund, withdraw, dispute or cancel anything, and you never see card or bank details; send them to the payment in the app for that. Up to ${PAYMENTS_SHOWN} payments; \`more\` says how many others match.`,
    input_schema: {
      type: 'object',
      properties: {
        direction: { type: ['string', 'null'], enum: ['paid', 'received', null], description: '"paid" for money they paid, "received" for money paid to them, null for both.' },
        days: { type: ['integer', 'null'], minimum: 1, maximum: MAX_DAYS, description: `How many days back. Null means ${DEFAULT_DAYS}.` },
        month: { type: ['string', 'null'], description: 'One calendar month in their time zone instead of days, as YYYY-MM (for "last month"), within the last year. Null to use days.' },
        status: {
          type: ['string', 'null'],
          enum: [...STATUS_FILTERS, null],
          description: 'Only payments in this state, or null for all: not_charged_yet (a card hold or setup, nothing taken), held (taken, in the 48-hour review or being released), completed (released to the person paid, or a purchase paid), refunded (refund pending, partly or fully refunded), disputed, canceled_or_failed.',
        },
      },
      required: ['direction', 'days', 'month', 'status'],
      additionalProperties: false,
    },
  },
];

const WALLET_TOOL_NAMES = new Set(walletReadToolDefinitions.map((tool) => tool.name));

// ─── Small helpers ─────────────────────────────────────────────────────────

/** "$1,284.50" for 128450 cents. */
function money(cents) {
  const value = Number(cents) || 0;
  const text = (Math.abs(value) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value < 0 ? '-' : ''}$${text}`;
}

/** An amount as both whole cents and the plain words: { amount_cents: 1250, amount: "$12.50" }. */
function cash(name, cents) {
  const value = Math.round(Number(cents) || 0);
  return { [`${name}_cents`]: value, [name]: money(value) };
}

/** The day of a time in `zone`, as a label and an ISO date. */
function dayOf(iso, zone) {
  const at = DateTime.fromISO(String(iso || ''), { zone: 'utc' }).setZone(zoneOr(zone));
  return at.isValid ? { day: dayLabel(iso, zone), date: at.toISODate() } : {};
}

/** "Thu, Oct 22" for a time in `zone`, for a line inside an entry that already has its day. */
function shortDay(iso, zone) {
  const at = DateTime.fromISO(String(iso || ''), { zone: 'utc' }).setZone(zoneOr(zone));
  return at.isValid ? at.toFormat('ccc, LLL d') : null;
}

/** A bare date ("2026-10-24", a bank payout's arrival) read as that day, never moved by a time zone. */
function bareDay(date) {
  const at = DateTime.fromISO(String(date || ''), { zone: 'utc' });
  return at.isValid ? { day: at.toFormat('cccc, LLLL d'), date: at.toISODate() } : {};
}

/** The signed-in person's id, or null: nothing is read without one. */
const ownId = (ctx) => (isUuid(ctx?.userId) ? ctx.userId : null);
const noAccount = () => ({ error: "Their account couldn't be checked, so nothing was read." });

// A table this server's database doesn't have yet reads as empty, as mailStamps.reconcile treats it.
const MISSING_TABLE = new Set(['42P01', 'PGRST205']);

// ─── get_wallet ────────────────────────────────────────────────────────────

// The Wallet's history labels (packages/ui-utils WALLET_TX_TYPE_CONFIG; an invoice is "Invoice Income").
const ACTIVITY_KINDS = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  gig_income: 'Task Income',
  gig_payment: 'Task Payment',
  tip_income: 'Tip Received',
  tip_sent: 'Tip Sent',
  refund: 'Refund',
  adjustment: 'Adjustment',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  cancellation_fee: 'Cancellation Fee',
  withdrawal_reversal: 'Withdrawal reversal',
  booking_income: 'Booking income',
  package_income: 'Package income',
};

function activityKind(tx) {
  if (tx.type === 'gig_income' && typeof tx.description === 'string' && tx.description.startsWith('Invoice')) return 'Invoice Income';
  return ACTIVITY_KINDS[tx.type] || 'Adjustment';
}

// The row's state as the Wallet screen shows it (iOS WalletViewModel.status / ActivityRow): a withdrawal
// without a recorded transfer is still pending, and a reversed one didn't go through.
function activityStatus(tx) {
  if (tx.type === 'withdrawal') {
    if (tx.status === 'reversed') return "Reversed: it didn't go through, and the money went back to the wallet";
    if ((tx.status === 'completed' || tx.status === 'pending') && !tx.stripe_transfer_id) return 'Pending';
  }
  if (tx.status === 'pending') return 'Pending';
  if (tx.status === 'failed') return 'Failed';
  if (tx.status === 'reversed') return 'Reversed';
  return tx.direction === 'debit' ? 'Completed' : 'Cleared';
}

/** The newest wallet moves, as GET /api/wallet/transactions lists them (the person's own ledger, newest first). */
async function recentActivity(userId) {
  const { data, error, count } = await supabaseAdmin
    .from('WalletTransaction')
    .select('type, amount, direction, description, status, stripe_transfer_id, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(0, ACTIVITY_SHOWN - 1);
  if (error) throw new Error(`Wallet history read failed: ${error.message}`);
  return { rows: data || [], total: count || 0 };
}

/**
 * The oldest withdrawal whose transfer was never recorded and that wasn't reversed: the Wallet screen asks
 * about it before offering a new withdrawal (getTransactions with `unsettledWithdrawal`). Its key is read
 * only to tell whether the screen offers a retry; it never leaves this function.
 */
async function unsettledWithdrawal(userId) {
  const { data, error, count } = await supabaseAdmin
    .from('WalletTransaction')
    .select('amount, idempotency_key, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .eq('type', 'withdrawal')
    .is('stripe_transfer_id', null)
    .neq('status', 'reversed')
    .order('created_at', { ascending: true, nullsFirst: true })
    .range(0, 0);
  if (error) throw new Error(`Withdrawal check failed: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  const prefix = `withdraw:${userId}:`;
  const key = typeof row.idempotency_key === 'string' && row.idempotency_key.startsWith(prefix) ? row.idempotency_key.slice(prefix.length) : null;
  const validKey = Boolean(key) && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
  const age = Date.now() - (typeof row.created_at === 'string' ? Date.parse(row.created_at) : NaN);
  const retryable = validKey && Number.isSafeInteger(Number(row.amount)) && Number(row.amount) >= 100
    && Number.isFinite(age) && age >= 0 && age < WITHDRAWAL_RETRY_MS;
  return { amount: Number(row.amount) || 0, createdAt: row.created_at, retryable, count: count || 1 };
}

/**
 * GET /api/wallet/pending-release, without its Stripe tip reconcile: payments to the person still held
 * (in the 48-hour review, or past it and waiting for the hourly release), and income under an open dispute.
 */
async function pendingRelease(userId) {
  const now = new Date();
  const { data, error } = await supabaseAdmin
    .from('Payment')
    .select('id, amount_total, amount_to_payee, cooling_off_ends_at, payment_status, gig_fee:metadata->gig_fee')
    .eq('payee_id', userId)
    .in('payment_status', ['captured_hold', 'transfer_scheduled', 'transfer_pending'])
    .or('dispute_id.is.null,dispute_status.eq.won');
  if (error) throw new Error(`Pending release read failed: ${error.message}`);
  let inReviewCents = 0;
  let releasingSoonCents = 0;
  let inReviewCount = 0;
  let releasingSoonCount = 0;
  let firstReviewEnds = null;
  for (const row of data || []) {
    const payment = { ...row, metadata: { gig_fee: row.gig_fee } };
    // A charged poster-fault fee pays the worker only its share of the fee.
    const amount = publicGigFee(payment)?.worker_share_cents ?? (row.amount_to_payee || 0);
    const coolingEnds = row.cooling_off_ends_at ? new Date(row.cooling_off_ends_at) : null;
    const isPastCooling = coolingEnds && coolingEnds <= now;
    if (isPastCooling || row.payment_status !== 'captured_hold') {
      releasingSoonCents += amount;
      releasingSoonCount += 1;
    } else {
      inReviewCents += amount;
      inReviewCount += 1;
      if (coolingEnds && (!firstReviewEnds || coolingEnds < firstReviewEnds)) firstReviewEnds = coolingEnds;
    }
  }
  const disputed = await walletService.getDisputedIncome(userId);
  return {
    inReviewCents, inReviewCount, releasingSoonCents, releasingSoonCount, firstReviewEnds,
    inDisputeCents: disputed.cents, inDisputeCount: disputed.count,
  };
}

const PAYOUT_STATUS = { pending: 'Pending', in_transit: 'In transit', paid: 'Paid', failed: 'Failed', canceled: 'Canceled' };

/** Stripe's payouts from their payout account to their bank, as GET /api/payments/history lists them (no bank details). */
async function bankPayouts(userId) {
  const { data, error } = await supabaseAdmin
    .from('Payout')
    .select('amount, payout_status, arrival_date, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(0, PAYOUTS_SHOWN - 1);
  if (error) throw new Error(`Payout read failed: ${error.message}`);
  return data || [];
}

/** The payout account as the database last stored it: no call to Stripe, no account id. */
async function payoutAccount(userId) {
  const { data, error } = await supabaseAdmin
    .from('StripeAccount')
    .select('charges_enabled, payouts_enabled, details_submitted, last_synced_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Payout account read failed: ${error.message}`);
  return data;
}

// The Wallet and Payments screens' words for the payout account (iOS WalletViewModel.payoutAccount, PaymentsViewModel.payouts).
function payoutsForModel(account, zone) {
  if (account === undefined) return { status: "Couldn't be checked just now" };
  const checked = account?.last_synced_at ? { last_checked: dayLabel(account.last_synced_at, zone) } : {};
  if (!account) {
    return { set_up: false, status: 'Not set up', screen_says: 'Set up payouts on the Wallet screen to withdraw. Stripe handles payouts.' };
  }
  if (account.charges_enabled && account.payouts_enabled) {
    return { set_up: true, status: 'Stripe account connected', screen_says: 'Payouts enabled · Card payments enabled', ...checked };
  }
  return {
    set_up: false,
    status: 'Account verification in progress',
    screen_says: 'Stripe is verifying your identity. This usually takes 1–2 business days. Continue setup from the Wallet screen.',
    ...checked,
  };
}

// Why the Withdraw button is or isn't offered (iOS WalletViewModel.withdrawGateMessage, POST /api/wallet/withdraw).
// While something is owed the screen says withdrawals are paused; a withdrawal pays what is owed from the balance
// first (walletService.withdraw → collectDebts), so only money beyond it can go, which the balance already leaves out.
function withdrawForModel({ availableCents, owedCents, frozen, payouts }) {
  if (frozen) return { can_now: false, screen_says: 'Your wallet is frozen. Please contact support.' };
  const owed = owedCents > 0 ? `Withdrawals paused while ${money(owedCents)} is owed; their next earnings pay it first.` : null;
  if (owed && availableCents < 100) return { can_now: false, screen_says: owed };
  if (payouts?.set_up === false) return { can_now: false, screen_says: 'Set up payouts before withdrawing.' };
  if (availableCents <= 0) return { can_now: false, screen_says: 'No funds to withdraw.' };
  if (availableCents < 100) return { can_now: false, screen_says: 'The minimum withdrawal is $1.00.' };
  const up = [
    owed ? `${owed} A withdrawal pays that from the balance first.` : null,
    `Up to ${money(availableCents)} can be withdrawn on the Wallet screen; Pantopus says a withdrawal reaches the bank within 2-3 business days.`,
  ].filter(Boolean).join(' ');
  // Without the payout account there is no telling whether the screen offers Withdraw or "Set up payouts".
  if (payouts?.set_up !== true) return { can_now: null, screen_says: `${up} Whether payouts are set up couldn't be checked.` };
  return { can_now: true, screen_says: up };
}

const quietly = (promise, what, userId) => promise.catch((err) => {
  logger.warn('assistant wallet read failed', { what, userId, error: err?.message });
  return undefined;
});

async function readWallet(_args, ctx) {
  const userId = ownId(ctx);
  if (!userId) return noAccount();
  const zone = zoneOr(ctx.timeZone);
  const [wallet, hold, owedCents, pending, activity, unsettled, payouts, account] = await Promise.all([
    walletService.getWallet(userId),
    walletService.getDisputeHold(userId),
    walletService.getOpenDebt(userId),
    pendingRelease(userId),
    recentActivity(userId),
    unsettledWithdrawal(userId),
    quietly(bankPayouts(userId), 'payouts', userId),
    quietly(payoutAccount(userId), 'payout-account', userId),
  ]);

  // GET /api/wallet's `balance`: held and owed money is not withdrawable.
  const balanceCents = Number(wallet?.balance || 0);
  const availableCents = Math.max(0, balanceCents - hold.cents - owedCents);
  const frozen = Boolean(wallet?.frozen);
  const payoutsView = payoutsForModel(account, zone);

  const screenSays = [
    owedCents > 0 ? `${money(owedCents)} is still owed for a payment that was refunded or disputed after it reached your wallet. Your next earnings pay it first.` : null,
    hold.cents > 0 ? `${money(hold.cents)} of your balance is on hold while a payment dispute is open.` : null,
    frozen ? 'Wallet frozen. Please contact support.' : null,
  ].filter(Boolean);

  const totalPending = pending.inReviewCents + pending.releasingSoonCents;
  const pendingView = totalPending > 0 || pending.inDisputeCount > 0
    ? {
      note: 'Money on its way into the wallet: none of it is in the balance yet.',
      ...cash('total_pending', totalPending),
      ...cash('in_review', pending.inReviewCents),
      in_review_payments: pending.inReviewCount,
      ...(pending.firstReviewEnds ? { first_review_ends: whenLabel(pending.firstReviewEnds.toISOString(), null, zone) } : {}),
      ...cash('releasing_soon', pending.releasingSoonCents),
      releasing_soon_payments: pending.releasingSoonCount,
      ...(pending.inDisputeCount > 0 ? {
        ...cash('in_dispute', pending.inDisputeCents),
        in_dispute_payments: pending.inDisputeCount,
        in_dispute_note: 'Held while the bank reviews it, not pending; it waits for the bank\'s decision.',
      } : {}),
    }
    : { note: 'Nothing in escrow: no payment to them is waiting for release.' };

  const recent = activity.rows.map((tx) => {
    // Pantopus writes most of these lines, but support can write an adjustment's, so they count as people's words.
    const description = clip(tx.description, 80);
    return {
      kind: activityKind(tx),
      direction: tx.direction === 'debit' ? 'out' : 'in',
      ...cash('amount', tx.amount),
      status: activityStatus(tx),
      ...dayOf(tx.created_at, zone),
      ...(description ? { description_text: description } : {}),
    };
  });

  return {
    about: `Their own Wallet, read only, as the Wallet screen shows it. You cannot withdraw, pay, refund or change payouts: send them to the Wallet screen. Earnings are held ${REVIEW_HOURS} hours for review, then released into the wallet (releases run every hour).`,
    ...(recent.some((row) => row.description_text) ? { note: OTHERS_WORDS } : {}),
    wallet: {
      ...(wallet ? {} : { opened: false, opened_note: 'No wallet has been opened for them yet, so everything is $0.00.' }),
      ...cash('can_withdraw', availableCents),
      ...cash('held_for_dispute', hold.cents),
      ...cash('owed', owedCents),
      currency: String(wallet?.currency || 'usd').toUpperCase(),
      frozen,
      ...cash('lifetime_received', wallet?.lifetime_received || 0),
      ...cash('lifetime_withdrawn', wallet?.lifetime_withdrawals || 0),
    },
    ...(screenSays.length ? { screen_says: screenSays } : {}),
    withdraw: withdrawForModel({ availableCents, owedCents, frozen, payouts: payoutsView }),
    pending_release: pendingView,
    payouts: { ...payoutsView, ...(payoutsView.last_checked ? { note: 'As last stored; the Wallet screen checks with Stripe when it opens.' } : {}) },
    ...(unsettled ? {
      unfinished_withdrawal: {
        ...cash('amount', unsettled.amount),
        started: dayLabel(unsettled.createdAt, zone),
        screen_says: unsettled.retryable
          ? 'This withdrawal is still being processed. The Wallet screen offers "Retry withdrawal" for it; do not start a new withdrawal for this money.'
          : 'This withdrawal needs support review. Do not start a new withdrawal for this money.',
        ...(unsettled.count > 1 ? { others_unfinished: unsettled.count - 1 } : {}),
      },
    } : {}),
    ...(payouts === undefined ? { bank_payouts_not_checked: true } : {
      bank_payouts: payouts.map((payout) => {
        const arrives = bareDay(payout.arrival_date);
        return {
          ...cash('amount', payout.amount),
          status: PAYOUT_STATUS[payout.payout_status] || 'Pending',
          ...(arrives.date ? { arrives: arrives.day, arrival_date: arrives.date } : {}),
        };
      }),
    }),
    recent_activity: recent,
    ...(activity.total > recent.length ? { more_activity: activity.total - recent.length } : {}),
  };
}

// ─── find_payments ─────────────────────────────────────────────────────────

// The Payments screen's status words (web PaymentStatusBadge; getPaymentStatusLabel's fallback for the rest).
const STATUS_LABELS = {
  none: 'No Payment',
  setup_pending: 'Saving Card',
  ready_to_authorize: 'Authorization needed',
  authorize_pending: 'Authorizing',
  authorized: 'Authorized',
  authorization_failed: 'Auth Failed',
  capture_pending: 'Capturing',
  captured_hold: 'Payment Held',
  transfer_scheduled: 'Payout Scheduled',
  transfer_pending: 'Payout Processing',
  transferred: 'Paid Out',
  refund_pending: 'Refund Pending',
  refunded_partial: 'Partially Refunded',
  refunded_full: 'Refunded',
  disputed: 'Disputed',
  canceled: 'Canceled',
  succeeded: 'Succeeded',
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};
const statusLabel = (status) => STATUS_LABELS[status] || 'Payment status unavailable';

// What each of those words means, given once for the ones a read shows.
const RELEASE_WORDS = `The ${REVIEW_HOURS}-hour review is over; it is being released to the wallet of the person paid (releases run every hour).`;
const STATUS_MEANINGS = {
  'No Payment': 'No payment has been set up yet.',
  'Saving Card': 'The card is being saved for this payment.',
  'Authorization needed': 'The card has to be authorized before the work starts.',
  Authorizing: 'The card authorization is in progress.',
  Authorized: 'The amount is held on the card; nothing has been charged yet.',
  'Auth Failed': 'The card authorization failed; the payer needs to update their card.',
  Capturing: 'The charge is being taken.',
  'Payment Held': `Charged. Pantopus holds it for a ${REVIEW_HOURS}-hour review, then releases it to the wallet of the person paid.`,
  'Payout Scheduled': RELEASE_WORDS,
  'Payout Processing': RELEASE_WORDS,
  'Paid Out': 'Released to the person paid (into their Pantopus wallet; some older payments went straight to their Stripe account).',
  'Refund Pending': 'A refund, or the release of a card hold, is in progress.',
  'Partially Refunded': 'Part of it was refunded to the payer.',
  Refunded: 'Refunded to the payer in full.',
  Disputed: "The payer's bank is reviewing a dispute; the money waits for the bank's decision.",
  Canceled: 'Canceled before anything was charged; any card hold was released.',
  Succeeded: 'Paid.',
  Completed: 'Paid.',
  Pending: 'Not finished yet.',
  Processing: 'Being processed.',
  Failed: 'The payment failed.',
  Paid: 'Bought from Pantopus and paid.',
  'Refunded or disputed': 'The purchase was refunded or disputed, so it no longer counts.',
  'Payment status unavailable': "The status couldn't be shown here; the payment's own screen has it.",
};

const STATUS_GROUPS = {
  not_charged_yet: ['none', 'setup_pending', 'ready_to_authorize', 'authorize_pending', 'authorized', 'capture_pending',
    'pending', 'processing', 'requires_payment_method', 'requires_confirmation'],
  held: ['captured_hold', 'transfer_scheduled', 'transfer_pending'],
  completed: ['transferred', 'succeeded', 'completed'],
  refunded: ['refund_pending', 'refunded_partial', 'refunded_full', 'refunded', 'partially_refunded'],
  disputed: ['disputed'],
  canceled_or_failed: ['canceled', 'authorization_failed', 'failed'],
};

// GET /api/payments/spending (SPENDING_PAID_STATUSES) and /earnings (INCLUDABLE_STATUSES) count these.
const COUNTED_STATUSES = new Set([
  'captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred',
  'refund_pending', 'refunded_partial', 'refunded_full', 'disputed',
  'succeeded', 'processing',
]);
const RELEASED_STATUSES = new Set(['transferred', 'succeeded']);

// Only the metadata the screens' rules read: the kind of order, an invoice's business, and a charged fee.
// The rest (a tip's delivery receipts, provider references) is never read.
const PAYMENT_COLUMNS = [
  'id', 'payer_id', 'payee_id', 'gig_id', 'amount_total', 'amount_to_payee', 'amount_platform_fee', 'tip_amount',
  'payment_status', 'payment_type', 'transfer_status', 'description', 'refunded_amount', 'dispute_id', 'dispute_status',
  'cooling_off_ends_at', 'created_at',
  'meta_type:metadata->>type', 'meta_business:metadata->>business_user_id', 'gig_fee:metadata->gig_fee',
  'gig:gig_id(title)',
].join(', ');

const withMetadata = (row) => ({ ...row, metadata: { type: row.meta_type || null, business_user_id: row.meta_business || null, gig_fee: row.gig_fee || null } });

/** What a payment was for, in plain words. */
function purposeOf(payment) {
  if (payment.payment_type === 'tip') return 'tip';
  const fee = publicGigFee(payment);
  if (fee) return fee.kind === 'poster_no_show' ? 'no-show fee' : 'late cancellation fee';
  if (payment.payment_type === 'cancellation_fee') return 'cancellation fee';
  if (payment.metadata.type === 'invoice_payment') return 'invoice';
  if (payment.payment_type === 'booking_payment') return 'booking';
  if (payment.payment_type === 'package_payment') return 'booking package';
  if (payment.metadata.type === 'listing_offer_checkout') return 'marketplace item';
  if (payment.gig_id) return 'task';
  return 'payment';
}

/**
 * Who the other side is, as GET /api/payments names them (paymentPeople): the payer of money they received;
 * the payee of money they paid, except that a customer who paid a business's invoice paid the business,
 * never the person behind it.
 */
function otherSideId(payment, userId) {
  if (String(payment.payer_id) !== String(userId)) return payment.payer_id;
  const businessId = payment.metadata.type === 'invoice_payment' ? payment.metadata.business_user_id : null;
  return businessId || payment.payee_id;
}

async function namesOf(ids) {
  const wanted = [...new Set(ids.filter(isUuid))];
  if (!wanted.length) return new Map();
  const [people, kinds] = await Promise.all([
    loadChatPeople(wanted),
    supabaseAdmin.from('User').select('id, account_type').in('id', wanted),
  ]);
  // Without knowing who is a business, a business's name could be cut to its first word: name nobody.
  if (kinds.error) return new Map();
  const businesses = new Set((kinds.data || []).filter((row) => row.account_type === 'business').map((row) => String(row.id)));
  const names = new Map();
  for (const id of wanted) {
    const person = people.get(String(id));
    if (!person?.displayName) continue;
    names.set(String(id), businesses.has(String(id))
      ? { business: clip(person.displayName, 80) }
      : { other_person: firstNameOf({ display_name: person.displayName }) });
  }
  return names;
}

// The payer's refund history line (web refundRecovery.receiptText), from GET /api/payments/:id/refunds.
function refundWords(request) {
  const amount = money(request.amount_cents);
  if (request.operation === 'release') {
    if (request.status === 'succeeded') return `${amount} authorization hold released. This was not a captured charge.`;
    if (request.status === 'failed' || request.status === 'canceled') return 'The authorization hold release did not complete.';
    return `${amount} authorization hold release is pending.`;
  }
  if (request.status === 'succeeded') return `${amount} refund completed. Your bank may take additional time to show it.`;
  if (request.status === 'requires_action') return `${amount} refund needs additional action. Check its status or contact support.`;
  if (request.status === 'failed' || request.status === 'canceled') return `${amount} refund did not complete.`;
  return `${amount} refund is pending.`;
}

// A bank dispute, from the side the person is on. "won" means the person paid keeps the money.
function disputeWords(payment, paid) {
  switch (payment.dispute_status) {
    case 'won': return paid ? 'The bank decided the dispute for the person you paid; the payment stands.' : 'The bank decided the dispute for you; the payment stands.';
    case 'lost': return paid ? 'The bank decided the dispute for you and returned the money.' : 'The bank decided the dispute for the payer and took the money back.';
    case 'charge_refunded': return 'The dispute closed after the payment was refunded.';
    case 'warning_closed': return 'The bank closed its inquiry without a dispute.';
    default: return paid ? 'Your bank is reviewing a dispute on this payment.' : "The payer's bank is reviewing a dispute on this payment; the money is held until it decides.";
  }
}

// For money they received: where it stands on its way to their wallet (the pending-release rules, and
// the credit in their own wallet history once it arrived).
function walletWords(payment, credit, zone, now) {
  if (credit) return `Credited to your wallet ${shortDay(credit.created_at, zone)} (${money(credit.amount)})`;
  if (payment.payment_status === 'disputed') return 'Held while the bank reviews a dispute; not in your balance';
  if (payment.payment_status === 'captured_hold') {
    const ends = payment.cooling_off_ends_at ? new Date(payment.cooling_off_ends_at) : null;
    if (ends && ends > now) return `In review until ${whenLabel(payment.cooling_off_ends_at, null, zone)}, then released to your wallet`;
    if (ends) return 'Releasing soon to your wallet';
    return 'In review, then released to your wallet';
  }
  if (payment.payment_status === 'transfer_scheduled' || payment.payment_status === 'transfer_pending') return 'Releasing soon to your wallet';
  if (payment.payment_status === 'transferred' && payment.transfer_status === 'wallet_credited') return 'Released to your wallet';
  return null;
}

function paymentForModel(payment, { userId, zone, now, names, refunds, credits }) {
  const paid = String(payment.payer_id) === String(userId);
  const { payerCents, payeeCents } = paymentRowAmounts(payment);
  const fee = publicGigFee(payment);
  const title = clip(payment.gig?.title, 80) || clip(payment.description, 80);
  const requests = paid ? refunds.get(payment.id) || [] : [];
  const credit = paid ? null : credits.get(payment.id) || null;
  const refundedCents = Number(payment.refunded_amount || 0);
  const platformFee = Number(payment.amount_platform_fee || 0);
  const wallet = paid ? null : walletWords(payment, credit, zone, now);
  return {
    payment_id: payment.id,
    you: paid ? 'paid' : 'received',
    for: purposeOf(payment),
    ...(title ? { title_text: title } : {}),
    ...cash('amount', paid ? payerCents : payeeCents),
    status: statusLabel(payment.payment_status),
    ...(names.get(String(otherSideId(payment, userId))) || {}),
    ...dayOf(payment.created_at, zone),
    ...(fee ? { charged_fee: `${fee.kind === 'poster_no_show' ? 'No-show fee' : 'Cancellation fee'} ${money(fee.fee_cents)} charged · ${money(fee.released_cents)} released` } : {}),
    ...(!fee && platformFee > 0 ? cash('platform_fee', platformFee) : {}),
    ...(Number(payment.tip_amount || 0) > 0 ? cash('tip', payment.tip_amount) : {}),
    ...(refundedCents > 0 ? cash('refunded', refundedCents) : {}),
    ...(requests.length ? { refund: refundWords(requests[0]), ...(requests.length > 1 ? { refund_requests: requests.length } : {}) } : {}),
    ...(payment.dispute_id || payment.payment_status === 'disputed' ? { dispute: disputeWords(payment, paid) } : {}),
    ...(wallet ? { wallet } : {}),
  };
}

/** Totals for the period, counted as GET /api/payments/spending and /earnings count them. */
function totalsOf(rows, userId, direction) {
  const paid = { payments: 0, spent: 0, refunded: 0, net: 0 };
  const received = { payments: 0, earned: 0, released: 0 };
  for (const row of rows) {
    if (!COUNTED_STATUSES.has(String(row.payment_status || ''))) continue;
    const refunded = Number(row.refunded_amount || 0) || 0;
    if (String(row.payer_id) === String(userId)) {
      // A charged poster-fault fee spent only the captured fee, not the authorized amount.
      const amount = capturedFeeCents(row) ?? (Number(row.amount_total || 0) || 0);
      paid.payments += 1;
      paid.spent += amount;
      paid.refunded += refunded;
      paid.net += Math.max(0, amount - refunded);
    } else {
      // A charged poster-fault fee earns only the worker share of the fee.
      const toPayee = Number(row.amount_to_payee || 0) || 0;
      const total = Number(row.amount_total || 0) || 0;
      const feeCents = capturedFeeCents(row);
      const net = feeCents !== null && total > 0
        ? Math.max(0, Math.floor(feeCents * toPayee / total) - Math.floor(refunded * toPayee / total))
        : Math.max(0, toPayee - refunded);
      received.payments += 1;
      received.earned += net;
      if (RELEASED_STATUSES.has(row.payment_status)) received.released += net;
    }
  }
  return {
    ...(direction !== 'received' ? {
      paid: {
        payments: paid.payments, ...cash('spent', paid.spent), ...cash('refunded', paid.refunded), ...cash('net', paid.net),
        note: 'Charged payments only, not card holds or canceled ones (the Payments screen\'s total spent).',
      },
    } : {}),
    ...(direction !== 'paid' ? {
      received: {
        payments: received.payments, ...cash('earned', received.earned), ...cash('released', received.released),
        note: 'Earned is after fees and refunds and includes money still in review or held; released reached their wallet. get_wallet says what they can withdraw.',
      },
    } : {}),
  };
}

const PROVIDERS = { stripe: 'the web', apple: 'the App Store', google: 'Google Play' };

/** The stamp books and review packets they bought from Pantopus in the period. */
async function purchasesOf(userId, sinceIso, untilIso) {
  const [stamps, packets] = await Promise.all([
    supabaseAdmin.from('MailStampPurchase').select('provider, product_id, credits, revoked, created_at')
      .eq('user_id', userId).gte('created_at', sinceIso).lt('created_at', untilIso)
      .order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('AppealPacketPurchase').select('amount_cents, revoked, value_year, created_at')
      .eq('user_id', userId).gte('created_at', sinceIso).lt('created_at', untilIso)
      .order('created_at', { ascending: false }).limit(100),
  ]);
  const failed = [stamps, packets].some((result) => result.error && !MISSING_TABLE.has(result.error.code));
  const rows = [];
  let books = [];
  if ((stamps.data || []).length) {
    try {
      // Loaded only when there is a stamp book to price; the server already has it loaded for the Stamps routes.
      // eslint-disable-next-line global-require
      books = require('../mailStamps').BOOKS || [];
    } catch (err) {
      logger.warn('assistant wallet: stamp prices unavailable', { error: err?.message });
    }
  }
  for (const row of stamps.data || []) {
    const book = books.find((entry) => entry.id === row.product_id || entry.credits === row.credits);
    rows.push({
      kind: 'stamps',
      created_at: row.created_at,
      revoked: Boolean(row.revoked),
      cents: book ? book.price_cents : null,
      view: {
        you: 'paid',
        for: 'stamps',
        title: `${row.credits} Pantopus digital stamps`,
        ...(book ? { ...cash('amount', book.price_cents), amount_is_list_price: true } : { amount_cents: null, amount: 'not recorded' }),
        bought_on: PROVIDERS[row.provider] || 'Pantopus',
      },
    });
  }
  for (const row of packets.data || []) {
    rows.push({
      kind: 'packet',
      created_at: row.created_at,
      revoked: Boolean(row.revoked),
      cents: Number(row.amount_cents) || 0,
      view: {
        you: 'paid',
        for: 'property value review packet',
        title: `Property value review packet, ${row.value_year} county value`,
        ...cash('amount', row.amount_cents),
        bought_on: 'the web',
      },
    });
  }
  return { rows, failed };
}

/** The period asked for: a calendar month in their zone, or the last `days` days. */
function periodOf(args, zone) {
  const now = DateTime.now().setZone(zone);
  if (args.month != null) {
    const start = typeof args.month === 'string' && /^\d{4}-\d{2}$/.test(args.month)
      ? DateTime.fromISO(`${args.month}-01`, { zone }) : null;
    if (!start?.isValid) return { error: 'Give the month as YYYY-MM, or null to use days.' };
    if (start > now) return { error: "That month hasn't started yet." };
    if (start < now.minus({ days: MAX_DAYS }).startOf('month')) return { error: 'Payments can be read for the last year only.' };
    return { since: start.toUTC().toISO(), until: start.plus({ months: 1 }).toUTC().toISO(), label: start.toFormat('LLLL yyyy') };
  }
  const days = args.days ?? DEFAULT_DAYS;
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return { error: `Choose 1 to ${MAX_DAYS} days, or null for ${DEFAULT_DAYS}.` };
  return {
    since: now.minus({ days }).toUTC().toISO(),
    until: now.plus({ minutes: 1 }).toUTC().toISO(),
    label: `The last ${days} days, since ${now.minus({ days }).toFormat('cccc, LLLL d, yyyy')}`,
  };
}

async function findPayments(args, ctx) {
  const userId = ownId(ctx);
  if (!userId) return noAccount();
  const zone = zoneOr(ctx.timeZone);
  const direction = args.direction ?? null;
  if (direction !== null && direction !== 'paid' && direction !== 'received') return { error: 'Choose "paid", "received" or null for both.' };
  const status = args.status ?? null;
  if (status !== null && !STATUS_FILTERS.includes(status)) return { error: `Choose a status from ${STATUS_FILTERS.join(', ')}, or null for all.` };
  const period = periodOf(args, zone);
  if (period.error) return { error: period.error };

  // GET /api/payments: the person as payer, payee or either; newest first.
  let query = supabaseAdmin.from('Payment').select(PAYMENT_COLUMNS)
    .gte('created_at', period.since)
    .lt('created_at', period.until)
    .order('created_at', { ascending: false })
    .limit(PERIOD_ROWS);
  if (direction === 'paid') query = query.eq('payer_id', userId);
  else if (direction === 'received') query = query.eq('payee_id', userId);
  else query = query.or(`payer_id.eq.${userId},payee_id.eq.${userId}`);

  const [{ data, error }, purchases] = await Promise.all([
    query,
    direction === 'received' ? { rows: [], failed: false } : purchasesOf(userId, period.since, period.until),
  ]);
  if (error) throw new Error(`Payments read failed: ${error.message}`);
  // Fail closed: a row that isn't theirs is never shown, whatever the query returned.
  const rows = (data || []).map(withMetadata)
    .filter((row) => String(row.payer_id) === String(userId) || String(row.payee_id) === String(userId));

  const wanted = status ? new Set(STATUS_GROUPS[status]) : null;
  const purchaseMatches = (row) => !status || (status === 'refunded' ? row.revoked : status === 'completed' && !row.revoked);
  const matched = [
    ...rows.filter((row) => !wanted || wanted.has(String(row.payment_status || ''))).map((row) => ({ at: row.created_at, payment: row })),
    ...purchases.rows.filter(purchaseMatches).map((row) => ({ at: row.created_at, purchase: row })),
  ].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  const shown = matched.slice(0, PAYMENTS_SHOWN);

  // What the shown payments need: names, the payer's refund requests, and the wallet credits of money received.
  const shownPayments = shown.filter((entry) => entry.payment).map((entry) => entry.payment);
  const paidIds = shownPayments.filter((p) => String(p.payer_id) === String(userId)).map((p) => p.id);
  const receivedIds = shownPayments.filter((p) => String(p.payer_id) !== String(userId)).map((p) => p.id);
  const [names, refundRows, creditRows] = await Promise.all([
    namesOf(shownPayments.map((p) => otherSideId(p, userId))),
    paidIds.length
      ? supabaseAdmin.from('PaymentRefundRequest').select('payment_id, operation, amount_cents, status, created_at')
        .in('payment_id', paidIds).order('created_at', { ascending: false })
      : { data: [] },
    receivedIds.length
      ? supabaseAdmin.from('WalletTransaction').select('payment_id, amount, created_at')
        .eq('user_id', userId).eq('direction', 'credit').in('type', ['gig_income', 'tip_income']).in('payment_id', receivedIds)
      : { data: [] },
  ]);
  if (refundRows.error) throw new Error(`Refund read failed: ${refundRows.error.message}`);
  if (creditRows.error) throw new Error(`Wallet credit read failed: ${creditRows.error.message}`);
  const refunds = new Map();
  for (const request of refundRows.data || []) {
    if (!paidIds.includes(request.payment_id)) continue;
    refunds.set(request.payment_id, [...(refunds.get(request.payment_id) || []), request]);
  }
  const credits = new Map();
  for (const credit of creditRows.data || []) {
    const earlier = credits.get(credit.payment_id);
    credits.set(credit.payment_id, earlier
      ? { amount: Number(earlier.amount) + Number(credit.amount), created_at: earlier.created_at }
      : { amount: Number(credit.amount), created_at: credit.created_at });
  }

  const now = new Date();
  const items = shown.map((entry) => (entry.payment
    ? paymentForModel(entry.payment, { userId, zone, now, names, refunds, credits })
    : { ...entry.purchase.view, status: entry.purchase.revoked ? 'Refunded or disputed' : 'Paid', ...dayOf(entry.purchase.created_at, zone) }));
  const meanings = Object.fromEntries([...new Set(items.map((item) => item.status))]
    .map((label) => [label, STATUS_MEANINGS[label]]).filter(([, meaning]) => meaning));
  const boughtTotal = purchases.rows.filter((row) => !row.revoked && row.cents != null).reduce((sum, row) => sum + row.cents, 0);
  const boughtCount = purchases.rows.filter((row) => !row.revoked).length;

  return {
    about: 'Their own payments, read only: you cannot pay, refund, dispute or cancel. Paid: the amount was charged (or held on the card) and includes platform_fee. Received: the amount is theirs after platform_fee.',
    ...(items.some((item) => item.title_text) ? { note: OTHERS_WORDS } : {}),
    period: period.label,
    totals: {
      ...totalsOf(rows, userId, direction),
      ...(direction !== 'received' && boughtCount ? {
        bought_from_pantopus: { purchases: boughtCount, ...cash('total', boughtTotal), note: 'Stamp books at their listed price and review packets; refunded or disputed ones left out.' },
      } : {}),
      ...(rows.length >= PERIOD_ROWS ? { cut_short: `Only the newest ${PERIOD_ROWS} payments of this period are counted.` } : {}),
    },
    ...(status ? { showing: `Only ${status.replace(/_/g, ' ')} payments.` } : {}),
    payments: items,
    ...(matched.length > shown.length ? { more: matched.length - shown.length } : {}),
    ...(items.length ? {} : { none: 'No payments match in this period.' }),
    ...(purchases.failed ? { purchases_not_checked: 'Purchases from Pantopus could not be read just now; say so rather than guessing.' } : {}),
    ...(Object.keys(meanings).length ? { status_meanings: meanings } : {}),
  };
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

const WALLET_READ_EXECUTORS = {
  get_wallet: readWallet,
  find_payments: findPayments,
};

async function runWalletReadTool(name, args, ctx) {
  const executor = WALLET_READ_EXECUTORS[name];
  if (!executor) return null;
  try {
    return await executor(args || {}, ctx || {});
  } catch (err) {
    logger.warn('assistant read tool failed', { tool: name, userId: ctx?.userId, error: err?.message });
    return { error: `That couldn't be read just now (${name}).` };
  }
}

module.exports = { walletReadToolDefinitions, runWalletReadTool, WALLET_TOOL_NAMES };
