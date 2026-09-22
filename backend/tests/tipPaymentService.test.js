const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

jest.mock('stripe', () => jest.requireActual('./__mocks__/stripe'));

const stripe = require('stripe');
const { createNotification } = require('../services/notificationService');
const stripeService = require('../stripe/stripeService');
const { PAYMENT_STATES } = require('../stripe/paymentStateMachine');

function tipFixture() {
  const payment = { id: 'tip-proof-payment', payer_id: 'tip-payer', payee_id: 'tip-worker', gig_id: 'tip-gig',
    payment_type: 'tip', payment_status: 'authorize_pending', amount_total: 500, amount_subtotal: 500,
    amount_platform_fee: 0, amount_to_payee: 500, amount_processing_fee: 44, tip_amount: 500, currency: 'usd',
    stripe_customer_id: 'cus_tipproof', stripe_payment_intent_id: 'pi_tipproof', metadata: {} };
  const intent = { id: 'pi_tipproof', customer: 'cus_tipproof', livemode: false, amount: 500, currency: 'usd',
    capture_method: 'automatic', confirmation_method: 'automatic', status: 'succeeded', amount_received: 500,
    amount_capturable: 0, transfer_data: null, on_behalf_of: null, application_fee_amount: null,
    latest_charge: 'ch_tipproof', payment_method: 'pm_tipproof', metadata: { payer_id: payment.payer_id,
      payee_id: payment.payee_id, gig_id: payment.gig_id, payment_type: 'tip', platform_fee: '0', payee_stripe_account: 'acct_tipproof' } };
  const charge = { id: 'ch_tipproof', payment_intent: intent.id, customer: intent.customer, livemode: false,
    amount: 500, currency: 'usd', on_behalf_of: null, transfer: null, destination: null, application_fee: null,
    application_fee_amount: null, paid: true, captured: true, amount_captured: 500, amount_refunded: 0,
    refunded: false, disputed: false, dispute: null, created: 1710000000 };
  return { payment, intent, charge };
}

describe('existing tip status requires the current matching provider payment', () => {
  let originalKey;
  beforeEach(() => {
    resetTables(); jest.clearAllMocks(); stripe._resetAll();
    originalKey = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test_tip_proof_fixture';
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });
  test.each([
    ['intent', { id: 'pi_other' }], ['intent', { customer: 'cus_other' }],
    ['intent', { amount: 600 }], ['intent', { currency: 'eur' }],
    ['intent', { livemode: true }], ['intent', { amount_received: 1 }],
    ['intent', { transfer_data: { destination: 'acct_other' } }],
    ['intent', { metadata: { payer_id: 'another-payer' } }],
    ['charge', { payment_intent: 'pi_other' }], ['charge', { captured: false }],
    ['charge', { amount_captured: 1 }], ['charge', { created: null }],
  ])('rejects mismatched %s evidence before marking paid: %j', async (part, change) => {
    const fixture = tipFixture(); fixture[part] = { ...fixture[part], ...change };
    seedTable('Payment', [fixture.payment]);
    stripe.paymentIntents.retrieve.mockResolvedValue(fixture.intent);
    stripe.charges.retrieve.mockResolvedValue(fixture.charge);
    await expect(stripeService.syncTipPaymentStatus(fixture.payment.id)).rejects.toMatchObject({ code: 'TIP_PROVIDER_REVIEW' });
    expect(getTable('Payment')[0]).toMatchObject({ payment_status: 'authorize_pending' });
    expect(getTable('Payment')[0].payment_succeeded_at).toBeUndefined();
    expect(createNotification).not.toHaveBeenCalled();
  });
  test('a supplied succeeded event cannot override a current processing intent', async () => {
    const { payment, intent } = tipFixture(); seedTable('Payment', [payment]);
    stripe.paymentIntents.retrieve.mockResolvedValue({ ...intent, status: 'processing', amount_received: 0, latest_charge: null });
    const result = await stripeService.syncTipPaymentStatus(payment.id, { paymentIntent: intent });
    expect(result.payment_status).toBe('authorize_pending'); expect(result.stripe_status).toBe('processing');
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(intent.id);
    expect(createNotification).not.toHaveBeenCalled();
  });
  test('a local paid flag without any provider identity cannot confirm a tip', async () => {
    const { payment } = tipFixture();
    seedTable('Payment', [{ ...payment, stripe_payment_intent_id: null,
      payment_status: 'captured_hold', payment_succeeded_at: '2026-09-14T00:00:00Z' }]);
    await expect(stripeService.syncTipPaymentStatus(payment.id)).rejects.toMatchObject({ code: 'TIP_PROVIDER_REVIEW' });
    expect(createNotification).not.toHaveBeenCalled(); expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });
  test('an unresolved original without a provider identity stays pending without creating another payment', async () => {
    const { payment } = tipFixture(); seedTable('Payment', [{ ...payment, stripe_payment_intent_id: null }]);
    const result = await stripeService.syncTipPaymentStatus(payment.id);
    expect(result.payment_status).toBe('authorize_pending');
    expect(createNotification).not.toHaveBeenCalled(); expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });
  test('matching current intent and captured Charge confirm the original tip', async () => {
    const { payment, intent, charge } = tipFixture(); seedTable('Payment', [payment]);
    stripe.paymentIntents.retrieve.mockResolvedValue(intent); stripe.charges.retrieve.mockResolvedValue(charge);
    const result = await stripeService.syncTipPaymentStatus(payment.id);
    expect(result.payment_status).toBe('captured_hold');
    expect(getTable('Payment')[0].stripe_charge_id).toBe(charge.id);
    expect(getTable('Payment')[0].payment_succeeded_at).toBe(new Date(charge.created * 1000).toISOString());
    expect(createNotification).not.toHaveBeenCalled(); // SQL capture owns durable notification creation.
  });
  test('historical capture cannot be validated by a different latest Charge', async () => {
    const { payment, intent, charge } = tipFixture();
    seedTable('Payment', [{ ...payment, payment_status: 'transferred', payment_succeeded_at: '2024-01-01T00:00:00Z',
      stripe_charge_id: 'ch_historical' }]);
    stripe.paymentIntents.retrieve.mockResolvedValue(intent); stripe.charges.retrieve.mockResolvedValue(charge);
    await expect(stripeService.syncTipPaymentStatus(payment.id)).rejects.toMatchObject({ code: 'TIP_PROVIDER_REVIEW' });
    expect(getTable('Payment')[0].stripe_charge_id).toBe('ch_historical'); expect(createNotification).not.toHaveBeenCalled();
  });
  test.each(['succeeded', 'canceled'])('a failed database transition never reports %s or writes around the guard', async status => {
    const { payment, intent, charge } = tipFixture(); seedTable('Payment', [payment]);
    stripe.paymentIntents.retrieve.mockResolvedValue(status === 'succeeded' ? intent
      : { ...intent, status, amount_received: 0, latest_charge: null });
    stripe.charges.retrieve.mockResolvedValue(charge);
    const db = require('../config/supabaseAdmin');
    const from = db.from;
    jest.spyOn(db, 'from').mockImplementation(table => {
      const builder = from(table);
      const update = builder.update;
      builder.update = values => {
        update.call(builder, values);
        if (table === 'Payment' && values.payment_status) {
          builder.single = async () => ({ data: null, error: { message: 'Synthetic transition conflict' } });
        }
        return builder;
      };
      return builder;
    });
    await expect(stripeService.syncTipPaymentStatus(payment.id)).rejects.toThrow('Synthetic transition conflict');
    expect(getTable('Payment')[0].payment_status).toBe('authorize_pending');
    expect(createNotification).not.toHaveBeenCalled();
  });
  test('a changed amount during provider verification cannot be marked as the original paid tip', async () => {
    const { payment, intent, charge } = tipFixture(); seedTable('Payment', [payment]);
    stripe.paymentIntents.retrieve.mockResolvedValue(intent);
    stripe.charges.retrieve.mockImplementation(async () => {
      getTable('Payment')[0].amount_total = 600;
      return charge;
    });
    await expect(stripeService.syncTipPaymentStatus(payment.id)).rejects.toThrow();
    expect(getTable('Payment')[0].payment_status).toBe('authorize_pending');
    expect(createNotification).not.toHaveBeenCalled();
  });
});

describe('original tip creation and recovery in the existing service', () => {
  const db = require('../config/supabaseAdmin');
  const { projectTipOriginal } = require('../stripe/gigTipProof');
  let originalKey, saved, intent, charge, calls, reserveError, recordError, loseRecord, claimBusy;
  // RPC responses use JSON transport, including plain objects in this test realm.
  const copy = value => JSON.parse(JSON.stringify(value));
  const terms = () => ({ gigId: 'tip-gig', payerId: 'tip-payer', payeeId: 'tip-worker', ownerConfirmedAt: '2026-09-14T00:00:00Z' });
  const command = (overrides = {}) => ({ requestId: 'tip-proof-payment', payerId: 'tip-payer', gigId: 'tip-gig', amount: 500,
    paymentMethodId: null, sessionScope: 'a'.repeat(64), expectedTerms: terms(), mode: 'resume', ...overrides });
  function frozenParams() {
    const p = saved.payment;
    return { amount: 500, currency: 'usd', customer: p.stripe_customer_id, capture_method: 'automatic', confirmation_method: 'automatic',
      metadata: { payer_id: p.payer_id, payee_id: p.payee_id, gig_id: p.gig_id, payment_type: 'tip', platform_fee: '0',
        payee_stripe_account: 'acct_tipproof', tip_request_id: p.id, payment_id: p.id }, description: `Pantopus Tip - Gig ${p.gig_id}` };
  }
  function prepared(age = 0) {
    saved.original.provider_started_at = new Date(Date.now() - age).toISOString();
    saved.original.provider_params = frozenParams(); saved.original.state = 'creating';
  }
  function pendingProvider(status = 'requires_payment_method') {
    Object.assign(intent, { status, amount_received: 0, latest_charge: null });
    stripe.paymentIntents.retrieve.mockImplementation(async () => copy(intent));
  }
  beforeEach(() => {
    resetTables(); jest.clearAllMocks(); stripe._resetAll();
    originalKey = process.env.STRIPE_SECRET_KEY; process.env.STRIPE_SECRET_KEY = 'sk_test_tip_original_fixture';
    const fixture = tipFixture(); ({ intent, charge } = fixture);
    saved = { payment: { ...fixture.payment, stripe_payment_intent_id: null }, original: { version: 1, state: 'reserved',
      terms: terms(), payment_method_id: null, original_session_scope: 'a'.repeat(64), stripe_account_id: 'acct_tipproof', livemode: false } };
    intent.metadata = { ...intent.metadata, tip_request_id: saved.payment.id, payment_id: saved.payment.id };
    intent.client_secret = `${intent.id}_secret_fixture`;
    calls = []; reserveError = false; recordError = false; loseRecord = false; claimBusy = false;
    stripe.paymentIntents.list = jest.fn().mockResolvedValue({ data: [], has_more: false });
    stripe.paymentMethods = { retrieve: jest.fn() };
    stripe.customers.retrieve.mockResolvedValue({ id: 'cus_tipproof', livemode: false, metadata: { user_id: 'tip-payer' } });
    stripe.paymentIntents.create.mockImplementation(async () => { calls.push('provider-create'); return copy(intent); });
    stripe.paymentIntents.retrieve.mockImplementation(async () => copy(intent));
    stripe.charges.retrieve.mockImplementation(async () => copy(charge));
    jest.spyOn(stripeService, 'createEphemeralKey').mockResolvedValue({ secret: 'ephemeral_fixture' });
    jest.spyOn(db, 'rpc').mockImplementation(async (name, args) => {
      calls.push(name);
      if (name === 'reserve_gig_tip_original' && reserveError) return { error: { message: 'Reservation unavailable' } };
      if (name === 'read_gig_tip_original' && saved === null) return { data: { error: 'NOT_FOUND' } };
      if (name === 'read_gig_tip_original' && saved.original.source === 'legacy' && !saved.payment.metadata?.gig_tip_original_v1) {
        return { data: { error: 'LEGACY_REVIEW', payment: copy(saved.payment) } };
      }
      if (name === 'register_legacy_gig_tip') {
        if (recordError) return { error: { message: 'Adoption unavailable' } };
        expect(args.p_expected_payment).toEqual(saved.payment);
        saved.payment.metadata = { ...saved.payment.metadata, gig_tip_original_v1: copy(saved.original) };
      }
      if (name === 'claim_gig_tip_original') {
        if (claimBusy) return { data: { error: 'BUSY' } };
        saved.original.lease_id = 'tip-fixture-lease';
      }
      if (name === 'prepare_gig_tip_provider') {
        saved.payment.stripe_customer_id = args.p_customer_id;
        if (!saved.original.provider_started_at) prepared();
      }
      if (['record_gig_tip_original', 'register_legacy_gig_tip'].includes(name)) {
        if (recordError) return { error: { message: 'Receipt unavailable' } };
        const proof = args.p_proof;
        Object.assign(saved.payment, { stripe_payment_intent_id: proof.id, stripe_charge_id: proof.charge_id });
        Object.assign(saved.original, { state: 'pending', provider_status: proof.status });
        if (['succeeded', 'canceled'].includes(proof.status)) {
          saved.original.state = proof.status;
          saved.payment.payment_status = proof.status === 'succeeded' ? 'captured_hold' : 'canceled';
          saved.payment.payment_succeeded_at = proof.status === 'succeeded' ? proof.captured_at : null;
          saved.original.receipt = { requestId: saved.payment.id, paymentId: saved.payment.id, gigId: saved.payment.gig_id,
            payerId: saved.payment.payer_id, payeeId: saved.payment.payee_id, amountCents: 500, currency: 'usd',
            status: proof.status, paymentIntentId: proof.id, chargeId: proof.charge_id,
            amountChargedCents: proof.status === 'succeeded' ? 500 : 0 };
        }
        if (loseRecord) { loseRecord = false; return { error: { message: 'Lost committed acknowledgement' } }; }
      }
      if (name === 'cancel_unstarted_gig_tip') {
        saved.original.state = 'canceled'; saved.payment.payment_status = 'canceled';
        saved.original.receipt = { requestId: saved.payment.id, paymentId: saved.payment.id, gigId: saved.payment.gig_id,
          payerId: saved.payment.payer_id, payeeId: saved.payment.payee_id, amountCents: 500, currency: 'usd', status: 'canceled',
          paymentIntentId: null, chargeId: null, amountChargedCents: 0 };
      }
      if (name === 'release_gig_tip_original') delete saved.original.lease_id;
      return { data: copy(saved) };
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = originalKey;
  });
  test('old commands fail before reservation or provider operations', async () => {
    await expect(stripeService.createTipPayment({ payerId: 'tip-payer', gigId: 'tip-gig', amount: 500 }))
      .rejects.toMatchObject({ code: 'TIP_TERMS_REQUIRED' });
    expect(calls).toEqual([]); expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });
  test('reserves and freezes parameters before provider work, then requires current capture and durable receipt', async () => {
    const result = await stripeService.createTipPayment(command());
    expect(calls.indexOf('reserve_gig_tip_original')).toBeLessThan(calls.indexOf('provider-create'));
    expect(calls.indexOf('prepare_gig_tip_provider')).toBeLessThan(calls.indexOf('provider-create'));
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(frozenParams(), { idempotencyKey: 'gig-tip:tip-proof-payment' });
    expect(result.status).toBe('succeeded'); expect(result.receipt.amountChargedCents).toBe(500);
    expect(saved.payment.amount_to_payee).toBe(500); expect(saved.payment.amount_platform_fee).toBe(0);
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(intent.id);
    expect(createNotification).not.toHaveBeenCalled();
  });
  test('reservation failure prevents all provider work', async () => {
    reserveError = true;
    await expect(stripeService.createTipPayment(command())).rejects.toMatchObject({ code: 'TIP_RECEIPT_UNKNOWN' });
    expect(stripe.customers.retrieve).not.toHaveBeenCalled(); expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });
  test('a lost create response retains the UUID and recovers the exact intent without another create', async () => {
    stripe.paymentIntents.create.mockRejectedValue(new Error('Lost provider response'));
    const first = await stripeService.createTipPayment(command());
    expect(first.status).toBe('pending'); expect(first.receipt).toBeNull(); expect(saved.original.provider_started_at).toBeTruthy();
    stripe.paymentIntents.list.mockResolvedValue({ data: [copy(intent)], has_more: false });
    const result = await stripeService.createTipPayment(command({ sessionScope: 'b'.repeat(64) }));
    expect(result.status).toBe('succeeded'); expect(result.request.requestId).toBe(first.request.requestId);
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
  });
  test('explicit retry in the recovery window uses identical saved parameters and idempotency key', async () => {
    stripe.paymentIntents.create.mockRejectedValueOnce(new Error('Lost response'));
    await stripeService.createTipPayment(command()); const originalStart = saved.original.provider_started_at;
    const result = await stripeService.createTipPayment(command());
    expect(result.status).toBe('succeeded'); expect(saved.original.provider_started_at).toBe(originalStart);
    expect(stripe.paymentIntents.create.mock.calls[0]).toEqual(stripe.paymentIntents.create.mock.calls[1]);
  });
  test('old unknown creation cannot create again when discovery finds nothing', async () => {
    prepared(24 * 60 * 60 * 1000);
    const result = await stripeService.createTipPayment(command());
    expect(result.status).toBe('needs_review'); expect(result.receipt).toBeNull();
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });
  test('check of an unknown UUID never reserves or creates a replacement', async () => {
    saved = null;
    await expect(stripeService.createTipPayment(command({ mode: 'check' }))).rejects.toMatchObject({ code: 'TIP_NOT_FOUND' });
    expect(calls).toEqual(['read_gig_tip_original']); expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });
  test('check only reconciles current provider state; checkout secrets stay transient', async () => {
    prepared(); saved.payment.stripe_payment_intent_id = intent.id; pendingProvider('requires_action');
    const result = await stripeService.createTipPayment(command({ mode: 'check' }));
    expect(result.status).toBe('requires_action'); expect(result.receipt).toBeNull();
    expect(result.checkout.clientSecret).toBe(intent.client_secret);
    expect(JSON.stringify(saved)).not.toContain('_secret_'); expect(JSON.stringify(saved)).not.toContain('ephemeral_fixture');
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled(); expect(stripe.paymentIntents.confirm).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled(); expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
  test('read API returns only local original progress with no provider access', async () => {
    const result = await stripeService.readTipRequest({ requestId: saved.payment.id, payerId: saved.payment.payer_id });
    expect(result.status).toBe('pending'); expect(result.checkout).toBeUndefined(); expect(calls).toEqual(['read_gig_tip_original']);
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled(); expect(stripeService.createEphemeralKey).not.toHaveBeenCalled();
  });
  test('unstarted cancellation completes with zero provider calls', async () => {
    const result = await stripeService.createTipPayment(command({ mode: 'cancel' }));
    expect(result.status).toBe('canceled'); expect(result.receipt.amountChargedCents).toBe(0);
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled(); expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(stripe.customers.retrieve).not.toHaveBeenCalled();
  });
  test('unknown creation cannot be canceled by assuming the provider has no payment', async () => {
    prepared();
    const result = await stripeService.createTipPayment(command({ mode: 'cancel' }));
    expect(result.status).toBe('pending'); expect(result.receipt).toBeNull();
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled(); expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(calls).not.toContain('cancel_unstarted_gig_tip');
  });
  test('cancel reads fresh proof after the provider call before returning a zero-charge receipt', async () => {
    prepared(); saved.payment.stripe_payment_intent_id = intent.id; pendingProvider();
    stripe.paymentIntents.cancel.mockImplementation(async () => { intent.status = 'canceled'; throw new Error('Lost cancellation reply'); });
    const result = await stripeService.createTipPayment(command({ mode: 'cancel' }));
    expect(result.status).toBe('canceled'); expect(result.receipt.amountChargedCents).toBe(0);
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledTimes(2);
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });
  test('provider still processing after failed cancellation remains recoverable', async () => {
    prepared(); saved.payment.stripe_payment_intent_id = intent.id; pendingProvider('processing');
    stripe.paymentIntents.cancel.mockRejectedValue(new Error('Not cancellable yet'));
    const result = await stripeService.createTipPayment(command({ mode: 'cancel' }));
    expect(result.status).toBe('pending'); expect(result.receipt).toBeNull(); expect(result.checkout).toBeUndefined();
  });
  test.each([{ amount: 600 }, { customer: 'cus_other' }, { livemode: true }, { metadata: {} }])(
    'mismatched current intent cannot bind or report paid: %j', async patch => {
      prepared(); saved.payment.stripe_payment_intent_id = intent.id; Object.assign(intent, patch);
      const result = await stripeService.createTipPayment(command({ mode: 'check' }));
      expect(result.status).toBe('needs_review'); expect(result.receipt).toBeNull(); expect(result.checkout).toBeUndefined();
      expect(calls).not.toContain('record_gig_tip_original'); expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    });
  test('lost database acknowledgement recovers the committed exact receipt', async () => {
    loseRecord = true;
    const result = await stripeService.createTipPayment(command());
    expect(result.status).toBe('succeeded'); expect(result.receipt.paymentIntentId).toBe(intent.id);
    expect(calls.filter(call => call === 'record_gig_tip_original')).toHaveLength(1);
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
  });
  test('a database write that never committed cannot report paid or hand out checkout', async () => {
    recordError = true;
    const result = await stripeService.createTipPayment(command());
    expect(result.status).toBe('pending'); expect(result.receipt).toBeNull(); expect(result.checkout).toBeUndefined();
    expect(createNotification).not.toHaveBeenCalled();
  });
  test('a busy original returns pending without any provider work', async () => {
    claimBusy = true;
    const result = await stripeService.createTipPayment(command());
    expect(result.status).toBe('pending'); expect(result.canRetry).toBe(false); expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });
  test('changed displayed terms fail before provider access on a check', async () => {
    await expect(stripeService.createTipPayment(command({ mode: 'check', amount: 501 }))).rejects.toMatchObject({ code: 'TIP_REQUEST_CONFLICT' });
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled(); expect(calls).not.toContain('claim_gig_tip_original');
  });
  test('cancel of an already captured intent records success without a new refund or cancellation', async () => {
    prepared(); saved.payment.stripe_payment_intent_id = intent.id;
    const result = await stripeService.createTipPayment(command({ mode: 'cancel' }));
    expect(result.status).toBe('succeeded'); expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
  test('modern webhook reconciliation checks the original without creating payment work', async () => {
    prepared(); saved.payment.stripe_payment_intent_id = intent.id;
    seedTable('Payment', [{ ...copy(saved.payment), metadata: { gig_tip_original_v1: copy(saved.original) } }]);
    const result = await stripeService.syncTipPaymentStatus(saved.payment.id);
    expect(result.payment_status).toBe('captured_hold'); expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(calls).not.toContain('reserve_gig_tip_original');
  });
  test('a corrupted receipt cannot establish completion on the local read API', async () => {
    saved.original.state = 'succeeded'; saved.original.receipt = { status: 'succeeded', amountChargedCents: 500 };
    expect(() => projectTipOriginal(saved)).toThrow();
  });
  function legacy() {
    saved.original = { ...saved.original, source: 'legacy', terms: { ...terms(), ownerConfirmedAt: null },
      stripe_account_id: null, state: 'needs_review' };
    saved.payment.stripe_payment_intent_id = intent.id;
    saved.payment.currency = 'USD';
    delete intent.metadata.tip_request_id; delete intent.metadata.payment_id;
    return command({ mode: 'check', expectedTerms: saved.original.terms });
  }
  test('local legacy read exposes the original identity and unknown time without provider work or a receipt', async () => {
    legacy(); saved.payment.payment_status = 'transferred';
    const result = await stripeService.readTipRequest({ requestId: saved.payment.id, payerId: saved.payment.payer_id });
    expect(result.request).toMatchObject({ source: 'legacy', currency: 'usd', terms: { ownerConfirmedAt: null } });
    expect(result.status).toBe('needs_review'); expect(result.receipt).toBeNull(); expect(result.canRetry).toBe(false);
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled(); expect(calls).not.toContain('register_legacy_gig_tip');
  });
  test('legacy resume rejects before reservation, discovery, provider creation or confirmation', async () => {
    const cmd = legacy();
    await expect(stripeService.createTipPayment({ ...cmd, mode: 'resume' })).rejects.toMatchObject({ code: 'TIP_LEGACY_CHECK_ONLY' });
    expect(calls).toEqual([]); expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.list).not.toHaveBeenCalled(); expect(stripe.paymentIntents.confirm).not.toHaveBeenCalled();
  });
  test('legacy missing intent cannot be adopted, canceled as unstarted or replaced', async () => {
    const cmd = legacy(); saved.payment.stripe_payment_intent_id = null;
    const result = await stripeService.createTipPayment({ ...cmd, mode: 'cancel' });
    expect(result.status).toBe('needs_review'); expect(result.canCancel).toBe(false); expect(result.receipt).toBeNull();
    expect(calls).not.toContain('register_legacy_gig_tip'); expect(calls).not.toContain('cancel_unstarted_gig_tip');
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled(); expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });
  test('legacy SCA requires check or cancel and never exposes client confirmation credentials', async () => {
    const cmd = legacy(); pendingProvider('requires_action');
    const result = await stripeService.createTipPayment(cmd);
    expect(result.status).toBe('requires_action'); expect(result.canRetry).toBe(false); expect(result.canCancel).toBe(true);
    expect(result.checkout).toBeUndefined(); expect(result.request.requestId).toBe(saved.payment.id);
    expect(stripeService.createEphemeralKey).not.toHaveBeenCalled(); expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(calls).toContain('register_legacy_gig_tip'); expect(calls).not.toContain('prepare_gig_tip_provider');
  });
  test('legacy explicit cancellation reads the same existing provider payment before and after cancellation', async () => {
    const cmd = legacy(); pendingProvider('requires_action');
    stripe.paymentIntents.cancel.mockImplementation(async () => { pendingProvider('canceled'); return copy(intent); });
    const result = await stripeService.createTipPayment({ ...cmd, mode: 'cancel' });
    expect(result.status).toBe('canceled'); expect(result.receipt.amountChargedCents).toBe(0);
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith(intent.id, expect.anything(),
      { idempotencyKey: `gig-tip-cancel:${cmd.requestId}:${intent.id}` });
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled(); expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
  test.each(['amount', 'customer', 'livemode', 'metadata'])('mismatched legacy %s proof leaves an unregistered original', async field => {
    const cmd = legacy(); intent[field] = { amount: 600, customer: 'cus_other', livemode: true,
      metadata: { ...intent.metadata, tip_request_id: saved.payment.id } }[field];
    const result = await stripeService.createTipPayment(cmd);
    expect(result.status).toBe('needs_review'); expect(result.receipt).toBeNull(); expect(result.checkout).toBeUndefined();
    expect(calls).not.toContain('register_legacy_gig_tip'); expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });
  test('lost legacy adoption acknowledgement recovers only the committed matching receipt', async () => {
    const cmd = legacy(); loseRecord = true;
    const result = await stripeService.createTipPayment(cmd);
    expect(result.status).toBe('succeeded'); expect(result.receipt.paymentIntentId).toBe(intent.id);
    expect(result.request.source).toBe('legacy'); expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });
  test('failed legacy adoption does not turn provider success into local completion', async () => {
    const cmd = legacy(); recordError = true;
    const result = await stripeService.createTipPayment(cmd);
    expect(result.status).toBe('needs_review'); expect(result.receipt).toBeNull(); expect(result.canRetry).toBe(false);
    expect(createNotification).not.toHaveBeenCalled();
  });
});
