const db = require('./__mocks__/supabaseAdmin');
const { resetTables, seedTable, getTable, setRpcMock } = db;
const service = require('../services/walletSettlementService');
jest.mock('../services/walletService', () => ({ creditGigIncome: jest.fn(), creditTipIncome: jest.fn() }));
const wallet = require('../services/walletService');
const notifications = require('../services/notificationService');
const processTransfers = require('../jobs/processPendingTransfers');
const payment = extra => ({ id: 'payment', gig_id: 'gig', payer_id: 'payer', payee_id: 'worker', payment_type: 'gig_payment',
  amount_total: 1000, amount_to_payee: 850, currency: 'USD', stripe_customer_id: 'cus_exact', stripe_payment_intent_id: 'pi_exact',
  stripe_charge_id: 'ch_exact', captured_at: '2020-01-01T00:00:00Z', cooling_off_ends_at: '2020-01-03T00:00:00Z',
  payment_status: 'refunded_partial', refunded_amount: 300, transfer_completed_at: null, dispute_id: null, ...extra });
const credit = extra => ({ id: 'income', payment_id: 'payment', user_id: 'worker', counterparty_id: 'payer', gig_id: 'gig',
  wallet_id: 'wallet', amount: 595, direction: 'credit', type: 'gig_income', ...extra });
const receipt = (p, extra) => ({ id: 'aaf60000-0000-4000-8000-000000000001', payment_id: p.id,
  wallet_transaction_id: 'income', frozen_payment: service.snapshot(p), amount_cents: 595, refund_basis_cents: 300,
  currency: 'usd', status: 'credited', created_at: '2026-01-01T00:00:00Z', ...extra });
beforeEach(() => {
  resetTables(); jest.clearAllMocks(); jest.restoreAllMocks();
  seedTable('Wallet', [{ id: 'wallet', user_id: 'worker', currency: 'USD' }]);
  seedTable('PaymentRefundReceipt', [{ payment_id: 'payment', amount_cents: 300, status: 'succeeded' }]);
});
function settled(p = payment(), changes) {
  seedTable('PaymentWalletSettlement', [receipt(p, changes)]); seedTable('WalletTransaction', [credit()]); return p;
}
test('protected receipt exposes the exact historical residual credit, never current gross minus refunds', async () => {
  const p = settled(payment({ refunded_amount: 500 }));
  seedTable('PaymentRefundReceipt', [{ payment_id: p.id, amount_cents: 500, status: 'succeeded' }]);
  expect(await service.readProjection(p)).toEqual({ payee_release_status: 'wallet_credited', wallet_settlement: {
    id: 'aaf60000-0000-4000-8000-000000000001', paymentId: p.id, status: 'credited', amountCents: 595,
    currency: 'usd', refundBasisCents: 300, createdAt: '2026-01-01T00:00:00Z' } });
  expect(p.amount_to_payee).toBe(850);
});
test.each([
  ['wrong original owner', { frozen_payment: { ...service.snapshot(payment()), payer_id: 'foreign' } }],
  ['amount not based on frozen refund', { amount_cents: 600 }],
  ['basis exceeds verified receipts', { refund_basis_cents: 400 }],
  ['wrong currency', { currency: 'eur' }],
  ['wrong transaction', { wallet_transaction_id: 'foreign' }],
])('%s never becomes verified earnings', async (_, extra) => {
  expect((await service.readProjection(settled(payment(), extra))).payee_release_status).toBe('unknown');
});
test.each([{ user_id: 'foreign' }, { counterparty_id: 'foreign' }, { gig_id: 'foreign' }, { amount: 594 }, { type: 'tip_income' }])('wrong exact income proof %j is unknown', async extra => {
  const p = settled(); seedTable('WalletTransaction', [credit(extra)]);
  expect((await service.readProjection(p)).payee_release_status).toBe('unknown');
});
test.each([{ user_id: 'foreign' }, { currency: 'EUR' }])('actual wallet identity/currency %j must agree', async extra => {
  const p = settled(); seedTable('Wallet', [{ id: 'wallet', user_id: 'worker', currency: 'usd', ...extra }]);
  expect((await service.readProjection(p)).payee_release_status).toBe('unknown');
});
test('multiple income credits or missing receipt evidence cannot be read as paid', async () => {
  const p = settled(); seedTable('WalletTransaction', [credit(), credit({ id: 'second' })]);
  expect((await service.readProjection(p)).payee_release_status).toBe('unknown');
  seedTable('WalletTransaction', []);
  expect((await service.readProjection(p)).payee_release_status).toBe('unknown');
});
test('legacy exact full credit is readable without fabricating a protected receipt', async () => {
  seedTable('WalletTransaction', [credit({ amount: 850 })]);
  expect(await service.readProjection(payment())).toEqual({ payee_release_status: 'wallet_credited', wallet_settlement: null });
  expect(getTable('PaymentWalletSettlement')).toEqual([]);
});
test.each(['transferred', 'transfer_pending'])('legacy %s with no credit proof is unknown', async payment_status => {
  expect((await service.readProjection(payment({ payment_status }))).payee_release_status).toBe('unknown');
});
test('unreleased verified funds remain held; verified external transfer stays separate', async () => {
  expect((await service.readProjection(payment())).payee_release_status).toBe('held');
  expect((await service.readProjection(payment({ stripe_transfer_id: 'tr_exact' }))).payee_release_status).toBe('external_transfer');
});
test('full verified refund can show no earnings before or after a zero receipt, without a credit', async () => {
  const p = payment({ refunded_amount: 1000, payment_status: 'refunded_full' });
  seedTable('PaymentRefundReceipt', [{ payment_id: p.id, amount_cents: 1000, status: 'succeeded' }]);
  expect(await service.readProjection(p)).toEqual({ payee_release_status: 'no_earnings', wallet_settlement: null });
  seedTable('PaymentWalletSettlement', [receipt(p, { amount_cents: 0, refund_basis_cents: 1000, status: 'no_earnings', wallet_transaction_id: null })]);
  expect((await service.readProjection(p)).wallet_settlement.amountCents).toBe(0);
});
test('cent rounding uses the exact integer basis even at the SQL integer ceiling', async () => {
  const p = payment({ amount_total: 2147483647, amount_to_payee: 2147483646, refunded_amount: 2147483645 });
  seedTable('PaymentRefundReceipt', [{ payment_id: p.id, amount_cents: p.refunded_amount, status: 'succeeded' }]);
  seedTable('WalletTransaction', [credit({ amount: 2 })]);
  seedTable('PaymentWalletSettlement', [receipt(p, { amount_cents: 2, refund_basis_cents: p.refunded_amount })]);
  expect((await service.readProjection(p)).payee_release_status).toBe('wallet_credited');
});
test.each([[[]], [[{ payment_id: 'payment', amount_cents: 300, status: 'pending' }]], [[{ payment_id: 'payment', amount_cents: '300', status: 'succeeded' }]]])('unproved refund totals %j stay unknown', async rows => {
  seedTable('PaymentRefundReceipt', rows);
  expect((await service.readProjection(payment())).payee_release_status).toBe('unknown');
});
test('failed read does not return a permissive held fallback', async () => {
  const original = db.from;
  jest.spyOn(db, 'from').mockImplementation(table => table === 'PaymentWalletSettlement'
    ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: { code: '08006' } }) }) }) } : original(table));
  await expect(service.readProjection(payment())).rejects.toMatchObject({ statusCode: 503 });
});
test('settlement RPC binds all original identities, terms and provider proof', async () => {
  const rpc = jest.fn(async () => ({ data: { payment: payment(), settlement: receipt(payment()), reused: false } }));
  setRpcMock(rpc); await service.settle(payment());
  expect(rpc).toHaveBeenCalledWith('settle_paid_gig_wallet_income', { p_payment_id: 'payment', p_expected: service.snapshot(payment()) });
});
test.each([{ error: { code: '08006' } }, { data: { error: 'TERMS_CHANGED' } }, { data: { payment: payment() } }])('failed or incomplete SQL receipt never succeeds %j', async response => {
  setRpcMock(async () => response); await expect(service.settle(payment())).rejects.toThrow();
});
function scheduled(result) {
  seedTable('Payment', [payment()]); seedTable('Gig', [{ id: 'gig', title: 'Test gig' }]);
  const rpc = jest.fn(async name => {
    if (name !== 'settle_paid_gig_wallet_income') throw new Error(`Unexpected ${name}`);
    return result;
  }); setRpcMock(rpc); return rpc;
}
test('actual scheduler uses one atomic residual transaction and announces exact credited amount', async () => {
  const rpc = scheduled({ data: { payment: payment(), settlement: receipt(payment()), reused: false } });
  await processTransfers(); expect(rpc).toHaveBeenCalledTimes(1);
  expect(wallet.creditGigIncome).not.toHaveBeenCalled();
  expect(notifications.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'worker', title: '$5.95 added to your wallet', metadata: expect.objectContaining({ amount: 595 }) }));
});
test.each([{ reused: true, status: 'credited' }, { reused: false, status: 'no_earnings' }])('scheduler duplicate/zero receipt does not announce another credit: %j', async flags => {
  scheduled({ data: { payment: payment(), settlement: receipt(payment(), { status: flags.status }), reused: flags.reused } });
  await processTransfers(); expect(notifications.createNotification).not.toHaveBeenCalled(); expect(wallet.creditGigIncome).not.toHaveBeenCalled();
});
test('unknown atomic response leaves current payment for exact retry with no legacy reset or false notice', async () => {
  const rpc = scheduled({ error: { code: '08006' } });
  await processTransfers(); expect(rpc).toHaveBeenCalledTimes(1);
  expect(getTable('Payment')[0].payment_status).toBe('refunded_partial');
  expect(notifications.createNotification).not.toHaveBeenCalled(); expect(wallet.creditGigIncome).not.toHaveBeenCalled();
});

test('a paid-gig row missing its Gig link cannot fall through to legacy wallet credit', async () => {
  const rpc = scheduled({ data: { error: 'CAPTURE_PROOF_REQUIRED' } });
  getTable('Payment')[0].gig_id = null;
  await processTransfers(); expect(rpc).toHaveBeenCalledTimes(1);
  expect(wallet.creditGigIncome).not.toHaveBeenCalled();
  expect(getTable('Payment')[0].payment_status).toBe('refunded_partial');
  expect(notifications.createNotification).not.toHaveBeenCalled();
});
