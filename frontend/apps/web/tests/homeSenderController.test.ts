import { webcrypto } from 'node:crypto';
import * as api from '@pantopus/api';
import { SenderController } from '../src/components/home/invitations/SenderController';
import { validSenderDraft, validSenderInput, validSenderInvitation, type SenderDraft } from '../src/components/home/invitations/senderModel';
import type { SenderSnapshot } from '../src/components/home/invitations/PendingSenderStore';
jest.mock('@pantopus/api',()=>({getApiBaseUrl:jest.fn(()=> 'http://127.0.0.1:18080'),getAuthToken:jest.fn(()=> 'synthetic'),
 AUTH_SESSION_CHANGE_KEY:'session-marker',apiClient:{get:jest.fn(),post:jest.fn(),request:jest.fn()},users:{getMyProfile:jest.fn()}}));
const actor='10000000-0000-4000-8000-000000000001',home='10000000-0000-4000-8000-000000000002',invite='10000000-0000-4000-8000-000000000003';
const session={actor_id:actor,session_scope:'a'.repeat(64)},decision='b'.repeat(64),input={home_id:home,action:'create' as const,payload:{email:'synthetic@example.invalid',relationship:'member',start_at:undefined,end_at:undefined}};
function memory(){let snapshot:SenderSnapshot|null=null,count=0;return {load:jest.fn(async()=>snapshot),save:jest.fn(async(draft:SenderDraft,expected:SenderSnapshot|null,current:()=>boolean)=>{
 if(!current()||(snapshot?.revision??null)!==(expected?.revision??null))throw Error('Changed');snapshot={draft:structuredClone(draft),revision:String(++count)};return snapshot; }),clear:jest.fn(async()=>{snapshot=null;})};}
const result=(d:SenderDraft)=>({state:'completed',home_id:home,action:d.action,invitation_id:invite,decision_token:decision,
 command:{actor_id:actor,request_id:d.request_id,created_at:'2026-09-12T12:00:00Z',updated_at:'2026-09-12T12:00:00Z'},delivery:{email:'unconfirmed',in_app:'not_requested'},session});
beforeEach(()=>{jest.clearAllMocks();localStorage.clear();Object.defineProperty(globalThis,'crypto',{configurable:true,value:webcrypto});
 Object.defineProperty(globalThis,'structuredClone',{configurable:true,value:(v:unknown)=>JSON.parse(JSON.stringify(v))});
 jest.mocked(api.apiClient.get).mockResolvedValue({data:{session}} as never);jest.mocked(api.users.getMyProfile).mockResolvedValue({id:actor,name:'Fixture'} as never);
 jest.mocked(api.apiClient.post).mockResolvedValue({data:{...input,decision_token:decision,invitation:null,session}} as never);
});
test('protected write failure blocks POST and requires re-opening the saved slot',async()=>{
 const store=memory(),c=new SenderController();await c.open(()=>store);await c.prepare(input);store.save.mockRejectedValueOnce(Error('Storage unavailable'));
 await expect(c.submit(decision)).rejects.toThrow('Storage unavailable');expect(api.apiClient.request).not.toHaveBeenCalled();expect(c.needsReload).toBe(true);
});
test('lost reply survives cold recovery and retries exact original bytes once',async()=>{
 const store=memory(),c=new SenderController();await c.open(()=>store);await c.prepare(input);jest.mocked(api.apiClient.request).mockRejectedValueOnce(Error('Lost reply'));
 await expect(c.submit(decision)).rejects.toThrow('result is not confirmed');const original=c.pending!;expect(validSenderDraft(original,c.origin,actor)).toBe(true);c.retire();
 const cold=new SenderController();await cold.open(()=>store);jest.mocked(api.apiClient.request).mockResolvedValueOnce({status:201,data:result(original)} as never);
 await cold.recover('retry');expect(jest.mocked(api.apiClient.request).mock.calls[1][0].data).toBe(original.request_json);
 expect(cold.canAcknowledge).toBe(true);await cold.recover('retry');expect(api.apiClient.request).toHaveBeenCalledTimes(2);
});
test('receipt storage repair does not post again and acknowledgement clears the original',async()=>{
 const store=memory(),c=new SenderController();await c.open(()=>store);await c.prepare(input);
 jest.mocked(api.apiClient.request).mockImplementation(async()=>{const d=c.pending!;store.save.mockRejectedValueOnce(Error('Receipt storage failed'));return {status:201,data:result(d)} as never;});
 await expect(c.submit(decision)).rejects.toThrow('Receipt storage failed');expect(c.canAcknowledge).toBe(false);
 await c.recover('retry');expect(api.apiClient.request).toHaveBeenCalledTimes(1);expect(c.canAcknowledge).toBe(true);
 await c.acknowledge(c.pending!.request_id);expect(await store.load()).toBeNull();
});
test('foreign success preserves original and changed session prevents dispatch',async()=>{
 const store=memory(),c=new SenderController();await c.open(()=>store);await c.prepare(input);
 jest.mocked(api.apiClient.request).mockImplementation(async()=>({status:201,data:{...result(c.pending!),home_id:actor}} as never));
 await expect(c.submit(decision)).rejects.toThrow('result is not confirmed');expect(c.pending?.outcome).toBeUndefined();
 jest.mocked(api.apiClient.get).mockResolvedValueOnce({data:{session:{...session,session_scope:'c'.repeat(64)}}} as never);
 await expect(c.recover('retry')).rejects.toThrow('session changed');expect(api.apiClient.request).toHaveBeenCalledTimes(1);
});
test('sharing rechecks current invitation eligibility without another command and retires on refresh',async()=>{
 const store=memory(),c=new SenderController();await c.open(()=>store);await c.prepare(input);
 jest.mocked(api.apiClient.request).mockImplementation(async()=>({status:201,data:result(c.pending!)} as never));await c.submit(decision);
 expect(c.shareToken).toBeNull();
 jest.mocked(api.apiClient.post).mockResolvedValueOnce({data:{home_id:home,action:'resend',decision_token:decision,session,
  invitation:{id:invite,home_id:home,status:'pending',expires_at:'2099-01-01T00:00:00Z'}}} as never);
 await c.checkShare(c.pending!.request_id);expect(c.shareToken).toBe(c.pending!.token);expect(api.apiClient.request).toHaveBeenCalledTimes(1);
 c.clearShare();expect(c.shareToken).toBeNull();jest.mocked(api.apiClient.post).mockRejectedValueOnce(Error('Current authority denied'));
 await expect(c.checkShare(c.pending!.request_id)).rejects.toThrow('could not be confirmed for sharing');expect(c.shareToken).toBeNull();
});
test('unavailable display profile does not prevent loading the original under a confirmed sender session',async()=>{
 jest.mocked(api.users.getMyProfile).mockRejectedValueOnce(Error('Profile unavailable'));const store=memory(),c=new SenderController();await c.open(()=>store);
 expect(c.opened).toBe(true);expect(store.load).toHaveBeenCalledTimes(1);expect(c.accountLabel).toBe('Your current account');
});

test('sender context rejects a malformed effective role instead of falling back to legacy role',()=>{
 expect(validSenderInvitation({id:invite,home_id:home,status:'pending',proposed_role:'member',proposed_role_base:5},home)).toBe(false);
});

test.each(['state','email','in_app'] as const)('malformed array %s cannot replace or acknowledge the protected original',async(field)=>{
 const store=memory(),c=new SenderController();await c.open(()=>store);await c.prepare(input);
 jest.mocked(api.apiClient.request).mockImplementation(async()=>{
  const receipt=result(c.pending!);
  return {status:201,data:field==='state'?{...receipt,state:['completed']}:
   {...receipt,delivery:{...receipt.delivery,[field]:[field==='email'?'provider_accepted':'saved']}}} as never;
 });
 await expect(c.submit(decision)).rejects.toThrow('result is not confirmed');
 const original=c.pending!;expect(original.outcome).toBeUndefined();expect(c.canAcknowledge).toBe(false);
 expect((await store.load())?.draft.request_json).toBe(original.request_json);
 jest.mocked(api.apiClient.request).mockResolvedValueOnce({status:200,data:result(original)} as never);
 await c.recover('status');expect(c.canAcknowledge).toBe(true);
 expect(c.pending!.request_json).toBe(original.request_json);
 expect(jest.mocked(api.apiClient.request).mock.calls[1][0].method).toBe('GET');
});

test('malformed action arrays cannot enter review as resend or withdrawal',()=>{
 for(const action of ['resend','withdraw'])expect(validSenderInput({home_id:home,invitation_id:invite,action:[action]})).toBe(false);
});
