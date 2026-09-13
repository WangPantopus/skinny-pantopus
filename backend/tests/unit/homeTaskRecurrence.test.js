const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/notificationService', () => ({ notifyTaskAssigned: jest.fn() }));
const service = require('../../services/homeTaskRecurrenceService');
const home = require('../../routes/home');
const { getRequestSessionScope } = require('../../utils/requestSessionScope');
const id = n => `ddf20001-0000-4000-8000-${String(n).padStart(12, '0')}`;
const args = { homeId: id(1), actorId: id(2), taskId: id(3), requestId: id(4),
  command: { action: 'pause', expected_revision: 0 } };
const result = () => ({ ok: true, home_id: args.homeId, task_id: args.taskId, can_manage: true,
  task_updated_at: '2026-09-10T00:00:00Z', configuration: null, revision: 0, replayed: false,
  receipt: { request_id: args.requestId, actor_id: args.actorId, home_id: args.homeId, task_id: args.taskId,
    action: 'pause', revision: 0, request_hash: 'a'.repeat(64), created_at: '2026-09-10T00:00:00Z' } });
function response() { return { statusCode: 200, headers: {}, set(k,v) { this.headers[k]=v; return this; },
  status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; return this; } }; }
function request() {
  const req = { params: { id: args.homeId, taskId: args.taskId }, user: { id: args.actorId },
    session: { id: 'recurrence-test-session' }, headers: {}, body: { request_id: args.requestId, ...args.command } };
  req.headers['x-pantopus-session-scope'] = getRequestSessionScope(req).session_scope;
  return req;
}
const handler = method => home.stack.find(l => l.route?.path === '/:id/tasks/:taskId/recurrence' && l.route.methods[method]).route.stack.at(-1).handle;
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
test('HTTP mutation binds exact signed-in account, task, immutable command and original request', async () => {
  const rpc = jest.fn(async () => ({ data: result() })); db.setRpcMock(rpc);
  const req = request(), res = response(); await handler('post')(req,res);
  expect(res.statusCode).toBe(200); expect(res.body.receipt.request_id).toBe(args.requestId);
  expect(res.headers['Cache-Control']).toBe('private, no-store');
  expect(rpc).toHaveBeenCalledWith('set_home_task_recurrence', { p_home_id: args.homeId, p_actor_id: args.actorId,
    p_task_id: args.taskId, p_request_id: args.requestId, p_command: args.command });
});
test.each(['missing','changed-session','changed-account'])('%s opening scope stops writes before database work', async mode => {
  const rpc = jest.fn(); db.setRpcMock(rpc); const req=request(), res=response();
  if (mode==='missing') delete req.headers['x-pantopus-session-scope'];
  if (mode==='changed-session') req.session.id='replacement-session';
  if (mode==='changed-account') req.user.id=id(9);
  await handler('post')(req,res);
  expect(res.statusCode).toBe(409); expect(rpc).not.toHaveBeenCalled();
});
test('read performs no command or generation', async () => {
  const rpc=jest.fn(async()=>({data:result()}));db.setRpcMock(rpc);
  const res=response();await handler('get')(request(),res);
  expect(res.statusCode).toBe(200);expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls[0][0]).toBe('get_home_task_recurrence');
});
test.each(['HOME_RECORD_DENIED','HOME_RECORD_WRITE_DENIED','HOME_TASK_RECURRENCE_STALE','HOME_TASK_RECURRENCE_CONFLICT'])('%s remains a visible denial/conflict',async code=>{
  db.setRpcMock(async()=>({data:{ok:false,code,status:code.includes('RECURRENCE')?409:403}}));
  await expect(service.change(args)).rejects.toMatchObject({code});
});
test.each([{home_id:id(8)},{task_id:id(8)},{can_manage:undefined},{revision:-1},{configuration:undefined},
  {configuration:{id:id(8),state:'active',revision:0,frequency:'DAILY',interval:1,timezone:'UTC',next_due_at:'invalid'}}])('rejects invalid current projection %p',async override=>{
  db.setRpcMock(async()=>({data:{...result(),...override}}));
  await expect(service.change(args)).rejects.toMatchObject({statusCode:503});
});
test.each([{request_id:id(8)},{actor_id:id(8)},{home_id:id(8)},{task_id:id(8)},{action:'start'},{request_hash:'bad'},
  {created_at:'invalid'},{revision:-1}])('does not acknowledge another or malformed receipt %p',async override=>{
  db.setRpcMock(async()=>({data:{...result(),receipt:{...result().receipt,...override}}}));
  await expect(service.change(args)).rejects.toMatchObject({statusCode:503});
});
test('unknown command response retries only its original request and terms',async()=>{
  const rpc=jest.fn().mockRejectedValueOnce(new Error('lost reply')).mockResolvedValue({data:{...result(),replayed:true}});
  db.setRpcMock(rpc);await expect(service.change(args)).rejects.toMatchObject({statusCode:503});
  expect((await service.change(args)).replayed).toBe(true);expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
});
test('one failed generation does not prevent another due schedule; each retains revision',async()=>{
  const rpc=jest.fn(async(name,parameters)=>{
    if(name==='due_home_task_recurrences')return{data:[{id:id(10),revision:1},{id:id(11),revision:2}]};
    if(parameters.p_id===id(10))throw new Error('lost commit reply');
    return{data:{outcome:'generated',task_id:id(20)}};
  });db.setRpcMock(rpc);
  expect(await service.generateDue(200)).toEqual({selected:2,generated:1,paused:0,unchanged:0,failed:1});
  expect(rpc.mock.calls[0][1]).toEqual({p_limit:100});
  expect(rpc.mock.calls[2][1]).toEqual({p_id:id(11),p_revision:2});
});
test.each([[{id:'invalid',revision:1}],[{id:id(1),revision:0}],{},null])('malformed due set %p generates nothing',async due=>{
  const rpc=jest.fn(async()=>({data:due}));db.setRpcMock(rpc);
  await expect(service.generateDue()).rejects.toMatchObject({statusCode:503});expect(rpc).toHaveBeenCalledTimes(1);
});
