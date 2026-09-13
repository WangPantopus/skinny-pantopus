const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/notificationService', () => ({ notifyTaskAssigned: jest.fn().mockResolvedValue(undefined) }));
const notifications = require('../../services/notificationService');
const service = require('../../services/homeRecordService');
const home = require('../../routes/home');
const { getRequestSessionScope } = require('../../utils/requestSessionScope');
const handler = home.stack.find(layer => layer.route?.path === '/:id/tasks' && layer.route.methods.post).route.stack.at(-1).handle;
const homeId = 'ddf17000-0000-4000-8000-000000000100';
const actorId = 'ddf17000-0000-4000-8000-000000000001';
const requestId = 'ddf17000-0000-4000-8000-000000000200';
const taskId = 'ddf17000-0000-4000-8000-000000000300';
const record = { id: taskId, home_id: homeId, created_by: actorId, title: 'Original task', capabilities: {can_edit: true}, media: [] };
const receipt = { home_id: homeId, actor_id: actorId, request_id: requestId, task_id: taskId,
  payload_hash: 'a'.repeat(64), created_at: '2026-09-10T00:00:00Z' };
const args = { homeId, actorId, kind: 'task', action: 'create', requestId, payload: { title: 'Original task', description: null } };
function result(overrides = {}) { return { ok: true, record, creation_receipt: receipt, replayed: false, ...overrides }; }
function request() {
  const req = { params: {id: homeId}, user: {id: actorId}, session: {id: 'synthetic-session-one'},
    headers: {}, body: {...args.payload, request_id: requestId} };
  req.headers['x-pantopus-session-scope'] = getRequestSessionScope(req).session_scope;
  return req;
}
function response() { return { statusCode: 200, headers: {}, set(k,v) { this.headers[k]=v; return this; },
  status(n) {this.statusCode=n;return this;}, json(v) {this.body=v;return this;} }; }
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
test('stable creation binds authenticated actor/Home/request and immutable canonical task type', async () => {
  const rpc = jest.fn(async () => ({data: result()})); db.setRpcMock(rpc);
  const payload = {...args.payload, task_type: 'recurring'};
  await service.mutate({...args, payload});
  expect(rpc).toHaveBeenCalledWith('create_home_task_with_receipt', { p_home_id: homeId, p_actor_id: actorId,
    p_request_id: requestId, p_payload: {...payload, task_type: 'reminder', is_recurring: true} });
  expect(payload.task_type).toBe('recurring');
});
test.each([null, '', 'invalid', {}, []])('malformed stable request %p never reaches RPC', async id => {
  const rpc = jest.fn(); db.setRpcMock(rpc);
  await expect(service.mutate({...args, requestId: id})).rejects.toMatchObject({code: 'HOME_RECORD_INVALID', statusCode: 400});
  expect(rpc).not.toHaveBeenCalled();
});
test.each([{kind:'event'}, {action:'update'}, {recordId:taskId}, {sourceMailId:taskId}])('request identity cannot bypass another gateway %p', async override => {
  const rpc = jest.fn(); db.setRpcMock(rpc);
  await expect(service.mutate({...args,...override})).rejects.toMatchObject({statusCode:400});
  expect(rpc).not.toHaveBeenCalled();
});
test.each([
  {home_id: taskId}, {actor_id: taskId}, {request_id: taskId}, {task_id: homeId},
  {payload_hash: 'bad'}, {payload_hash: ['a'.repeat(64)]}, {created_at: 'invalid'}, {created_at: ['2026-09-10']},
])('mismatched or malformed creation receipt %p never reports saved', async override => {
  db.setRpcMock(async () => ({data: result({creation_receipt:{...receipt,...override}})}));
  await expect(service.mutate(args)).rejects.toMatchObject({code:'HOME_RECORD_UNAVAILABLE',statusCode:503});
});
test.each([{creation_receipt:null}, {replayed:undefined}, {record:{...record,created_by:taskId}}])('invalid result %p never reports saved', async override => {
  db.setRpcMock(async () => ({data: result(override)}));
  await expect(service.mutate(args)).rejects.toMatchObject({statusCode:503});
});
test.each(['HOME_TASK_CREATE_CONFLICT','HOME_TASK_CREATE_RETIRED'])('%s is an explicit terminal conflict', async code => {
  db.setRpcMock(async () => ({data:{ok:false,code,status:409}}));
  await expect(service.mutate(args)).rejects.toMatchObject({code,statusCode:409});
});
test.each([undefined, 'b'.repeat(64)])('missing/stale new-create session %p blocks before RPC', async scope => {
  const rpc = jest.fn(); db.setRpcMock(rpc); const req=request(); const res=response();
  req.headers['x-pantopus-session-scope']=scope;
  await handler(req,res);
  expect(res.statusCode).toBe(409); expect(res.body.code).toBe('SESSION_SCOPE_CHANGED'); expect(rpc).not.toHaveBeenCalled();
});
test('same account replacement session blocks retained create before mutation', async () => {
  const rpc=jest.fn();db.setRpcMock(rpc);const req=request();const res=response();
  req.session.id='synthetic-session-two'; await handler(req,res);
  expect(res.statusCode).toBe(409);expect(rpc).not.toHaveBeenCalled();
});
test.each([false,true])('HTTP creation replay=%s returns exact receipt/session and never repeats notification', async replayed => {
  db.setRpcMock(async () => ({data:result({replayed,notify_user_id:replayed?'recipient':null})}));
  const req=request();const res=response();await handler(req,res);await new Promise(setImmediate);
  expect(res.statusCode).toBe(replayed?200:201);
  expect(res.body).toEqual({task:record,creation_receipt:receipt,replayed,
    task_session:{...getRequestSessionScope(req),home_id:homeId}});
  expect(res.headers['Cache-Control']).toBe('private, no-store');
  expect(notifications.notifyTaskAssigned).not.toHaveBeenCalled();
  expect(req.body.request_id).toBe(requestId);
});
test('unknown creation outcome preserves the exact same request on retry', async () => {
  const rpc=jest.fn().mockRejectedValueOnce(new Error('Lost reply')).mockResolvedValueOnce({data:result({replayed:true})});
  db.setRpcMock(rpc);const req=request();const first=response();await handler(req,first);
  expect(first.statusCode).toBe(503);
  const retry=response();await handler(req,retry);expect(retry.statusCode).toBe(200);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  expect(rpc.mock.calls[1][1].p_payload).toEqual(args.payload);
  expect(retry.body.creation_receipt.task_id).toBe(taskId);
});
