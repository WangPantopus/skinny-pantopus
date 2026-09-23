jest.mock('../../services/gigStopService', () => ({ preview: jest.fn(), readRequest: jest.fn(), execute: jest.fn(),
  notifyPosterNoShow: jest.fn(() => Promise.resolve(null)) }));
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
test('a bounded Other explanation and fingerprint reach the same stop service', async () => {
  const result = await post('stop-requests', { ...body, reason: 'other', reasonNote: 'Synthetic schedule change', reasonNoteHash: 'a'.repeat(64) });
  expect(result.status).toBe(202);
  expect(stop.execute).toHaveBeenCalledWith(expect.objectContaining({ reason: 'other', reasonNote: 'Synthetic schedule change', reasonNoteHash: 'a'.repeat(64) }));
});
test.each([
  { reason: 'changed_plans', reasonNote: 'Note', reasonNoteHash: 'a'.repeat(64) },
  { reason: 'other', reasonNote: 'x'.repeat(1001), reasonNoteHash: 'a'.repeat(64) },
  { reason: 'other', reasonNote: 'Note', reasonNoteHash: 'not-a-fingerprint' },
])('malformed Other details stay before the service: %j', async details => {
  expect((await post('stop-requests', { ...body, ...details })).status).toBe(409);
  expect(stop.execute).not.toHaveBeenCalled();
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


describe('no-show report admission matches the existing timing preview', () => {
  const now = Date.parse('2026-09-14T18:00:00Z');
  const base = { id: gig, user_id: payer, accepted_by: worker, status: 'assigned', price: 100,
    accepted_at: new Date(now - 60_000).toISOString(), scheduled_start: new Date(now + 60_000).toISOString() };
  beforeEach(() => { jest.spyOn(Date, 'now').mockReturnValue(now); });
  afterEach(() => { jest.spyOn(Date, 'now').mockRestore(); });
  test.each([
    ['poster before the scheduled start', payer, {}],
    ['worker before 24 hours', worker, {}],
    ['work already in progress', payer, { status: 'in_progress', started_at: new Date(now - 60_000).toISOString() }],
    ['poster exactly at the 30-minute boundary', payer, { scheduled_start: new Date(now - 30 * 60_000).toISOString() }],
    ['worker exactly at the 24-hour boundary', worker, { accepted_at: new Date(now - 24 * 60 * 60_000).toISOString() }],
    ['invalid scheduled time', payer, { scheduled_start: 'invalid' }],
    ['invalid acceptance time', worker, { accepted_at: 'invalid' }],
    ['no assigned worker', payer, { accepted_by: null, scheduled_start: new Date(now - 60 * 60_000).toISOString() }],
    ['same person on both sides', payer, { accepted_by: payer, scheduled_start: new Date(now - 60 * 60_000).toISOString() }],
    ['recorded start with stale assigned status', payer, { started_at: new Date(now - 60_000).toISOString(), scheduled_start: new Date(now - 60 * 60_000).toISOString() }],
    // A poster no-show also needs the agreed start plus the poster report's 30-minute buffer to pass.
    ['worker beyond 24 hours before the scheduled start', worker, { accepted_at: new Date(now - 24 * 60 * 60_000 - 1).toISOString() }],
    ['worker beyond 24 hours exactly at the start buffer', worker, { accepted_at: new Date(now - 24 * 60 * 60_000 - 1).toISOString(), scheduled_start: new Date(now - 30 * 60_000).toISOString() }],
    ['worker beyond 24 hours with an invalid scheduled start', worker, { accepted_at: new Date(now - 24 * 60 * 60_000 - 1).toISOString(), scheduled_start: 'invalid' }],
  ])('%s cannot bypass the read-only eligibility check', async (_, actor, changes) => {
    seedTable('Gig', [{ ...base, ...changes }]);
    const preview = await request(app).get(`/gigs/${gig}/no-show-check`).set('x-test-user-id', actor);
    expect(preview.status).toBe(200); expect(preview.body.can_report).toBe(false);
    const result = await request(app).post(`/gigs/${gig}/report-no-show`).set('x-test-user-id', actor).send({ description: 'Synthetic report' });
    expect(result.status).toBe(409); expect(result.body.code).toBe('NO_SHOW_NOT_ELIGIBLE');
    expect(getTable('GigIncident')).toHaveLength(0);
    expect(getTable('Gig')[0]).toEqual({ ...base, ...changes });
  });

  test.each([
    ['poster beyond the scheduled buffer', payer, { scheduled_start: new Date(now - 30 * 60_000 - 1).toISOString() }],
    ['poster beyond the unscheduled acceptance buffer', payer, { scheduled_start: null, accepted_at: new Date(now - 150 * 60_000 - 1).toISOString() }],
    ['worker beyond 24 hours and the scheduled start buffer', worker, { accepted_at: new Date(now - 24 * 60 * 60_000 - 1).toISOString(), scheduled_start: new Date(now - 30 * 60_000 - 1).toISOString() }],
    ['worker beyond 24 hours without a scheduled start', worker, { accepted_at: new Date(now - 24 * 60 * 60_000 - 1).toISOString(), scheduled_start: null }],
  ])('%s retains the existing eligible path', async (_, actor, changes) => {
    seedTable('Gig', [{ ...base, ...changes }]);
    const preview = await request(app).get(`/gigs/${gig}/no-show-check`).set('x-test-user-id', actor);
    expect(preview.status).toBe(200); expect(preview.body.can_report).toBe(true);
    const result = await request(app).post(`/gigs/${gig}/report-no-show`).set('x-test-user-id', actor).send({ description: 'Synthetic eligible report' });
    expect(result.status).toBe(200);
    expect(getTable('GigIncident')).toHaveLength(1);
    expect(getTable('GigIncident')[0]).toMatchObject({ gig_id: gig, reported_by: actor, reported_against: actor === payer ? worker : payer });
    expect(getTable('Gig')[0].status).toBe('cancelled');
  });

  test('the poster cannot cancel a task while the worker no-show fee is being captured', async () => {
    seedTable('Gig', [{ ...base, payment_id: 'fee-payment', scheduled_start: new Date(now - 60 * 60_000).toISOString() }]);
    seedTable('Payment', [{ id: 'fee-payment', gig_id: gig, payment_status: 'capture_pending',
      metadata: { gig_fee: { kind: 'poster_no_show', state: 'pending' } } }]);
    const result = await request(app).post(`/gigs/${gig}/report-no-show`).set('x-test-user-id', payer).send({});
    expect(result.status).toBe(409); expect(result.body.code).toBe('NO_SHOW_REPORT_ACTIVE');
    expect(getTable('GigIncident')).toHaveLength(0); expect(getTable('Gig')[0].status).toBe('assigned');
  });

  test('a retry after a failed cancellation applies the reliability rule exactly once', async () => {
    const supabaseAdmin = require('../__mocks__/supabaseAdmin');
    seedTable('Gig', [{ ...base, accepted_at: new Date(now - 24 * 60 * 60_000 - 1).toISOString(), scheduled_start: null }]);
    seedTable('User', [{ id: payer, no_show_count: 0, late_cancel_count: 0, reliability_score: 100 }, { id: worker, name: 'Synthetic worker' }]);
    const realFrom = supabaseAdmin.from; let failNextCancel = true;
    const spy = jest.spyOn(supabaseAdmin, 'from').mockImplementation(table => {
      const builder = realFrom(table);
      if (table === 'Gig' && failNextCancel) {
        builder.update = () => {
          failNextCancel = false;
          const lost = { eq: () => lost, select: () => lost, maybeSingle: () => lost,
            then: (resolve, reject) => Promise.resolve({ data: null, error: { code: '08006', message: 'Synthetic lost connection' } }).then(resolve, reject) };
          return lost;
        };
      }
      return builder;
    });
    try {
      const first = await request(app).post(`/gigs/${gig}/report-no-show`).set('x-test-user-id', worker).send({ description: 'Synthetic report' });
      expect(first.status).toBe(500); expect(getTable('GigIncident')).toHaveLength(1);
      expect(getTable('Gig')[0].status).toBe('assigned');
      const retry = await request(app).post(`/gigs/${gig}/report-no-show`).set('x-test-user-id', worker).send({ description: 'Synthetic report' });
      expect(retry.status).toBe(200); expect(getTable('Gig')[0].status).toBe('cancelled');
      expect(getTable('GigIncident')).toHaveLength(1);
      expect(getTable('User').find(u => u.id === payer)).toMatchObject({ no_show_count: 1, reliability_score: 85 });
    } finally { spy.mockRestore(); }
  });

  test('an unrelated actor stays outside the reporting boundary', async () => {
    const other = 'aac90000-0000-4000-8000-000000000003';
    seedTable('Gig', [{ ...base, scheduled_start: new Date(now - 60 * 60_000).toISOString() }]);
    const result = await request(app).post(`/gigs/${gig}/report-no-show`).set('x-test-user-id', other).send({});
    expect(result.status).toBe(403); expect(getTable('GigIncident')).toHaveLength(0);
    expect(getTable('Gig')[0].status).toBe('assigned');
  });
});
