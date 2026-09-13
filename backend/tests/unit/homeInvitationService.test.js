const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/emailService', () => ({ sendHomeInviteEmail: jest.fn() }));
jest.mock('../../services/notificationService', () => ({ notifyHomeInvite: jest.fn(), notifyHomeInviteAccepted: jest.fn() }));
const email = require('../../services/emailService');
const notifications = require('../../services/notificationService');
const service = require('../../services/homeInvitationService');
beforeEach(() => { db.resetTables(); jest.clearAllMocks(); });

test.each(['create','approve_request'])('%s generates one raw token and binds exact actor and request', async action => {
 const rpc = jest.fn(async (_name,args) => ({ data: { ok:true,replayed:false,invitation:{id:'invite',token:args.p_token} } }));
 db.setRpcMock(rpc);
 const payload={ request_id:'request' };
 const result=await service.write({homeId:'home',actorId:'actor',action,payload});
 expect(result.invitation.token).toMatch(/^[a-f0-9]{64}$/);
 expect(rpc).toHaveBeenCalledTimes(1);
 expect(rpc).toHaveBeenCalledWith('write_home_invitation',{
  p_home_id:'home',p_actor_id:'actor',p_action:action,p_payload:payload,p_token:result.invitation.token });
});
test.each(['accept','decline','preview'])('%s uses exactly one current actor/selector RPC',async action=>{
 const result={ok:true,replayed:false,homeId:'home',occupancy:{id:'occupancy'},invitation:{id:'invite'}};
 const rpc=jest.fn(async()=>({data:result}));db.setRpcMock(rpc);
 await service.act({actorId:'actor',token:'raw-token',action});
 expect(rpc).toHaveBeenCalledWith('act_on_home_invitation',{
  p_actor_id:'actor',p_invite_id:null,p_token:'raw-token',p_action:action,p_validity_days:365 });
 expect(rpc).toHaveBeenCalledTimes(1);
});
test('list binds received versus issued invitation scope',async()=>{
 const rpc=jest.fn(async()=>({data:{ok:true,invitations:[]}}));db.setRpcMock(rpc);
 await service.list('actor','home');
 expect(rpc).toHaveBeenCalledWith('list_home_invitations',{p_actor_id:'actor',p_home_id:'home'});
});
test.each([null,{}, {ok:true}, {ok:false,code:'toString',status:403}, {ok:false,code:'private detail',status:403}])(
 'malformed or unknown permission state fails closed with retryable response',async data=>{
 db.setRpcMock(async()=>({data}));
 const from=jest.spyOn(db,'from');
 await expect(service.list('actor')).rejects.toMatchObject({code:'INVITE_UNAVAILABLE',statusCode:503});
 expect(from).not.toHaveBeenCalled();from.mockRestore();
});
test.each(['MEMBERS_MANAGE_REQUIRED','INVITER_ACCESS_CHANGED','INVITE_EMAIL_MISMATCH'])(
 'known %s denial stays denied without direct table fallback',async code=>{
 db.setRpcMock(async()=>({data:{ok:false,code,status:403}}));
 await expect(service.act({actorId:'actor',token:'raw',action:'accept'})).rejects.toMatchObject({code,statusCode:403});
});
test.each(['55P03','XX000'])( 'database %s is retryable and hides internal details',async code=>{
 db.setRpcMock(async()=>({error:{code,message:'confidential internal detail'}}));
 await expect(service.list('actor')).rejects.toMatchObject({code:'INVITE_UNAVAILABLE',statusCode:503});
});
test('transport failure is retryable',async()=>{
 db.setRpcMock(async()=>{throw new Error('confidential transport detail');});
 await expect(service.list('actor')).rejects.toMatchObject({code:'INVITE_UNAVAILABLE',statusCode:503});
});
const created={replayed:false,invitation:{id:'invite',token:'raw',home_id:'home',proposed_role:'member',invitee_user_id:'recipient'},
 delivery_email:'synthetic@example.invalid',actor_name:'Inviter',home_label:'Home'};
test.each([[{success:true},true],[{success:false,error:'EMAIL_UNAVAILABLE'},false],[{success:true,preview:true},false],[undefined,false]])(
 'email delivery %j is reported truthfully',async(delivery,expected)=>{
 email.sendHomeInviteEmail.mockResolvedValue(delivery);
 await expect(service.notifyCreated(created)).resolves.toBe(expected);
 expect(notifications.notifyHomeInvite).toHaveBeenCalledWith(expect.objectContaining({inviteeUserId:'recipient',inviteToken:'raw'}));
});
test('post-commit notification failure does not undo invitation or claim successful email',async()=>{
 email.sendHomeInviteEmail.mockRejectedValue(new Error('smtp unavailable'));
 notifications.notifyHomeInvite.mockRejectedValue(new Error('push unavailable'));
 await expect(service.notifyCreated(created)).resolves.toBe(false);
});
test('exact request retry does not send duplicate notifications',async()=>{
 await expect(service.notifyCreated({replayed:true})).resolves.toBe(false);
 expect(email.sendHomeInviteEmail).not.toHaveBeenCalled();expect(notifications.notifyHomeInvite).not.toHaveBeenCalled();
});
