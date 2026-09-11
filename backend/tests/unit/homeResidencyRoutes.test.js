const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/notificationService', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));
const notifications = require('../../services/notificationService');
const express = require('express');
const request = require('supertest');
const { getRequestSessionScope } = require('../../utils/requestSessionScope');
const router = require('../../routes/home');
const id = n => `ddc23501-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1), target = id(2), home = id(100), claim = id(201), token = 'a'.repeat(64);
const session = { id: 'residency-route-session' };
const scope = getRequestSessionScope({ user: { id: actor }, session }).session_scope;
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.session = session; next(); });
app.use('/homes', router);
const post = (action, body = {}, expected = scope) => {
  const r = request(app).post(`/homes/${home}/claim/${claim}/${action}`).set('x-test-user-id', actor);
  if (expected !== null) r.set('x-pantopus-session-scope', expected);
  return r.send(body);
};
function current(status = 'pending') {
  return { ok: true, home_id: home, claim: { id: claim, home_id: home, user_id: target, status, review_token: token },
    occupancy: { id: id(300), user_id: target, is_active: true } };
}
function decision(action, { replayed = false, legacy = true, status } = {}) {
  const result = action === 'approve' ? 'verified' : 'rejected';
  return { ...current(status || result), claim_id: claim, target_id: target, action, replayed,
    receipt: { id: id(400), home_id: home, claim_id: claim, actor_id: actor, action,
      request_id: id(500), request_hash: 'b'.repeat(64), review_token: token, legacy_request: legacy,
      created_at: '2026-09-11T00:00:00.000Z', result: { status: result } } };
}
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });

test('legacy manager attach still uses the original admission transaction and authenticated actor', async () => {
  const rpc = jest.fn(async () => ({ data: { ok: true, target_id: target, replayed: false,
    occupancy: { id: id(300) }, user: { id: target } }, error: null }));
  db.setRpcMock(rpc);
  const res = await request(app).post(`/homes/${home}/attach`).set('x-test-user-id', actor)
    .send({ userId: target, actorId: id(99) });
  expect(res.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('review_home_residency', expect.objectContaining({
    p_home_id: home, p_actor_id: actor, p_action: 'attach', p_payload: { target_id: target },
  }));
});

test.each(['approve', 'reject'])('%s binds authenticated actor and exact path through validation to one transaction', async action => {
  const rpc = jest.fn(async () => ({ data: decision(action), error: null }));
  db.setRpcMock(rpc);
  const res = await post(action, { actorId: id(99), targetId: id(99),
    ...(action === 'approve' ? { proposed_role: 'guest' } : { reason: 'review note' }) });
  expect(res.status).toBe(200);
  expect(res.headers['cache-control']).toBe('private, no-store');
  expect(res.body.residency_session).toEqual({ actor_id: actor, session_scope: scope, home_id: home });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('decide_home_residency_review', expect.objectContaining({
    p_home_id: home, p_claim_id: claim, p_actor_id: actor, p_action: action,
    p_role: action === 'approve' ? 'guest' : null, p_reason: action === 'reject' ? 'review note' : null,
    p_request_id: null, p_review_token: null,
  }));
  expect(db.getTable('HomeOccupancy')).toHaveLength(0);
  expect(db.getTable('HomeResidencyClaim')).toHaveLength(0);
});

test.each(['approve', 'reject'])('%s returns retryable failure with no notification on an uncertain response', async action => {
  db.setRpcMock(async () => ({ data: null, error: { code: '55P03' } }));
  const res = await post(action);
  expect(res.status).toBe(503);
  expect(res.body.code).toBe('RESIDENCY_REVIEW_UNAVAILABLE');
  expect(notifications.createNotification).not.toHaveBeenCalled();
});

test.each(['approve', 'reject'])('%s preserves historical/current separation without replaying notification', async action => {
  const original = decision(action, { replayed: true, status: 'pending' });
  original.occupancy.is_active = false;
  db.setRpcMock(async () => ({ data: original, error: null }));
  const res = await post(action);
  expect(res.status).toBe(200);
  expect(res.body.receipt).toEqual(original.receipt);
  expect(res.body.claim.status).toBe('pending');
  expect(res.body.occupancy.is_active).toBe(false);
  expect(notifications.createNotification).not.toHaveBeenCalled();
});

test.each(['approve', 'reject'])('%s reports committed success when notification delivery fails', async action => {
  db.setRpcMock(async () => ({ data: decision(action), error: null }));
  notifications.createNotification.mockRejectedValueOnce(new Error('notification unavailable'));
  const res = await post(action);
  expect(res.status).toBe(200);
  expect(notifications.createNotification).toHaveBeenCalledTimes(1);
  expect(notifications.createNotification.mock.calls[0][0].userId).toBe(target);
});

test.each(['approve', 'reject'])('%s requires a complete prepared identity and unchanged opening session before SQL', async action => {
  const rpc = jest.fn(); db.setRpcMock(rpc);
  expect((await post(action, { request_id: id(500) })).status).toBe(400);
  expect((await post(action, { request_id: id(500), review_token: token }, null)).status).toBe(409);
  expect((await post(action, { request_id: id(500), review_token: token }, 'c'.repeat(64))).body.code).toBe('SESSION_SCOPE_CHANGED');
  expect(rpc).not.toHaveBeenCalled();
  expect(notifications.createNotification).not.toHaveBeenCalled();
});

test('prepared read and explicit decision retain the same reviewed identity', async () => {
  const rpc = jest.fn(async name => ({ data: name === 'get_home_residency_review' ? current()
    : decision('reject', { legacy: false }), error: null }));
  db.setRpcMock(rpc);
  const review = await request(app).get(`/homes/${home}/claim/${claim}/review`).set('x-test-user-id', actor);
  expect(review.status).toBe(200);
  expect(review.body.residency_session.session_scope).toBe(scope);
  expect(review.headers['cache-control']).toBe('private, no-store');
  const res = await post('reject', { request_id: id(500).toUpperCase(), review_token: review.body.claim.review_token, reason: '  Review note  ' });
  expect(res.status).toBe(200);
  expect(rpc).toHaveBeenLastCalledWith('decide_home_residency_review', expect.objectContaining({
    p_request_id: id(500), p_review_token: token, p_reason: 'Review note',
  }));
});

test('a malformed receipt never becomes a successful confirmation or notification', async () => {
  const wrong = decision('approve'); wrong.receipt.actor_id = id(99);
  db.setRpcMock(async () => ({ data: wrong, error: null }));
  expect((await post('approve')).status).toBe(503);
  expect(notifications.createNotification).not.toHaveBeenCalled();
});
