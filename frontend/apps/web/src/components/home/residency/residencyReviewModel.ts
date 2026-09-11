import type { ResidencyReviewAction, ResidencyReviewCommand, ResidencyReviewReceipt, ResidencyReview, ResidencyReviewRole } from '@pantopus/api';
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const nullableText = (v: unknown) => v === null || typeof v === 'string';
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const nullableDate = (v: unknown) => v === null || date(v);
export const residencyRoles: Record<ResidencyReviewRole, string> = {
  member: 'Member', lease_resident: 'Lease resident', restricted_member: 'Restricted member', guest: 'Guest', service_provider: 'Service provider',
};
export const actionLabel = (action: ResidencyReviewAction) => action === 'approve' ? 'Approve residency' : 'Reject residency';
export interface PendingResidencyReview {
  version: 1; origin: string; actor_id: string; home_id: string; claim_id: string;
  command: ResidencyReviewCommand; confirmed?: ResidencyReviewReceipt;
}
export function validReceipt(v: unknown, pending: PendingResidencyReview): v is ResidencyReviewReceipt {
  return object(v) && typeof v.id === 'string' && UUID.test(v.id) && v.home_id === pending.home_id
    && v.claim_id === pending.claim_id && v.actor_id === pending.actor_id && v.request_id === pending.command.request_id
    && v.action === pending.command.action && v.review_token === pending.command.review_token && v.legacy_request === false
    && typeof v.request_hash === 'string' && HASH.test(v.request_hash) && date(v.created_at)
    && object(v.result) && v.result.status === (pending.command.action === 'approve' ? 'verified' : 'rejected')
    && date(v.result.reviewed_at) && (v.result.occupancy_id === null || (typeof v.result.occupancy_id === 'string' && UUID.test(v.result.occupancy_id)))
    && nullableText(v.result.role_base);
}
export function validPendingResidencyReview(v: unknown, origin: string, actor: string, home: string): v is PendingResidencyReview {
  if (!object(v) || Object.keys(v).some(k => !['version','origin','actor_id','home_id','claim_id','command','confirmed'].includes(k))
    || v.version !== 1 || v.origin !== origin || v.actor_id !== actor || v.home_id !== home
    || typeof v.claim_id !== 'string' || !UUID.test(v.claim_id) || !object(v.command)) return false;
  const c = v.command;
  return !Object.keys(c).some(k => !['action','role','reason','request_id','review_token'].includes(k))
    && ((c.action === 'approve' && typeof c.role === 'string' && Object.hasOwn(residencyRoles, c.role) && c.reason === null)
      || (c.action === 'reject' && c.role === null && typeof c.reason === 'string' && c.reason.length <= 2000 && c.reason === c.reason.trim()))
    && typeof c.request_id === 'string' && UUID.test(c.request_id)
    && typeof c.review_token === 'string' && HASH.test(c.review_token)
    && (v.confirmed === undefined || validReceipt(v.confirmed, v as unknown as PendingResidencyReview));
}
export function validReview(v: unknown, home: string, claim: string, actor: string): v is ResidencyReview {
  if (!object(v) || v.ok !== true || v.home_id !== home || !object(v.residency_session)
    || v.residency_session.actor_id !== actor || v.residency_session.home_id !== home
    || typeof v.residency_session.session_scope !== 'string' || !HASH.test(v.residency_session.session_scope)
    || !object(v.claim) || v.claim.id !== claim || v.claim.home_id !== home
    || typeof v.claim.user_id !== 'string' || !UUID.test(v.claim.user_id)
    || typeof v.claim.status !== 'string' || !v.claim.status
    || !['claimed_role','claimed_address','review_note','reviewed_by'].every(key => nullableText(v.claim && (v.claim as Record<string, unknown>)[key]))
    || !date(v.claim.created_at) || !date(v.claim.updated_at) || !nullableDate(v.claim.reviewed_at)
    || typeof v.claim.review_token !== 'string' || !HASH.test(v.claim.review_token)) return false;
  const o = v.occupancy;
  return o === null || (object(o) && typeof o.id === 'string' && UUID.test(o.id)
    && o.user_id === v.claim.user_id && typeof o.is_active === 'boolean'
    && ['role','role_base','age_band','verification_status'].every(key => nullableText(o[key]))
    && ['start_at','end_at','access_start_at','access_end_at','verified_at','verification_expires_at'].every(key => nullableDate(o[key])));
}
export const canDecide = (review: ResidencyReview, actor: string) => review.claim.user_id !== actor && review.claim.status === 'pending';
