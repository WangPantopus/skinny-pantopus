const express = require('express');
const request = require('supertest');
const supabaseAdmin = require('./__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable } = supabaseAdmin;
const mockRetrieveSetup = jest.fn();
const mockCreateSetup = jest.fn();
const mockRetrieveMethod = jest.fn();
const mockAttach = jest.fn();
const mockDetach = jest.fn();
const mockCustomerUpdate = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => ({
  setupIntents: { retrieve: mockRetrieveSetup, create: mockCreateSetup },
  paymentMethods: { retrieve: mockRetrieveMethod, attach: mockAttach, detach: mockDetach },
  customers: { update: mockCustomerUpdate },
  webhooks: { constructEvent: mockConstructEvent },
}));
jest.mock('./__mocks__/verifyToken', () => {
  const verify = (req, res, next) => {
    if (!req.headers['x-test-user-id']) return res.status(401).json({ error: 'Unauthorized' });
    req.user = { id: req.headers['x-test-user-id'] };
    next();
  };
  verify.requireAdmin = (_req, res) => res.sendStatus(403);
  return verify;
});
const service = require('../stripe/stripeService');
const owner = 'user-1';
const setupId = 'seti_owned1';
const method = () => ({
  id: 'pm_card1', customer: 'cus_owner', type: 'card',
  card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030, funding: 'credit' },
});
const setup = () => ({
  id: setupId, customer: 'cus_owner', status: 'succeeded', payment_method: 'pm_card1',
  metadata: { source: 'mobile_add_card', user_id: owner },
});
let app;
let oldWebhookSecret;
beforeAll(() => {
  oldWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  app = express();
  app.use('/webhook', express.raw({ type: 'application/json' }), require('../stripe/stripeWebhooks'));
  app.use(express.json());
  app.use('/api/payments', require('../routes/pays'));
});
afterAll(() => {
  if (oldWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = oldWebhookSecret;
});
beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  resetTables();
  seedTable('User', [{ id: owner, stripe_customer_id: 'cus_owner' }, { id: 'other', stripe_customer_id: 'cus_other' }]);
  mockRetrieveSetup.mockResolvedValue(setup());
  mockRetrieveMethod.mockResolvedValue(method());
  mockDetach.mockResolvedValue({ id: 'pm_card1', customer: null });
  mockCustomerUpdate.mockResolvedValue({ id: 'cus_owner' });
  mockCreateSetup.mockResolvedValue({ id: setupId, client_secret: 'seti_test_secret', status: 'requires_payment_method' });
  mockConstructEvent.mockReturnValue({
    id: 'evt_attach1', type: 'payment_method.attached', api_version: '2024-06-20',
    data: { object: method() },
  });
});
function confirm(id = setupId, userId = owner) {
  return request(app).post('/api/payments/payment-sheet-add-card/confirm')
    .set('x-test-user-id', userId).send({ setupIntentId: id });
}
function webhook() {
  return request(app).post('/webhook').set('stripe-signature', 'test')
    .set('content-type', 'application/json').send('{}');
}
function failMethodInsert() {
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin);
  jest.spyOn(supabaseAdmin, 'rpc').mockImplementation((name, args) => name === 'save_payment_method'
    ? { data: null, error: { code: '08006' } } : rpc(name, args));
}

describe('owned mobile SetupIntent reconciliation', () => {
  test('preparation returns a separate setup identifier for post-sheet retries', async () => {
    jest.spyOn(service, 'getOrCreateCustomer').mockResolvedValue('cus_owner');
    jest.spyOn(service, 'createEphemeralKey').mockResolvedValue({ secret: 'ek_test' });
    const response = await request(app).post('/api/payments/payment-sheet-add-card').set('x-test-user-id', owner);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ setupIntentId: setupId, setupIntent: 'seti_test_secret' });
    expect(mockCreateSetup).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_owner', metadata: { source: 'mobile_add_card', user_id: owner },
    }));
  });

  test('completed proof saves one durable card and repeating it returns the same row', async () => {
    const first = await confirm();
    const retry = await confirm();
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ confirmed: true, paymentMethod: {
      user_id: owner, stripe_customer_id: 'cus_owner', stripe_payment_method_id: 'pm_card1', card_last4: '4242',
    } });
    expect(retry.body).toEqual(first.body);
    expect(getTable('PaymentMethod')).toHaveLength(1);
    expect(mockAttach).not.toHaveBeenCalled();
    expect(mockCreateSetup).not.toHaveBeenCalled();
  });

  test('a selected different default survives both initial save and retry', async () => {
    seedTable('PaymentMethod', [{ id: 'selected', user_id: owner, stripe_customer_id: 'cus_owner', stripe_payment_method_id: 'pm_other', is_default: true }]);
    await confirm();
    await confirm();
    expect(getTable('PaymentMethod').find((m) => m.id === 'selected').is_default).toBe(true);
    expect(getTable('PaymentMethod').find((m) => m.stripe_payment_method_id === 'pm_card1').is_default).toBe(false);
    expect(mockCustomerUpdate).not.toHaveBeenCalled();
  });

  test.each([
    ['foreign customer', { customer: 'cus_other' }],
    ['foreign actor metadata', { metadata: { source: 'mobile_add_card', user_id: 'other' } }],
    ['different setup purpose', { metadata: { source: 'gig', user_id: owner } }],
    ['missing ownership metadata', { metadata: {} }],
    ['mismatched provider id', { id: 'seti_other' }],
  ])('%s cannot create or return a saved card', async (_name, fields) => {
    mockRetrieveSetup.mockResolvedValue({ ...setup(), ...fields });
    const response = await confirm();
    expect(response.status).toBe(404);
    expect(mockRetrieveMethod).not.toHaveBeenCalled();
    expect(getTable('PaymentMethod')).toHaveLength(0);
  });

  test.each(['requires_payment_method', 'requires_action', 'processing'])('%s setup cannot be reported as saved', async (status) => {
    mockRetrieveSetup.mockResolvedValue({ ...setup(), status });
    expect((await confirm()).status).toBe(409);
    expect(getTable('PaymentMethod')).toHaveLength(0);
  });

  test('expanded provider customer and method IDs remain correctly bound', async () => {
    mockRetrieveSetup.mockResolvedValue({ ...setup(), customer: { id: 'cus_owner' }, payment_method: { id: 'pm_card1' } });
    mockRetrieveMethod.mockResolvedValue({ ...method(), customer: { id: 'cus_owner' } });
    expect((await confirm()).status).toBe(200);
  });

  test.each([null, 'cus_other'])('removed or moved card cannot be resurrected by an old successful setup', async (customer) => {
    await confirm();
    const before = JSON.stringify(getTable('PaymentMethod'));
    mockRetrieveMethod.mockResolvedValue({ ...method(), customer });
    expect((await confirm()).status).toBe(404);
    expect(JSON.stringify(getTable('PaymentMethod'))).toBe(before);
    expect(mockAttach).not.toHaveBeenCalled();
  });

  test('database failure remains retryable with the same proof and no second attachment', async () => {
    failMethodInsert();
    expect((await confirm()).status).toBe(503);
    expect(getTable('PaymentMethod')).toHaveLength(0);
    supabaseAdmin.rpc.mockRestore();
    expect((await confirm()).status).toBe(200);
    expect(getTable('PaymentMethod')).toHaveLength(1);
    expect(mockAttach).not.toHaveBeenCalled();
  });

  test('provider failure is redacted and a missing SetupIntent is denied', async () => {
    mockRetrieveSetup.mockRejectedValueOnce(Object.assign(new Error('private provider diagnostic'), { statusCode: 409 }));
    const response = await confirm();
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('private');
    mockRetrieveSetup.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'resource_missing' }));
    expect((await confirm()).status).toBe(404);
  });

  test('missing authentication, malformed proof and foreign account are denied', async () => {
    expect((await request(app).post('/api/payments/payment-sheet-add-card/confirm').send({ setupIntentId: setupId })).status).toBe(401);
    expect((await confirm('seti_owned1_secret_value')).status).toBe(400);
    expect(mockRetrieveSetup).not.toHaveBeenCalled();
    expect((await confirm(setupId, 'other')).status).toBe(404);
    expect(getTable('PaymentMethod')).toHaveLength(0);
  });

  test('failed owner lookup cannot be confused with a valid empty account', async () => {
    jest.spyOn(supabaseAdmin, 'from').mockReturnValueOnce({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: '08006' } }) }) }) });
    expect((await confirm()).status).toBe(503);
    expect(mockRetrieveSetup).not.toHaveBeenCalled();
  });

  test('saving and retrying a card never overwrite the provider invoice preference', async () => {
    mockCustomerUpdate.mockRejectedValue(new Error('invoice service unavailable'));
    expect((await confirm()).status).toBe(200);
    const originalId = getTable('PaymentMethod')[0].id;
    const retry = await confirm();
    expect(retry.status).toBe(200);
    expect(retry.body.paymentMethod.id).toBe(originalId);
    expect(mockCustomerUpdate).not.toHaveBeenCalled();
  });
});

describe('resuming a prepared card setup after recreation', () => {
  function resume(id = setupId, userId = owner) {
    return request(app).post('/api/payments/payment-sheet-add-card')
      .set('x-test-user-id', userId).send({ setupIntentId: id });
  }

  test.each(['requires_payment_method', 'requires_confirmation', 'requires_action'])('%s resumes the same proof with a fresh ephemeral key', async (status) => {
    mockRetrieveSetup.mockResolvedValue({ ...setup(), status, client_secret: 'same_setup_secret' });
    const createCustomer = jest.spyOn(service, 'getOrCreateCustomer');
    const mintKey = jest.spyOn(service, 'createEphemeralKey').mockResolvedValue({ secret: 'fresh_ephemeral' });
    const response = await resume();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      setupIntentId: setupId, setupStatus: status, setupIntent: 'same_setup_secret',
      customer: 'cus_owner', ephemeralKey: 'fresh_ephemeral',
    });
    expect(mintKey).toHaveBeenCalledWith('cus_owner');
    expect(createCustomer).not.toHaveBeenCalled();
    expect(mockCreateSetup).not.toHaveBeenCalled();
    expect(mockAttach).not.toHaveBeenCalled();
  });

  test.each(['succeeded', 'processing'])('%s is rechecked without creating a new setup or SDK key', async (status) => {
    mockRetrieveSetup.mockResolvedValue({ ...setup(), status });
    const mintKey = jest.spyOn(service, 'createEphemeralKey');
    const response = await resume();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ setupIntentId: setupId, setupStatus: status, ephemeralKey: '' });
    expect(mintKey).not.toHaveBeenCalled();
    expect(mockCreateSetup).not.toHaveBeenCalled();
    expect(getTable('PaymentMethod')).toHaveLength(0);
  });

  test('completed setup resumes into confirmation after the SDK callback was lost', async () => {
    const response = await resume();
    expect(response.body.setupStatus).toBe('succeeded');
    const saved = await confirm(response.body.setupIntentId);
    expect(saved.status).toBe(200);
    expect(getTable('PaymentMethod')).toHaveLength(1);
    expect(mockCreateSetup).not.toHaveBeenCalled();
  });

  test.each([
    ['canceled', { status: 'canceled' }],
    ['foreign customer', { customer: 'cus_other' }],
    ['foreign actor', { metadata: { source: 'mobile_add_card', user_id: 'other' } }],
    ['unrelated purpose', { metadata: { source: 'gig', user_id: owner } }],
  ])('%s saved setup returns terminal denial without replacing it', async (_name, fields) => {
    mockRetrieveSetup.mockResolvedValue({ ...setup(), ...fields });
    expect((await resume()).status).toBe(404);
    expect((await confirm()).status).toBe(404);
    expect(mockCreateSetup).not.toHaveBeenCalled();
  });

  test('missing setup and another signed-in account cannot resume or replace it', async () => {
    expect((await resume(setupId, 'other')).status).toBe(404);
    mockRetrieveSetup.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'resource_missing' }));
    expect((await resume()).status).toBe(404);
    expect(mockCreateSetup).not.toHaveBeenCalled();
  });

  test('transient resume failure and malformed input never create another setup', async () => {
    mockRetrieveSetup.mockRejectedValueOnce(new Error('private provider diagnostic'));
    const response = await resume();
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('private');
    expect((await resume('seti_invalid_secret_value')).status).toBe(400);
    expect(mockCreateSetup).not.toHaveBeenCalled();
  });

  test('unknown provider state fails closed without another setup or SDK key', async () => {
    mockRetrieveSetup.mockResolvedValue({ ...setup(), status: 'future_status' });
    const mintKey = jest.spyOn(service, 'createEphemeralKey');
    expect((await resume()).status).toBe(503);
    expect(mintKey).not.toHaveBeenCalled();
    expect(mockCreateSetup).not.toHaveBeenCalled();
  });
});

describe('attachment webhook and post-sheet races', () => {
  test('competing requests and attachment event converge on one owned durable card', async () => {
    const responses = await Promise.all([confirm(), confirm(), webhook(), webhook()]);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(getTable('PaymentMethod')).toHaveLength(1);
    expect(getTable('StripeWebhookEvent')).toHaveLength(1);
    expect(getTable('StripeWebhookEvent')[0].processed).toBe(true);
    expect(mockAttach).not.toHaveBeenCalled();
  });

  test('database save failure returns 500 and redelivery recovers the same event', async () => {
    failMethodInsert();
    expect((await webhook()).status).toBe(500);
    expect(getTable('StripeWebhookEvent')[0].processed).toBe(false);
    expect(getTable('PaymentMethod')).toHaveLength(0);
    supabaseAdmin.rpc.mockRestore();
    expect((await webhook()).status).toBe(200);
    expect(getTable('StripeWebhookEvent')).toHaveLength(1);
    expect(getTable('StripeWebhookEvent')[0].processed).toBe(true);
    expect(getTable('PaymentMethod')).toHaveLength(1);
    const reads = mockRetrieveMethod.mock.calls.length;
    expect((await webhook()).body.duplicate).toBe(true);
    expect(mockRetrieveMethod).toHaveBeenCalledTimes(reads);
  });

  test('late attachment delivery does not restore a card removed at the provider', async () => {
    mockRetrieveMethod.mockResolvedValue({ ...method(), customer: null });
    expect((await webhook()).status).toBe(200);
    expect(getTable('PaymentMethod')).toHaveLength(0);
    expect(mockAttach).not.toHaveBeenCalled();
  });

  test('failed customer read is retryable rather than acknowledged as an unrelated customer', async () => {
    const from = supabaseAdmin.from.bind(supabaseAdmin);
    jest.spyOn(supabaseAdmin, 'from').mockImplementation((table) => table === 'User'
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: '08006' } }) }) }) }
      : from(table));
    expect((await webhook()).status).toBe(500);
    expect(getTable('StripeWebhookEvent')[0].processed).toBe(false);
  });

  test('failure to record the event does not perform or acknowledge its mutation', async () => {
    const from = supabaseAdmin.from.bind(supabaseAdmin);
    jest.spyOn(supabaseAdmin, 'from').mockImplementation((table) => {
      const builder = from(table);
      if (table === 'StripeWebhookEvent') builder.insert = async () => ({ data: null, error: { code: '08006' } });
      return builder;
    });
    expect((await webhook()).status).toBe(500);
    expect(mockRetrieveMethod).not.toHaveBeenCalled();
    expect(getTable('PaymentMethod')).toHaveLength(0);
  });
});

describe('saved-card preference and removal HTTP recovery', () => {
  test('an owned removal keeps proof on provider outage, denies stale setup and retries the same ID', async () => {
    const saved = (await confirm()).body.paymentMethod;
    mockDetach.mockRejectedValueOnce(new Error('private provider details'));
    const failed = await request(app).delete(`/api/payments/methods/${saved.id}`).set('x-test-user-id', owner);
    expect(failed.status).toBe(503);
    expect(JSON.stringify(failed.body)).not.toContain('private');
    expect((await confirm()).status).toBe(404);
    expect((await request(app).put(`/api/payments/methods/${saved.id}/default`).set('x-test-user-id', owner)).status).toBe(404);
    expect((await request(app).delete(`/api/payments/methods/${saved.id}`).set('x-test-user-id', 'other')).status).toBe(404);
    expect((await request(app).delete(`/api/payments/methods/${saved.id}`).set('x-test-user-id', owner)).status).toBe(200);
    expect((await request(app).delete(`/api/payments/methods/${saved.id}`).set('x-test-user-id', owner)).status).toBe(200);
    expect(getTable('PaymentMethod')).toHaveLength(0);
    expect(mockDetach).toHaveBeenCalledTimes(2);
  });
  test('a delayed customer.updated invoice snapshot cannot replace the app preference', async () => {
    await confirm();
    const second = { id: 'selected', user_id: owner, stripe_customer_id: 'cus_owner', stripe_payment_method_id: 'pm_other', is_default: true };
    getTable('PaymentMethod')[0].is_default = false;
    getTable('PaymentMethod').push(second);
    mockConstructEvent.mockReturnValue({ id: 'evt_olddefault', type: 'customer.updated', data: {
      object: { id: 'cus_owner', invoice_settings: { default_payment_method: 'pm_card1' } },
    } });
    expect((await webhook()).status).toBe(200);
    expect(getTable('PaymentMethod').find((m) => m.id === 'selected').is_default).toBe(true);
    expect(getTable('PaymentMethod').find((m) => m.stripe_payment_method_id === 'pm_card1').is_default).toBe(false);
    expect(mockCustomerUpdate).not.toHaveBeenCalled();
  });
  test('failed detached webhook completion remains unprocessed and redelivery finishes the same removal', async () => {
    await confirm();
    mockRetrieveMethod.mockResolvedValue({ ...method(), customer: null });
    mockConstructEvent.mockReturnValue({ id: 'evt_detached', type: 'payment_method.detached', data: { object: { ...method(), customer: null } } });
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin);
    const failed = jest.spyOn(supabaseAdmin, 'rpc').mockImplementation((name, args) => name === 'complete_payment_method_removal'
      ? { data: null, error: { code: '08006' } } : rpc(name, args));
    expect((await webhook()).status).toBe(500);
    expect(getTable('StripeWebhookEvent')[0].processed).toBe(false);
    expect(getTable('PaymentMethod')).toHaveLength(1);
    failed.mockRestore();
    expect((await webhook()).status).toBe(200);
    expect((await webhook()).status).toBe(200);
    expect(getTable('PaymentMethod')).toHaveLength(0);
    expect(getTable('PaymentMethodRemoval')).toHaveLength(1);
    mockRetrieveMethod.mockResolvedValue(method());
    mockConstructEvent.mockReturnValue({ id: 'evt_lateattach', type: 'payment_method.attached', data: { object: method() } });
    expect((await webhook()).status).toBe(200);
    expect(getTable('PaymentMethod')).toHaveLength(0);
    expect(getTable('StripeWebhookEvent').every((event) => event.processed)).toBe(true);
  });
});
