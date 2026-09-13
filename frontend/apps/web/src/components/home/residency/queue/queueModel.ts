export interface QueueSession { actor_id: string; session_scope: string }
export interface QueueClaim {
  id: string; home_id: string; user_id: string; status: 'pending';
  created_at: string | null; claimed_role: 'renter' | 'household' | null;
  claimant: { id: string; username: string | null; name: null } | null;
}
export interface QueueResult {
  home_id: string; actor_id: string; claims: QueueClaim[];
  residency_session: QueueSession & { home_id: string };
}
export const QUEUE_SESSION_PATH = '/api/homes/residency-claims/session';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).sort().join() === [...expected].sort().join();
export const queueUUID = (value: unknown): value is string => typeof value === 'string'
  && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
function date(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.\d{6}Z$/.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const calendar = new Date(0); calendar.setUTCFullYear(year, month - 1, day);
  return year > 0 && month >= 1 && month <= 12 && day >= 1
    && calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day
    && hour < 24 && minute < 60 && second < 60;
}
const invalid = () => new Error('Current residency claims could not be verified.');
export function queueSession(value: unknown): QueueSession {
  if (!object(value) || !keys(value, ['session']) || !object(value.session)
    || !keys(value.session, ['actor_id', 'session_scope']) || !queueUUID(value.session.actor_id)
    || typeof value.session.session_scope !== 'string' || !/^[a-f0-9]{64}$/.test(value.session.session_scope)) throw invalid();
  return value.session as unknown as QueueSession;
}
function claim(value: unknown, homeId: string): asserts value is QueueClaim {
  if (!object(value) || !keys(value, ['id', 'home_id', 'user_id', 'status', 'created_at', 'claimed_role', 'claimant'])
    || !queueUUID(value.id) || value.home_id !== homeId || !queueUUID(value.user_id) || value.status !== 'pending'
    || !(value.created_at === null || date(value.created_at))
    || !(value.claimed_role === null || value.claimed_role === 'renter' || value.claimed_role === 'household')) throw invalid();
  if (value.claimant !== null) {
    const person = value.claimant;
    if (!object(person) || !keys(person, ['id', 'username', 'name']) || person.id !== value.user_id || person.name !== null
      || !(person.username === null || typeof person.username === 'string' && person.username.length <= 100)) throw invalid();
  }
}
/** Match complete SQL ordering, including legitimate legacy NULL dates last. */
export function queueEarlier(left: QueueClaim, right: QueueClaim): boolean {
  if (left.created_at === right.created_at) return left.id < right.id;
  if (left.created_at === null) return true;
  if (right.created_at === null) return false;
  return left.created_at < right.created_at;
}
export function validateQueue(value: unknown, homeId: string, session: QueueSession): asserts value is QueueResult {
  if (!queueUUID(homeId) || !object(value) || !keys(value, ['home_id', 'actor_id', 'claims', 'residency_session'])
    || value.home_id !== homeId || value.actor_id !== session.actor_id || !Array.isArray(value.claims)
    || !object(value.residency_session) || !keys(value.residency_session, ['home_id', 'actor_id', 'session_scope'])
    || value.residency_session.home_id !== homeId || value.residency_session.actor_id !== session.actor_id
    || value.residency_session.session_scope !== session.session_scope) throw invalid();
  value.claims.forEach(value => claim(value, homeId));
  const items = value.claims as QueueClaim[];
  if (new Set(items.map(item => item.id)).size !== items.length
    || new Set(items.map(item => item.user_id)).size !== items.length) throw invalid();
  for (let index = 1; index < items.length; index++) if (!queueEarlier(items[index], items[index - 1])) throw invalid();
}
export function queueError(error: unknown): string {
  const failure = error as { statusCode?: number; code?: string; data?: { code?: string } };
  if (failure?.statusCode === 401 || (failure?.data?.code || failure?.code) === 'SESSION_SCOPE_CHANGED')
    return 'Your session changed. Sign in again or reload to check current residency claims.';
  if (failure?.statusCode === 403) return 'Your current household permissions do not allow reviewing residency claims.';
  if (failure?.statusCode === 404) return 'Current residency claims are not available for your account in this Home.';
  return 'Current residency claims could not be loaded. Reload to check access.';
}
export const queueApplicant = (claim: QueueClaim) => claim.claimant?.username ? `@${claim.claimant.username}` : 'Applicant identity unavailable';
export const queueRelationship = (claim: QueueClaim) => claim.claimed_role === 'renter' ? 'Renter'
  : claim.claimed_role === 'household' ? 'Household' : 'Requested relationship unspecified';
export const queueDate = (claim: QueueClaim) => claim.created_at === null ? 'Date unavailable'
  : `Requested ${new Date(claim.created_at).toLocaleDateString()}`;
