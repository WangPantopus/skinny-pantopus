// ============================================================
// TEST: Checkout PaymentSheet params (Block 3B)
// POST /api/payments/intent must return the full set of params the
// mobile PaymentSheet needs (clientSecret + customer + ephemeralKey +
// publishableKey), and must derive payee + amount from server-side gig /
// listing-offer records instead of trusting client-provided price data.
// ============================================================

const express = require('express');
const request = require('supertest');

jest.mock('../config/supabaseAdmin', () => jest.requireActual('./__mocks__/supabaseAdmin'));
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

jest.mock('../stripe/stripeService', () => ({
  createPaymentIntentForGig: jest.fn(),
  getPaymentIntentClientSecret: jest.fn(),
  getOrCreateCustomer: jest.fn(),
  createEphemeralKey: jest.fn(),
}));
const stripeService = require('../stripe/stripeService');

jest.mock('../middleware/verifyToken', () => {
  const mw = (req, _res, next) => {
    req.user = { id: req.headers['x-test-user-id'] || PAYER_ID, role: 'user' };
    next();
  };
  mw.requireAdmin = (_req, _res, next) => next();
  mw.invalidateRoleCache = () => {};
  return mw;
});

const paysRoutes = require('../routes/pays');

const PAYER_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const SELLER_ID = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const WORKER_ID = 'eeeeeeee-eeee-1eee-8eee-eeeeeeeeeeee';
const GIG_ID = 'ffffffff-ffff-1fff-8fff-ffffffffffff';
const BID_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc';
const OFFER_ID = 'dddddddd-dddd-1ddd-8ddd-dddddddddddd';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paysRoutes);
  return app;
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_block3b';
  stripeService.createPaymentIntentForGig.mockResolvedValue({
    clientSecret: 'pi_secret_123',
    paymentIntentId: 'pi_123',
    paymentId: 'pay-1',
    payment: { id: 'pay-1', payment_status: 'authorize_pending' },
  });
  stripeService.getPaymentIntentClientSecret.mockResolvedValue('pi_existing_secret');
  stripeService.getOrCreateCustomer.mockResolvedValue('cus_123');
  stripeService.createEphemeralKey.mockResolvedValue({ secret: 'ek_secret_123' });
});

function seedAcceptedListingOffer(overrides = {}) {
  seedTable('Listing', [{
    id: LISTING_ID,
    user_id: SELLER_ID,
    title: 'Patio chair',
    status: 'reserved',
    ...overrides.listing,
  }]);
  seedTable('ListingOffer', [{
    id: OFFER_ID,
    listing_id: LISTING_ID,
    buyer_id: PAYER_ID,
    seller_id: SELLER_ID,
    amount: 75,
    status: 'accepted',
    ...overrides.offer,
  }]);
}

describe('POST /api/payments/intent — PaymentSheet params', () => {
  test('returns clientSecret + customer + ephemeralKey + publishableKey for a listing offer', async () => {
    seedAcceptedListingOffer();

    const res = await request(buildApp())
      .post('/api/payments/intent')
      .send({ listingId: LISTING_ID, offerId: OFFER_ID });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      clientSecret: 'pi_secret_123',
      paymentIntentId: 'pi_123',
      customer: 'cus_123',
      ephemeralKey: 'ek_secret_123',
      publishableKey: 'pk_test_block3b',
    });
    expect(stripeService.getOrCreateCustomer).toHaveBeenCalledWith(PAYER_ID);
    expect(stripeService.createEphemeralKey).toHaveBeenCalledWith('cus_123');
  });

  test('derives listing-offer payee and amount from the database', async () => {
    seedAcceptedListingOffer();

    const res = await request(buildApp())
      .post('/api/payments/intent')
      .send({ listingId: LISTING_ID, offerId: OFFER_ID, metadata: { listing_id: 'spoofed' } });

    expect(res.status).toBe(201);
    const args = stripeService.createPaymentIntentForGig.mock.calls[0][0];
    expect(args.payerId).toBe(PAYER_ID);
    expect(args.payeeId).toBe(SELLER_ID);
    expect(args.amount).toBe(7500);
    expect(args.gigId).toBeNull();
    expect(args.description).toBe('Pantopus listing: Patio chair');
    expect(args.idempotencyKey).toBe(`payment-intent:listing-offer:${LISTING_ID}:${OFFER_ID}:${PAYER_ID}:7500`);
    expect(args.metadata).toEqual({
      type: 'listing_offer_checkout',
      listing_id: LISTING_ID,
      offer_id: OFFER_ID,
    });
  });

  test('derives gig payee and amount from the database', async () => {
    seedTable('Gig', [{
      id: GIG_ID,
      user_id: PAYER_ID,
      accepted_by: WORKER_ID,
      title: 'Hang lights',
      status: 'assigned',
      price: 80.5,
      origin_home_id: 'home-1',
      payment_id: null,
      payment_status: 'none',
    }]);
    seedTable('GigBid', [{
      id: BID_ID,
      gig_id: GIG_ID,
      user_id: WORKER_ID,
      status: 'accepted',
      bid_amount: 92.75,
    }]);

    const res = await request(buildApp())
      .post('/api/payments/intent')
      .send({ gigId: GIG_ID });

    expect(res.status).toBe(201);
    const args = stripeService.createPaymentIntentForGig.mock.calls[0][0];
    expect(args.payerId).toBe(PAYER_ID);
    expect(args.payeeId).toBe(WORKER_ID);
    expect(args.amount).toBe(9275);
    expect(args.gigId).toBe(GIG_ID);
    expect(args.homeId).toBe('home-1');
    expect(args.description).toBe('Pantopus gig: Hang lights');
    expect(args.idempotencyKey).toBe(`payment-intent:gig:${GIG_ID}:${PAYER_ID}:9275`);
    expect(args.metadata).toEqual({
      type: 'gig_checkout',
      gig_id: GIG_ID,
      bid_id: BID_ID,
    });
    expect(getTable('Gig').find((gig) => gig.id === GIG_ID)).toMatchObject({
      payment_id: 'pay-1',
      payment_status: 'authorize_pending',
    });
  });

  test('rejects raw client payee and amount without an order reference', async () => {
    const res = await request(buildApp())
      .post('/api/payments/intent')
      .send({ payeeId: SELLER_ID, amount: 7500 });

    expect(res.status).toBe(400);
    expect(stripeService.createPaymentIntentForGig).not.toHaveBeenCalled();
  });

  test('still succeeds (card-only) when ephemeral-key minting fails', async () => {
    seedAcceptedListingOffer();
    stripeService.createEphemeralKey.mockRejectedValueOnce(new Error('stripe down'));

    const res = await request(buildApp())
      .post('/api/payments/intent')
      .send({ listingId: LISTING_ID, offerId: OFFER_ID });

    expect(res.status).toBe(201);
    expect(res.body.clientSecret).toBe('pi_secret_123');
    expect(res.body.ephemeralKey).toBeNull();
  });

  test('reuses an existing active listing-offer PaymentIntent', async () => {
    seedAcceptedListingOffer();
    seedTable('Payment', [{
      id: 'pay-existing',
      payer_id: PAYER_ID,
      payee_id: SELLER_ID,
      gig_id: null,
      amount_total: 7500,
      payment_status: 'authorize_pending',
      payment_type: 'gig_payment',
      stripe_payment_intent_id: 'pi_existing',
      metadata: {
        type: 'listing_offer_checkout',
        listing_id: LISTING_ID,
        offer_id: OFFER_ID,
      },
    }]);

    const res = await request(buildApp())
      .post('/api/payments/intent')
      .send({ listingId: LISTING_ID, offerId: OFFER_ID });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      clientSecret: 'pi_existing_secret',
      paymentIntentId: 'pi_existing',
      paymentId: 'pay-existing',
      reused: true,
    });
    expect(stripeService.getPaymentIntentClientSecret).toHaveBeenCalledWith('pi_existing');
    expect(stripeService.createPaymentIntentForGig).not.toHaveBeenCalled();
  });

  test('rejects an existing active checkout payment with mismatched order terms', async () => {
    seedAcceptedListingOffer();
    seedTable('Payment', [{
      id: 'pay-existing',
      payer_id: PAYER_ID,
      payee_id: SELLER_ID,
      gig_id: null,
      amount_total: 5000,
      payment_status: 'authorize_pending',
      payment_type: 'gig_payment',
      stripe_payment_intent_id: 'pi_existing',
      metadata: {
        type: 'listing_offer_checkout',
        listing_id: LISTING_ID,
        offer_id: OFFER_ID,
      },
    }]);

    const res = await request(buildApp())
      .post('/api/payments/intent')
      .send({ listingId: LISTING_ID, offerId: OFFER_ID });

    expect(res.status).toBe(409);
    expect(stripeService.createPaymentIntentForGig).not.toHaveBeenCalled();
  });
});
