import type { RelationshipAction, RelationshipCommand, RelationshipReceipt, RelationshipReview } from '@pantopus/api';

export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const actionLabel = (action: RelationshipAction) => action === 'decline_relationship' ? 'Continue independent review' : 'Flag unknown claimant';
export interface PendingRelationship {
  version: 1; origin: string; actor_id: string; home_id: string; claim_id: string;
  command: RelationshipCommand; confirmed?: RelationshipReceipt;
}
export function validReceipt(v: unknown, pending: PendingRelationship): v is RelationshipReceipt {
  return object(v) && typeof v.id === 'string' && UUID.test(v.id) && v.home_id === pending.home_id
    && v.claim_id === pending.claim_id && v.actor_id === pending.actor_id && v.request_id === pending.command.request_id
    && v.action === pending.command.action && v.review_token === pending.command.review_token && v.legacy_request === false
    && typeof v.request_hash === 'string' && HASH.test(v.request_hash)
    && typeof v.created_at === 'string' && Number.isFinite(Date.parse(v.created_at))
    && object(v.result) && typeof v.result.state === 'string' && typeof v.result.qualifies_for_dispute === 'boolean';
}
export function validPendingRelationship(v: unknown, origin: string, actor: string, home: string): v is PendingRelationship {
  if (!object(v) || Object.keys(v).some(k => !['version','origin','actor_id','home_id','claim_id','command','confirmed'].includes(k))
    || v.version !== 1 || v.origin !== origin || v.actor_id !== actor || v.home_id !== home
    || typeof v.claim_id !== 'string' || !UUID.test(v.claim_id) || !object(v.command)) return false;
  const c = v.command;
  return !Object.keys(c).some(k => !['action','note','request_id','review_token'].includes(k))
    && ['decline_relationship','flag_unknown_person'].includes(c.action as string)
    && typeof c.note === 'string' && c.note.length <= 1000 && c.note === c.note.trim()
    && typeof c.request_id === 'string' && UUID.test(c.request_id)
    && typeof c.review_token === 'string' && HASH.test(c.review_token)
    && (v.confirmed === undefined || validReceipt(v.confirmed, v as unknown as PendingRelationship));
}
export function validReview(v: unknown, home: string, claim: string, actor: string): v is RelationshipReview {
  return object(v) && object(v.relationship_session) && v.relationship_session.actor_id === actor
    && v.relationship_session.home_id === home && typeof v.relationship_session.session_scope === 'string'
    && HASH.test(v.relationship_session.session_scope) && object(v.claim) && v.claim.id === claim && v.claim.home_id === home
    && typeof v.claim.state === 'string' && typeof v.claim.claim_type === 'string'
    && typeof v.claim.claimant_user_id === 'string' && UUID.test(v.claim.claimant_user_id)
    && typeof v.claim.review_token === 'string' && HASH.test(v.claim.review_token)
    && Array.isArray(v.claim.evidence) && v.claim.evidence.every(e => object(e) && typeof e.id === 'string'
      && UUID.test(e.id) && typeof e.evidence_type === 'string' && typeof e.eligible_for_review === 'boolean');
}
export function canDecide(review: RelationshipReview, actor: string) {
  const c = review.claim;
  return c.claimant_user_id !== actor && !c.merged_into_claim_id && c.terminal_reason === 'none'
    && (!c.expires_at || Date.parse(c.expires_at) > Date.now())
    && !['approved','rejected','revoked','disputed'].includes(c.state)
    && (c.claim_phase_v2 ? ['initiated','evidence_submitted','under_review'].includes(c.claim_phase_v2)
      : ['draft','submitted','pending_review','pending_challenge_window','needs_more_info'].includes(c.state)) && c.challenge_state !== 'challenged';
}
