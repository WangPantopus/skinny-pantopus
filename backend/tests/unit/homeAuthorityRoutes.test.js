const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../utils/homePermissions', () => {
  const actual = jest.requireActual('../../utils/homePermissions');
  return { ...actual, checkHomePermission: jest.fn().mockResolvedValue({ hasAccess: true, isOwner: true }) };
});
jest.mock('../../services/notificationService', () => ({ createBulkNotifications: jest.fn().mockResolvedValue(undefined) }));
const home = require('../../routes/home');
const iam = require('../../routes/homeIam');
function handler(router, method, path) {
  return router.stack.find(l => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle;
}
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
test.each([
  ['delete', '/:id', 'delete_home_authorized', { p_home_id: 'home', p_user_id: 'actor' }],
  ['post', '/:id/detach', 'mutate_home_member', { p_home_id: 'home', p_actor_id: 'actor', p_target_id: 'target', p_action: 'remove', p_payload: {} }],
  ['post', '/:id/move-out', 'mutate_home_member', { p_home_id: 'home', p_actor_id: 'actor', p_target_id: 'actor', p_action: 'remove', p_payload: {} }],
])('%s %s binds identity to one transaction', async (method, path, rpcName, args) => {
  const rpc = jest.fn(async () => ({ data: { ok: true, allowed: true, deleted: true, notify_user_ids: [] }, error: null }));
  db.setRpcMock(rpc);
  const res = response();
  await handler(home, method, path)({ params: { id: 'home' }, user: { id: 'actor' }, body: { userId: 'target' } }, res);
  expect(res.statusCode).toBe(200);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith(rpcName, args);
});
test('move-out preserves stale normalization response without replaying notification', async () => {
  db.setRpcMock(async () => ({ data: { ok: true, reconciled_stale_occupancy: true, notify_user_ids: [] }, error: null }));
  const res = response();
  await handler(home, 'post', '/:id/move-out')({ params: { id: 'home' }, user: { id: 'actor' }, body: {} }, res);
  expect(res.body.reconciled_stale_occupancy).toBe(true);
  expect(require('../../services/notificationService').createBulkNotifications).not.toHaveBeenCalled();
});
test('failed move-out never sends notifications or reports completion', async () => {
  db.setRpcMock(async () => ({ data: null, error: { code: '55P03' } }));
  const res = response();
  await handler(home, 'post', '/:id/move-out')({ params: { id: 'home' }, user: { id: 'actor' }, body: {} }, res);
  expect(res.statusCode).toBe(503);
  expect(require('../../services/notificationService').createBulkNotifications).not.toHaveBeenCalled();
});
test('legacy transfer-admin directs callers to verified ownership flow without changing authority', async () => {
  db.seedTable('Home', [{ id: 'home', owner_id: 'actor' }]);
  const res = response();
  await handler(iam, 'post', '/:id/transfer-admin')({ params: { id: 'home' }, user: { id: 'actor' }, body: { new_admin_user_id: 'target' } }, res);
  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe('OWNERSHIP_FLOW_REQUIRED');
  expect(db.getTable('Home')[0].owner_id).toBe('actor');
});
test.each(['owner','admin','manager','property_manager'])('legacy residency claim cannot grant %s', async role => {
  db.seedTable('HomeResidencyClaim', [{ id: 'claim', home_id: 'home', user_id: 'target', status: 'pending', claimed_role: role }]);
  const res = response();
  await handler(home, 'post', '/:id/claim/:claimId/approve')({ params: { id: 'home', claimId: 'claim' }, user: { id: 'actor' }, body: {} }, res);
  expect(res.statusCode).toBe(403);
  expect(res.body.code).toBe('RESIDENCY_ROLE_FORBIDDEN');
  expect(db.getTable('HomeResidencyClaim')[0].status).toBe('pending');
  expect(db.getTable('HomeOccupancy')).toHaveLength(0);
});
