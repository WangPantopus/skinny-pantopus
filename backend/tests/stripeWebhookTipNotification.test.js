const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');
const { createNotification } = require('../services/notificationService');

const mockConstructEvent = jest.fn();

jest.mock('stripe', () => ({
  webhooks: {
    constructEvent: mockConstructEvent,
  },
}));

describe('Stripe webhook tip notifications', () => {
  let app;

  beforeAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    app = express();
    app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), require('../stripe/stripeWebhooks'));
  });

  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
  });

  test('payment_intent.succeeded notifies the worker only after a tip actually succeeds', async () => {
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
      amount_to_payee: 750,
      payment_status: PAYMENT_STATES.AUTHORIZE_PENDING,
      payment_type: 'tip',
      tip_amount: 750,
      stripe_payment_intent_id: 'pi_tip_001',
      metadata: {},
    }]);

    mockConstructEvent.mockReturnValue({
      id: 'evt_tip_paid_001',
      type: 'payment_intent.succeeded',
      api_version: '2024-06-20',
      data: {
        object: {
          id: 'pi_tip_001',
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
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith({
      userId: 'worker-001',
      type: 'tip_received',
      title: 'You received a tip!',
      body: 'The poster of "Test Gig" sent you a $7.50 tip. 🎉',
      icon: '💰',
      link: '/gigs/gig-tip-001',
      metadata: {
        gig_id: 'gig-tip-001',
        amount: 750,
        payment_id: 'pay-tip-001',
      },
    });

    const payment = getTable('Payment').find((row) => row.id === 'pay-tip-001');
    expect(payment.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);
    expect(payment.payment_succeeded_at).toBeTruthy();
    expect(payment.metadata.tip_notification_sent_at).toBeTruthy();

    const secondRes = await request(app)
      .post('/api/webhooks/stripe')
      .set('stripe-signature', 'sig_test')
      .set('content-type', 'application/json')
      .send('{}');

    expect(secondRes.status).toBe(200);
    expect(createNotification).toHaveBeenCalledTimes(1);
  });
});
