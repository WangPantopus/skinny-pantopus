const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/notificationService', () => ({ notifyTaskAssigned: jest.fn().mockResolvedValue(undefined) }));
const notifications = require('../../services/notificationService');
const home = require('../../routes/home');
const mail = require('../../routes/mailboxV2Phase3');
function handler(router, method, path) {
  return router.stack.find(l => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle;
}
function response() { return { statusCode: 200, headers: {}, set(k,v) { this.headers[k]=v; return this; }, status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; return this; } }; }
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
const record = { id: 'record', home_id: 'home', title: 'Exact record', media: [] };
const request = { params: { id: 'home', recordId: 'record', eventId: 'record', homeId: 'home', taskId: 'record' },
  headers: { authorization: 'Bearer synthetic-unit' }, user: { id: 'actor' }, query: {}, body: { description: null, actorId: 'forged' } };
test.each(['tasks','events'])('%s list and detail use the exact actor and current projection', async path => {
  const rpc = jest.fn(async () => ({ data: { ok: true, records: [record], attendees: [], can_create: false } })); db.setRpcMock(rpc);
  for (const suffix of ['', '/:recordId']) {
    const res = response(); await handler(home, 'get', '/:id/'+path+suffix)(request,res);
    expect(res.statusCode).toBe(200);
    expect(rpc.mock.calls.at(-1)[0]).toBe('get_home_records');
    expect(rpc.mock.calls.at(-1)[1]).toMatchObject({ p_home_id: 'home', p_actor_id: 'actor', p_record_id: suffix ? 'record' : null });
  }
});
test.each([['tasks','task'],['events','event']])('%s mutations bind actor and preserve the response envelope', async (path, kind) => {
  const rpc = jest.fn(async () => ({ data: { ok: true, record } })); db.setRpcMock(rpc);
  for (const method of (kind==='task'?['post','put']:['post','put','delete'])) {
    const res = response(); await handler(home, method, '/:id/'+path+(method==='post'?'':'/:recordId'))(request,res);
    expect(res.statusCode).toBe(method==='post'?201:200);
    expect(rpc.mock.calls.at(-1)[1]).toMatchObject({ p_home_id: 'home', p_actor_id: 'actor', p_kind: kind,
      p_payload: method==='delete'?{}:request.body });
    if (method!=='delete') expect(res.body[kind]).toEqual(record);
  }
});
test.each(['get','post','put'])('%s denial never reads or writes a raw task table', async method => {
  db.setRpcMock(async () => ({ data: { ok: false, code: 'HOME_RECORD_DENIED', status: 403 } }));
  const from = jest.spyOn(db,'from'); const res=response();
  await handler(home,method,'/:id/tasks'+(['put','delete'].includes(method)?'/:recordId':''))(request,res);
  expect(res.statusCode).toBe(403); expect(from).not.toHaveBeenCalled(); from.mockRestore();
});
test('RSVP binds self and exact event; supplied target cannot replace authenticated actor', async () => {
  const rpc=jest.fn(async()=>({data:{ok:true,attendee:{user_id:'actor',rsvp_status:'going'}}}));db.setRpcMock(rpc);
  const res=response();await handler(home,'post','/:id/events/:eventId/rsvp')({...request,body:{status:'going',user_id:'forged'}},res);
  expect(rpc.mock.calls[0][1]).toMatchObject({p_actor_id:'actor',p_record_id:'record',p_action:'rsvp'});
  expect(res.body.attendee.user_id).toBe('actor');
});
test('mail status/due updates use canonical values and do not permit a raw ID-only update',async()=>{
  const rpc=jest.fn(async()=>({data:{ok:true,record:{...record,status:'done'}}}));db.setRpcMock(rpc);
  const res=response();await handler(mail,'patch','/tasks/:id')({...request,params:{id:'record'},body:{status:'completed',dueAt:null}},res);
  expect(rpc).toHaveBeenCalledWith('mutate_home_task_by_id',{p_actor_id:'actor',p_task_id:'record',p_action:'update',p_payload:{status:'done',due_at:null}});
  expect(res.body.task.status).toBe('completed');
});
test('mail conversion binds immutable source and selected Home atomically',async()=>{
  const rpc=jest.fn(async()=>({data:{ok:true,record}}));db.setRpcMock(rpc);const res=response();
  await handler(mail,'post','/tasks/from-mail')({...request,body:{homeId:'home',mailId:'mail',title:'Exact task',priority:'medium'}},res);
  expect(rpc).toHaveBeenCalledTimes(1);expect(rpc.mock.calls[0][1]).toMatchObject({p_home_id:'home',p_actor_id:'actor',p_source_mail_id:'mail',p_action:'create'});
  expect(db.getTable('HomeTask')).toHaveLength(0);
});
test.each([['post','/tasks/:id/to-gig',mail,'HOME_TASK_GIG_FLOW_REQUIRED']])('%s %s exposes the explicit authorized prerequisite without writes',async(method,path,router,code)=>{
  db.setRpcMock(async()=>({data:{ok:false,code,status:409}}));const from=jest.spyOn(db,'from');const res=response();
  await handler(router,method,path)(request,res);expect(res.statusCode).toBe(409);expect(res.body.code).toBe(code);
  expect(from).not.toHaveBeenCalled();from.mockRestore();
});
test.each([['get','/:id/tasks'],['post','/:id/tasks'],['put','/:id/events/:recordId']])('%s %s returns sanitized retryable transport failure',async(method,path)=>{
  db.setRpcMock(async()=>({error:{code:'55P03',message:'private database detail'}}));const res=response();
  await handler(home,method,path)(request,res);expect(res.statusCode).toBe(503);expect(res.body.error).not.toContain('private database detail');
});
test('successful assignment relies on its atomic database notice and never launches a second notification', async () => {
  const rpc=jest.fn(async()=>({data:{ok:true,record:{...record,assigned_to:'recipient'},notify_user_id:'recipient'}}));
  db.setRpcMock(rpc);
  const res=response();await handler(home,'post','/:id/tasks')(request,res);
  await new Promise(setImmediate);
  expect(res.statusCode).toBe(201);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls[0][0]).toBe('mutate_home_record');
  expect(notifications.notifyTaskAssigned).not.toHaveBeenCalled();
});

test('task deletion uses current retirement transaction before exact deletion and never raw tables',async()=>{
  const homeId='ddf10001-0000-4000-8000-000000000100',taskId='ddf10001-0000-4000-8000-000000000200',actorId='ddf10001-0000-4000-8000-000000000001';
  const rpc=jest.fn(async name=>({data:name==='retire_home_task_media_for_delete'
    ? {ok:true,home_id:homeId,task_id:taskId,cleanup:[]}: {ok:true,record:{id:taskId,home_id:homeId}}}));
  db.setRpcMock(rpc);const res=response();await handler(home,'delete','/:id/tasks/:recordId')({...request,params:{id:homeId,recordId:taskId},user:{id:actorId}},res);
  expect(res.statusCode).toBe(200);expect(rpc.mock.calls.map(call=>call[0])).toEqual(['retire_home_task_media_for_delete','delete_home_task_after_media']);
});
test('task cleanup denial never proceeds to deletion',async()=>{
  const rpc=jest.fn(async()=>({data:{ok:false,code:'HOME_RECORD_DENIED',status:403}}));db.setRpcMock(rpc);const res=response();
  await handler(home,'delete','/:id/tasks/:recordId')({...request,params:{id:'ddf10001-0000-4000-8000-000000000100',recordId:'ddf10001-0000-4000-8000-000000000200'},user:{id:'ddf10001-0000-4000-8000-000000000001'}},res);
  expect(res.statusCode).toBe(403);expect(rpc).toHaveBeenCalledTimes(1);
});

test.each([false,true])('empty task collection exposes exact server creation capability %s and current session',async canCreate=>{
  db.setRpcMock(async()=>({data:{ok:true,records:[],attendees:[],can_create:canCreate}}));
  const res=response();await handler(home,'get','/:id/tasks')(request,res);
  expect(res.statusCode).toBe(200);expect(res.body.tasks).toEqual([]);
  expect(res.body.collection_capabilities).toEqual({can_create:canCreate});
  expect(res.body.task_session).toEqual({actor_id:'actor',home_id:'home',session_scope:expect.stringMatching(/^[0-9a-f]{64}$/)});
  expect(res.headers['Cache-Control']).toBe('private, no-store');
  expect(JSON.stringify(res.body)).not.toContain('synthetic-unit');
});
test.each(['','/:recordId'])('stale task read scope blocks %s before database access',async suffix=>{
  const rpc=jest.fn();db.setRpcMock(rpc);const res=response();
  await handler(home,'get','/:id/tasks'+suffix)({...request,headers:{...request.headers,'x-pantopus-session-scope':'a'.repeat(64)}},res);
  expect(res.statusCode).toBe(409);expect(res.body.code).toBe('SESSION_SCOPE_CHANGED');expect(rpc).not.toHaveBeenCalled();
});
test('missing task collection creation capability is a retryable contract failure',async()=>{
  db.setRpcMock(async()=>({data:{ok:true,records:[],attendees:[]}}));const res=response();
  await handler(home,'get','/:id/tasks')(request,res);
  expect(res.statusCode).toBe(503);expect(res.body.code).toBe('HOME_RECORD_UNAVAILABLE');
});
