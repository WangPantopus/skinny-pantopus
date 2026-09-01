const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

jest.mock('stripe', () => jest.requireActual('./__mocks__/stripe'));

const stripe = require('stripe');
const { createNotification } = require('../services/notificationService');
const stripeService = require('../stripe/stripeService');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');

describe('stripeService.createTipPayment', () => {
  beforeEach(() => {
    resetTables();
    jest.clearAllMocks();
    stripe._resetAll();
  });

  test('credits the worker with the full tip amount and reconciles immediate success', async () => {
    seedTable('User', [{
      id: 'payer-1',
      email: 'payer@example.com',
      name: 'Payer',
      username: 'payer',
      stripe_customer_id: 'cus_existing_123',
    }]);
    seedTable('StripeAccount', [{
      id: 'acct-row-1',
      user_id: 'payee-1',
      stripe_account_id: 'acct_payee_123',
      charges_enabled: true,
      payouts_enabled: true,
    }]);
    seedTable('Gig', [{
      id: 'gig-tip-1',
      title: 'Babysitter needed',
    }]);
    seedTable('Payment', []);

    stripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_tip_123',
      client_secret: 'pi_tip_123_secret',
      status: 'succeeded',
      latest_charge: 'ch_tip_123',
      payment_method: 'pm_saved_123',
      created: 1710000000,
    });

    const result = await stripeService.createTipPayment({
      payerId: 'payer-1',
      payeeId: 'payee-1',
      gigId: 'gig-tip-1',
      amount: 500,
      paymentMethodId: 'pm_saved_123',
      offSession: true,
    });

    expect(result.success).toBe(true);

    const payment = getTable('Payment').find((row) => row.id === result.paymentId);
    expect(payment).toBeTruthy();
    expect(payment.amount_total).toBe(500);
    expect(payment.amount_platform_fee).toBe(0);
    expect(payment.amount_processing_fee).toBe(44);
    expect(payment.amount_to_payee).toBe(500);
    expect(payment.payment_status).toBe(PAYMENT_STATES.CAPTURED_HOLD);
    expect(payment.payment_succeeded_at).toBeTruthy();
    expect(payment.stripe_charge_id).toBe('ch_tip_123');
    expect(payment.metadata.tip_notification_sent_at).toBeTruthy();

    expect(createNotification).toHaveBeenCalledWith({
      userId: 'payee-1',
      type: 'tip_received',
      title: 'You received a tip!',
      body: 'The poster of "Babysitter needed" sent you a $5.00 tip. 🎉',
      icon: '💰',
      link: '/gigs/gig-tip-1',
      metadata: {
        gig_id: 'gig-tip-1',
        amount: 500,
        payment_id: result.paymentId,
      },
    });
  });
});
