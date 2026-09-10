const { setRpcMock, resetTables } = require('./__mocks__/supabaseAdmin');
const mockRetrieve = jest.fn(), mockCreate = jest.fn(), mockList = jest.fn(), mockConfirm = jest.fn(), mockCancel = jest.fn();
jest.mock('stripe', () => ({ paymentIntents: { retrieve: mockRetrieve, create: mockCreate, list: mockList, confirm: mockConfirm, cancel: mockCancel } }));
const { recover } = require('../services/legacyGigAuthorization');
let payment, attempt, calls;
const pi = (status = 'requires_action', extra = {}) => ({ id: 'pi_legacy', status, amount: 1200,
  currency: 'usd', customer: 'cus_payer', capture_method: 'manual', confirmation_method: 'automatic',
  amount_capturable: status === 'requires_capture' ? 1200 : 0, client_secret: 'ephemeral-provider-secret',
  latest_charge: { id: 'ch_legacy', payment_intent: 'pi_legacy', customer: 'cus_payer', amount: 1200,
    currency: 'usd', paid: true, captured: false, refunded: false, amount_refunded: 0,
    payment_method_details: { type: 'card', card: { capture_before: Math.floor(Date.now()/1000)+3600 } } },
  metadata: { payer_id: 'payer', payee_id: 'worker', gig_id: 'gig', legacy_authorization_id: 'attempt' }, ...extra });
function setupRpc(handler) {
  setRpcMock(async (name, args) => {
    calls.push({ name, args });
    const intercepted = await handler?.(name, args);
    if (intercepted) return intercepted;
    if (name === 'begin_legacy_gig_authorization' && args.p_replace) {
      attempt = { ...attempt, id: 'replacement', intent_id: null, adopted: false, provider_status: null, verified_at: null };
    }
    if (name === 'claim_legacy_gig_authorization') attempt.requested_at = new Date().toISOString();
    if (name === 'record_legacy_gig_authorization') {
      attempt = { ...attempt, intent_id: args.p_proof.id, provider_status: args.p_proof.status, verified_at: new Date().toISOString() };
      payment.stripe_payment_intent_id = args.p_proof.id;
      payment.payment_status = args.p_proof.status === 'requires_capture' ? 'authorized' : 'authorize_pending';
    }
    return { data: { payment: { ...payment }, attempt: { ...attempt } } };
  });
}
beforeEach(() => {
  resetTables(); jest.resetAllMocks(); calls = [];
  payment = { id: 'payment', gig_id: 'gig', payer_id: 'payer', payee_id: 'worker', amount_total: 1200,
    created_at: new Date().toISOString(), amount_platform_fee: 180, stripe_customer_id: 'cus_payer', stripe_payment_intent_id: 'pi_legacy',
    stripe_payment_method_id: 'pm_saved', currency: 'USD', payment_status: 'authorization_failed' };
  attempt = { id: 'attempt', intent_id: 'pi_legacy', adopted: true, off_session: false,
    created_at: new Date().toISOString(), verified_at: null };
  mockRetrieve.mockResolvedValue(pi()); mockList.mockResolvedValue({ data: [], has_more: false });
  setupRpc();
});
test.each(['requires_action','requires_confirmation','requires_payment_method'])('resume preserves the exact %s intent', async status => {
  mockRetrieve.mockResolvedValue(pi(status));
  expect(await recover({ gigId: 'gig', actorId: 'payer', mode: 'resume' })).toMatchObject({
    paymentIntentId: 'pi_legacy', authorizationReady: false, recoveryState: 'action_required', amountCents: 1200, currency: 'usd',
  });
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockConfirm).not.toHaveBeenCalled();
});
test('verified capture-ready intent returns ready without a client secret or another SDK setup', async () => {
  mockRetrieve.mockResolvedValue(pi('requires_capture'));
  const result = await recover({ gigId: 'gig', actorId: 'payer', mode: 'resume' });
  expect(result).toMatchObject({ authorizationReady: true, alreadyAuthorized: true, paymentStatus: 'authorized' });
  expect(result).not.toHaveProperty('clientSecret'); expect(mockCreate).not.toHaveBeenCalled();
});
test.each([
  { amount: 1300 }, { customer: 'cus_other' }, { capture_method: 'automatic' },
  { metadata: { payer_id: 'other', payee_id: 'worker', gig_id: 'gig' } },
  { status: 'requires_capture', amount_capturable: 1199 }, { status: 'succeeded' },
])('rejects mismatched or captured provider evidence: %j', async mismatch => {
  mockRetrieve.mockResolvedValue(pi('requires_action', mismatch));
  await expect(recover({ gigId: 'gig', actorId: 'payer', mode: 'resume' })).rejects.toMatchObject({ statusCode: 409 });
  expect(calls.some(c => c.name === 'record_legacy_gig_authorization')).toBe(false); expect(mockCreate).not.toHaveBeenCalled();
});
test('missing secret is an explicit needs-review state, never success', async () => {
  mockRetrieve.mockResolvedValue(pi('requires_action', { client_secret: null }));
  expect(await recover({ gigId: 'gig', actorId: 'payer' })).toMatchObject({ authorizationReady: false, recoveryState: 'needs_review', canRetry: false });
});
test('database failure after provider proof does not return ready', async () => {
  mockRetrieve.mockResolvedValue(pi('requires_capture'));
  setupRpc(name => name === 'record_legacy_gig_authorization' && { error: { message: 'offline' } });
  await expect(recover({ gigId: 'gig', actorId: 'payer' })).rejects.toMatchObject({ statusCode: 503, code: 'authorization_unknown' });
});
test('revoked actor/current terms prevent a fresh provider mutation at the lease', async () => {
  attempt.intent_id = null; attempt.adopted = false; payment.payment_status = 'ready_to_authorize';
  setupRpc(name => name === 'claim_legacy_gig_authorization' && { data: { error: 'FORBIDDEN' } });
  await expect(recover({ gigId: 'gig', actorId: 'payer', mode: 'resume' })).rejects.toMatchObject({ statusCode: 403 });
  expect(mockCreate).not.toHaveBeenCalled();
});
test('unknown create outcome retains one key and is later found by exact customer and operation', async () => {
  attempt.intent_id = null; attempt.adopted = false; payment.payment_status = 'ready_to_authorize';
  mockCreate.mockRejectedValueOnce(new Error('lost response'));
  await expect(recover({ gigId: 'gig', actorId: 'payer', mode: 'resume' })).rejects.toMatchObject({ code: 'authorization_unknown' });
  mockList.mockResolvedValue({ data: [pi()], has_more: false });
  const result = await recover({ gigId: 'gig', actorId: 'payer', mode: 'check' });
  expect(result.paymentIntentId).toBe('pi_legacy'); expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate.mock.calls[0][1]).toEqual({ idempotencyKey: 'legacy-gig-create:attempt' });
  expect(mockList.mock.calls[0][0]).toMatchObject({ customer: 'cus_payer' });
});
test('unknown historical list absence cannot authorize creation beyond the safe window', async () => {
  attempt.intent_id = null; attempt.adopted = false; payment.payment_status = 'ready_to_authorize'; attempt.requested_at = new Date().toISOString();
  attempt.created_at = new Date(Date.now() - 86400000).toISOString(); attempt.requested_at = attempt.created_at;
  setupRpc(name => name === 'claim_legacy_gig_authorization' && { data: { error: 'NEEDS_REVIEW' } });
  expect(await recover({ gigId: 'gig', actorId: 'payer', mode: 'check' })).toMatchObject({ recoveryState: 'needs_review', canRetry: false });
  await expect(recover({ gigId: 'gig', actorId: 'payer', mode: 'resume' })).resolves.toMatchObject({ recoveryState: 'needs_review', canRetry: false });
  expect(mockCreate).not.toHaveBeenCalled();
});
test('ambiguous provider discovery never selects one candidate or creates another', async () => {
  attempt.intent_id = null; attempt.requested_at = new Date().toISOString();
  mockList.mockResolvedValue({ data: [pi(), pi('requires_action', { id: 'pi_second' })], has_more: false });
  await expect(recover({ gigId: 'gig', actorId: 'payer', mode: 'resume' })).rejects.toMatchObject({ statusCode: 409 });
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockRetrieve).not.toHaveBeenCalled();
});
test('off-session authentication errors bind the retrieved exact created intent', async () => {
  attempt.intent_id = null; attempt.adopted = false; payment.payment_status = 'ready_to_authorize'; attempt.off_session = true;
  mockCreate.mockRejectedValue({ code: 'authentication_required', raw: { payment_intent: { id: 'pi_legacy' } } });
  const result = await recover({ gigId: 'gig', scheduler: true, mode: 'resume' });
  expect(result.authorizationReady).toBe(false); expect(result.paymentIntentId).toBe('pi_legacy');
  expect(mockRetrieve).toHaveBeenCalledWith('pi_legacy');
  expect(calls.at(-1).args.p_proof.attempt_id).toBe('attempt');
});
test('a canceled intent is replaced only after its exact terminal receipt is durable', async () => {
  mockRetrieve.mockResolvedValue(pi('canceled'));
  mockCreate.mockResolvedValue(pi('requires_confirmation', { id: 'pi_replacement', metadata: { ...pi().metadata, legacy_authorization_id: 'replacement' } }));
  const result = await recover({ gigId: 'gig', actorId: 'payer', mode: 'resume' });
  expect(result.paymentIntentId).toBe('pi_replacement');
  expect(calls.map(c => c.name)).toEqual(['begin_legacy_gig_authorization','record_legacy_gig_authorization',
    'begin_legacy_gig_authorization','claim_legacy_gig_authorization','record_legacy_gig_authorization']);
});
test('status checking never creates or confirms an intent even when no provider outcome exists', async () => {
  attempt.intent_id = null; payment.payment_status = 'ready_to_authorize';
  expect(await recover({ gigId: 'gig', actorId: 'payer', mode: 'check' })).toMatchObject({ authorizationReady: false, paymentIntentId: null, recoveryState: 'pending' });
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockConfirm).not.toHaveBeenCalled();
});
test('scheduled cancellation preserves a newly authorized hold and assigned gig', async () => {
  mockRetrieve.mockResolvedValue(pi('requires_capture'));
  expect(await recover({ gigId: 'gig', scheduler: true, mode: 'cancel' })).toMatchObject({ authorizationReady: true });
  expect(mockCancel).not.toHaveBeenCalled(); expect(calls.some(c => c.name === 'finish_legacy_gig_auto_cancel')).toBe(false);
});
test('an old lost off-session intent is discovered and adopted without creating a second hold', async () => {
  payment.stripe_payment_intent_id = null; attempt.intent_id = null; attempt.adopted = false;
  const old = pi('requires_action', { metadata: { payer_id: 'payer', payee_id: 'worker', gig_id: 'gig' } });
  mockList.mockResolvedValue({ data: [old], has_more: false }); mockRetrieve.mockResolvedValue(old);
  expect(await recover({ gigId: 'gig', actorId: 'payer', mode: 'resume' })).toMatchObject({
    paymentIntentId: 'pi_legacy', authorizationReady: false, recoveryState: 'action_required',
  });
  expect(calls.at(-1).args.p_proof.discovered_legacy).toBe(true); expect(mockCreate).not.toHaveBeenCalled();
});
test('missing historical failed intent remains needs-review after an empty exact discovery', async () => {
  payment.stripe_payment_intent_id = null; attempt.intent_id = null; attempt.adopted = false;
  expect(await recover({ gigId: 'gig', actorId: 'payer', mode: 'resume' })).toMatchObject({
    authorizationReady: false, recoveryState: 'needs_review', canRetry: false,
  });
  expect(mockCreate).not.toHaveBeenCalled(); expect(mockList).toHaveBeenCalledTimes(1);
});
test.each(['authorized','authorize_pending','canceled'])('historical %s with no intent cannot start a blind replacement', async status => {
  payment.payment_status=status; payment.stripe_payment_intent_id=null; attempt.intent_id=null; attempt.adopted=false;
  expect(await recover({gigId:'gig',actorId:'payer',mode:'resume'})).toMatchObject({authorizationReady:false,recoveryState:'needs_review',canRetry:false});
  expect(mockCreate).not.toHaveBeenCalled();
});
test('a ready row with evidence of an old attempt remains unknown after empty discovery', async () => {
  payment.payment_status='ready_to_authorize'; payment.payment_attempted_at=new Date().toISOString();
  payment.stripe_payment_intent_id=null; attempt.intent_id=null; attempt.adopted=false;
  expect(await recover({gigId:'gig',actorId:'payer',mode:'resume'})).toMatchObject({recoveryState:'needs_review',canRetry:false});
  expect(mockCreate).not.toHaveBeenCalled();
});
test('durable cancellation suppresses even exact ready proof and SDK callbacks', async () => {
  attempt.cancel_requested=true; mockRetrieve.mockResolvedValue(pi('requires_capture'));
  expect(await recover({gigId:'gig',actorId:'payer',mode:'resume'})).toMatchObject({authorizationReady:false,recoveryState:'pending',canRetry:false,cancellationPending:true});
  expect(mockCreate).not.toHaveBeenCalled();
});
test('fresh future authorization stays scheduled without creating a premature hold', async () => {
  payment.payment_status='ready_to_authorize'; payment.stripe_payment_intent_id=null; attempt.intent_id=null; attempt.adopted=false;
  const scheduled_start=new Date(Date.now()+72*3600000).toISOString();
  const base=jest.fn(async()=>({data:{payment,attempt,gig:{scheduled_start}}})); setRpcMock(base);
  const result=await recover({gigId:'gig',actorId:'payer',mode:'resume'});
  expect(result).toMatchObject({authorizationReady:false,recoveryState:'pending',canRetry:false});
  expect(Date.parse(result.authorizationAvailableAt)).toBe(Date.parse(scheduled_start)-24*3600000); expect(mockCreate).not.toHaveBeenCalled();
});

test('internal change tracking distinguishes first authorization from an unchanged recheck',async () => {
  mockRetrieve.mockResolvedValue(pi('requires_capture'));
  expect((await recover({gigId:'gig',actorId:'payer'})).paymentChanged).toBe(true);
  expect((await recover({gigId:'gig',actorId:'payer'})).paymentChanged).toBe(false);
});
test('binding the exact provider identity is a change even when local status remains pending',async () => {
  payment.stripe_payment_intent_id=null; payment.payment_status='authorize_pending';
  expect((await recover({gigId:'gig',actorId:'payer'})).paymentChanged).toBe(true);
});
