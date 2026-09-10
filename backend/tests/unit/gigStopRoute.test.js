jest.mock('../../services/gigStopService', () => ({ preview: jest.fn(), readRequest: jest.fn(), execute: jest.fn() }));
jest.mock('../__mocks__/verifyToken', () => {
  const verify = (req, res, next) => { req.user = { id: req.headers['x-test-user-id'] }; req.session = { id: req.headers['x-test-session'] || 'session' }; next(); };
  verify.requireAdmin = (req, res, next) => next(); return verify;
});
const express = require('express');
const request = require('supertest');
const stop = require('../../services/gigStopService');
const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const { getRequestSessionScope } = require('../../utils/requestSessionScope');
const payer = 'aac90000-0000-4000-8000-000000000001';
const worker = 'aac90000-0000-4000-8000-000000000002';
const gig = 'aac90000-0000-4000-8000-000000000101';
const operation = 'aac90000-0000-4000-8000-000000000801';
const app = express(); app.use(express.json()); app.use('/gigs', require('../../routes/gigs'));
const scope = (id = payer, session = 'session') => getRequestSessionScope({ user: { id }, session: { id: session } }).session_scope;
const body = { requestId: operation, action: 'cancel', expectedActorId: payer, expectedSessionScope: scope(), expectedTerms: { gigId: gig }, reason: 'changed_plans' };
const post = (route, payload = body) => request(app).post(`/gigs/${gig}/${route}`).set('x-test-user-id', payer).send(payload);
beforeEach(() => { jest.clearAllMocks(); resetTables(); stop.execute.mockResolvedValue({ requestId: operation, action: 'cancel', status: 'pending', receipt: null }); });
test.each(['cancel', 'reopen-bidding', 'worker-release', 'close', 'stop-requests'])('%s requires opening proof before touching the service', async route => {
  expect((await post(route, {})).status).toBe(409); expect(stop.execute).not.toHaveBeenCalled();
});
test('same-actor replacement session before delayed browser event is rejected pre-provider', async () => {
  const result = await request(app).post(`/gigs/${gig}/stop-requests`).set('x-test-user-id', payer).set('x-test-session', 'new-session').send(body);
  expect(result.status).toBe(409); expect(result.body.code).toBe('SESSION_SCOPE_CHANGED'); expect(stop.execute).not.toHaveBeenCalled();
});
test('changed account cannot reuse the prior screen opening proof', async () => {
  const result = await request(app).post(`/gigs/${gig}/stop-requests`).set('x-test-user-id', worker).send(body);
  expect(result.status).toBe(409); expect(stop.execute).not.toHaveBeenCalled();
});
test('an explicitly refreshed session can resume the same UUID and original terms', async () => {
  const result = await request(app).post(`/gigs/${gig}/stop-requests`).set('x-test-user-id', payer).set('x-test-session', 'new-session')
    .send({ ...body, expectedSessionScope: scope(payer, 'new-session') });
  expect(result.status).toBe(202); expect(result.body).toMatchObject({ status: 'pending', receipt: null, actorId: payer, sessionScope: scope(payer, 'new-session') });
  expect(stop.execute).toHaveBeenCalledWith(expect.objectContaining({ requestId: operation, sessionScope: scope(payer, 'new-session'), expectedTerms: body.expectedTerms }));
});
test('plain HTTP success remains pending unless the service returns a completed exact receipt', async () => {
  expect((await post('cancel')).status).toBe(202);
  stop.execute.mockResolvedValue({ status: 'completed', requestId: operation, receipt: { requestId: operation, gigStatus: 'cancelled' } });
  expect((await post('cancel')).status).toBe(200);
});
test('route action cannot be changed by an incompatible body', async () => {
  expect((await post('worker-release')).status).toBe(409); expect(stop.execute).not.toHaveBeenCalled();
});
test.each([{ reason: 'free text' }, { note: 'private note' }, { requestId: 'not-a-uuid' }])('invalid persisted intent refuses before the service: %j', async change => {
  expect((await post('stop-requests', { ...body, ...change })).status).toBe(409); expect(stop.execute).not.toHaveBeenCalled();
});
test('STOP_ACTIVE preserves its code and exact active request UUID', async () => {
  stop.execute.mockRejectedValue(Object.assign(new Error('Active request'), { code: 'STOP_ACTIVE', statusCode: 409, activeRequestId: operation }));
  expect((await post('stop-requests')).body).toMatchObject({ code: 'STOP_ACTIVE', activeRequestId: operation });
});
test('read-only preview/status return current server scope without executing a command', async () => {
  stop.preview.mockResolvedValue({ eligible: true, terms: body.expectedTerms }); stop.readRequest.mockResolvedValue({ status: 'pending', requestId: operation });
  const preview = await request(app).get(`/gigs/${gig}/stop-preview?action=cancel`).set('x-test-user-id', payer);
  const status = await request(app).get(`/gigs/${gig}/stop-requests/${operation}`).set('x-test-user-id', payer);
  expect(preview.body.sessionScope).toBe(scope()); expect(status.body.sessionScope).toBe(scope()); expect(stop.execute).not.toHaveBeenCalled();
});
test.each(['open', 'cancelled'])('generic status %s cannot bypass task stop receipts', async status => {
  seedTable('Gig', [{ id: gig, user_id: payer, status: 'assigned' }]);
  const response = await request(app).patch(`/gigs/${gig}/status`).set('x-test-user-id', payer).send({ status });
  expect(response.status).toBe(409); expect(response.body.code).toBe('STOP_TERMS_REQUIRED');
  expect(getTable('Gig')[0].status).toBe('assigned'); expect(stop.execute).not.toHaveBeenCalled();
});
test('legacy DELETE without a command does not remove an open task or its financial history', async () => {
  seedTable('Gig', [{ id: gig, user_id: payer, status: 'open', payment_id: 'historical' }]);
  seedTable('Payment', [{ id: 'historical', gig_id: gig }]);
  const response = await request(app).delete(`/gigs/${gig}`).set('x-test-user-id', payer).send({});
  expect(response.status).toBe(409); expect(getTable('Gig')).toHaveLength(1); expect(getTable('Payment')[0].gig_id).toBe(gig);
  expect(stop.execute).not.toHaveBeenCalled();
});
test('exact DELETE command shares pending close recovery without a parallel row deletion', async () => {
  seedTable('Gig', [{ id: gig, user_id: payer, status: 'open' }]);
  const response = await request(app).delete(`/gigs/${gig}`).set('x-test-user-id', payer).send({ ...body, action: 'close' });
  expect(response.status).toBe(202); expect(response.body.receipt).toBeNull(); expect(getTable('Gig')).toHaveLength(1);
  expect(stop.execute).toHaveBeenCalledWith(expect.objectContaining({ gigId: gig, action: 'close', requestId: operation }));
});
