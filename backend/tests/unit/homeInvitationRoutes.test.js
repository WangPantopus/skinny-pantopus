const db=require('../__mocks__/supabaseAdmin');
jest.mock('../../services/notificationService',()=>({notifyHouseholdAccessRequest:jest.fn(),notifyHouseholdAccessRequestRejected:jest.fn(),notifyHomeInvite:jest.fn(),notifyHomeInviteAccepted:jest.fn()}));
jest.mock('../../services/emailService',()=>({sendHomeInviteEmail:jest.fn(async()=>({success:false}))}));
const notifications=require('../../services/notificationService');
const router=require('../../routes/home');
const config=require('../../config/householdClaims');
const paths=[['/:id/invite','create'],['/:id/request-household-from-owner','request'],
 ['/:id/household-access-requests/:requestId/approve','approve_request'],['/:id/household-access-requests/:requestId/reject','reject_request']];
function handler(path,method='post'){return router.stack.find(l=>l.route?.path===path&&l.route.methods[method]).route.stack.at(-1).handle;}
function response(){return{statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
const req={params:{id:'home',requestId:'exact-request',invitationId:'exact-invite',token:'exact-token'},query:{},user:{id:'actor'},
 body:{requested_identity:'guest',actorId:'forged',targetId:'forged'}};
beforeEach(()=>{db.resetTables();jest.clearAllMocks();config.flags.inviteMerge=false;});
test.each(paths)('%s binds authenticated actor and stored request source',async(path,action)=>{
 const rpc=jest.fn(async(_name,args)=>({data:{ok:true,replayed:false,notify_user_ids:['owner'],
  invitation:{id:'invite',token:args.p_token},target_id:'recipient'}}));db.setRpcMock(rpc);
 const res=response();await handler(path)(req,res);
 expect(res.statusCode).toBe(action==='create'?201:200);
 expect(rpc).toHaveBeenCalledTimes(1);
 expect(rpc.mock.calls[0][0]).toBe('write_home_invitation');
 expect(rpc.mock.calls[0][1]).toMatchObject({p_home_id:'home',p_actor_id:'actor',p_action:action});
 expect(rpc.mock.calls[0][1].p_payload).toEqual(action==='create'?req.body:action==='request'?{requested_identity:'guest'}:{request_id:'exact-request'});
 expect(db.getTable('HomeInvite')).toHaveLength(0);expect(db.getTable('HomeOccupancy')).toHaveLength(0);
});
test.each(paths)('%s keeps unavailable authorization retryable without sending notifications',async(path)=>{
 db.setRpcMock(async()=>({error:{code:'55P03'}}));const res=response();await handler(path)(req,res);
 expect(res.statusCode).toBe(503);expect(res.body.code).toBe('INVITE_UNAVAILABLE');
 for(const mock of Object.values(notifications))expect(mock).not.toHaveBeenCalled();
});
test('request list binds current actor/home/filter and hides backend failure details',async()=>{
 const rpc=jest.fn(async()=>({data:{ok:true,requests:[{id:'request'}]}}));db.setRpcMock(rpc);
 const res=response();await handler('/:id/household-access-requests','get')({...req,query:{status:'APPROVED'}},res);
 expect(res.body.requests).toEqual([{id:'request'}]);
 expect(rpc).toHaveBeenCalledWith('list_home_household_requests',{p_home_id:'home',p_actor_id:'actor',p_status:'approved'});
});
test.each(['/invitations/:invitationId/accept','/invitations/token/:token/accept'])(
 'disabled claim-merge flag in %s cannot fall through to ordinary owner admission',async path=>{
 db.setRpcMock(async()=>({data:{ok:true,kind:'claim_merge',invitation:{id:'invite',proposed_role:'owner'}}}));
 const res=response();await handler(path)(req,res);
 expect(res.statusCode).toBe(409);expect(db.getTable('HomeOccupancy')).toHaveLength(0);
 expect(notifications.notifyHomeInviteAccepted).not.toHaveBeenCalled();
});
