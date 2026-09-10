const { resetTables, seedTable, getTable, setRpcMock } = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/gigStopService', () => ({ execute: jest.fn(), preview: jest.fn(), readRequest: jest.fn() }));
jest.mock('../../stripe/stripeService', () => ({ cancelAuthorization: jest.fn() }));
jest.mock('../__mocks__/verifyToken', () => {
  const verify = (req, res, next) => { req.user = { id: req.headers['x-test-user-id'] }; req.session = { id: 'worker-session' }; next(); };
  verify.requireAdmin = (req, res, next) => next(); return verify;
});
const express = require('express');
const request = require('supertest');
const stop = require('../../services/gigStopService');
const stripe = require('../../stripe/stripeService');
const notifications = require('../../services/notificationService');
const { getRequestSessionScope } = require('../../utils/requestSessionScope');
const poster = 'aac60000-0000-4000-8000-000000000001';
const worker = 'aac60000-0000-4000-8000-000000000002';
const other = 'aac60000-0000-4000-8000-000000000003';
const gigId = 'aac60000-0000-4000-8000-000000000101';
const requestId = 'aac60000-0000-4000-8000-000000000801';
const app = express(); app.use(express.json()); app.use('/api/gigs', require('../../routes/gigs'));
let before;
beforeEach(() => {
  jest.clearAllMocks(); resetTables(); setRpcMock(null);
  seedTable('Gig', [{ id: gigId, user_id: poster, accepted_by: worker, status: 'assigned', payment_id: 'payment',
    last_worker_reminder_at: '2026-09-10T12:00:00Z' }]);
  seedTable('Payment', [{ id: 'payment', payment_status: 'authorized' }]);
  seedTable('GigBid', [{ id: 'accepted', gig_id: gigId, status: 'accepted' }, { id: 'rejected', gig_id: gigId, status: 'rejected' }]);
  before = structuredClone({ gigs: getTable('Gig'), payments: getTable('Payment'), bids: getTable('GigBid') });
});
const post = (actor, body) => request(app).post(`/api/gigs/${gigId}/worker-release`).set('x-test-user-id', actor).send(body);
const command = () => ({ requestId, action: 'worker_release', expectedActorId: worker,
  expectedSessionScope: getRequestSessionScope({ user: { id: worker }, session: { id: 'worker-session' } }).session_scope,
  expectedTerms: { gigId, ownerId: poster, workerId: worker, paymentId: 'payment', amountCents: 1000 }, reason: null });
function unchanged() {
  expect({ gigs: getTable('Gig'), payments: getTable('Payment'), bids: getTable('GigBid') }).toEqual(before);
  expect(stripe.cancelAuthorization).not.toHaveBeenCalled();
  expect(notifications.createBulkNotifications).not.toHaveBeenCalled();
  expect(notifications.createNotification).not.toHaveBeenCalled();
}
// Legacy clients must refresh their opening proof. These checks preserve the
// essential no-provider/no-reopen/no-notification assertions for old requests.
test.each([worker, poster, other])('legacy worker-release request from %s cannot bypass the durable gateway', async actor => {
  const response = await post(actor, {});
  expect(response.status).toBe(409); expect(response.body.code).toBe('STOP_TERMS_REQUIRED');
  expect(stop.execute).not.toHaveBeenCalled(); unchanged();
});
test('legacy free-text note is not turned into a new stop intent', async () => {
  expect((await post(worker, { note: 'Something came up' })).status).toBe(409);
  expect(stop.execute).not.toHaveBeenCalled(); unchanged();
});
test('an expired legacy payment failure cannot reopen the task through the old Stripe helper', async () => {
  stripe.cancelAuthorization.mockRejectedValueOnce(new Error('Stripe timeout'));
  expect((await post(worker, {})).status).toBe(409); unchanged();
});
test('current exact command reaches the shared gateway and returns its completed receipt', async () => {
  const receipt = { requestId, gigId, action: 'worker_release', gigStatus: 'open', financialStatus: 'released' };
  stop.execute.mockResolvedValue({ requestId, action: 'worker_release', status: 'completed', receipt });
  const response = await post(worker, command());
  expect(response.status).toBe(200); expect(response.body.receipt).toEqual(receipt);
  expect(stop.execute).toHaveBeenCalledWith(expect.objectContaining({ requestId, actorId: worker, action: 'worker_release', expectedTerms: command().expectedTerms }));
  // SQL owns assignment/bid/reminder/notice effects. The HTTP shim performs no
  // parallel legacy writes; actual effects are verified in gig-stop.sql/harness.
  unchanged();
});
test('unknown current release remains pending and does not claim success or reopen through the shim', async () => {
  stop.execute.mockResolvedValue({ requestId, action: 'worker_release', status: 'pending', financialStatus: 'release_pending', receipt: null });
  const response = await post(worker, command());
  expect(response.status).toBe(202); expect(response.body).toMatchObject({ status: 'pending', receipt: null });
  expect(response.body.success).toBeUndefined(); unchanged();
});
test.each([['STOP_FORBIDDEN', 403], ['STOP_STARTED_POLICY_REVIEW', 409]])('current gateway restriction %s preserves the original task', async (code, statusCode) => {
  stop.execute.mockRejectedValue(Object.assign(new Error('Current assignment cannot release'), { code, statusCode }));
  const response = await post(worker, command()); expect(response.status).toBe(statusCode); expect(response.body.code).toBe(code); unchanged();
});
