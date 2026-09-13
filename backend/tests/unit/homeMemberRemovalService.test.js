jest.mock('../../utils/homePermissions',()=>({getActiveOccupancy:jest.fn()}));
jest.mock('../../services/notificationService',()=>({createBulkNotifications:jest.fn()}));
const db=require('../__mocks__/supabaseAdmin');
const service=require('../../services/homeMemberRemovalService');
const express=require('express'),request=require('supertest');
const router=require('../../routes/homeMemberRemovals');
const scope=require('../../utils/requestSessionScope');
const id=n=>`ddc26300-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=id(1),target=id(2),home=id(100),occupancy=id(200),requestId=id(500),decision='a'.repeat(64);
const intent={home_id:home,target_user_id:target,occupancy_id:occupancy,action:'remove',decision_token:decision};
const receipt=()=>({ok:true,state:'completed',...intent,completed_at:'2026-09-13T10:00:00Z',code:null,status:null,replayed:false,
 command:{actor_id:actor,request_id:requestId,created_at:'2026-09-13T10:00:00Z',updated_at:'2026-09-13T10:00:00Z'}});
const context=()=>({ok:true,...intent,home:{id:home,name:'Home'},target:{id:target,name:null,username:'member',role_base:'member',is_self:false,is_active:true,
 verification_status:'verified',start_at:null,end_at:null,access_start_at:null,access_end_at:null}});
const app=express();app.use(express.json());app.use('/api/homes/member-removals',router);
const session=scope.getRequestSessionScope({user:{id:actor},headers:{authorization:'Bearer synthetic-unit-only'}});
const http=(method,path)=>request(app)[method]('/api/homes/member-removals'+path).set('Authorization','Bearer synthetic-unit-only')
 .set('x-test-user-id',actor).set('x-pantopus-session-scope',session.session_scope);
beforeEach(()=>{db.resetTables();jest.clearAllMocks();});
test('exact original and cancellation bind only the authenticated actor',async()=>{
 const rpc=jest.fn(async()=>({data:receipt(),error:null}));db.setRpcMock(rpc);
 await service.resolve({actorId:actor,requestId,intent});await service.resolve({actorId:actor,requestId,intent,cancel:true});
 expect(rpc.mock.calls.map(c=>c[1])).toEqual([false,true].map(p_cancel=>({p_actor_id:actor,p_request_id:requestId,p_intent:intent,p_cancel})));
});
test('saved result survives a lost SQL reply through independent historical read',async()=>{
 const rpc=jest.fn(async name=>{if(name==='resolve_home_member_removal')throw Error('private upstream failure');return {data:receipt()};});db.setRpcMock(rpc);
 await expect(service.resolve({actorId:actor,requestId,intent})).rejects.toMatchObject({code:'MEMBER_REMOVAL_UNAVAILABLE',statusCode:503});
 await expect(service.read({actorId:actor,requestId})).resolves.toMatchObject({state:'completed'});
 expect(rpc.mock.calls.map(c=>c[0])).toEqual(['resolve_home_member_removal','get_home_member_removal']);
});
test.each([null,[],false,{}, {...intent,extra:'field'}, {...intent,action:['remove']},{...intent,decision_token:['a'.repeat(64)]},
 {...intent,occupancy_id:[]},{...intent,target_user_id:null}])('invalid original never reaches SQL: %j',async value=>{
 const rpc=jest.fn();db.setRpcMock(rpc);await expect(service.resolve({actorId:actor,requestId,intent:value})).rejects.toMatchObject({code:'MEMBER_REMOVAL_INVALID'});expect(rpc).not.toHaveBeenCalled();
});
test.each([
 r=>{r.state=['completed'];},r=>{r.action=['remove'];},r=>{r.decision_token=[decision];},r=>{r.home_id=id(999);},r=>{r.target_user_id=id(999);},
 r=>{r.occupancy_id=id(999);},r=>{r.command.actor_id=id(999);},r=>{r.command.request_id=id(999);},r=>{r.completed_at=null;},
 r=>{r.completed_at='yesterday';},r=>{r.state='cancelled';},r=>{r.state='rejected';r.code='MEMBER_REMOVAL_CHANGED';r.status=403;r.completed_at=null;},
 r=>{r.state='rejected';r.code='MEMBER_REMOVAL_INVALID';r.status=400;r.completed_at=null;},r=>{r.replayed='false';},r=>{r.status=200;},
])('malformed/misbound proof leaves the original unresolved',async change=>{
 const r=receipt();change(r);db.setRpcMock(async()=>({data:r}));await expect(service.resolve({actorId:actor,requestId,intent})).rejects.toMatchObject({code:'MEMBER_REMOVAL_UNAVAILABLE'});
});
test.each(Object.entries(service.REJECTIONS))('durable %s retains exact status %s',async(code,status)=>{
 db.setRpcMock(async()=>({data:{...receipt(),state:'rejected',completed_at:null,code,status}}));
 const r=await http('post','/commands').send({request_id:requestId,...intent});expect(r.status).toBe(status);expect(r.body).toMatchObject({state:'rejected',code,status,session});
});
test('history strips unexpected credentials and private target metadata',async()=>{
 db.setRpcMock(async()=>({data:{...receipt(),private_token:'SECRET_SENTINEL',target:{name:'SECRET_SENTINEL'},command:{...receipt().command,secret:'SECRET_SENTINEL'}}}));
 const r=await http('get','/commands/'+requestId);expect(r.status).toBe(200);expect(JSON.stringify(r.body)).not.toContain('SECRET_SENTINEL');expect(r.body.session).toEqual(session);
});
test('prepared identity is username-only and binds the current exact target',async()=>{
 const r=context();r.target.email='SECRET_SENTINEL';r.home.secret='SECRET_SENTINEL';db.setRpcMock(async()=>({data:r}));
 const result=await service.prepare({actorId:actor,intent:{home_id:home,target_user_id:target}});expect(result.target.name).toBeNull();expect(result.target.username).toBe('member');expect(JSON.stringify(result)).not.toContain('SECRET_SENTINEL');
});
test.each([r=>{r.target.name='Private legal name';},r=>{r.target.id=id(9);},r=>{r.target.is_self='false';},r=>{r.target.is_active=null;},
 r=>{r.target.role_base=['member'];},r=>{r.target.role_base=null;},r=>{r.target.start_at='infinity';},r=>{r.action=['remove'];},r=>{r.home.id=id(9);},
])('malformed/private prepared context fails closed',async change=>{
 const r=context();change(r);db.setRpcMock(async()=>({data:r}));await expect(service.prepare({actorId:actor,intent:{home_id:home,target_user_id:target}})).rejects.toMatchObject({code:'MEMBER_REMOVAL_UNAVAILABLE'});
});
test('fresh session exists without current Home access and missing scope cannot dispatch',async()=>{
 const rpc=jest.fn();db.setRpcMock(rpc);const r=await http('get','/session');expect(r.body.session).toEqual(session);
 const rejected=await request(app).post('/api/homes/member-removals/commands').set('x-test-user-id',actor).send({request_id:requestId,...intent});
 expect(rejected.status).toBe(409);expect(rejected.body.code).toBe('SESSION_SCOPE_CHANGED');expect(rpc).not.toHaveBeenCalled();
});
test.each([['MEMBER_REMOVAL_NOT_FOUND',404,'unknown'],['MEMBER_REMOVAL_ACCOUNT_UNAVAILABLE',403,'error'],['MEMBER_REMOVAL_CONFLICT',409,'error']])(
 'nonreceipt %s never pretends to resolve the original',async(code,status,state)=>{
 db.setRpcMock(async()=>({data:{ok:false,code,status}}));const r=await http('get','/commands/'+requestId);
 expect(r.status).toBe(status);expect(r.body.state).toBe(state);expect(r.body).not.toHaveProperty('command');expect(r.body.session).toEqual(session);
});
test('invalid upstream error shape and errors with private messages become generic unavailable',async()=>{
 db.setRpcMock(async()=>({data:{ok:false,code:['MEMBERS_MANAGE_REQUIRED'],status:403,error:'SECRET_SENTINEL'}}));
 const r=await http('post','/context').send({home_id:home,target_user_id:target});expect(r.status).toBe(503);expect(r.body.state).toBe('error');expect(JSON.stringify(r.body)).not.toContain('SECRET_SENTINEL');
});
test('cancel retains exact intent without a mutation callback or local substitute',async()=>{
 const rpc=jest.fn(async()=>({data:{...receipt(),state:'cancelled',completed_at:null}}));db.setRpcMock(rpc);
 const r=await http('post','/commands/'+requestId+'/cancel').send(intent);expect(r.status).toBe(200);expect(r.body.state).toBe('cancelled');
 expect(rpc).toHaveBeenCalledWith('resolve_home_member_removal',{p_actor_id:actor,p_request_id:requestId,p_intent:intent,p_cancel:true});
});

test.each([undefined,null,[],['bad'],''])('missing/malformed request UUID %j fails before SQL',async value=>{
 const rpc=jest.fn();db.setRpcMock(rpc);
 await expect(service.resolve({actorId:actor,requestId:value,intent})).rejects.toMatchObject({code:'MEMBER_REMOVAL_INVALID',statusCode:400});
 await expect(service.read({actorId:actor,requestId:value})).rejects.toMatchObject({code:'MEMBER_REMOVAL_INVALID',statusCode:400});
 const r=await http('post','/commands').send({...intent,...(value===undefined?{}:{request_id:value})});expect(r.status).toBe(400);expect(r.body.state).toBe('error');
 expect(rpc).not.toHaveBeenCalled();
});

const memberAccess=require('../../utils/homePermissions');
const notice=require('../../services/notificationService');
test('first committed self-leave rechecks candidates and emits only a generic current-member notice',async()=>{
 const selfIntent={...intent,target_user_id:actor};const value={...receipt(),...selfIntent,_notify_user_ids:[target,id(3),actor,target]};
 db.setRpcMock(async()=>({data:value}));memberAccess.getActiveOccupancy.mockImplementation(async(_home,user)=>user===target?{id:occupancy}:null);
 notice.createBulkNotifications.mockResolvedValue([]);
 const r=await service.resolve({actorId:actor,requestId,intent:selfIntent});
 expect(r.state).toBe('completed');expect(r._notify_user_ids).toBeUndefined();
 expect(memberAccess.getActiveOccupancy.mock.calls).toEqual([[home,target],[home,id(3)]]);
 expect(notice.createBulkNotifications).toHaveBeenCalledTimes(1);
 expect(notice.createBulkNotifications.mock.calls[0][0]).toEqual([{userId:target,type:'member_moved_out',title:'Household member left',body:'A household member left.',link:`/homes/${home}/occupants`,metadata:{home_id:home,moved_out_user_id:actor}}]);
});
test.each(['read','replay','cancel','other'])('history/cancel/other-target does not notify: %s',async mode=>{
 const selfIntent={...intent,target_user_id:mode==='other'?target:actor};
 db.setRpcMock(async()=>({data:{...receipt(),...selfIntent,replayed:mode==='replay',_notify_user_ids:[target]}}));
 if(mode==='read')await service.read({actorId:actor,requestId});else await service.resolve({actorId:actor,requestId,intent:selfIntent,cancel:mode==='cancel'});
 expect(memberAccess.getActiveOccupancy).not.toHaveBeenCalled();expect(notice.createBulkNotifications).not.toHaveBeenCalled();
});
test.each(['access','transport'])('notice %s failure preserves the committed receipt',async point=>{
 const selfIntent={...intent,target_user_id:actor};db.setRpcMock(async()=>({data:{...receipt(),...selfIntent,_notify_user_ids:[target]}}));
 memberAccess.getActiveOccupancy.mockImplementation(async()=>{if(point==='access')throw Error('unavailable');return {id:occupancy};});
 notice.createBulkNotifications.mockRejectedValue(Error('unavailable'));
 await expect(service.resolve({actorId:actor,requestId,intent:selfIntent})).resolves.toMatchObject({state:'completed'});
 if(point==='access')expect(notice.createBulkNotifications).not.toHaveBeenCalled();else expect(notice.createBulkNotifications).toHaveBeenCalledTimes(1);
});
