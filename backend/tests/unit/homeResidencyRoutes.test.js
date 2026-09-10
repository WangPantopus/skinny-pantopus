const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/notificationService', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));
const notifications = require('../../services/notificationService');
const router = require('../../routes/home');
function handler(path) { return router.stack.find(l => l.route?.path === path && l.route.methods.post).route.stack.at(-1).handle; }
function response() { return { statusCode: 200, status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; return this; } }; }
const paths = ['/:id/attach','/:id/claim/:claimId/approve','/:id/claim/:claimId/reject'];
const request = { params: { id: 'home', claimId: 'claim' }, user: { id: 'actor' },
  body: { userId: 'target', actorId: 'forged', targetId: 'forged', proposed_role: 'guest', reason: 'review note' } };
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
test.each(paths)('%s binds the authenticated actor and exact source to one transaction', async path => {
  const rpc = jest.fn(async () => ({ data: { ok: true, target_id: 'target', replayed: false,
    occupancy: { id: 'occupancy', created_at: 'today' }, user: { id: 'target', username: 'recipient', name: 'Recipient' } }, error: null }));
  db.setRpcMock(rpc);
  const res = response(); await handler(path)(request,res);
  expect(res.statusCode).toBe(200);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls[0][0]).toBe('review_home_residency');
  expect(rpc.mock.calls[0][1]).toMatchObject({ p_home_id: 'home', p_actor_id: 'actor' });
  expect(rpc.mock.calls[0][1].p_payload).toEqual(path===paths[0] ? { target_id: 'target' }
    : path===paths[1] ? { claim_id: 'claim', role: 'guest' } : { claim_id: 'claim', reason: 'review note' });
  expect(db.getTable('HomeOccupancy')).toHaveLength(0);
  expect(db.getTable('HomeResidencyClaim')).toHaveLength(0);
});
test.each(paths)('%s returns retryable failure with no mutation or notification', async path => {
  db.setRpcMock(async () => ({ data: null, error: { code: '55P03' } }));
  const res = response(); await handler(path)(request,res);
  expect(res.statusCode).toBe(503);
  expect(res.body.code).toBe('HOME_ADMISSION_UNAVAILABLE');
  expect(notifications.createNotification).not.toHaveBeenCalled();
});
test.each(paths.slice(1))('%s does not replay a notification after a successful retry', async path => {
  db.setRpcMock(async () => ({ data: { ok: true, target_id: 'target', replayed: true,
    occupancy: { id: 'occ' }, user: { id: 'target' } }, error: null }));
  const res = response(); await handler(path)(request,res);
  expect(res.statusCode).toBe(200);
  expect(notifications.createNotification).not.toHaveBeenCalled();
});
test.each(paths.slice(1))('%s reports committed success if notification delivery fails', async path => {
  db.setRpcMock(async () => ({ data: { ok: true, target_id: 'target', replayed: false,
    occupancy: { id: 'occ' }, user: { id: 'target' } }, error: null }));
  notifications.createNotification.mockRejectedValueOnce(new Error('notification unavailable'));
  const res = response(); await handler(path)(request,res);
  expect(res.statusCode).toBe(200);
  expect(notifications.createNotification).toHaveBeenCalledTimes(1);
  expect(notifications.createNotification.mock.calls[0][0].userId).toBe('target');
});
