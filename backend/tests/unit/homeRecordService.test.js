const db = require('../__mocks__/supabaseAdmin');
const service = require('../../services/homeRecordService');
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
const record = { id: 'record', home_id: 'home', title: 'Exact task' };
test('list binds Home, actor, record and date/source filters to one RPC', async () => {
  const rpc = jest.fn(async () => ({ data: { ok: true, records: [record], attendees: [] }, error: null }));
  db.setRpcMock(rpc);
  await expect(service.list({ homeId: 'home', actorId: 'actor', kind: 'task', recordId: 'record', mailOnly: true }))
    .resolves.toMatchObject({ records: [record] });
  expect(rpc).toHaveBeenCalledWith('get_home_records', { p_home_id: 'home', p_actor_id: 'actor', p_kind: 'task',
    p_record_id: 'record', p_start_after: null, p_start_before: null, p_mail_only: true });
});
test.each(['create', 'update', 'delete'])('%s preserves explicit null and omission in the atomic mutation', async action => {
  const rpc = jest.fn(async () => ({ data: { ok: true, record }, error: null })); db.setRpcMock(rpc);
  const payload = { description: null, assigned_to: null, due_at: null };
  await service.mutate({ homeId: 'home', actorId: 'actor', kind: 'task', action, payload,
    recordId: action === 'create' ? null : 'record', sourceMailId: action === 'create' ? 'mail' : null });
  expect(rpc).toHaveBeenCalledWith('mutate_home_record', expect.objectContaining({
    p_home_id: 'home', p_actor_id: 'actor', p_kind: 'task', p_action: action, p_payload: payload,
    p_source_mail_id: action === 'create' ? 'mail' : null }));
  expect(rpc.mock.calls[0][1].p_payload).not.toHaveProperty('completed_at');
});
test.each([['general','chore'], ['recurring','reminder']])('legacy %s form uses canonical %s without changing caller payload', async (type, canonical) => {
  const rpc = jest.fn(async () => ({ data: { ok: true, record }, error: null })); db.setRpcMock(rpc);
  const payload = { task_type: type, title: 'Task' };
  await service.mutate({ homeId: 'home', actorId: 'actor', kind: 'task', action: 'create', payload });
  expect(rpc.mock.calls[0][1].p_payload.task_type).toBe(canonical);
  expect(payload.task_type).toBe(type);
});
test.each([null, [], 'text'])('invalid payload %p does not reach the database', async payload => {
  const rpc = jest.fn(); db.setRpcMock(rpc);
  await expect(service.mutate({ homeId: 'home', actorId: 'actor', kind: 'event', action: 'update', payload }))
    .rejects.toMatchObject({ statusCode: 400 });
  expect(rpc).not.toHaveBeenCalled();
});
test.each(['HOME_RECORD_DENIED','HOME_RECORD_WRITE_DENIED','HOME_RECORD_RECIPIENT_DENIED','HOME_TASK_SOURCE_DENIED'])('typed %s does not fall back to direct reads', async code => {
  db.setRpcMock(async () => ({ data: { ok: false, code, status: 403 }, error: null }));
  const from = jest.spyOn(db, 'from');
  await expect(service.list({ homeId: 'home', actorId: 'actor', kind: 'task' })).rejects.toMatchObject({ code, statusCode: 403 });
  expect(from).not.toHaveBeenCalled(); from.mockRestore();
});
test.each(['HOME_TASK_MEDIA_CLEANUP_REQUIRED','HOME_TASK_PRIVATE_STORAGE_REQUIRED','HOME_TASK_GIG_FLOW_REQUIRED'])('%s remains explicit unfinished work', async code => {
  db.setRpcMock(async () => ({ data: { ok: false, code, status: 409 }, error: null }));
  await expect(service.mutate({ homeId: 'home', actorId: 'actor', kind: 'task', action: 'authorize_attachment', recordId: 'record' }))
    .rejects.toMatchObject({ code, statusCode: 409 });
});
test.each(['22P02','22007','55P03','08006'])('%s transport errors are sanitized and typed', async code => {
  db.setRpcMock(async () => ({ data: null, error: { code, message: 'private provider value' } }));
  await expect(service.list({ homeId: 'home', actorId: 'actor', kind: 'task' }))
    .rejects.toMatchObject({ statusCode: code.startsWith('22') ? 400 : 503 });
  await expect(service.list({ homeId: 'home', actorId: 'actor', kind: 'task' }))
    .rejects.not.toHaveProperty('message', 'private provider value');
});
test.each([null, {}, { ok: true }, { ok: true, records: [{ ...record, home_id: 'foreign' }], attendees: [] },
  { ok: false, code: 'unknown-provider-detail', status: 403 }])('malformed response %p fails closed', async data => {
  db.setRpcMock(async () => ({ data, error: null }));
  await expect(service.list({ homeId: 'home', actorId: 'actor', kind: 'task' })).rejects.toMatchObject({ code: 'HOME_RECORD_UNAVAILABLE' });
});
test('derived projections omit denied records but propagate retryable failures', async () => {
  db.setRpcMock(async () => ({ data: { ok: false, code: 'HOME_RECORD_DENIED', status: 403 } }));
  await expect(service.visibleRecords({ homeId: 'home', actorId: 'actor', kind: 'task' })).resolves.toEqual([]);
  db.setRpcMock(async () => { throw new Error('transport detail'); });
  await expect(service.visibleRecords({ homeId: 'home', actorId: 'actor', kind: 'task' })).rejects.toMatchObject({ statusCode: 503 });
});
