import { invitationUUID as uuid, validInvitationSession, type InvitationSession } from '../../homes/invitations/invitationDecisionModel';

export { validInvitationSession };
export type RemovalSession = InvitationSession;
export interface RemovalInput { home_id: string; target_user_id: string }
export interface RemovalSummary {
  home: { id: string; name: string | null };
  target: {
    id: string; name: null; username: string | null; role_base: string | null;
    is_self: boolean; is_active: boolean; verification_status: string | null;
    start_at: string | null; end_at: string | null; access_start_at: string | null; access_end_at: string | null;
  };
}
export interface RemovalContext extends RemovalInput, RemovalSummary {
  occupancy_id: string; action: 'remove'; decision_token: string; session: RemovalSession;
}
export interface RemovalOutcome extends RemovalInput {
  occupancy_id: string; action: 'remove'; decision_token: string;
  state: 'pending' | 'completed' | 'rejected' | 'cancelled'; completed_at: string | null;
  code: string | null; status: number | null;
  command: { actor_id: string; request_id: string; created_at: string; updated_at: string };
}
export interface RemovalDraft extends RemovalInput {
  version: 1; origin: string; actor_id: string; request_id: string;
  occupancy_id: string; action: 'remove'; decision_token: string;
  reviewed: RemovalSummary; request_json: string; outcome?: RemovalOutcome;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const date = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(v);
  return !!m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= new Date(Date.UTC(+m[1], +m[2], 0)).getUTCDate()
    && +m[4] < 24 && +m[5] < 60 && +m[6] < 60 && (!m[7] || +m[7] < 24 && +m[8] < 60) && Number.isFinite(Date.parse(v));
};
const label = (v: unknown) => v === null || typeof v === 'string' && v.length <= 1000;
const roles = ['owner', 'admin', 'manager', 'lease_resident', 'member', 'restricted_member', 'guest', 'service_provider'];
const dates = ['start_at', 'end_at', 'access_start_at', 'access_end_at'];
export const removalErrorStatuses: Record<string, number> = {
  MEMBER_REMOVAL_CHANGED: 409, MEMBER_ALREADY_REMOVED: 409,
  MEMBERS_MANAGE_REQUIRED: 403, TARGET_RANK_FORBIDDEN: 403, OWNERSHIP_FLOW_REQUIRED: 409,
  TRANSFER_REQUIRED: 409, MEMBER_ROLE_UNKNOWN: 409, MEMBER_NOT_FOUND: 404, HOME_NOT_FOUND: 404,
};
const sameKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join() === [...keys].sort().join();
export function validRemovalInput(v: unknown): v is RemovalInput {
  return object(v) && sameKeys(v, ['home_id', 'target_user_id']) && uuid(v.home_id) && uuid(v.target_user_id);
}
function validSummary(v: unknown, input: RemovalInput, actor: string): v is RemovalSummary {
  if (!object(v) || !object(v.home) || !object(v.target)) return false;
  const t = v.target;
  return v.home.id === input.home_id && label(v.home.name) && t.id === input.target_user_id
    && t.name === null && label(t.username) && typeof t.is_self === 'boolean' && t.is_self === (actor === input.target_user_id)
    && typeof t.is_active === 'boolean' && (t.role_base === null ? t.is_self : typeof t.role_base === 'string' && roles.includes(t.role_base))
    && (t.verification_status === null || typeof t.verification_status === 'string' && t.verification_status.length <= 80)
    && dates.every(k => t[k] === null || date(t[k]));
}
export function validateRemovalContext(value: unknown, input: RemovalInput, session: RemovalSession): asserts value is RemovalContext {
  if (!object(value) || value.home_id !== input.home_id || value.target_user_id !== input.target_user_id
    || !uuid(value.occupancy_id) || value.action !== 'remove' || !hash(value.decision_token)
    || !validInvitationSession(value.session) || value.session.actor_id !== session.actor_id || value.session.session_scope !== session.session_scope
    || !validSummary(value, input, session.actor_id)) throw new Error('The current member details could not be confirmed. Review again before removing anyone.');
}
export function projectRemovalSummary(v: RemovalSummary): RemovalSummary {
  const t = v.target;
  return { home: { id: v.home.id, name: v.home.name }, target: {
    id: t.id, name: t.name, username: t.username, role_base: t.role_base, is_self: t.is_self,
    is_active: t.is_active, verification_status: t.verification_status,
    start_at: t.start_at, end_at: t.end_at, access_start_at: t.access_start_at, access_end_at: t.access_end_at,
  } };
}
export function validRemovalOutcome(value: unknown, draft: RemovalDraft): value is RemovalOutcome {
  if (!object(value) || typeof value.state !== 'string' || !['pending', 'completed', 'rejected', 'cancelled'].includes(value.state)
    || ['home_id', 'target_user_id', 'occupancy_id', 'action', 'decision_token'].some(k => value[k] !== draft[k as keyof RemovalDraft])
    || !object(value.command) || value.command.actor_id !== draft.actor_id || value.command.request_id !== draft.request_id
    || !date(value.command.created_at) || !date(value.command.updated_at)
    || (value.replayed !== undefined && typeof value.replayed !== 'boolean')) return false;
  if (value.state === 'completed') return date(value.completed_at) && value.code === null && value.status === null;
  if (value.completed_at !== null) return false;
  if (value.state === 'rejected') return typeof value.code === 'string' && Object.hasOwn(removalErrorStatuses, value.code)
    && value.status === removalErrorStatuses[value.code];
  return value.code === null && value.status === null;
}
export function projectRemovalOutcome(v: RemovalOutcome): RemovalOutcome {
  return { state: v.state, home_id: v.home_id, target_user_id: v.target_user_id, occupancy_id: v.occupancy_id,
    action: v.action, decision_token: v.decision_token, completed_at: v.completed_at, code: v.code, status: v.status,
    command: { actor_id: v.command.actor_id, request_id: v.command.request_id, created_at: v.command.created_at, updated_at: v.command.updated_at } };
}
export function validRemovalDraft(value: unknown, origin: string, actor: string): value is RemovalDraft {
  try {
    if (!object(value) || value.version !== 1 || value.origin !== origin || value.actor_id !== actor || !uuid(actor)
      || !uuid(value.home_id) || !uuid(value.target_user_id) || !uuid(value.occupancy_id) || !uuid(value.request_id)
      || value.action !== 'remove' || !hash(value.decision_token) || typeof value.request_json !== 'string' || value.request_json.length > 3000
      || !validSummary(value.reviewed, { home_id: value.home_id, target_user_id: value.target_user_id }, actor)) return false;
    const body = JSON.parse(value.request_json);
    const keys = ['request_id', 'home_id', 'target_user_id', 'occupancy_id', 'action', 'decision_token'];
    if (!object(body) || !sameKeys(body, keys) || keys.some(k => body[k] !== value[k])) return false;
    return value.outcome === undefined || validRemovalOutcome(value.outcome, value as unknown as RemovalDraft);
  } catch { return false; }
}
export function removalMessage(code?: string | null) {
  return ({
    MEMBER_REMOVAL_CHANGED: 'Membership, reviewed details or household authority changed. Acknowledge this result, then review the current member again.',
    MEMBER_ALREADY_REMOVED: 'This membership is already ended. Check the current household list.',
    MEMBERS_MANAGE_REQUIRED: 'Your current household permissions do not allow removing this member.',
    TARGET_RANK_FORBIDDEN: 'Your current household role does not allow removing this member.',
    TRANSFER_REQUIRED: 'The primary owner must transfer ownership before leaving.',
    OWNERSHIP_FLOW_REQUIRED: 'Use the separate ownership process for this owner.',
    MEMBER_ROLE_UNKNOWN: 'This member’s current role could not be verified.',
    MEMBER_NOT_FOUND: 'This membership is no longer available.',
    HOME_NOT_FOUND: 'This Home is no longer available.',
  } as Record<string, string>)[code || ''] || 'This removal could not continue. Review the current member and your household authority.';
}
export function removalLink(homeId: string, target: string | 'self') {
  return `/app/homes/member-removals?home=${encodeURIComponent(homeId)}&${target === 'self' ? 'self=1' : `target=${encodeURIComponent(target)}`}`;
}
