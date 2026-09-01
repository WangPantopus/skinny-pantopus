// TEST: Saved payment method service behavior
// Verifies default-card bookkeeping stays consistent when the current default
// is removed.

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

const mockDetach = jest.fn();
const mockCustomerUpdate = jest.fn();
const mockPaymentIntentCreate = jest.fn();

jest.mock('stripe', () => ({
  paymentMethods: { detach: mockDetach },
  customers: { update: mockCustomerUpdate },
  paymentIntents: { create: mockPaymentIntentCreate },
}));

const stripeService = require('../stripe/stripeService');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  mockDetach.mockResolvedValue({ id: 'pm_stripe_default' });
  mockCustomerUpdate.mockResolvedValue({ id: 'cus_1' });
  mockPaymentIntentCreate.mockResolvedValue({});
});

describe('deletePaymentMethod', () => {
  test('promotes another saved method when deleting the default', async () => {
    seedTable('PaymentMethod', [
      {
        id: 'pm-default',
        user_id: 'user-1',
        stripe_customer_id: 'cus_1',
        stripe_payment_method_id: 'pm_stripe_default',
        is_default: true,
        created_at: '2026-06-01T00:00:00Z',
      },
      {
        id: 'pm-next',
        user_id: 'user-1',
        stripe_customer_id: 'cus_1',
        stripe_payment_method_id: 'pm_stripe_next',
        is_default: false,
        created_at: '2026-06-02T00:00:00Z',
      },
    ]);

    await stripeService.deletePaymentMethod('user-1', 'pm-default');

    const rows = getTable('PaymentMethod');
    expect(rows.find((row) => row.id === 'pm-default')).toBeUndefined();
    expect(rows.find((row) => row.id === 'pm-next')?.is_default).toBe(true);
    expect(mockDetach).toHaveBeenCalledWith('pm_stripe_default');
    expect(mockCustomerUpdate).toHaveBeenCalledWith('cus_1', {
      invoice_settings: { default_payment_method: 'pm_stripe_next' },
    });
  });

  test('clears Stripe customer default when deleting the only saved method', async () => {
    seedTable('PaymentMethod', [
      {
        id: 'pm-default',
        user_id: 'user-1',
        stripe_customer_id: 'cus_1',
        stripe_payment_method_id: 'pm_stripe_default',
        is_default: true,
        created_at: '2026-06-01T00:00:00Z',
      },
    ]);

    await stripeService.deletePaymentMethod('user-1', 'pm-default');

    expect(getTable('PaymentMethod')).toEqual([]);
    expect(mockCustomerUpdate).toHaveBeenCalledWith('cus_1', {
      invoice_settings: { default_payment_method: null },
    });
  });

  test('promotes local fallback without Stripe update when customer id is missing', async () => {
    seedTable('PaymentMethod', [
      {
        id: 'pm-default',
        user_id: 'user-1',
        stripe_customer_id: null,
        stripe_payment_method_id: 'pm_stripe_default',
        is_default: true,
        created_at: '2026-06-01T00:00:00Z',
      },
      {
        id: 'pm-next',
        user_id: 'user-1',
        stripe_customer_id: null,
        stripe_payment_method_id: 'pm_stripe_next',
        is_default: false,
        created_at: '2026-06-02T00:00:00Z',
      },
    ]);

    await stripeService.deletePaymentMethod('user-1', 'pm-default');

    const rows = getTable('PaymentMethod');
    expect(rows.find((row) => row.id === 'pm-default')).toBeUndefined();
    expect(rows.find((row) => row.id === 'pm-next')?.is_default).toBe(true);
    expect(mockCustomerUpdate).not.toHaveBeenCalled();
  });
});
