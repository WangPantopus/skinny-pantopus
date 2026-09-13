import { apiClient } from '../client';

export interface Session { actor_id: string; session_scope: string }
export type CanonicalRole = 'owner' | 'admin' | 'manager' | 'member' | 'restricted_member' | 'guest' | 'lease_resident' | 'service_provider';
export interface Item {
  decision: {
    id: string; home_id: string; claim_id: string; actor_id: string;
    action: 'approve' | 'reject'; created_at: string; legacy_request: boolean;
    result: { status: 'verified' | 'rejected'; reviewed_at: string; occupancy_id: string | null; role_base: CanonicalRole | null };
  };
  current: {
    claim_status: 'pending' | 'verified' | 'rejected'; applicant_lookup: 'current_claim_reference';
    applicant: { id: string; username: string | null; name: null } | null;
    household_access: 'not_checked';
  };
}
export interface Page { home_id: string; actor_id: string; items: Item[]; next_cursor: string | null; session: Session }
export interface Detail { home_id: string; actor_id: string; item: Item; session: Session }
export interface RawResponse<T = unknown> { status: number; body: T }
const root = '/api/homes/residency-review-history';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function identity(value: string): string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new Error('The saved review reference is invalid.');
  return value.toLowerCase();
}
function headers(session: Session) {
  identity(session?.actor_id);
  if (typeof session?.session_scope !== 'string' || !/^[a-f0-9]{64}$/.test(session.session_scope)) {
    throw new Error('Reopen history to check your signed-in session.');
  }
  return { 'Cache-Control': 'no-cache, no-store', 'x-pantopus-session-scope': session.session_scope };
}
async function raw(url: string, session?: Session): Promise<RawResponse> {
  const response = await apiClient.request<unknown>({ method: 'GET', url, headers: session ? headers(session) : undefined,
    validateStatus: () => true });
  // Consumers validate session, Home, actor, ordering and every projected field.
  // A failed/retired read must not become an empty list or a retained authority.
  return { status: response.status, body: response.data };
}
export const getSession = (): Promise<RawResponse> => raw(`${root}/session`);
export function list(homeId: string, session: Session, after?: string): Promise<RawResponse> {
  if (after !== undefined && (typeof after !== 'string' || after.length > 600 || !/^[A-Za-z0-9_-]+$/.test(after))) {
    throw new Error('Reload your recent saved decisions to restart this history page.');
  }
  return raw(`${root}/${identity(homeId)}${after === undefined ? '' : `?after=${encodeURIComponent(after)}`}`, session);
}
export const read = (homeId: string, receiptId: string, session: Session): Promise<RawResponse> =>
  raw(`${root}/${identity(homeId)}/${identity(receiptId)}`, session);
