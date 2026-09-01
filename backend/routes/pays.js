// ============================================================
// STRIPE PAYMENT ROUTES
// REST API endpoints for payments and Connect accounts
// ============================================================

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const supabaseAdmin = require('../config/supabaseAdmin');
const stripeService = require('../stripe/stripeService');
const verifyToken = require('../middleware/verifyToken');
const { requireAdmin } = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const Joi = require('joi');
const logger = require('../utils/logger');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');

const paymentHistoryReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many payment history requests. Please try again shortly.' },
});

// `exact` is expensive on hot financial tables; use planner-based counts and
// mark totals as approximate in responses.
const COUNT_MODE = 'planned';

function sanitizeStripeErrorMessage(err, fallback = 'Payment service is temporarily unavailable. Please try again.') {
  const raw = String(err?.message || '');
  const normalized = raw.toLowerCase();
  if (
    normalized.includes('you did not provide an api key') ||
    normalized.includes('authorization header') ||
    normalized.includes('invalid api key')
  ) {
    return fallback;
  }
  return raw || fallback;
}

const SPENDING_PAID_STATUSES = new Set([
  'captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred',
  'refund_pending', 'refunded_partial', 'refunded_full', 'disputed',
  'succeeded', 'processing',
]);

function toIsoOrNull(dateValue) {
  if (!dateValue) return null;
  const dt = new Date(String(dateValue));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function normalizeSpending(raw) {
  const totalPayments = Number(raw?.totalPayments ?? raw?.total_payments ?? 0) || 0;
  const totalSpent = Number(raw?.totalSpent ?? raw?.total_spent ?? 0) || 0;
  const totalPaid = Number(raw?.totalPaid ?? raw?.total_paid ?? 0) || 0;
  const totalRefunded = Number(raw?.totalRefunded ?? raw?.total_refunded ?? 0) || 0;
  const currency = raw?.currency || 'USD';

  return {
    totalPayments,
    total_payments: totalPayments,
    totalSpent,
    total_spent: totalSpent,
    totalPaid,
    total_paid: totalPaid,
    totalRefunded,
    total_refunded: totalRefunded,
    currency,
  };
}

const AGGREGATE_SPENDING_LIMIT = 10000;

async function aggregateSpending(userId, startDate = null, endDate = null) {
  let query = supabaseAdmin
    .from('Payment')
    .select('amount_total, refunded_amount, payment_status, created_at')
    .eq('payer_id', userId)
    .order('created_at', { ascending: false })
    .limit(AGGREGATE_SPENDING_LIMIT);

  if (startDate) query = query.gte('created_at', new Date(String(startDate)).toISOString());
  if (endDate) query = query.lte('created_at', new Date(String(endDate)).toISOString());

  const { data: rows, error: qErr } = await query;

  if (qErr) throw new Error(qErr.message);

  if (rows && rows.length >= AGGREGATE_SPENDING_LIMIT) {
    logger.warn('aggregateSpending fallback hit safety cap', { userId, limit: AGGREGATE_SPENDING_LIMIT });
  }

  let totalPayments = 0;
  let totalSpent = 0;
  let totalPaid = 0;
  let totalRefunded = 0;

  for (const row of (rows || [])) {
    const status = String(row?.payment_status || '');
    if (!SPENDING_PAID_STATUSES.has(status)) continue;
    const amount = Number(row?.amount_total || 0) || 0;
    const refunded = Number(row?.refunded_amount || 0) || 0;
    totalPayments += 1;
    totalSpent += amount;
    totalRefunded += refunded;
    totalPaid += Math.max(0, amount - refunded);
  }

  return normalizeSpending({
    totalPayments,
    totalSpent,
    totalPaid,
    totalRefunded,
    currency: 'USD',
  });
}

// ============ VALIDATION SCHEMAS ============

const createConnectAccountSchema = Joi.object({
  country: Joi.string().length(2).default('US'),
  businessType: Joi.string().valid('individual', 'company').default('individual')
});

const createPaymentSchema = Joi.object({
  gigId: Joi.string().uuid().optional(),
  listingId: Joi.string().uuid().optional(),
  offerId: Joi.string().uuid().optional(),
  description: Joi.string().max(500).optional(),
  paymentMethodId: Joi.string().optional(), // Stripe payment method ID
  metadata: Joi.object().optional()
})
  // The server must derive payee + amount from one authoritative order
  // reference. Listing checkouts are identified by the listing/offer pair.
  .xor('gigId', 'offerId')
  .with('listingId', 'offerId')
  .with('offerId', 'listingId');

const attachPaymentMethodSchema = Joi.object({
  paymentMethodId: Joi.string().required() // pm_xxx from Stripe.js
});

const createRefundSchema = Joi.object({
  amount: Joi.number().integer().min(50).optional(), // If not provided, full refund
  reason: Joi.string().valid(
    'duplicate', 'fraudulent', 'requested_by_customer', 
    'work_not_completed', 'other'
  ).required(),
  description: Joi.string().max(500).optional()
});

function paymentRouteError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function dollarsToCents(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100);
}

function assertPayableAmount(amount) {
  if (!Number.isInteger(amount) || amount < 50) {
    throw paymentRouteError(400, 'Order amount must be at least $0.50');
  }
}

const PAYABLE_GIG_STATUSES = new Set(['assigned', 'in_progress', 'completed']);
const ACCEPTED_BID_STATUSES = ['accepted', 'assigned', 'pending_payment'];
const REUSABLE_CHECKOUT_PAYMENT_STATUSES = new Set([
  PAYMENT_STATES.AUTHORIZE_PENDING,
  PAYMENT_STATES.AUTHORIZED,
  'pending',
  'requires_payment_method',
  'requires_confirmation',
  'processing',
]);
const RETRYABLE_CHECKOUT_PAYMENT_STATUSES = new Set([
  PAYMENT_STATES.AUTHORIZATION_FAILED,
]);
const IGNORED_CHECKOUT_PAYMENT_STATUSES = new Set([
  PAYMENT_STATES.CANCELED,
  'canceled',
  'failed',
]);
const BLOCKING_CHECKOUT_PAYMENT_STATUSES = new Set([
  PAYMENT_STATES.CAPTURE_PENDING,
  PAYMENT_STATES.CAPTURED_HOLD,
  PAYMENT_STATES.TRANSFER_SCHEDULED,
  PAYMENT_STATES.TRANSFER_PENDING,
  PAYMENT_STATES.TRANSFERRED,
  PAYMENT_STATES.REFUND_PENDING,
  PAYMENT_STATES.REFUNDED_PARTIAL,
  PAYMENT_STATES.REFUNDED_FULL,
  PAYMENT_STATES.DISPUTED,
  'succeeded',
  'refunded',
  'partially_refunded',
]);

function paymentStatus(payment) {
  return String(payment?.payment_status || '').toLowerCase();
}

function paymentHasSameTerms(payment, { payerId, checkout }) {
  return (
    String(payment?.payer_id) === String(payerId) &&
    String(payment?.payee_id) === String(checkout.payeeId) &&
    Number(payment?.amount_total) === Number(checkout.amount)
  );
}

function metadataMatches(metadata = {}, expected = {}) {
  return Object.entries(expected).every(([key, value]) => String(metadata?.[key] || '') === String(value));
}

function checkoutIdempotencyKey({ payerId, checkout }) {
  if (checkout.gigId) {
    return `payment-intent:gig:${checkout.gigId}:${payerId}:${checkout.amount}`;
  }
  return `payment-intent:listing-offer:${checkout.listingId}:${checkout.offerId}:${payerId}:${checkout.amount}`;
}

async function resolveAcceptedGigBid({ gigId, acceptedBy }) {
  if (!acceptedBy) return null;

  const { data, error } = await supabaseAdmin
    .from('GigBid')
    .select('id, bid_amount, status')
    .eq('gig_id', gigId)
    .eq('user_id', acceptedBy)
    .in('status', ACCEPTED_BID_STATUSES)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn('Payment intent: accepted bid lookup failed', { gigId, acceptedBy, error: error.message });
  }
  return data || null;
}

async function resolveGigCheckout({ payerId, gigId }) {
  const { data: gig, error } = await supabaseAdmin
    .from('Gig')
    .select('id, user_id, accepted_by, title, status, price, origin_home_id, payment_id, payment_status')
    .eq('id', gigId)
    .single();

  if (error || !gig) {
    throw paymentRouteError(404, 'Gig not found');
  }
  if (gig.user_id !== payerId) {
    throw paymentRouteError(403, 'Only the gig requester can pay for this gig');
  }
  if (!gig.accepted_by) {
    throw paymentRouteError(409, 'Gig does not have an accepted worker');
  }
  if (!PAYABLE_GIG_STATUSES.has(gig.status)) {
    throw paymentRouteError(400, 'Gig is not payable');
  }

  const acceptedBid = await resolveAcceptedGigBid({ gigId, acceptedBy: gig.accepted_by });
  const amount = dollarsToCents(acceptedBid?.bid_amount ?? gig.price);
  assertPayableAmount(amount);

  const orderMetadata = {
    type: 'gig_checkout',
    gig_id: gigId,
  };
  if (acceptedBid?.id) orderMetadata.bid_id = acceptedBid.id;

  return {
    payeeId: gig.accepted_by,
    amount,
    gigId,
    listingId: null,
    offerId: null,
    homeId: gig.origin_home_id || null,
    description: `Pantopus gig: ${gig.title || gigId}`,
    orderMetadata,
    metadata: { ...orderMetadata },
  };
}

async function resolveListingOfferCheckout({ payerId, listingId, offerId }) {
  const { data: offer, error: offerError } = await supabaseAdmin
    .from('ListingOffer')
    .select('id, listing_id, buyer_id, seller_id, amount, status')
    .eq('id', offerId)
    .single();

  if (offerError || !offer) {
    throw paymentRouteError(404, 'Offer not found');
  }
  if (offer.listing_id !== listingId) {
    throw paymentRouteError(400, 'Offer does not belong to this listing');
  }
  if (offer.buyer_id !== payerId) {
    throw paymentRouteError(403, 'Only the buyer can pay for this offer');
  }
  if (offer.status !== 'accepted') {
    throw paymentRouteError(409, 'Offer must be accepted before payment');
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from('Listing')
    .select('id, user_id, title, status')
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    throw paymentRouteError(404, 'Listing not found');
  }
  if (listing.user_id !== offer.seller_id) {
    throw paymentRouteError(409, 'Offer seller does not match listing owner');
  }
  if (!['active', 'reserved'].includes(listing.status)) {
    throw paymentRouteError(409, 'Listing is not payable');
  }

  const amount = dollarsToCents(offer.amount);
  assertPayableAmount(amount);

  const orderMetadata = {
    type: 'listing_offer_checkout',
    listing_id: listingId,
    offer_id: offerId,
  };

  return {
    payeeId: offer.seller_id,
    amount,
    gigId: null,
    listingId,
    offerId,
    homeId: null,
    description: `Pantopus listing: ${listing.title || listingId}`,
    orderMetadata,
    metadata: { ...orderMetadata },
  };
}

async function resolveCheckoutPayment({ payerId, body }) {
  if (body.gigId) {
    return resolveGigCheckout({
      payerId,
      gigId: body.gigId,
    });
  }

  return resolveListingOfferCheckout({
    payerId,
    listingId: body.listingId,
    offerId: body.offerId,
  });
}

async function findExistingCheckoutPayments(checkout) {
  let query = supabaseAdmin
    .from('Payment')
    .select('*')
    .eq('payment_type', 'gig_payment')
    .order('created_at', { ascending: false })
    .limit(10);

  if (checkout.gigId) {
    query = query.eq('gig_id', checkout.gigId);
  } else {
    query = query
      .is('gig_id', null)
      .contains('metadata', checkout.orderMetadata);
  }

  const { data, error } = await query;
  if (error) {
    throw paymentRouteError(500, `Failed to check existing checkout payment: ${error.message}`);
  }

  return (data || []).filter((payment) => (
    checkout.gigId || metadataMatches(payment.metadata, checkout.orderMetadata)
  ));
}

async function resolveExistingCheckoutIntent({ payerId, checkout }) {
  const existingPayments = await findExistingCheckoutPayments(checkout);
  const activePayments = existingPayments.filter((payment) => (
    !IGNORED_CHECKOUT_PAYMENT_STATUSES.has(paymentStatus(payment))
  ));

  const conflictingPayment = activePayments.find((payment) => !paymentHasSameTerms(payment, { payerId, checkout }));
  if (conflictingPayment) {
    throw paymentRouteError(409, 'An existing checkout payment no longer matches this order');
  }

  const payment = activePayments.find((candidate) => paymentHasSameTerms(candidate, { payerId, checkout }));
  if (!payment) return null;

  const status = paymentStatus(payment);
  if (BLOCKING_CHECKOUT_PAYMENT_STATUSES.has(status)) {
    throw paymentRouteError(409, `Checkout already has a payment in ${status} state`);
  }

  if (RETRYABLE_CHECKOUT_PAYMENT_STATUSES.has(status)) {
    return { existingPaymentId: payment.id };
  }

  if (REUSABLE_CHECKOUT_PAYMENT_STATUSES.has(status) && payment.stripe_payment_intent_id) {
    const clientSecret = await stripeService.getPaymentIntentClientSecret(payment.stripe_payment_intent_id);
    return {
      reused: true,
      result: {
        success: true,
        clientSecret,
        paymentIntentId: payment.stripe_payment_intent_id,
        paymentId: payment.id,
        payment,
      },
    };
  }

  throw paymentRouteError(409, `Checkout already has a payment in ${status || 'unknown'} state`);
}

async function linkGigCheckoutPayment({ checkout, result }) {
  if (!checkout.gigId || !result?.paymentId) return;

  const paymentStatus = result.payment?.payment_status || PAYMENT_STATES.AUTHORIZE_PENDING;
  const { error } = await supabaseAdmin
    .from('Gig')
    .update({
      payment_id: result.paymentId,
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', checkout.gigId)
    .is('payment_id', null);

  if (error) {
    logger.warn('Payment intent: failed to link gig payment', {
      gigId: checkout.gigId,
      paymentId: result.paymentId,
      error: error.message,
    });
  }
}

// ============ CONNECT ACCOUNT ROUTES ============

/**
 * POST /api/payments/connect/account
 * Create Stripe Connect account for user
 */
router.post('/connect/account', verifyToken, validate(createConnectAccountSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { country, businessType } = req.body;
    
    // Get user email (use admin client — RLS restricts User reads)
    const { data: user } = await supabaseAdmin
      .from('User')
      .select('email, name')
      .eq('id', userId)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const result = await stripeService.createConnectAccount(userId, {
      email: user.email,
      country: country,
      business_type: businessType
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.status(201).json({
      message: 'Stripe Connect account created',
      account: result.account,
      stripeAccountId: result.stripeAccountId
    });
    
  } catch (err) {
    logger.error('Connect account creation error', { error: err.message, stack: err.stack });
    
    // Surface Stripe-specific errors clearly
    if (err.message?.includes('signed up for Connect')) {
      return res.status(503).json({ 
        error: 'Stripe Connect is not enabled',
        message: 'The platform needs to enable Stripe Connect in the Stripe Dashboard before accounts can be created. Visit https://dashboard.stripe.com/connect/overview to set it up.',
        code: 'connect_not_enabled'
      });
    }
    
    res.status(500).json({ error: 'Failed to create Connect account', message: err.message });
  }
});

/**
 * POST /api/payments/connect/onboarding
 * Create onboarding link for Connect account
 */
router.post('/connect/onboarding', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { returnUrl, refreshUrl } = req.body;
    
    const clientUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3000';
    const defaultReturnUrl = `${clientUrl}/app/settings/payments?onboarding=success`;
    const defaultRefreshUrl = `${clientUrl}/app/settings/payments?onboarding=refresh`;
    
    const result = await stripeService.createAccountLink(
      userId,
      returnUrl || defaultReturnUrl,
      refreshUrl || defaultRefreshUrl
    );
    
    res.json({
      onboardingUrl: result.url,
      expiresAt: result.expiresAt
    });
    
  } catch (err) {
    logger.error('Onboarding link error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to create onboarding link', message: err.message });
  }
});

/**
 * GET /api/payments/connect/account
 * Get user's Connect account status
 */
router.get('/connect/account', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await stripeService.getConnectAccount(userId);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ account: result.account });
    
  } catch (err) {
    logger.error('Get Connect account error', { error: err.message });
    res.status(500).json({ error: 'Failed to get Connect account' });
  }
});

/**
 * POST /api/payments/connect/dashboard
 * Create login link to Stripe Express dashboard
 */
router.post('/connect/dashboard', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await stripeService.createLoginLink(userId);
    
    res.json({ dashboardUrl: result.url });
    
  } catch (err) {
    logger.error('Dashboard link error', { error: err.message });
    res.status(500).json({ error: 'Failed to create dashboard link' });
  }
});

// ============ PAYMENT INTENT ROUTES ============

/**
 * POST /api/payments/intent
 * Create mobile PaymentSheet params for a server-priced checkout.
 */
router.post('/intent', verifyToken, validate(createPaymentSchema), async (req, res) => {
  try {
    const payerId = req.user.id;
    const checkout = await resolveCheckoutPayment({ payerId, body: req.body });
    const existingIntent = await resolveExistingCheckoutIntent({ payerId, checkout });

    const result = existingIntent?.result || await stripeService.createPaymentIntentForGig({
      payerId,
      payeeId: checkout.payeeId,
      amount: checkout.amount,
      gigId: checkout.gigId,
      homeId: checkout.homeId,
      paymentMethodId: req.body.paymentMethodId,
      existingPaymentId: existingIntent?.existingPaymentId,
      metadata: checkout.metadata,
      description: checkout.description,
      idempotencyKey: existingIntent?.existingPaymentId ? undefined : checkoutIdempotencyKey({ payerId, checkout }),
    });

    await linkGigCheckoutPayment({ checkout, result });

    // The mobile PaymentSheet needs the buyer's Stripe customer + a
    // short-lived ephemeral key to render saved cards (and save new ones).
    // The PaymentIntent was created against getOrCreateCustomer(payerId);
    // mint a key for that same customer. Non-fatal if it fails — the sheet
    // still works card-only against the client secret.
    let customer = null;
    let ephemeralKey = null;
    try {
      customer = await stripeService.getOrCreateCustomer(payerId);
      const ek = await stripeService.createEphemeralKey(customer);
      ephemeralKey = ek?.secret || null;
    } catch (ekErr) {
      logger.warn('Payment intent: ephemeral key creation failed (non-fatal)', { error: ekErr.message });
    }

    res.status(existingIntent?.reused ? 200 : 201).json({
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      payment: result.payment,
      paymentId: result.paymentId,
      customer,
      ephemeralKey,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
      amount: checkout.amount,
      reused: !!existingIntent?.reused,
    });

  } catch (err) {
    logger.error('Payment intent creation error', { error: err.message });
    const status = err.status || 500;
    res.status(status).json({
      error: status >= 500 ? 'Failed to create payment intent' : err.message,
      message: err.message
    });
  }
});

/**
 * GET /api/payments
 * Get user's payment history
 * NOTE: /:paymentId moved to end of file to avoid catching named routes
 */
router.get('/', verifyToken, paymentHistoryReadLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      type = 'all', // 'sent', 'received', 'all'
      status,
      limit = 50,
      offset = 0
    } = req.query;

    const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
    const parsedOffset = Math.max(0, parseInt(String(offset), 10) || 0);
    const MAX_OFFSET = 5000;
    if (parsedOffset > MAX_OFFSET) {
      return res.status(400).json({
        error: `Offset too large. Maximum supported offset is ${MAX_OFFSET}.`,
      });
    }
    
    let query = supabaseAdmin
      .from('Payment')
      .select(`
        *,
        payer:payer_id(id, username, name, profile_picture_url),
        payee:payee_id(id, username, name, profile_picture_url),
        gig:gig_id(id, title, category)
      `, { count: COUNT_MODE });
    
    // Filter by type
    if (type === 'sent') {
      query = query.eq('payer_id', userId);
    } else if (type === 'received') {
      query = query.eq('payee_id', userId);
    } else {
      query = query.or(`payer_id.eq.${userId},payee_id.eq.${userId}`);
    }
    
    // Filter by status
    if (status) {
      query = query.eq('payment_status', status);
    }
    
    // Pagination
    query = query
      .order('created_at', { ascending: false })
      .range(parsedOffset, parsedOffset + parsedLimit - 1);
    
    const { data: payments, error, count } = await query;
    
    if (error) {
      logger.error('Error fetching payments', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch payments' });
    }
    
    const enrichedPayments = (payments || []).map((payment) => {
      const isSender = String(payment?.payer_id || '') === String(userId);
      const payerAmount = Number(payment?.amount_total || 0) || 0;
      const payeeAmount = Number(payment?.amount_to_payee ?? payment?.amount_total ?? 0) || 0;
      return {
        ...payment,
        amount_cents: isSender ? payerAmount : payeeAmount,
        _isSender: isSender,
        direction: isSender ? 'debit' : 'credit',
      };
    });

    res.json({
      payments: enrichedPayments,
      total: count,
      total_is_approximate: true,
      count_mode: COUNT_MODE,
      limit: parsedLimit,
      offset: parsedOffset
    });
    
  } catch (err) {
    logger.error('Payments fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

/**
 * GET /api/payments/history
 * Combined payment + payout history for Payments & Payouts UI.
 */
router.get('/history', verifyToken, paymentHistoryReadLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 50), 10) || 50));
    const offset = Math.max(0, parseInt(String(req.query.offset || 0), 10) || 0);

    // Cap the total window to prevent expensive unbounded DB reads.
    const MAX_FETCH_SPAN = 500;
    if (offset >= MAX_FETCH_SPAN) {
      return res.status(400).json({
        error: `Offset too large. Maximum supported offset is ${MAX_FETCH_SPAN - 1}.`,
      });
    }
    const fetchSpan = Math.min(offset + limit, MAX_FETCH_SPAN);

    // Self-heal older stuck tip rows so history reflects their real Stripe
    // status instead of leaving successful tips as authorize_pending forever.
    await stripeService.reconcilePendingTipsForUser(userId);

    const [paymentsRes, payoutsRes] = await Promise.all([
      supabaseAdmin
        .from('Payment')
        .select(`
          id,
          payer_id,
          payee_id,
          amount_total,
          amount_to_payee,
          currency,
          payment_status,
          payment_type,
          description,
          created_at,
          updated_at,
          gig:gig_id(id, title, category),
          payer:payer_id(id, username, name, profile_picture_url),
          payee:payee_id(id, username, name, profile_picture_url)
        `, { count: COUNT_MODE })
        .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .range(0, Math.max(0, fetchSpan - 1)),
      supabaseAdmin
        .from('Payout')
        .select(`
          id,
          amount,
          currency,
          payout_status,
          destination_last4,
          destination_type,
          arrival_date,
          stripe_payout_id,
          created_at,
          updated_at
        `, { count: COUNT_MODE })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(0, Math.max(0, fetchSpan - 1)),
    ]);

    if (paymentsRes.error) {
      logger.error('Error fetching payment history stream', {
        error: paymentsRes.error.message,
        userId,
      });
      return res.status(500).json({ error: 'Failed to fetch history' });
    }
    if (payoutsRes.error) {
      logger.error('Error fetching payout history stream', {
        error: payoutsRes.error.message,
        userId,
      });
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    const paymentRows = (paymentsRes.data || []).map((payment) => {
      const isSender = String(payment?.payer_id || '') === String(userId);
      const payerAmount = Number(payment?.amount_total || 0) || 0;
      const payeeAmount = Number(payment?.amount_to_payee ?? payment?.amount_total ?? 0) || 0;
      return {
        ...payment,
        id: payment.id,
        entry_type: 'payment',
        amount_cents: isSender ? payerAmount : payeeAmount,
        direction: isSender ? 'debit' : 'credit',
        status: payment?.payment_status || null,
        _isSender: isSender,
      };
    });

    const payoutRows = (payoutsRes.data || []).map((payout) => ({
      id: `payout_${payout.id}`,
      payout_id: payout.id,
      entry_type: 'payout',
      amount: Number(payout?.amount || 0) || 0,
      amount_cents: Number(payout?.amount || 0) || 0,
      currency: payout?.currency || 'USD',
      payout_status: payout?.payout_status || 'pending',
      status: payout?.payout_status || 'pending',
      destination_last4: payout?.destination_last4 || null,
      destination_type: payout?.destination_type || null,
      arrival_date: payout?.arrival_date || null,
      stripe_payout_id: payout?.stripe_payout_id || null,
      direction: 'debit',
      description: `Payout${payout?.destination_last4 ? ` to bank ••••${payout.destination_last4}` : ''}`,
      created_at: payout?.created_at,
      updated_at: payout?.updated_at,
      _isSender: true,
    }));

    const merged = [...paymentRows, ...payoutRows].sort((a, b) => {
      const aTs = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTs = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return bTs - aTs;
    });

    const sliced = merged.slice(offset, offset + limit);
    const total = Number(paymentsRes.count || 0) + Number(payoutsRes.count || 0);

    return res.json({
      transactions: sliced,
      payments: sliced, // backwards compatibility for existing clients
      total,
      total_is_approximate: true,
      count_mode: COUNT_MODE,
      limit,
      offset,
    });
  } catch (err) {
    logger.error('Combined history fetch error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ============ REFUND ROUTES ============

/**
 * POST /api/payments/:paymentId/refund
 * Create refund
 */
router.post('/:paymentId/refund', verifyToken, validate(createRefundSchema), async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;
    const { amount, reason, description } = req.body;
    
    // Get payment
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('Payment')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError) {
      logger.error('Error fetching payment for refund', { error: paymentError.message, paymentId });
      return res.status(500).json({ error: 'Failed to fetch payment' });
    }

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Only the payer can initiate a refund
    if (payment.payer_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Terminal states cannot be refunded
    const terminalStates = ['refunded_full', 'canceled', 'disputed'];
    if (terminalStates.includes(payment.payment_status)) {
      return res.status(400).json({ error: 'Payment is in a terminal state and cannot be refunded' });
    }

    // Transferred payments require admin/support intervention
    if (payment.payment_status === 'transferred') {
      return res.status(403).json({ error: 'Payment already transferred. Contact support for refund.' });
    }

    // Default to full refund
    const refundAmount = amount || payment.amount_total;
    
    const result = await stripeService.createRefund(
      paymentId,
      refundAmount,
      reason,
      userId
    );
    
    res.status(201).json({
      message: 'Refund created successfully',
      refund: result.refund
    });
    
  } catch (err) {
    logger.error('Refund creation error', { error: err.message, paymentId: req.params.paymentId });
    res.status(500).json({ 
      error: 'Failed to create refund',
      message: err.message 
    });
  }
});

/**
 * POST /api/payments/:paymentId/admin-refund
 * Admin-only refund that supports all payment states including post-transfer.
 * Delegates to createSmartRefund which handles Stripe refund + transfer reversal.
 */
const adminRefundSchema = Joi.object({
  amount: Joi.number().integer().min(50).optional(),
  reason: Joi.string().valid(
    'duplicate', 'fraudulent', 'requested_by_customer',
    'work_not_completed', 'other'
  ).required(),
  description: Joi.string().max(500).optional()
});

router.post('/:paymentId/admin-refund', verifyToken, requireAdmin, validate(adminRefundSchema), async (req, res) => {
  try {
    const { paymentId } = req.params;
    const adminUserId = req.user.id;
    const { amount, reason, description } = req.body;

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('Payment')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError) {
      logger.error('Admin refund: error fetching payment', { error: paymentError.message, paymentId });
      return res.status(500).json({ error: 'Failed to fetch payment' });
    }

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const terminalStates = ['refunded_full', 'canceled'];
    if (terminalStates.includes(payment.payment_status)) {
      return res.status(400).json({ error: `Payment is in terminal state (${payment.payment_status}) and cannot be refunded` });
    }

    const refundAmount = amount || payment.amount_total;

    logger.info('Admin refund initiated', {
      adminUserId,
      paymentId,
      amount: refundAmount,
      reason,
      description: description || null,
      currentStatus: payment.payment_status,
    });

    const result = await stripeService.createSmartRefund(
      paymentId,
      refundAmount,
      reason,
      adminUserId
    );

    res.status(201).json({
      message: 'Admin refund created successfully',
      refund: result.refund,
    });

  } catch (err) {
    logger.error('Admin refund error', { error: err.message, paymentId: req.params.paymentId });
    res.status(500).json({
      error: 'Failed to create admin refund',
      message: err.message,
    });
  }
});

// ============ PAYMENT METHOD ROUTES ============

/**
 * GET /api/payments/methods
 * Get user's payment methods
 */
router.get('/methods', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data: methods, error } = await supabaseAdmin
      .from('PaymentMethod')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Error fetching payment methods', { error: error.message, userId });
      return res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
    
    res.json({ paymentMethods: methods || [] });
    
  } catch (err) {
    logger.error('Payment methods fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * POST /api/payments/methods
 * Attach payment method to customer
 */
router.post('/methods', verifyToken, validate(attachPaymentMethodSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { paymentMethodId } = req.body;
    
    const result = await stripeService.attachPaymentMethod(userId, paymentMethodId);
    
    res.status(201).json({
      message: 'Payment method added successfully',
      paymentMethod: result.paymentMethod
    });
    
  } catch (err) {
    logger.error('Attach payment method error', { error: err.message });
    res.status(500).json({ 
      error: 'Failed to attach payment method',
      message: err.message 
    });
  }
});

/**
 * PUT /api/payments/methods/:methodId/default
 * Set default payment method
 */
router.put('/methods/:methodId/default', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { methodId } = req.params;
    
    await stripeService.setDefaultPaymentMethod(userId, methodId);
    
    res.json({ message: 'Default payment method updated' });
    
  } catch (err) {
    logger.error('Set default payment method error', { error: err.message });
    res.status(500).json({ 
      error: 'Failed to set default payment method',
      message: err.message 
    });
  }
});

/**
 * DELETE /api/payments/methods/:methodId
 * Delete payment method
 */
router.delete('/methods/:methodId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { methodId } = req.params;
    
    await stripeService.deletePaymentMethod(userId, methodId);
    
    res.json({ message: 'Payment method deleted successfully' });
    
  } catch (err) {
    logger.error('Delete payment method error', { error: err.message });
    res.status(500).json({ 
      error: 'Failed to delete payment method',
      message: err.message 
    });
  }
});

// ============ EARNINGS & STATS ROUTES ============

/**
 * GET /api/payments/earnings
 * Get user's earnings summary
 */
router.get('/earnings', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;
    const earningsService = require('../services/earningsService');
    const raw = await earningsService.getEarningsForUser(userId, startDate || null, endDate || null);
    const earnings = {
      totalPayments: raw.total_payments,
      total_payments: raw.total_payments,
      totalEarned: raw.total_earned,
      total_earned: raw.total_earned,
      totalPaid: raw.total_paid,
      total_paid: raw.total_paid,
      totalEscrowed: raw.total_escrowed,
      total_escrowed: raw.total_escrowed,
      totalAvailable: raw.total_available,
      total_available: raw.total_available,
      currency: raw.currency,
    };
    res.json({ earnings, ...earnings });
    
  } catch (err) {
    logger.error('Earnings fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

/**
 * GET /api/payments/spending
 * Get user's spending summary
 */
router.get('/spending', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;
    const rpcArgs = {
      p_user_id: userId,
      p_start_date: toIsoOrNull(startDate),
      p_end_date: toIsoOrNull(endDate),
    };
    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('get_user_spending', rpcArgs);
    if (!rpcErr && rpcData && typeof rpcData === 'object') {
      const spending = normalizeSpending(rpcData);
      return res.json({ spending, ...spending, source: 'rpc' });
    }

    if (rpcErr) {
      logger.warn('Spending RPC failed; falling back to JS aggregate', {
        userId,
        error: rpcErr.message,
      });
    } else {
      logger.warn('Spending RPC returned empty payload; falling back to JS aggregate', { userId });
    }

    const spending = await aggregateSpending(userId, startDate || null, endDate || null);
    return res.json({ spending, ...spending, source: 'aggregate' });
    
  } catch (err) {
    logger.error('Spending fetch error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch spending' });
  }
});

// ============ TIP ROUTE ============

const tipSchema = Joi.object({
  gigId: Joi.string().uuid().required(),
  amount: Joi.number().integer().min(50).required(), // Min $0.50
  paymentMethodId: Joi.string().optional(), // Optional: use saved card for off-session
});

/**
 * POST /api/payments/tip
 * Create a tip payment for a completed gig.
 * Tips are auto-captured (not escrowed) and transferred after cooling-off.
 *
 * Flow:
 *   - On-session (no paymentMethodId): returns clientSecret for frontend confirmation
 *   - Off-session (with paymentMethodId): auto-confirms, handles SCA gracefully
 */
router.post('/tip', verifyToken, validate(tipSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { gigId, amount, paymentMethodId } = req.body;

    // Validate gig exists, is completed, and user is the poster
    const { data: gig, error: gigError } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, accepted_by, status, title, owner_confirmed_at')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }

    // Only the gig poster can tip
    if (gig.user_id !== userId) {
      return res.status(403).json({ error: 'Only the gig poster can send a tip' });
    }

    // Gig must be completed and confirmed
    if (gig.status !== 'completed') {
      return res.status(400).json({ error: 'Gig must be completed before tipping' });
    }
    if (!gig.owner_confirmed_at) {
      return res.status(400).json({ error: 'Gig must be confirmed before tipping' });
    }

    // Worker must exist
    if (!gig.accepted_by) {
      return res.status(400).json({ error: 'No worker assigned to tip' });
    }

    // Check for duplicate tips (limit 3 per gig to prevent abuse).
    // Only count tips that actually succeeded; abandoned on-session attempts
    // should not burn one of the limited tip slots.
    const { data: existingTips } = await supabaseAdmin
      .from('Payment')
      .select('id')
      .eq('gig_id', gigId)
      .eq('payer_id', userId)
      .eq('payment_type', 'tip')
      .not('payment_succeeded_at', 'is', null);

    if (existingTips && existingTips.length >= 3) {
      return res.status(400).json({ error: 'Maximum 3 tips per gig reached' });
    }

    // Create the tip payment via StripeService
    const result = await stripeService.createTipPayment({
      payerId: userId,
      payeeId: gig.accepted_by,
      gigId,
      amount,
      paymentMethodId: paymentMethodId || undefined,
      offSession: Boolean(paymentMethodId),
    });

    logger.info('Tip payment created', {
      gigId,
      payerId: userId,
      payeeId: gig.accepted_by,
      amount,
      paymentId: result.paymentId,
    });

    res.json({
      success: true,
      clientSecret: result.clientSecret || null,
      paymentId: result.paymentId,
      paymentIntentId: result.paymentIntentId || null,
      // Mobile PaymentSheet needs these to show saved cards / accept a new one.
      // Web ignores them.
      customer: result.customer || null,
      ephemeralKey: result.ephemeralKey || null,
      publishableKey: result.publishableKey || null,
    });
  } catch (err) {
    logger.error('Tip payment error', { error: err.message });

    // Handle SCA failure gracefully for off-session attempts
    if (err.type === 'StripeCardError' && err.code === 'authentication_required') {
      return res.status(402).json({
        error: 'Card requires authentication',
        code: 'authentication_required',
        message: 'Your card requires additional verification. Try again without a saved card.',
      });
    }

    res.status(500).json({ error: err.message || 'Failed to create tip' });
  }
});

/**
 * POST /api/payments/tip/:paymentId/refresh-status
 * Best-effort status sync for tip payments after client-side confirmation.
 * Useful when mobile PaymentSheet succeeds before local webhook delivery.
 */
router.post('/tip/:paymentId/refresh-status', verifyToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const { data: payment, error: paymentErr } = await supabaseAdmin
      .from('Payment')
      .select('id, payer_id, payee_id, payment_type, payment_status')
      .eq('id', paymentId)
      .single();

    if (paymentErr) {
      logger.error('Tip payment refresh fetch error', { error: paymentErr.message, paymentId, userId });
      return res.status(500).json({ error: 'Failed to fetch payment' });
    }

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.payment_type !== 'tip') {
      return res.status(400).json({ error: 'Only tip payments can be refreshed here' });
    }

    if (payment.payer_id !== userId && payment.payee_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to refresh this payment' });
    }

    const beforeStatus = payment.payment_status;
    const reconciled = await stripeService.syncTipPaymentStatus(payment.id);
    const afterStatus = reconciled?.payment_status || beforeStatus;

    return res.json({
      paymentStatus: afterStatus,
      previousPaymentStatus: beforeStatus,
      changed: beforeStatus !== afterStatus,
      stripeStatus: reconciled?.stripe_status || null,
    });
  } catch (err) {
    logger.error('Tip payment refresh error', {
      error: err.message,
      paymentId: req.params.paymentId,
      userId: req.user?.id,
    });
    res.status(500).json({ error: 'Failed to refresh tip payment status' });
  }
});

// ============ WILDCARD ROUTE (must be LAST) ============

/**
 * GET /api/payments/:paymentId
 * Get payment details.
 * IMPORTANT: This must remain the LAST GET route to avoid
 * catching named routes like /connect/account, /methods, etc.
 */
router.get('/:paymentId', verifyToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const { data: payment, error } = await supabaseAdmin
      .from('Payment')
      .select(`
        *,
        payer:payer_id(id, username, name, profile_picture_url),
        payee:payee_id(id, username, name, profile_picture_url),
        gig:gig_id(id, title, category)
      `)
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify user is involved in payment
    if (payment.payer_id !== userId && payment.payee_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ payment });

  } catch (err) {
    logger.error('Get payment error', { error: err.message });
    res.status(500).json({ error: 'Failed to get payment' });
  }
});

// ============ MOBILE PAYMENT SHEET ============

/**
 * POST /api/payments/payment-sheet-params
 * Returns params needed for Stripe mobile PaymentSheet.
 * Body: { gigId }
 */
router.post('/payment-sheet-params', verifyToken, async (req, res) => {
  try {
    const { gigId } = req.body;
    if (!gigId) {
      return res.status(400).json({ error: 'gigId is required' });
    }

    const params = await stripeService.getPaymentSheetParams(gigId, req.user.id);
    res.json(params);
  } catch (err) {
    logger.error('Payment sheet params error', { error: err.message, gigId: req.body?.gigId });
    res.status(500).json({ error: sanitizeStripeErrorMessage(err, 'Failed to prepare payment sheet') });
  }
});

/**
 * POST /api/payments/payment-sheet-add-card
 * Returns params needed for Stripe mobile PaymentSheet (setup mode) to add a card.
 */
router.post('/payment-sheet-add-card', verifyToken, async (req, res) => {
  try {
    const params = await stripeService.getAddCardSheetParams(req.user.id);
    res.json(params);
  } catch (err) {
    logger.error('Payment sheet add-card params error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: sanitizeStripeErrorMessage(err, 'Failed to prepare add-card flow') });
  }
});

module.exports = router;
