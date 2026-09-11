const db = require('./__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = db;
const mockDetach = jest.fn(), mockAttach = jest.fn(), mockRetrieve = jest.fn();
const mockCustomerUpdate = jest.fn(), mockRetrieveIntent = jest.fn();
const mockCustomerCreate = jest.fn();
jest.mock('stripe', () => ({
  paymentMethods: { detach: mockDetach, attach: mockAttach, retrieve: mockRetrieve },
  customers: { update: mockCustomerUpdate, create: mockCustomerCreate }, paymentIntents: { retrieve: mockRetrieveIntent, create: jest.fn() },
}));
const service = require('../stripe/stripeService');
const user = 'user-1';
const provider = (id = 'pm_cardA', customer = 'cus_owner') => ({
  id, customer, type: 'card', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
});
const saved = (id = 'A', isDefault = true) => ({
  id, user_id: user, stripe_customer_id: 'cus_owner', stripe_payment_method_id: `pm_card${id}`,
  payment_method_type: 'card', is_default: isDefault, created_at: `2026-06-0${id === 'A' ? 1 : 2}T00:00:00Z`,
});
function failRpc(name) {
  const rpc = db.rpc.bind(db);
  return jest.spyOn(db, 'rpc').mockImplementation((called, args) => called === name
    ? { data: null, error: { code: '08006' } } : rpc(called, args));
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
beforeEach(() => {
  jest.restoreAllMocks(); jest.clearAllMocks(); resetTables();
  seedTable('User', [{ id: user, stripe_customer_id: 'cus_owner' }, { id: 'foreign', stripe_customer_id: 'cus_foreign' }]);
  mockRetrieve.mockImplementation(async (id) => provider(id));
  mockAttach.mockImplementation(async (id) => provider(id));
  mockDetach.mockImplementation(async (id) => ({ id, customer: null }));
  jest.spyOn(service, 'getOrCreateCustomer').mockResolvedValue('cus_owner');
});
afterEach(() => expect(mockCustomerUpdate).not.toHaveBeenCalled());

describe('atomic app saved-card preference', () => {
  test('same attached card retry returns one durable ID without another attach', async () => {
    const first = await service.attachPaymentMethod(user, 'pm_cardA');
    expect((await service.attachPaymentMethod(user, 'pm_cardA')).paymentMethod.id).toBe(first.paymentMethod.id);
    expect(getTable('PaymentMethod')).toHaveLength(1); expect(mockAttach).not.toHaveBeenCalled();
  });
  test('DB failure after attachment retries its existing provider attachment', async () => {
    mockRetrieve.mockResolvedValueOnce(provider('pm_cardA', null));
    const failed = failRpc('save_payment_method');
    await expect(service.attachPaymentMethod(user, 'pm_cardA')).rejects.toThrow('Please retry');
    failed.mockRestore(); await service.attachPaymentMethod(user, 'pm_cardA');
    expect(mockAttach).toHaveBeenCalledTimes(1); expect(getTable('PaymentMethod')).toHaveLength(1);
  });
  test('foreign attached card cannot be claimed', async () => {
    mockRetrieve.mockResolvedValue(provider('pm_cardA', 'cus_foreign'));
    await expect(service.attachPaymentMethod(user, 'pm_cardA')).rejects.toMatchObject({ statusCode: 404 });
    expect(mockAttach).not.toHaveBeenCalled(); expect(getTable('PaymentMethod')).toHaveLength(0);
  });
  test('delayed A save preserves the later explicit choice of B', async () => {
    seedTable('PaymentMethod', [saved(), saved('B', false)]);
    const paused = deferred();
    const replay = service._savePaymentMethod(user, 'cus_owner', 'pm_cardA', () => paused.promise);
    await service.setDefaultPaymentMethod(user, 'B'); paused.resolve(provider());
    expect((await replay).paymentMethod.is_default).toBe(false);
    expect(getTable('PaymentMethod').find((m) => m.id === 'B').is_default).toBe(true);
  });
  test('failed default transaction preserves selected card and is retryable', async () => {
    seedTable('PaymentMethod', [saved(), saved('B', false)]);
    const failed = failRpc('set_default_payment_method');
    await expect(service.setDefaultPaymentMethod(user, 'B')).rejects.toThrow('Please retry');
    expect(getTable('PaymentMethod').find((m) => m.id === 'A').is_default).toBe(true);
    failed.mockRestore(); await service.setDefaultPaymentMethod(user, 'B');
    expect(getTable('PaymentMethod').find((m) => m.id === 'B').is_default).toBe(true);
  });
  test('foreign owner and customer binding cannot satisfy save/default', async () => {
    seedTable('PaymentMethod', [saved()]);
    await expect(service.setDefaultPaymentMethod('foreign', 'A')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service._savePaymentMethod('foreign', 'cus_owner', 'pm_cardA', async () => provider()))
      .rejects.toMatchObject({ statusCode: 404 });
  });
  test('empty RPC result cannot be reported as saved', async () => {
    jest.spyOn(db, 'rpc').mockResolvedValue({ data: {}, error: null });
    await expect(service.attachPaymentMethod(user, 'pm_cardA')).rejects.toThrow('Could not confirm');
  });
  test('checkout sync checks payer and current provider method before the shared save', async () => {
    seedTable('Payment', [{ id: 'payment', payer_id: user, stripe_payment_intent_id: 'pi_gig' }]);
    mockRetrieveIntent.mockResolvedValue({ customer: 'cus_owner', payment_method: 'pm_cardA' });
    await service.syncPaymentMethodToLocal('payment', 'foreign'); expect(mockRetrieveIntent).not.toHaveBeenCalled();
    await service.syncPaymentMethodToLocal('payment', user);
    expect(getTable('PaymentMethod')).toHaveLength(1); expect(mockRetrieve).toHaveBeenCalledWith('pm_cardA');
  });
});

describe('durable payment method removal', () => {
  beforeEach(() => seedTable('PaymentMethod', [saved(), saved('B', false)]));
  test('default removal promotes the remaining method and original-ID retry succeeds', async () => {
    await service.deletePaymentMethod(user, 'A');
    expect(getTable('PaymentMethod')).toMatchObject([{ id: 'B', is_default: true }]);
    expect(getTable('PaymentMethodRemoval')).toMatchObject([{ method_id: 'A', user_id: user, completed_at: expect.any(String) }]);
    expect(await service.deletePaymentMethod(user, 'A')).toEqual({ success: true });
    expect(mockDetach).toHaveBeenCalledTimes(1);
  });
  test('last card removal leaves no default', async () => {
    seedTable('PaymentMethod', [saved()]); await service.deletePaymentMethod(user, 'A');
    expect(getTable('PaymentMethod')).toHaveLength(0);
  });
  test('foreign removal cannot detach or reveal an owned completed tombstone', async () => {
    await expect(service.deletePaymentMethod('foreign', 'A')).rejects.toMatchObject({ statusCode: 404 });
    expect(mockDetach).not.toHaveBeenCalled(); await service.deletePaymentMethod(user, 'A');
    await expect(service.deletePaymentMethod('foreign', 'A')).rejects.toMatchObject({ statusCode: 404 });
  });
  test('failed admission has no provider side effect', async () => {
    failRpc('begin_payment_method_removal');
    await expect(service.deletePaymentMethod(user, 'A')).rejects.toThrow('Please retry');
    expect(mockRetrieve).not.toHaveBeenCalled(); expect(mockDetach).not.toHaveBeenCalled();
    expect(getTable('PaymentMethodRemoval')).toHaveLength(0);
  });
  test('unknown detach keeps proof and prevents save/default resurrection until retry', async () => {
    mockDetach.mockRejectedValueOnce(new Error('connection lost'));
    await expect(service.deletePaymentMethod(user, 'A')).rejects.toThrow('connection lost');
    expect(getTable('PaymentMethodRemoval')[0].completed_at).toBeNull();
    await expect(service.setDefaultPaymentMethod(user, 'A')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service._savePaymentMethod(user, 'cus_owner', 'pm_cardA', async () => provider()))
      .rejects.toMatchObject({ statusCode: 404 });
    await service.deletePaymentMethod(user, 'A'); expect(getTable('PaymentMethod').map((m) => m.id)).toEqual(['B']);
  });
  test('lost detach success is verified without a second detach', async () => {
    mockDetach.mockRejectedValueOnce(new Error('response lost'));
    mockRetrieve.mockResolvedValueOnce(provider()).mockResolvedValueOnce(provider('pm_cardA', null));
    await service.deletePaymentMethod(user, 'A');
    expect(getTable('PaymentMethod').map((m) => m.id)).toEqual(['B']); expect(mockDetach).toHaveBeenCalledTimes(1);
  });
  test('DB failure after detach retries the same ID and skips another provider detach', async () => {
    const failed = failRpc('complete_payment_method_removal');
    await expect(service.deletePaymentMethod(user, 'A')).rejects.toThrow('Please retry');
    expect(getTable('PaymentMethodRemoval')[0].completed_at).toBeNull(); failed.mockRestore();
    mockRetrieve.mockResolvedValue(provider('pm_cardA', null)); await service.deletePaymentMethod(user, 'A');
    expect(getTable('PaymentMethod').map((m) => m.id)).toEqual(['B']); expect(mockDetach).toHaveBeenCalledTimes(1);
  });
  test('provider missing method completes pending removal', async () => {
    mockRetrieve.mockRejectedValue(Object.assign(new Error('missing'), { code: 'resource_missing' }));
    await service.deletePaymentMethod(user, 'A'); expect(getTable('PaymentMethod').map((m) => m.id)).toEqual(['B']);
    expect(mockDetach).not.toHaveBeenCalled();
  });
  test('method moved to another customer is not detached', async () => {
    mockRetrieve.mockResolvedValue(provider('pm_cardA', 'cus_foreign'));
    await expect(service.deletePaymentMethod(user, 'A')).rejects.toMatchObject({ statusCode: 404 });
    expect(mockDetach).not.toHaveBeenCalled();
  });
  test('already-read provider object cannot resurrect a removed card', async () => {
    const paused = deferred();
    const pending = service._savePaymentMethod(user, 'cus_owner', 'pm_cardA', () => paused.promise);
    const rejected = expect(pending).rejects.toMatchObject({ statusCode: 404 });
    await service.deletePaymentMethod(user, 'A'); paused.resolve(provider()); await rejected;
    expect(getTable('PaymentMethod').map((m) => m.id)).toEqual(['B']);
  });
  test('verified detach before the first save fences a later attachment event', async () => {
    seedTable('PaymentMethod', []); mockRetrieve.mockResolvedValueOnce(provider('pm_cardA', null));
    await service.reconcileDetachedPaymentMethod(provider());
    expect(getTable('PaymentMethodRemoval')[0].user_id).toBeNull();
    await expect(service.reconcileAttachedPaymentMethod(provider())).resolves.toBeUndefined();
    expect(getTable('PaymentMethod')).toHaveLength(0);
  });
});

describe('durable first payment customer', () => {
  beforeEach(() => {
    service.getOrCreateCustomer.mockRestore();
    getTable('User').find((u) => u.id === user).stripe_customer_id = null;
    mockCustomerCreate.mockResolvedValue({ id: 'cus_candidate' });
  });
  test('competing initial customer candidates both return the same durable winner', async () => {
    mockCustomerCreate.mockResolvedValueOnce({ id: 'cus_first' }).mockResolvedValueOnce({ id: 'cus_second' });
    const results = await Promise.all([service.getOrCreateCustomer(user), service.getOrCreateCustomer(user)]);
    expect(results).toEqual(['cus_first', 'cus_first']);
    expect(getTable('User').find((u) => u.id === user).stripe_customer_id).toBe('cus_first');
  });
  test('failed binding cannot prepare any SDK key or SetupIntent and retry returns durable customer', async () => {
    const key = jest.spyOn(service, 'createEphemeralKey');
    const failed = failRpc('bind_payment_customer');
    await expect(service.getAddCardSheetParams(user)).rejects.toThrow('Please retry');
    expect(key).not.toHaveBeenCalled();
    expect(getTable('User').find((u) => u.id === user).stripe_customer_id).toBeNull();
    failed.mockRestore();
    expect(await service.getOrCreateCustomer(user)).toBe('cus_candidate');
    expect(getTable('User').find((u) => u.id === user).stripe_customer_id).toBe('cus_candidate');
  });
  test('legacy card backfill also uses CAS and keeps another request durable winner', async () => {
    seedTable('PaymentMethod', [saved()]);
    const rpc = db.rpc.bind(db);
    jest.spyOn(db, 'rpc').mockImplementation((name, args) => {
      if (name === 'bind_payment_customer') getTable('User').find((u) => u.id === user).stripe_customer_id = 'cus_winner';
      return rpc(name, args);
    });
    expect(await service.getOrCreateCustomer(user)).toBe('cus_winner');
    expect(mockCustomerCreate).not.toHaveBeenCalled();
  });
  test('legacy binding failure cannot claim success', async () => {
    seedTable('PaymentMethod', [saved()]); failRpc('bind_payment_customer');
    await expect(service.getOrCreateCustomer(user)).rejects.toThrow('Please retry');
    expect(mockCustomerCreate).not.toHaveBeenCalled();
    expect(getTable('User').find((u) => u.id === user).stripe_customer_id).toBeNull();
  });
  test('failed User lookup cannot be mistaken for a missing provider customer', async () => {
    jest.spyOn(db, 'from').mockReturnValueOnce({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { code: '08006' } }) }) }) });
    await expect(service.getOrCreateCustomer(user)).rejects.toThrow('Could not load payment customer');
    expect(mockCustomerCreate).not.toHaveBeenCalled();
  });
  test('failed legacy lookup cannot create a replacement customer', async () => {
    const from = db.from.bind(db);
    jest.spyOn(db, 'from').mockImplementation((table) => table === 'PaymentMethod'
      ? { select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: { code: '08006' } }) }) }) }) }
      : from(table));
    await expect(service.getOrCreateCustomer(user)).rejects.toThrow('Could not load payment customer');
    expect(mockCustomerCreate).not.toHaveBeenCalled();
  });
});
