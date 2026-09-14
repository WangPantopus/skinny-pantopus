import apiClient from '../client';
export interface Session { actor_id: string; session_scope: string }
export type Role = 'owner' | 'admin' | 'manager' | 'lease_resident' | 'member' | 'restricted_member' | 'guest' | 'service_provider';
export interface Context {
  home_id: string; target_user_id: string; occupancy_id: string; action: 'remove'; decision_token: string;
  home: { id: string; name: string | null };
  target: { id: string; name: null; username: string | null; role_base: Role | null; is_self: boolean; is_active: boolean;
    verification_status: string | null; start_at: string | null; end_at: string | null; access_start_at: string | null; access_end_at: string | null };
  session: Session;
}
export interface Intent { home_id: string; target_user_id: string; occupancy_id: string; action: 'remove'; decision_token: string }
export interface Original extends Intent { request_id: string }
export const REJECTIONS = { MEMBER_REMOVAL_CHANGED:409, MEMBER_ALREADY_REMOVED:409, MEMBERS_MANAGE_REQUIRED:403,
  TARGET_RANK_FORBIDDEN:403, OWNERSHIP_FLOW_REQUIRED:409, TRANSFER_REQUIRED:409, MEMBER_ROLE_UNKNOWN:409, MEMBER_NOT_FOUND:404, HOME_NOT_FOUND:404 } as const;
export type RejectionCode = keyof typeof REJECTIONS;
interface ReceiptBase extends Intent {
  command: { actor_id: string; request_id: string; created_at: string; updated_at: string }; session: Session; replayed?: boolean;
}
export type Receipt = ReceiptBase & (
  { state:'completed'; completed_at:string; code:null; status:null }
  | { state:'pending' | 'cancelled'; completed_at:null; code:null; status:null }
  | { state:'rejected'; completed_at:null; code:RejectionCode; status:403 | 404 | 409 }
);
export interface RawResponse<T = unknown> { status: number; body: T }
const root='/api/homes/member-removals';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function headers(session:Session) {
  if(typeof session?.actor_id!=='string' || !uuid.test(session.actor_id) || typeof session.session_scope!=='string' || !/^[a-f0-9]{64}$/.test(session.session_scope)) {
    throw new Error('Reopen member removal to verify the current session.');
  }
  return {'Content-Type':'application/json','x-pantopus-session-scope':session.session_scope};
}
function commandPath(requestId:string) {
  if(typeof requestId!=='string' || !uuid.test(requestId)) throw new Error('The saved removal request ID is invalid.');
  return `${root}/commands/${requestId}`;
}
async function raw(method:'GET' | 'POST',url:string,session?:Session,exactBody?:string):Promise<RawResponse> {
  if(exactBody!==undefined && typeof exactBody!=='string') throw new Error('The saved removal body is unavailable.');
  const response=await apiClient.request<unknown>({method,url,data:exactBody,headers:session?headers(session):undefined,
    // Preserve the retained original bytes. Consumers validate status, session
    // and every original identity before interpreting this unknown response.
    ...(exactBody===undefined?{}:{transformRequest:[(value:string)=>value]}),validateStatus:()=>true,
  });
  return {status:response.status,body:response.data};
}
export const getSession=():Promise<RawResponse>=>raw('GET',`${root}/session`);
export const prepare=(input:Pick<Intent,'home_id' | 'target_user_id'>,session:Session):Promise<RawResponse>=>raw('POST',`${root}/context`,session,JSON.stringify(input));
export const read=(requestId:string,session:Session):Promise<RawResponse>=>raw('GET',commandPath(requestId),session);
export const submit=(exactBody:string,session:Session):Promise<RawResponse>=>raw('POST',`${root}/commands`,session,exactBody);
export const cancel=(requestId:string,exactIntentBody:string,session:Session):Promise<RawResponse>=>raw('POST',`${commandPath(requestId)}/cancel`,session,exactIntentBody);
