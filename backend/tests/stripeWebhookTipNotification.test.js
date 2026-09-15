const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');
const { createNotification } = require('../services/notificationService');

const mockConstructEvent = jest.fn();

jest.mock('stripe', () => ({
  ...jest.requireActual('./__mocks__/stripe'),
  webhooks: {
    constructEvent: mockConstructEvent,
  },
}));
const stripe = require('stripe');

describe('Stripe webhook tip notifications', () => {
  let app;
  let originalKey;

  beforeAll(() => {
    originalKey = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test_tip_proof_fixture';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    app = express();
    app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), require('../stripe/stripeWebhooks'));
  });
  afterAll(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
  });

  test('payment_intent.succeeded records capture without a competing best-effort notice', async () => {
    seedTable('Gig', [{
      id: 'gig-tip-001',
      title: 'Test Gig',
      user_id: 'payer-001',
      accepted_by: 'worker-001',
      payment_status: PAYMENT_STATES.AUTHORIZE_PENDING,
    }]);

    seedTable('Payment', [{
      id: 'pay-tip-001',
      gig_id: 'gig-tip-001',
      payer_id: 'payer-001',
      payee_id: 'worker-001',
      amount_total: 750,
      amount_subtotal: 750,
      amount_platform_fee: 0,
      amount_processing_fee: 51,
      amount_to_payee: 750,
      currency: 'usd',
      payment_status: PAYMENT_STATES.AUTHORIZE_PENDING,
      payment_type: 'tip',
      tip_amount: 750,
      stripe_payment_intent_id: 'pi_tip001',
      stripe_customer_id: 'cus_tip001',
      metadata: {},
    }]);

    stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_tip001', customer: 'cus_tip001', livemode: false, amount: 750, currency: 'usd',
      status: 'succeeded', capture_method: 'automatic', confirmation_method: 'automatic', amount_capturable: 0,
      amount_received: 750, latest_charge: 'ch_tip001', transfer_data: null, on_behalf_of: null,
      application_fee_amount: null, payment_method: 'pm_tip001', metadata: { payer_id: 'payer-001',
        payee_id: 'worker-001', gig_id: 'gig-tip-001', payment_type: 'tip', platform_fee: '0' },
    });
    stripe.charges.retrieve.mockResolvedValue({
      id: 'ch_tip001', payment_intent: 'pi_tip001', customer: 'cus_tip001', livemode: false,
      amount: 750, currency: 'usd', paid: true, captured: true, amount_captured: 750, amount_refunded: 0,
      refunded: false, disputed: false, dispute: null, created: 1710000000, on_behalf_of: null,
      transfer: null, destination: null, application_fee: null, application_fee_amount: null,
    });
    mockConstructEvent.mockReturnValue({
      id: 'evt_tip_paid_001',
      type: 'payment_intent.succeeded',
      api_version: '2024-06-20',
      data: {
        object: {
          id: 'pi_tip001',
          amount: 750,
          status: 'succeeded',
          capture_method: 'automatic',
          latest_charge: 'ch_tip_001',
          charges: {
            data: [{
              id: 'ch_tip_001',
              created: 1710000000,
              payment_method_details: {
                type: 'card',
                card: { brand: 'visa', last4: '4242' },
              },
            }],
          },
        },
      },
    });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 'sig_test')
      .set('content-type', 'application/json')
      .send('{}');

    expect(res.status).toBe(200);
    // The real SQL capture transaction, tested by the SQL contract, owns the
    // notice. A webhook callback must not insert/send another notification.
    expect(createNotification).not.toHaveBeenCalled();

    const payment = getTable('Payment').find((row) => row.id === 'pay-tip-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);
    expect(payment.payment_succeeded_at).toBeTruthy();

    const secondRes = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 'sig_test')
      .set('content-type', 'application/json')
      .send('{}');

    expect(secondRes.status).toBe(200);
    expect(createNotification).not.toHaveBeenCalled();
  });
});
