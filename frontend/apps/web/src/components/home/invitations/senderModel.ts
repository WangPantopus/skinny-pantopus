import { invitationUUID as uuid, validInvitationSession, type InvitationSession } from '../../homes/invitations/invitationDecisionModel';
export { validInvitationSession };
export type SenderSession = InvitationSession;
export type SenderAction = 'create' | 'resend' | 'withdraw';
export type SenderPayload = { email?: string | null; user_id?: string | null; username?: string | null; relationship?: string | null;
  preset_key?: string | null; start_at?: string | null; end_at?: string | null; message?: string | null };
export type SenderInput = { home_id: string; action: 'create'; payload: SenderPayload } | { home_id: string; action: 'resend' | 'withdraw'; invitation_id: string };
export interface SenderInvitation { invitee?: {id:string;username:string|null;name:string|null}|null; id: string; home_id: string; status: string; invitee_email?: string | null; invitee_user_id?: string | null;
  proposed_role?: string | null; proposed_role_base?: string | null; proposed_preset_key?: string | null; access_start_at?: string | null; access_end_at?: string | null; expires_at?: string | null }
export interface SenderContext { home_id: string; action: SenderAction; decision_token: string; invitation: SenderInvitation | null; session: SenderSession }
export interface SenderOutcome { state: 'pending' | 'completed' | 'rejected' | 'cancelled'; home_id: string; invitation_id: string | null;
  action: SenderAction; decision_token: string; command: { actor_id: string; request_id: string; created_at: string; updated_at: string };
  delivery: { email: 'not_requested' | 'unconfirmed' | 'provider_accepted'; in_app: 'not_requested' | 'unconfirmed' | 'saved' }; code?: string }
export type SenderDraft = SenderInput & { version: 1; origin: string; actor_id: string; request_id: string; decision_token: string; token: string | null;
  request_json: string; outcome?: SenderOutcome; reviewed_invitation: SenderInvitation | null };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const payloadKeys = ['email','user_id','username','relationship','preset_key','start_at','end_at','message'];
export function validSenderInput(value: unknown): value is SenderInput & Record<string, unknown> {
  if (!object(value) || !uuid(value.home_id)) return false;
  if (value.action === 'create') return object(value.payload) && Object.entries(value.payload).every(([k,v]) => payloadKeys.includes(k) && (v === null || typeof v === 'string' && v.length <= 1000));
  return typeof value.action === 'string' && ['resend','withdraw'].includes(value.action) && uuid(value.invitation_id);
}
function validInvitee(value: unknown, userId: unknown) {
  return value === undefined || value === null || object(value) && value.id === userId && uuid(value.id)
    && ['username','name'].every(k => value[k] === null || typeof value[k] === 'string');
}
export function validSenderInvitation(value: unknown, homeId: string): value is SenderInvitation {
  return object(value) && uuid(value.id) && value.home_id === homeId && typeof value.status === 'string'
    && ['pending','accepted','revoked','expired','rejected'].includes(value.status)
    && validInvitee(value.invitee,value.invitee_user_id)
    && ['invitee_email','invitee_user_id','proposed_role','proposed_role_base','proposed_preset_key'].every(k => value[k] === undefined || value[k] === null || typeof value[k] === 'string')
    && ['access_start_at','access_end_at','expires_at'].every(k => value[k] === undefined || value[k] === null || date(value[k]));
}
export function validateSenderContext(value: unknown, input: SenderInput, session: SenderSession): asserts value is SenderContext {
  const c = value as SenderContext | null;
  if (!c || c.home_id !== input.home_id || c.action !== input.action || !hash(c.decision_token)
    || !validInvitationSession(c.session) || c.session.actor_id !== session.actor_id || c.session.session_scope !== session.session_scope
    || (input.action === 'create' ? c.invitation !== null : !validSenderInvitation(c.invitation, input.home_id) || c.invitation.id !== input.invitation_id || c.invitation.status !== 'pending'))
    throw new Error('The current invitation details could not be confirmed. Review again to retry.');
}
export function validSenderOutcome(value: unknown, draft: SenderDraft): value is SenderOutcome {
  if (!object(value) || typeof value.state !== 'string' || !['pending','completed','rejected','cancelled'].includes(value.state)
    || ['home_id','action','decision_token'].some(k => value[k] !== draft[k as keyof SenderDraft])
    || !object(value.command) || value.command.actor_id !== draft.actor_id || value.command.request_id !== draft.request_id
    || !date(value.command.created_at) || !date(value.command.updated_at) || !object(value.delivery)
    || typeof value.delivery.email !== 'string' || !['not_requested','unconfirmed','provider_accepted'].includes(value.delivery.email)
    || typeof value.delivery.in_app !== 'string' || !['not_requested','unconfirmed','saved'].includes(value.delivery.in_app)) return false;
  if ((draft.action === 'withdraw' || ['rejected','cancelled'].includes(value.state))
    && (value.delivery.email !== 'not_requested' || value.delivery.in_app !== 'not_requested')) return false;
  if (draft.action === 'create' ? value.state === 'completed' ? !uuid(value.invitation_id) : value.invitation_id !== null && !uuid(value.invitation_id) : value.invitation_id !== draft.invitation_id) return false;
  return value.state === 'rejected' ? typeof value.code === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(value.code) : value.code === undefined;
}
export function projectSenderOutcome(v: SenderOutcome): SenderOutcome {
  return { state: v.state, home_id: v.home_id, invitation_id: v.invitation_id, action: v.action, decision_token: v.decision_token,
    command: { actor_id:v.command.actor_id,request_id:v.command.request_id,created_at:v.command.created_at,updated_at:v.command.updated_at },
    delivery: { email:v.delivery.email,in_app:v.delivery.in_app }, ...(v.state === 'rejected' ? {code:v.code} : {}) };
}
export function validSenderDraft(value: unknown, origin: string, actor: string): value is SenderDraft {
  try {
    if (!object(value) || !validSenderInput(value) || value.version !== 1 || value.origin !== origin || value.actor_id !== actor || !uuid(actor)
      || !uuid(value.request_id) || !hash(value.decision_token) || (value.action === 'withdraw' ? value.token !== null : !hash(value.token))
      || typeof value.request_json !== 'string' || value.request_json.length > 12000
      || (value.action === 'create' ? value.reviewed_invitation !== null : !validSenderInvitation(value.reviewed_invitation,value.home_id) || value.reviewed_invitation.id !== value.invitation_id)) return false;
    const body = JSON.parse(value.request_json);
    const expected = {request_id:value.request_id,token:value.token,home_id:value.home_id,action:value.action,
      ...(value.action === 'create' ? {payload:value.payload} : {invitation_id:value.invitation_id}),decision_token:value.decision_token};
    if (!object(body) || Object.keys(body).sort().join() !== Object.keys(expected).sort().join()
      || Object.entries(expected).some(([k,v]) => JSON.stringify(body[k]) !== JSON.stringify(v))) return false;
    return value.outcome === undefined || validSenderOutcome(value.outcome,value as SenderDraft);
  } catch { return false; }
}
export const senderMessage = (code?: string) => ({
  INVITE_SENDER_CHANGED: 'Invitation details or household authority changed. Acknowledge this result, then review again.',
  INVITE_ALREADY_USED: 'This invitation has already been resolved. Existing household membership is preserved.',
  INVITE_EXPIRED: 'This invitation expired. A new invitation needs a separate review.',
  INVITE_NOT_FOUND: 'This invitation is no longer available.',
  INVITE_FORBIDDEN: 'Current household authority does not allow this invitation action.',
  HOME_FORBIDDEN: 'Current household authority does not allow this invitation action.',
  INVITE_DUPLICATE: 'A pending invitation already exists for this recipient. Check the invitation list.',
} as Record<string,string>)[code || ''] || 'This invitation action could not continue. Acknowledge the result, then review the current invitation and your household authority.';
export function deliveryMessage(outcome: SenderOutcome): string {
  if (outcome.action === 'withdraw') return 'The invitation was withdrawn. Existing household membership was preserved.';
  const email = outcome.delivery.email === 'provider_accepted' ? 'The email provider accepted the message; inbox delivery is not confirmed.'
    : outcome.delivery.email === 'unconfirmed' ? 'Email delivery is not confirmed.' : '';
  const app = outcome.delivery.in_app === 'saved' ? 'An in-app invitation notice was saved; device delivery is not confirmed.'
    : outcome.delivery.in_app === 'unconfirmed' ? 'The in-app invitation notice is not confirmed.' : '';
  return [email,app].filter(Boolean).join(' ') || 'Share the invitation link with the intended recipient. No delivery was requested.';
}
