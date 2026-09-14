import type { homes } from '@pantopus/api';
import { HOME_CREATE_UUID, projectHomeCreationOutcome, validHomeCreationDraft, validHomeCreationOutcome,
  type HomeCreationOutcome, type HomeRequestDraft, type HomeResidencyDraft } from './homeCreationModel';

export interface HomeResidencyInput {
  claimed_role: 'renter' | 'household';
  address: homes.ResidencyAddressSnapshot;
  request_id?: string;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && HOME_CREATE_UUID.test(value);
export function validHomeResidencyInput(value: unknown): value is HomeResidencyInput {
  if (!object(value) || !['renter', 'household'].includes(String(value.claimed_role)) || !object(value.address)
    || Object.keys(value).some(key => !['claimed_role', 'address', 'request_id'].includes(key))
    || (value.request_id !== undefined && !uuid(value.request_id))) return false;
  const fields: Record<string, number> = { line1: 255, line2: 255, city: 100, state: 50, postal_code: 20, country: 100 };
  const address = value.address;
  return !Object.keys(address).some(key => !Object.hasOwn(fields, key)) && Object.entries(fields).every(([key, max]) =>
    typeof address[key] === 'string' && address[key].length <= max && (key === 'line2' || !!address[key].trim()));
}

export function validHomeRequestOutcome(value: unknown, draft: HomeRequestDraft): value is HomeCreationOutcome {
  if (draft.version === 1) return validHomeCreationOutcome(value, draft);
  if (!object(value) || !['pending', 'completed', 'cancelled', 'rejected'].includes(String(value.state))
    || value.home_id !== draft.home_id || !object(value.command)
    || value.command.actor_id !== draft.actor_id || value.command.request_id !== draft.request_id
    || ![value.command.created_at, value.command.updated_at].every(date => typeof date === 'string' && Number.isFinite(Date.parse(date)))
    || value.home != null || value.ownership_claim_id != null || value.access_secret_ids != null) return false;
  if (value.state !== 'completed') return value.claim_id == null && value.occupancy_id == null
    && value.claimed_role == null && value.routing == null
    && (value.state !== 'rejected' || (typeof value.code === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(value.code)));
  try {
    const input = JSON.parse(draft.request_json) as HomeResidencyInput;
    return uuid(value.claim_id) && uuid(value.occupancy_id) && value.claimed_role === input.claimed_role
      && ['household_review', 'self_bootstrap', 'external_postcard', 'stale_authority_postcard'].includes(String(value.routing))
      && value.current_access === 'not_checked' && value.requires_verification === true && value.postcard_requested === false
      && value.next_step === (value.routing === 'household_review' ? 'household_review' : 'address_verification');
  } catch { return false; }
}

/** The existing encrypted slot keeps v1 creation commands readable. A v2 join
 * shares its compare-and-write fence; neither flow can erase the other. */
export function validHomeRequestDraft(value: unknown, origin: string, actorId: string): value is HomeRequestDraft {
  if (object(value) && value.version === 1) return validHomeCreationDraft(value, origin, actorId);
  try {
    if (!object(value) || value.version !== 2 || value.origin !== origin || value.actor_id !== actorId
      || !uuid(actorId) || !uuid(value.home_id) || !uuid(value.request_id) || typeof value.request_json !== 'string') return false;
    const input = JSON.parse(value.request_json);
    return validHomeResidencyInput(input) && input.request_id === value.request_id
      && (value.outcome === undefined || validHomeRequestOutcome(value.outcome, value as unknown as HomeResidencyDraft));
  } catch { return false; }
}
export function projectHomeRequestOutcome(value: HomeCreationOutcome, draft: HomeRequestDraft): HomeCreationOutcome {
  if (draft.version === 1) return projectHomeCreationOutcome(value);
  return { state: value.state, home_id: value.home_id, command: { actor_id: value.command.actor_id,
    request_id: value.command.request_id, created_at: value.command.created_at, updated_at: value.command.updated_at },
    ...(value.state === 'completed' ? { claim_id: value.claim_id, occupancy_id: value.occupancy_id,
      claimed_role: value.claimed_role, routing: value.routing, requires_verification: true,
      current_access: 'not_checked', next_step: value.next_step, postcard_requested: false } : {}),
    ...(value.state === 'rejected' ? { code: value.code } : {}) };
}
export function sameHomeRequestDecision(a: HomeCreationOutcome, b: HomeCreationOutcome, draft: HomeRequestDraft): boolean {
  const decision = (value: HomeCreationOutcome) => ({ ...projectHomeRequestOutcome(value, draft),
    command: { actor_id: value.command.actor_id, request_id: value.command.request_id } });
  return JSON.stringify(decision(a)) === JSON.stringify(decision(b));
}
