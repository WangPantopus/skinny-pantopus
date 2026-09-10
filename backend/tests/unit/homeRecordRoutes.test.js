const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/notificationService', () => ({ notifyTaskAssigned: jest.fn().mockResolvedValue(undefined) }));
const notifications = require('../../services/notificationService');
const home = require('../../routes/home');
const mail = require('../../routes/mailboxV2Phase3');
const upload = require('../../routes/upload');
function handler(router, method, path) {
  return router.stack.find(l => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle;
}
function response() { return { statusCode: 200, status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; return this; } }; }
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });
const record = { id: 'record', home_id: 'home', title: 'Exact record', media: [] };
const request = { params: { id: 'home', recordId: 'record', eventId: 'record', homeId: 'home', taskId: 'record' },
  user: { id: 'actor' }, query: {}, body: { description: null, actorId: 'forged' } };
test.each(['tasks','events'])('%s list and detail use the exact actor and current projection', async path => {
  const rpc = jest.fn(async () => ({ data: { ok: true, records: [record], attendees: [] } })); db.setRpcMock(rpc);
  for (const suffix of ['', '/:recordId']) {
    const res = response(); await handler(home, 'get', '/:id/'+path+suffix)(request,res);
    expect(res.statusCode).toBe(200);
    expect(rpc.mock.calls.at(-1)[0]).toBe('get_home_records');
    expect(rpc.mock.calls.at(-1)[1]).toMatchObject({ p_home_id: 'home', p_actor_id: 'actor', p_record_id: suffix ? 'record' : null });
  }
});
test.each([['tasks','task'],['events','event']])('%s mutations bind actor and preserve the response envelope', async (path, kind) => {
  const rpc = jest.fn(async () => ({ data: { ok: true, record } })); db.setRpcMock(rpc);
  for (const method of ['post','put','delete']) {
    const res = response(); await handler(home, method, '/:id/'+path+(method==='post'?'':'/:recordId'))(request,res);
    expect(res.statusCode).toBe(method==='post'?201:200);
    expect(rpc.mock.calls.at(-1)[1]).toMatchObject({ p_home_id: 'home', p_actor_id: 'actor', p_kind: kind,
      p_payload: method==='delete'?{}:request.body });
    if (method!=='delete') expect(res.body[kind]).toEqual(record);
  }
});
test.each(['get','post','put','delete'])('%s denial never reads or writes a raw task table', async method => {
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
test.each([['post','/tasks/:id/to-gig',mail,'HOME_TASK_GIG_FLOW_REQUIRED'],['post','/home-task-media/:homeId/:taskId',upload,'HOME_TASK_PRIVATE_STORAGE_REQUIRED']])('%s %s exposes the explicit authorized prerequisite without writes',async(method,path,router,code)=>{
  db.setRpcMock(async()=>({data:{ok:false,code,status:409}}));const from=jest.spyOn(db,'from');const res=response();
  await handler(router,method,path)(request,res);expect(res.statusCode).toBe(409);expect(res.body.code).toBe(code);
  expect(from).not.toHaveBeenCalled();from.mockRestore();
});
test('media read uses the exact readable task projection and never raw URLs',async()=>{
  const media=[{id:'media',available:false,availability_code:'HOME_TASK_MEDIA_REUPLOAD_REQUIRED'}];
  const rpc=jest.fn(async()=>({data:{ok:true,records:[{...record,media}],attendees:[]}}));db.setRpcMock(rpc);const res=response();
  await handler(upload,'get','/home-task-media/:homeId/:taskId')(request,res);
  expect(res.body).toEqual({media});expect(rpc.mock.calls[0][1]).toMatchObject({p_home_id:'home',p_actor_id:'actor',p_record_id:'record'});
});
test.each([['get','/:id/tasks'],['post','/:id/tasks'],['put','/:id/events/:recordId']])('%s %s returns sanitized retryable transport failure',async(method,path)=>{
  db.setRpcMock(async()=>({error:{code:'55P03',message:'private database detail'}}));const res=response();
  await handler(home,method,path)(request,res);expect(res.statusCode).toBe(503);expect(res.body.error).not.toContain('private database detail');
});
test.each([['other',false],['recipient',true]])('assignment notification rechecks current assignee %s and title',async(assignedTo,delivered)=>{
  const initial={...record,title:'Old title',assigned_to:'recipient'};
  const current={...record,title:'Current title',assigned_to:assignedTo};
  db.setRpcMock(async name=>({data:name==='mutate_home_record'
    ? {ok:true,record:initial,notify_user_id:'recipient'}
    : {ok:true,records:[current],attendees:[]}}));
  const res=response();await handler(home,'post','/:id/tasks')(request,res);
  await new Promise(setImmediate);
  expect(res.statusCode).toBe(201);
  if(delivered) expect(notifications.notifyTaskAssigned).toHaveBeenCalledWith(expect.objectContaining({
    assigneeUserId:'recipient',taskTitle:'Current title',homeId:'home',taskId:'record'}));
  else expect(notifications.notifyTaskAssigned).not.toHaveBeenCalled();
});
