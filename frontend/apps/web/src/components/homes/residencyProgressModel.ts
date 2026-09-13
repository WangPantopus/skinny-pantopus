import type { homes } from '@pantopus/api';
type PersonalResidencyRequest = homes.PersonalResidencyRequest;
type PersonalResidencyProgress = homes.PersonalResidencyProgress;

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const date = (v: unknown) => v === null || (typeof v === 'string' && Number.isFinite(Date.parse(v)));
export function validateResidencyRequest(value: unknown): asserts value is PersonalResidencyRequest {
  const r = value as PersonalResidencyRequest | null;
  if (!r || !uuid(r.id) || !(r.home_id === null || uuid(r.home_id))
    || !(r.submitted_address === null || typeof r.submitted_address === 'string')
    || !(r.claimed_role === null || typeof r.claimed_role === 'string')
    || !['pending', 'verified', 'rejected'].includes(r.status)
    || ![r.reviewed_at, r.created_at, r.updated_at].every(date)) throw new Error('Your residency request could not be checked. Please retry.');
}
export function validateResidencyPage(value: unknown): asserts value is { requests: PersonalResidencyRequest[]; next_cursor: string | null } {
  const page = value as { requests?: PersonalResidencyRequest[]; next_cursor?: string | null } | null;
  if (!page || !Array.isArray(page.requests) || !(page.next_cursor === null || uuid(page.next_cursor))) throw new Error('Your residency requests could not be loaded. Please retry.');
  page.requests.forEach(validateResidencyRequest);
  if (page.requests.length > 50 || new Set(page.requests.map(r => r.id)).size !== page.requests.length
    || (page.next_cursor !== null && page.requests.at(-1)?.id !== page.next_cursor)) throw new Error('Your residency requests could not be checked. Please retry.');
}
export function validateResidencyProgress(value: unknown, homeId: string): asserts value is PersonalResidencyProgress {
  const p = value as PersonalResidencyProgress | null;
  if (!p || !uuid(p.home_id) || p.home_id !== homeId.toLowerCase()
    || !['shared', 'private_setup', 'none'].includes(p.current_access)
    || !['home', 'household_review', 'address_verification', 'resubmit', 'access_review', 'ownership_verification', 'unavailable'].includes(p.next_step)
    || (p.next_step === 'home') !== (p.current_access === 'shared')) throw new Error('Your current residency status could not be checked. Please retry.');
  if (p.request !== null) {
    validateResidencyRequest(p.request);
    if (p.request.home_id !== p.home_id) throw new Error('This request belongs to a different Home. Please refresh.');
  }
}
export const residencyRequestLabel = (r: PersonalResidencyRequest) => r.submitted_address?.trim() || `Residency request · ${r.id.slice(-8)}`;
export const residencyReviewLabel = (status: PersonalResidencyRequest['status']) => ({
  pending: 'Request pending', verified: 'Review recorded', rejected: 'Request not approved',
})[status];
