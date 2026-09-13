import { validInvitationSession, type InvitationSession } from '../../../homes/invitations/invitationDecisionModel';

export type HistorySession = InvitationSession;
export interface HistoryItem {
  decision: {
    id: string; home_id: string; claim_id: string; actor_id: string;
    action: 'approve' | 'reject'; created_at: string; legacy_request: boolean;
    result: { status: 'verified' | 'rejected'; reviewed_at: string; occupancy_id: string | null; role_base: string | null };
  };
  current: {
    claim_status: 'pending' | 'verified' | 'rejected'; applicant_lookup: 'current_claim_reference';
    applicant: { id: string; username: string | null; name: null } | null; household_access: 'not_checked';
  };
}
export interface HistoryPage { home_id: string; actor_id: string; items: HistoryItem[]; next_cursor: string | null; session: HistorySession }
export interface HistoryDetail { home_id: string; actor_id: string; item: HistoryItem; session: HistorySession }
export const HISTORY_BASE = '/api/homes/residency-review-history';
export const historyRoles: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', manager: 'Manager', member: 'Member', restricted_member: 'Restricted member',
  guest: 'Guest', lease_resident: 'Lease resident', service_provider: 'Service provider',
};
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).sort().join() === [...expected].sort().join();
export const historyUUID = (value: unknown): value is string => typeof value === 'string'
  && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
function date(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  return !!match && +match[1] > 0 && +match[2] >= 1 && +match[2] <= 12
    && +match[3] >= 1 && +match[3] <= new Date(Date.UTC(+match[1], +match[2], 0)).getUTCDate()
    && +match[4] < 24 && +match[5] < 60 && +match[6] < 60
    && (!match[7] || +match[7] < 24 && +match[8] < 60) && Number.isFinite(Date.parse(value));
}
const createdDate = (value: unknown): value is string => date(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value);
export function historySession(value: unknown): HistorySession {
  if (!object(value) || !keys(value, ['actor_id', 'session_scope']) || !validInvitationSession(value) || !historyUUID(value.actor_id)) throw new Error('Your signed-in session could not be verified.');
  return value;
}
const matchesSession = (value: unknown, session: HistorySession) => object(value) && keys(value, ['actor_id', 'session_scope']) && validInvitationSession(value)
  && value.actor_id === session.actor_id && value.session_scope === session.session_scope;
export function validateHistoryItem(value: unknown, homeId: string, actorId: string): asserts value is HistoryItem {
  let valid = object(value) && keys(value, ['decision', 'current']) && object(value.decision) && object(value.current);
  if (!valid) throw new Error('The saved decision could not be verified.');
  const item = value as Record<string, Record<string, unknown>>, d = item.decision, c = item.current;
  valid = keys(d, ['id', 'home_id', 'claim_id', 'actor_id', 'action', 'created_at', 'legacy_request', 'result'])
    && historyUUID(d.id) && d.home_id === homeId && historyUUID(d.claim_id) && d.actor_id === actorId
    && typeof d.action === 'string' && ['approve', 'reject'].includes(d.action) && createdDate(d.created_at) && typeof d.legacy_request === 'boolean'
    && object(d.result) && keys(d.result, ['status', 'reviewed_at', 'occupancy_id', 'role_base']);
  if (!valid) throw new Error('The saved decision could not be verified.');
  const result = d.result as Record<string, unknown>;
  valid = date(result.reviewed_at) && result.status === (d.action === 'approve' ? 'verified' : 'rejected')
    && (d.action === 'reject' ? result.occupancy_id === null && result.role_base === null
      : historyUUID(result.occupancy_id) && (result.role_base === null || typeof result.role_base === 'string' && Object.hasOwn(historyRoles, result.role_base)))
    && keys(c, ['claim_status', 'applicant_lookup', 'applicant', 'household_access'])
    && typeof c.claim_status === 'string' && ['pending', 'verified', 'rejected'].includes(c.claim_status)
    && c.applicant_lookup === 'current_claim_reference' && c.household_access === 'not_checked';
  if (c.applicant !== null) {
    valid = valid && object(c.applicant) && keys(c.applicant, ['id', 'username', 'name'])
      && historyUUID(c.applicant.id) && c.applicant.name === null
      && (c.applicant.username === null || typeof c.applicant.username === 'string' && c.applicant.username.length <= 100);
  }
  if (!valid) throw new Error('The saved decision could not be verified.');
}
/** Canonical UTC microseconds retain ordering that Date.parse would round away. */
export function olderThan(a: HistoryItem, b: HistoryItem) {
  return a.decision.created_at < b.decision.created_at
    || a.decision.created_at === b.decision.created_at && a.decision.id < b.decision.id;
}
function validateCursor(value: string, last: HistoryItem, homeId: string, actorId: string) {
  if (!/^[A-Za-z0-9_-]{1,600}$/.test(value)) throw new Error('The next history page could not be verified.');
  let cursor: unknown;
  let text: string;
  try { text = atob(value.replaceAll('-', '+').replaceAll('_', '/')); cursor = JSON.parse(text); } catch { throw new Error('The next history page could not be verified.'); }
  if (!object(cursor) || !keys(cursor, ['version', 'actor_id', 'home_id', 'created_at', 'id']) || cursor.version !== 1
    || cursor.actor_id !== actorId || cursor.home_id !== homeId || cursor.id !== last.decision.id
    || cursor.created_at !== last.decision.created_at) throw new Error('The next history page could not be verified.');
  const canonical = JSON.stringify({ version: 1, actor_id: actorId, home_id: homeId, created_at: last.decision.created_at, id: last.decision.id });
  if (text !== canonical || btoa(canonical).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '') !== value)
    throw new Error('The next history page could not be verified.');
}
export function validateHistoryPage(value: unknown, homeId: string, session: HistorySession): asserts value is HistoryPage {
  if (!object(value) || !keys(value, ['home_id', 'actor_id', 'items', 'next_cursor', 'session'])
    || value.home_id !== homeId || value.actor_id !== session.actor_id || !matchesSession(value.session, session)
    || !Array.isArray(value.items) || value.items.length > 20
    || !(value.next_cursor === null || typeof value.next_cursor === 'string')) throw new Error('Your decision history could not be verified.');
  const items = value.items;
  items.forEach(item => validateHistoryItem(item, homeId, session.actor_id));
  for (let index = 1; index < items.length; index++) if (!olderThan(items[index], items[index - 1])) throw new Error('Your decision history order changed. Refresh to check it.');
  if (new Set(items.map(item => item.decision.id)).size !== items.length) throw new Error('Your decision history could not be verified.');
  if (value.next_cursor !== null) {
    if (items.length !== 20) throw new Error('The next history page could not be verified.');
    validateCursor(value.next_cursor, items[19], homeId, session.actor_id);
  }
}
export function validateHistoryDetail(value: unknown, homeId: string, receiptId: string, session: HistorySession): asserts value is HistoryDetail {
  if (!object(value) || !keys(value, ['home_id', 'actor_id', 'item', 'session']) || value.home_id !== homeId
    || value.actor_id !== session.actor_id || !matchesSession(value.session, session)) throw new Error('The saved decision could not be verified.');
  validateHistoryItem(value.item, homeId, session.actor_id);
  if (value.item.decision.id !== receiptId) throw new Error('The saved decision could not be verified.');
}
export function historyError(error: unknown) {
  const failure = error as { statusCode?: number; code?: string; data?: { code?: string } };
  const code = failure?.data?.code || failure?.code;
  if (failure?.statusCode === 401 || code === 'SESSION_SCOPE_CHANGED') return 'Your session changed. Sign in again or reload your decisions.';
  if (failure?.statusCode === 403) return 'Your current household permissions do not allow viewing these decisions.';
  if (code === 'RESIDENCY_HISTORY_CURSOR_INVALID') return 'The history page changed. Refresh to load your decisions again.';
  if (failure?.statusCode === 404) return 'This decision history is not available for your account in this Home.';
  return 'Your residency decisions could not be loaded. Retry to check current access and history.';
}
export const historyPath = (homeId: string, receiptId?: string) => `/app/homes/${encodeURIComponent(homeId)}/owners/review-claim/history`
  + (receiptId ? `?receipt=${encodeURIComponent(receiptId)}` : '');
