import apiClient from '../client';

export interface Session { actor_id: string; session_scope: string }
/** A current pending queue reference, not an admission receipt or history. */
export interface Claim {
  id: string; home_id: string; user_id: string; status: 'pending'; created_at: string | null;
  claimed_role: 'renter' | 'household' | null;
  claimant: { id: string; username: string | null; name: null } | null;
}
export interface Response {
  home_id: string; actor_id: string; claims: Claim[];
  residency_session: Session & { home_id: string };
}
export interface RawResponse<T = unknown> { status: number; body: T }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function identity(value: string): string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new Error('Reload pending residency claims for the current Home.');
  return value.toLowerCase();
}
function headers(session: Session) {
  identity(session?.actor_id);
  if (typeof session?.session_scope !== 'string' || !/^[a-f0-9]{64}$/.test(session.session_scope)) {
    throw new Error('Reopen pending residency claims to check your signed-in session.');
  }
  return { 'Cache-Control': 'no-cache, no-store', 'x-pantopus-session-scope': session.session_scope };
}
export async function getSession(): Promise<RawResponse> {
  const response = await apiClient.request<unknown>({ method: 'GET', url: '/api/homes/residency-claims/session',
    headers: { 'Cache-Control': 'no-cache, no-store' }, validateStatus: () => true });
  return { status: response.status, body: response.data };
}
export async function list(homeId: string, session: Session): Promise<RawResponse> {
  const response = await apiClient.request<unknown>({ method: 'GET', url: `/api/homes/${identity(homeId)}/claims`,
    headers: headers(session), validateStatus: () => true });
  // Readers must validate all identities, session, dates, ordering and required
  // fields before showing rows or a confirmed empty queue. Retire stale replies.
  return { status: response.status, body: response.data };
}
