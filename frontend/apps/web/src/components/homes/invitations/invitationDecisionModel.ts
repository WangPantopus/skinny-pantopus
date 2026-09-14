import { validateInvitationPreview, type InvitationPreview } from '../invitationPreviewModel';
export interface InvitationSession { actor_id: string; session_scope: string }
export interface InvitationContext { home_id: string; invitation_id: string; decision_token: string; preview: InvitationPreview; session: InvitationSession }
export interface InvitationOutcome {
  state: 'pending' | 'completed' | 'rejected' | 'cancelled'; home_id: string; invitation_id: string;
  action: 'accept' | 'decline'; decision_token: string; occupancy_id: string | null; current_access: 'not_checked'; code?: string;
  command: { actor_id: string; request_id: string; created_at: string; updated_at: string };
}
export interface InvitationDraft {
  version: 1; origin: string; actor_id: string; request_id: string; home_id: string; invitation_id: string;
  action: 'accept' | 'decline'; decision_token: string; token: string; home_label: string; request_json: string;
  outcome?: InvitationOutcome;
}
export const invitationUUID = (value: unknown): value is string => typeof value === 'string'
  && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function validInvitationSession(value: unknown): value is InvitationSession {
  return object(value) && invitationUUID(value.actor_id) && hash(value.session_scope);
}
export function validateInvitationContext(value: unknown, session: InvitationSession): asserts value is InvitationContext {
  const c = value as InvitationContext | null;
  if (!c || !invitationUUID(c.home_id) || !invitationUUID(c.invitation_id) || !hash(c.decision_token)
    || !validInvitationSession(c.session) || c.session.actor_id !== session.actor_id || c.session.session_scope !== session.session_scope
    || c.preview?.home?.id !== c.home_id || c.preview?.invitation?.id !== c.invitation_id
    || c.preview.invitation.status !== 'pending') throw new Error('The current invitation could not be checked. Reopen it to retry.');
  validateInvitationPreview(c.preview);
}
export function validInvitationOutcome(value: unknown, draft: InvitationDraft): value is InvitationOutcome {
  if (!object(value) || !['pending','completed','rejected','cancelled'].includes(String(value.state))
    || ['home_id','invitation_id','action','decision_token'].some(key => value[key] !== draft[key as keyof InvitationDraft])
    || value.current_access !== 'not_checked' || !object(value.command) || value.command.actor_id !== draft.actor_id
    || value.command.request_id !== draft.request_id || !date(value.command.created_at) || !date(value.command.updated_at)) return false;
  if (value.state === 'completed' && draft.action === 'accept' ? !invitationUUID(value.occupancy_id) : value.occupancy_id !== null) return false;
  return value.state === 'rejected' ? typeof value.code === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(value.code) : value.code === undefined;
}
export function projectInvitationOutcome(value: InvitationOutcome): InvitationOutcome {
  return { state: value.state, home_id: value.home_id, invitation_id: value.invitation_id, action: value.action,
    decision_token: value.decision_token, occupancy_id: value.occupancy_id, current_access: 'not_checked',
    command: { actor_id: value.command.actor_id, request_id: value.command.request_id,
      created_at: value.command.created_at, updated_at: value.command.updated_at }, ...(value.state === 'rejected' ? { code: value.code } : {}) };
}
export function validInvitationDraft(value: unknown, origin: string, actor: string): value is InvitationDraft {
  try {
    if (!object(value) || value.version !== 1 || value.origin !== origin || value.actor_id !== actor || !invitationUUID(actor)
      || !invitationUUID(value.home_id) || !invitationUUID(value.invitation_id) || !invitationUUID(value.request_id)
      || !['accept','decline'].includes(String(value.action)) || !hash(value.decision_token)
      || typeof value.token !== 'string' || value.token.length < 1 || value.token.length > 512
      || typeof value.home_label !== 'string' || value.home_label.length > 1000
      || typeof value.request_json !== 'string' || value.request_json.length > 3000) return false;
    const body = JSON.parse(value.request_json);
    if (!object(body) || Object.keys(body).length !== 6 || ['request_id','token','home_id','invitation_id','action','decision_token']
      .some(key => body[key] !== value[key])) return false;
    return value.outcome === undefined || validInvitationOutcome(value.outcome, value as unknown as InvitationDraft);
  } catch { return false; }
}
export const invitationDecisionMessage = (code?: string) => ({
  INVITE_EMAIL_MISMATCH: 'This invitation belongs to a different account. Sign in to the account the sender invited.',
  INVITE_DECISION_CHANGED: 'The invitation details changed. Acknowledge this result, then review the current invitation before deciding again.',
  INVITE_EXPIRED: 'This invitation expired. Ask the household for a new invitation.',
  INVITE_ALREADY_USED: 'This invitation was already accepted, declined or withdrawn. My Homes shows your current access.',
  INVITE_NOT_FOUND: 'This invitation is no longer available. Check the complete link with the sender.',
  INVITER_ACCESS_CHANGED: 'The sender can no longer grant this access. Ask the household for a new invitation.',
  OWNERSHIP_FLOW_REQUIRED: 'Use the separate ownership flow for this invitation.',
  INVITE_POLICY_CHANGED: 'The household permissions changed. Ask for a new invitation.',
  MEMBERSHIP_RENEWAL_REQUIRED: 'Your previous household access needs a new review. Accepting this link cannot restore it.',
} as Record<string, string>)[code || ''] || 'This decision could not continue. Review the invitation and your current account before starting again.';
