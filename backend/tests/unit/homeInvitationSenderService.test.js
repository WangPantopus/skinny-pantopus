const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/emailService', () => ({ sendHomeInviteEmail:jest.fn() }));
jest.mock('../../services/notificationService', () => ({ notifyHomeInvite:jest.fn() }));
const service = require('../../services/homeInvitationSenderService');
const invitations = require('../../services/homeInvitationService');
const email = require('../../services/emailService');
const notifications = require('../../services/notificationService');
const id = n => `deadbeef-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actorId=id(1),requestId=id(2),home=id(3),invite=id(4),token='a'.repeat(64),decision='b'.repeat(64);
const intent={home_id:home,action:'create',payload:{user_id:id(5),relationship:'member'},decision_token:decision};
const original={actorId,requestId,token,intent};
const receipt=()=>({ok:true,state:'completed',home_id:home,invitation_id:invite,action:'create',decision_token:decision,
 command:{actor_id:actorId,request_id:requestId,created_at:'2026-09-12T00:00:00Z',updated_at:'2026-09-12T00:00:00Z'},
 delivery:{email:'unconfirmed',in_app:'unconfirmed'},code:null,status:null,replayed:false});
beforeEach(()=>{db.resetTables();jest.clearAllMocks();});
test('saved creation remains completed when delivery claim fails',async()=>{
 const rpc=jest.fn(async name=>{if(name==='resolve_home_invitation_sender')return {data:receipt()};throw Error('private unavailable');});db.setRpcMock(rpc);
 await expect(service.resolve(original)).resolves.toMatchObject({state:'completed',delivery:{email:'unconfirmed'}});
 expect(rpc).toHaveBeenCalledWith('resolve_home_invitation_sender',{p_actor_id:actorId,p_request_id:requestId,p_token:token,p_intent:intent,p_cancel:false});
 expect(email.sendHomeInviteEmail).not.toHaveBeenCalled();
});
test('replay and read never re-dispatch notifications',async()=>{
 const rpc=jest.fn(async()=>({data:{...receipt(),replayed:true}}));db.setRpcMock(rpc);
 await service.resolve(original);await service.read({actorId,requestId});expect(rpc.mock.calls.map(c=>c[0])).toEqual(['resolve_home_invitation_sender','get_home_invitation_sender']);
});
test.each(['token','home_id','command','delivery','decision_token'])('malformed %s result fails closed',async key=>{
 const r=receipt();if(key==='token')r.action='withdraw';else r[key]='malformed';db.setRpcMock(async()=>({data:r}));
 await expect(service.read({actorId,requestId})).rejects.toMatchObject({code:'INVITE_UNAVAILABLE',statusCode:503});
});
test('cancel forwards exact original without dispatch',async()=>{
 const rpc=jest.fn(async()=>({data:{...receipt(),state:'cancelled',invitation_id:null,delivery:{email:'not_requested',in_app:'not_requested'}}}));db.setRpcMock(rpc);
 await service.resolve({...original,cancel:true});expect(rpc).toHaveBeenCalledTimes(1);expect(rpc.mock.calls[0][1].p_cancel).toBe(true);
});
test('withdraw requires null token and exact target identity',async()=>{
 db.setRpcMock(async()=>({data:receipt()}));await expect(service.resolve({...original,intent:{home_id:home,invitation_id:invite,action:'withdraw',decision_token:decision}})).rejects.toMatchObject({code:'INVITE_INVALID'});
});
test('historical response strips private unexpected fields',()=>{
 const res={set:jest.fn().mockReturnThis(),status:jest.fn().mockReturnThis(),json:jest.fn()};
 service.send(res,{...receipt(),token:'private',payload:{email:'private'},invitation:{token:'private'}},{actor_id:actorId,session_scope:decision});
 expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('private');expect(res.status).toHaveBeenCalledWith(201);
});
test.each([
 [{success:true},{id:id(6),user_id:id(5)},'provider_accepted','saved'],
 [{success:true,preview:true},null,'unconfirmed','unconfirmed'],
 [{success:false},{id:id(6),user_id:id(7)},'unconfirmed','unconfirmed'],
])('delivery accepts only provider and matching persisted row proof',async(e,n,expectedEmail,expectedApp)=>{
 email.sendHomeInviteEmail.mockResolvedValue(e);notifications.notifyHomeInvite.mockResolvedValue(n);
 const result=await invitations.notifySenderDelivery({delivery_email:'synthetic@example.invalid',invitation:{id:invite,home_id:home,invitee_user_id:id(5),proposed_role:'member',token}});
 expect(result).toEqual({email:expectedEmail,in_app:expectedApp});
});
test('delivery outcome write failure never replaces completed receipt',async()=>{
 const rpc=jest.fn(async name=>{if(name==='resolve_home_invitation_sender')return {data:receipt()};if(name==='claim_home_invitation_sender_delivery')return {data:{ok:true,dispatch:true,invitation:{id:invite,home_id:home,token}}};throw Error('lost outcome');});db.setRpcMock(rpc);
 await expect(service.resolve(original)).resolves.toMatchObject({state:'completed',delivery:{email:'unconfirmed'}});
});
test('current sender list keeps only matching safe recipient identity',async()=>{
 const row={id:invite,home_id:home,status:'pending',invitee_user_id:id(5),token:'private',admission_policy:{private:true},invitee:{id:id(5),username:'fixture',name:'Fixture',private_email:'private'}};
 const rpc=jest.fn(async()=>({data:{ok:true,invitations:[row]}}));db.setRpcMock(rpc);
 const result=await service.list({actorId,homeId:home});expect(result[0].invitee).toEqual({id:id(5),username:'fixture',name:'Fixture'});
 expect(JSON.stringify(result)).not.toContain('private');expect(rpc).toHaveBeenCalledWith('list_home_invitation_sender',{p_actor_id:actorId,p_home_id:home});
});
test('mismatched sender recipient identity fails closed',async()=>{
 db.setRpcMock(async()=>({data:{ok:true,invitations:[{id:invite,home_id:home,status:'pending',invitee_user_id:id(5),invitee:{id:id(6),username:'fixture',name:'Fixture'}}]}}));
 await expect(service.list({actorId,homeId:home})).rejects.toMatchObject({code:'INVITE_UNAVAILABLE'});
});
