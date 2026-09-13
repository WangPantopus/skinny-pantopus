const db = require('../__mocks__/supabaseAdmin');
jest.mock('../../services/notificationService',()=>({notifyHomeInvite:jest.fn(),notifyHomeInviteAccepted:jest.fn()}));
const notifications=require('../../services/notificationService');
const service=require('../../services/homeClaimMergeService');
const accepted={ok:true,replayed:false,homeId:'home',claimId:'claim',invitation:{id:'invite'},
 occupancy:{id:'occupancy',home_id:'home',user_id:'actor',role_base:'owner'},acceptedRoleBase:'owner',acceptedAsOwner:true,
 claimPhaseV2:'verified',terminalReason:'none',mergedIntoClaimId:null,homeResolutionState:'verified_household',
 inviter_id:'inviter',actor_name:'Claimant',home_label:'Home'};
beforeEach(()=>{db.resetTables();jest.clearAllMocks();notifications.notifyHomeInvite.mockResolvedValue(undefined);
 notifications.notifyHomeInviteAccepted.mockResolvedValue(undefined);});
test('issue binds exact current claim and actor; raw token is only used for post-commit delivery',async()=>{
 const rpc=jest.fn(async(_name,args)=>({data:{ok:true,replayed:false,homeId:'home',claimId:'claim',
  invitation:{id:'invite',invitee_user_id:'recipient',proposed_role_base:'owner'},token:args.p_token,
  actor_name:'Owner',home_label:'Home'}}));db.setRpcMock(rpc);
 const result=await service.issueClaimInvitation({homeId:'home',claimId:'claim',userId:'actor',note:'Exact claimant'});
 expect(rpc).toHaveBeenCalledTimes(1);
 expect(rpc).toHaveBeenCalledWith('mutate_home_claim_invitation',{p_home_id:'home',p_claim_id:'claim',p_actor_id:'actor',
  p_action:'issue',p_invitation_id:null,p_token:expect.stringMatching(/^[a-f0-9]{64}$/),p_note:'Exact claimant',p_validity_days:365});
 expect(result).not.toHaveProperty('token');
 expect(notifications.notifyHomeInvite).toHaveBeenCalledWith({inviteeUserId:'recipient',inviterName:'Owner',homeName:'Home',
  homeId:'home',inviteToken:rpc.mock.calls[0][1].p_token});
});
test('accept binds exact invitation, ignoring an untrusted old snapshot and avoiding local writes',async()=>{
 const rpc=jest.fn(async()=>({data:accepted}));db.setRpcMock(rpc);const from=jest.spyOn(db,'from');
 await expect(service.acceptClaimMerge({homeId:'home',claimId:'claim',userId:'actor',invitationId:'invite',
  invite:{id:'wrong',home_id:'foreign',proposed_role:'owner'}})).resolves.toMatchObject({acceptedAsOwner:true});
 expect(rpc).toHaveBeenCalledTimes(1);
 expect(rpc).toHaveBeenCalledWith('mutate_home_claim_invitation',{p_home_id:'home',p_claim_id:'claim',p_actor_id:'actor',
  p_action:'accept',p_invitation_id:'invite',p_token:null,p_note:null,p_validity_days:365});
 expect(from).not.toHaveBeenCalled();from.mockRestore();
});
test.each([
 null,{}, {ok:true}, {...accepted,homeId:'other'}, {...accepted,claimId:'other'},
 {...accepted,occupancy:{...accepted.occupancy,user_id:'other'}},
 {...accepted,occupancy:{...accepted.occupancy,home_id:'other'}},
 {...accepted,acceptedRoleBase:'unknown'}, {...accepted,acceptedAsOwner:false},
 {...accepted,claimPhaseV2:'merged_into_household'}, {...accepted,terminalReason:'merged_via_invite'},
 {ok:false,code:'toString',status:403},{ok:false,code:'private detail',status:409}
])('invalid transaction receipt remains retryable and does not notify (%#)',async data=>{
 db.setRpcMock(async()=>({data}));
 await expect(service.acceptClaimMerge({homeId:'home',claimId:'claim',userId:'actor'}))
  .rejects.toMatchObject({statusCode:503,code:'CLAIM_MERGE_UNAVAILABLE'});
 expect(notifications.notifyHomeInviteAccepted).not.toHaveBeenCalled();
});
test.each(['OWNERSHIP_MANAGE_REQUIRED','OWNER_INVITE_AUTHORITY_REQUIRED','CLAIM_RECIPIENT_MISMATCH',
 'PROPOSED_ROLE_FORBIDDEN','PERMISSION_DELEGATION_FORBIDDEN'])('effective %s denial stays denied',async code=>{
 db.setRpcMock(async()=>({data:{ok:false,code,status:403}}));
 await expect(service.acceptClaimMerge({homeId:'home',claimId:'claim',userId:'actor'})).rejects.toMatchObject({code,statusCode:403});
});
test.each(['55P03','XX000','23505'])('database %s is private and retryable without compensation',async code=>{
 db.setRpcMock(async()=>({error:{code,message:'private evidence location'}}));const from=jest.spyOn(db,'from');
 await expect(service.acceptClaimMerge({homeId:'home',claimId:'claim',userId:'actor'}))
  .rejects.toMatchObject({statusCode:503,code:'CLAIM_MERGE_UNAVAILABLE'});
 expect(from).not.toHaveBeenCalled();from.mockRestore();
});
test('transport failure never resumes old multi-write acceptance',async()=>{
 db.setRpcMock(async()=>{throw new Error('private transport state');});
 await expect(service.acceptClaimMerge({homeId:'home',claimId:'claim',userId:'actor'}))
  .rejects.toMatchObject({statusCode:503,code:'CLAIM_MERGE_UNAVAILABLE'});
});
test('committed acceptance notification failure does not invent rollback',async()=>{
 db.setRpcMock(async()=>({data:accepted}));notifications.notifyHomeInviteAccepted.mockRejectedValue(new Error('unavailable'));
 await expect(service.acceptClaimMerge({homeId:'home',claimId:'claim',userId:'actor'})).resolves.toEqual(accepted);
});
test('acceptance retry does not repeat notifications or writes',async()=>{
 db.setRpcMock(async()=>({data:{...accepted,replayed:true}}));
 await service.acceptClaimMerge({homeId:'home',claimId:'claim',userId:'actor'});
 expect(notifications.notifyHomeInviteAccepted).not.toHaveBeenCalled();
});
test('issue retry does not try to recover a stored raw token or notify again',async()=>{
 db.setRpcMock(async()=>({data:{ok:true,replayed:true,homeId:'home',claimId:'claim',invitation:{id:'invite',invitee_user_id:'recipient'}}}));
 await service.issueClaimInvitation({homeId:'home',claimId:'claim',userId:'actor'});
 expect(notifications.notifyHomeInvite).not.toHaveBeenCalled();
});

test('receipt for another invitation cannot confirm the requested acceptance',async()=>{
 db.setRpcMock(async()=>({data:accepted}));
 await expect(service.acceptClaimMerge({homeId:'home',claimId:'claim',userId:'actor',invitationId:'other-invite'}))
  .rejects.toMatchObject({code:'CLAIM_MERGE_UNAVAILABLE',statusCode:503});
 expect(notifications.notifyHomeInviteAccepted).not.toHaveBeenCalled();
});
