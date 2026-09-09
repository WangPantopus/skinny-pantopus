// TEST: Saved payment method service behavior
// Verifies default-card bookkeeping stays consistent when the current default
// is removed.

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const supabaseAdmin = require('./__mocks__/supabaseAdmin');

const mockDetach = jest.fn();
const mockAttach = jest.fn();
const mockCustomerUpdate = jest.fn();
const mockPaymentIntentCreate = jest.fn();

jest.mock('stripe', () => ({
  paymentMethods: { detach: mockDetach, attach: mockAttach },
  customers: { update: mockCustomerUpdate },
  paymentIntents: { create: mockPaymentIntentCreate },
}));

const stripeService = require('../stripe/stripeService');

beforeEach(() => {
  jest.restoreAllMocks();
  resetTables();
  jest.clearAllMocks();
  mockDetach.mockResolvedValue({ id: 'pm_stripe_default' });
  mockCustomerUpdate.mockResolvedValue({ id: 'cus_1' });
  mockPaymentIntentCreate.mockResolvedValue({});
});

describe('attachPaymentMethod', () => {
  const method = (overrides = {}) => ({
    id: 'saved-card', user_id: 'user-1', stripe_customer_id: 'cus_1',
    stripe_payment_method_id: 'pm_card', is_default: true, ...overrides,
  });

  beforeEach(() => {
    jest.spyOn(stripeService, 'getOrCreateCustomer').mockResolvedValue('cus_1');
    mockAttach.mockResolvedValue({
      id: 'pm_card', customer: 'cus_1', type: 'card',
      card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030, funding: 'credit' },
    });
  });

  function interceptInsert(work) {
    const from = supabaseAdmin.from.bind(supabaseAdmin);
    jest.spyOn(supabaseAdmin, 'from').mockImplementation((table) => {
      const builder = from(table);
      if (table === 'PaymentMethod') {
        builder.insert = () => ({ select: () => ({ single: work }) });
      }
      return builder;
    });
  }

  test('repeating a saved card returns its original row without attaching again', async () => {
    const first = await stripeService.attachPaymentMethod('user-1', 'pm_card');
    const retry = await stripeService.attachPaymentMethod('user-1', 'pm_card');
    expect(first.paymentMethod.id).toBeTruthy();
    expect(retry).toEqual(first);
    expect(getTable('PaymentMethod')).toHaveLength(1);
    expect(mockAttach).toHaveBeenCalledTimes(1);
  });

  test('retrying a nondefault card preserves the chosen default', async () => {
    seedTable('PaymentMethod', [method({ is_default: false }), method({ id: 'other', stripe_payment_method_id: 'pm_other' })]);
    const retry = await stripeService.attachPaymentMethod('user-1', 'pm_card');
    expect(retry.paymentMethod.is_default).toBe(false);
    expect(mockAttach).not.toHaveBeenCalled();
    expect(mockCustomerUpdate).not.toHaveBeenCalled();
  });

  test('retries the provider default update after the database row was saved', async () => {
    mockCustomerUpdate.mockRejectedValueOnce(new Error('Provider unavailable'));
    await expect(stripeService.attachPaymentMethod('user-1', 'pm_card')).rejects.toThrow('Provider unavailable');
    expect(getTable('PaymentMethod')).toHaveLength(1);
    const retry = await stripeService.attachPaymentMethod('user-1', 'pm_card');
    expect(retry.paymentMethod.id).toBe(getTable('PaymentMethod')[0].id);
    expect(mockAttach).toHaveBeenCalledTimes(1);
    expect(mockCustomerUpdate).toHaveBeenCalledTimes(2);
  });

  test('database insertion failure returns an error and can be retried later', async () => {
    interceptInsert(async () => ({ data: null, error: { code: '08006', message: 'connection lost' } }));
    await expect(stripeService.attachPaymentMethod('user-1', 'pm_card')).rejects.toThrow('Could not save payment method');
    expect(mockCustomerUpdate).not.toHaveBeenCalled();
    expect(mockDetach).not.toHaveBeenCalled();
    expect(getTable('PaymentMethod')).toHaveLength(0);
    supabaseAdmin.from.mockRestore();
    const retry = await stripeService.attachPaymentMethod('user-1', 'pm_card');
    expect(retry.paymentMethod.id).toBeTruthy();
    expect(getTable('PaymentMethod')).toHaveLength(1);
  });

  test('a competing insert returns the same owned durable card', async () => {
    interceptInsert(async () => {
      seedTable('PaymentMethod', [method()]);
      return { data: null, error: { code: '23505' } };
    });
    const result = await stripeService.attachPaymentMethod('user-1', 'pm_card');
    expect(result.paymentMethod).toEqual(method());
    expect(getTable('PaymentMethod')).toHaveLength(1);
  });

  test('a competing insert owned by another user cannot satisfy the request', async () => {
    interceptInsert(async () => {
      seedTable('PaymentMethod', [method({ user_id: 'other-user' })]);
      return { data: null, error: { code: '23505' } };
    });
    await expect(stripeService.attachPaymentMethod('user-1', 'pm_card')).rejects.toThrow('Could not save payment method');
    expect(mockCustomerUpdate).not.toHaveBeenCalled();
  });

  test('a saved card from a different customer fails closed', async () => {
    seedTable('PaymentMethod', [method({ stripe_customer_id: 'cus_other' })]);
    await expect(stripeService.attachPaymentMethod('user-1', 'pm_card')).rejects.toThrow('Could not confirm saved payment method');
    expect(mockAttach).not.toHaveBeenCalled();
    expect(mockCustomerUpdate).not.toHaveBeenCalled();
  });

  test('a failed initial read does not attach or change the provider default', async () => {
    jest.spyOn(supabaseAdmin, 'from').mockReturnValueOnce({
      select: () => ({ eq: async () => ({ data: null, error: { code: '08006' } }) }),
    });
    await expect(stripeService.attachPaymentMethod('user-1', 'pm_card')).rejects.toThrow('Could not load saved payment methods');
    expect(mockAttach).not.toHaveBeenCalled();
    expect(mockCustomerUpdate).not.toHaveBeenCalled();
  });

  test('an empty insert result is not reported as a saved card', async () => {
    interceptInsert(async () => ({ data: null, error: null }));
    await expect(stripeService.attachPaymentMethod('user-1', 'pm_card')).rejects.toThrow('Could not confirm saved payment method');
    expect(mockCustomerUpdate).not.toHaveBeenCalled();
  });
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
