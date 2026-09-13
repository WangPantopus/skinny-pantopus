import type { homeOwnership } from '@pantopus/api';
export type MailingAddress = homeOwnership.PostcardMailingAddress;
export type PostalStatus = homeOwnership.CurrentPostcardStatus;
export type PostalOutcome = homeOwnership.PostcardRequestOutcome & Partial<Omit<homeOwnership.PostcardVerificationOutcome, 'postcard_id'>>;
export interface PostalDraft {
  version: 1; origin: string; actor_id: string; home_id: string; request_id: string;
  kind: 'mail' | 'code'; postcard_id: string | null; request_json: string; outcome?: PostalOutcome;
}
export const postalUUID = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function validMailingAddress(v: unknown): v is MailingAddress {
  if (!object(v)) return false;
  const fields: Record<string, number> = { line1: 255, line2: 255, city: 100, state: 50, postal_code: 20, country: 100 };
  return Object.keys(v).length === 6 && Object.keys(v).every(k => Object.hasOwn(fields, k))
    && Object.entries(fields).every(([k, max]) => typeof v[k] === 'string' && v[k].length <= max && (k === 'line2' || !!v[k].trim()));
}
export function validPostalOutcome(value: unknown, draft: Pick<PostalDraft, 'kind' | 'actor_id' | 'home_id' | 'request_id' | 'postcard_id'>): value is PostalOutcome {
  if (!object(value) || !['pending', 'completed', 'cancelled', 'rejected'].includes(String(value.state))
    || value.home_id !== draft.home_id || !object(value.command) || value.command.actor_id !== draft.actor_id
    || value.command.request_id !== draft.request_id || !date(value.command.created_at) || !date(value.command.updated_at)) return false;
  if (draft.kind === 'code' ? value.postcard_id !== draft.postcard_id
    : value.state === 'completed' ? !postalUUID(value.postcard_id) : value.postcard_id !== null) return false;
  if (value.state === 'rejected') {
    if (typeof value.code !== 'string' || !/^POSTCARD_[A-Z_]+$|^HOME_NOT_FOUND$|^OWNERSHIP_FLOW_REQUIRED$/.test(value.code)) return false;
    if (value.code === 'POSTCARD_WRONG_CODE' && (!Number.isInteger(value.attempts_remaining) || Number(value.attempts_remaining) < 0 || Number(value.attempts_remaining) > 4)) return false;
  } else if (value.code !== undefined) return false;
  if (draft.kind === 'code' && value.state === 'completed') return ['verified', 'provisional'].includes(String(value.verification_status))
    && date(value.recorded_at) && value.current_access === 'not_checked'
    && (value.challenge_window_ends_at === null || (value.verification_status === 'provisional' && date(value.challenge_window_ends_at)));
  return value.verification_status === undefined && value.recorded_at === undefined && value.challenge_window_ends_at === undefined;
}
export function projectPostalOutcome(r: PostalOutcome): PostalOutcome {
  return { state: r.state, home_id: r.home_id, postcard_id: r.postcard_id,
    command: { actor_id: r.command.actor_id, request_id: r.command.request_id, created_at: r.command.created_at, updated_at: r.command.updated_at },
    ...(r.state === 'rejected' ? { code: r.code, ...(r.code === 'POSTCARD_WRONG_CODE' ? { attempts_remaining: r.attempts_remaining } : {}) } : {}),
    ...(r.verification_status ? { verification_status: r.verification_status, recorded_at: r.recorded_at,
      challenge_window_ends_at: r.challenge_window_ends_at, current_access: 'not_checked' as const } : {}) };
}
export function validPostalDraft(v: unknown, origin: string, actor: string, home: string): v is PostalDraft {
  try {
    if (!object(v) || v.version !== 1 || v.origin !== origin || v.actor_id !== actor || v.home_id !== home
      || !postalUUID(actor) || !postalUUID(home) || !postalUUID(v.request_id) || typeof v.request_json !== 'string'
      || !['mail', 'code'].includes(String(v.kind))) return false;
    const input: unknown = JSON.parse(v.request_json);
    if (!object(input) || input.request_id !== v.request_id || Object.keys(input).length !== 2) return false;
    if (v.kind === 'mail' ? v.postcard_id !== null || !validMailingAddress(input.address)
      : !postalUUID(v.postcard_id) || typeof input.code !== 'string' || !/^[a-z0-9]{6,8}$/i.test(input.code)) return false;
    return v.outcome === undefined || validPostalOutcome(v.outcome, v as unknown as PostalDraft);
  } catch { return false; }
}
export function validatePostalStatus(value: unknown, actor: string, home: string): asserts value is PostalStatus {
  const r = value as PostalStatus | null;
  const unavailable = () => { throw new Error('Mail verification status could not be checked. Please retry.'); };
  if (!r || r.home_id !== home || r.actor_id !== actor || !date(r.checked_at) || r.current_access !== 'not_checked'
    || ![r.can_request, r.can_resume, r.can_verify].every(v => typeof v === 'boolean')
    || !(r.restriction === null || typeof r.restriction === 'string')
    || !(r.restriction_message === null || typeof r.restriction_message === 'string')) return unavailable();
  const p = r.postcard;
  if (p !== null && (!p || !postalUUID(p.id) || !date(p.requested_at) || !date(p.expires_at)
    || !['pending', 'verified', 'expired', 'cancelled'].includes(p.status) || !['not_started', 'accepted', 'unknown', 'rejected'].includes(p.delivery)
    || !Number.isInteger(p.attempts_remaining) || p.attempts_remaining < 0 || p.attempts_remaining > 5)) return unavailable();
  if (r.request !== null && (!r.request || !validMailingAddress(r.request.address) || !postalUUID(r.request.command?.request_id)
    || !validPostalOutcome(r.request, { kind: 'mail', actor_id: actor, home_id: home, request_id: r.request.command.request_id, postcard_id: null })
    || r.request.state !== 'completed' || r.request.postcard_id !== p?.id)) return unavailable();
  if ((r.can_verify && (!p || p.status !== 'pending' || !['accepted', 'unknown'].includes(p.delivery) || p.attempts_remaining === 0))
    || (r.can_resume && (!r.request || !p || p.status !== 'pending' || p.delivery !== 'not_started'))
    || (r.can_request && (r.can_verify || r.can_resume))) return unavailable();
}
export const postalMessage = (code?: string) => ({
  POSTCARD_WRONG_CODE: 'That code did not match this postcard. Review the recorded attempt before entering a corrected code.',
  POSTCARD_ADDRESS_CHANGED: 'The Home address changed. Confirm the street and apartment again before requesting another postcard.',
  POSTCARD_EXPIRED: 'This postcard code has expired. Confirm your mailing address before requesting another.',
  POSTCARD_LOCKED: 'This postcard has no code attempts remaining. Confirm your address before requesting another.',
  POSTCARD_ACCESS_REVIEW_REQUIRED: 'Household access needs review. A mail code cannot restore removed or expired access.',
  POSTCARD_REVIEW_ALREADY_RECORDED: 'Your verification is already recorded. Check residency status for current access.',
  POSTCARD_HOME_UNAVAILABLE: 'Mail verification is unavailable for this Home right now.',
  POSTCARD_RESIDENCY_REQUEST_REQUIRED: 'Submit your residency request before requesting a postcard.',
  POSTCARD_COUNTRY_UNAVAILABLE: 'Mail verification is currently available for US addresses.',
  POSTCARD_ADDRESS_LIMIT: 'The request limit for this address has been reached. Try again later.',
  POSTCARD_USER_LIMIT: 'Your mail request limit has been reached. Try again later.',
  POSTCARD_NOT_DISPATCHED: 'Mailing has not started. Resume the saved request first.',
  OWNERSHIP_FLOW_REQUIRED: 'Continue ownership verification for this Home.',
  HOME_NOT_FOUND: 'This Home is no longer available. Check your residency status.',
} as Record<string, string>)[code || ''] || 'This request could not continue. Check your current status before trying again.';
