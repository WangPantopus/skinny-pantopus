import type { homes } from '@pantopus/api';

export const HOME_CREATE_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type HomeCreationInput = Parameters<typeof homes.createHome>[0];
export interface HomeCreationDraft {
  version: 1;
  origin: string;
  actor_id: string;
  request_id: string;
  request_json: string;
  outcome?: HomeCreationOutcome;
}
export interface HomeCreationOutcome {
  state: 'pending' | 'completed' | 'cancelled' | 'rejected';
  command: { actor_id: string; request_id: string; created_at: string; updated_at: string };
  home?: { id: string };
  ownership_claim_id?: string | null;
  access_secret_ids?: string[];
  role?: string;
  requires_verification?: boolean;
  verification_type?: string;
  current_access?: string;
  code?: string;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && HOME_CREATE_UUID.test(value);
const text = (value: unknown, min: number, max: number) => typeof value === 'string' && value.trim().length >= min && value.length <= max;

/** Validate what can be retained before a POST; malformed storage is never an empty slot. */
export function validHomeCreationInput(value: unknown): value is HomeCreationInput {
  if (!object(value) || !uuid(value.address_id) || !text(value.address, 5, 255)
    || !text(value.city, 2, 100) || !text(value.state, 2, 50) || !text(value.zip_code, 3, 20)
    || !['owner', 'renter'].includes(String(value.role)) || value.is_owner !== (value.role === 'owner')
    || typeof value.latitude !== 'number' || !Number.isFinite(value.latitude) || Math.abs(value.latitude) > 90
    || typeof value.longitude !== 'number' || !Number.isFinite(value.longitude) || Math.abs(value.longitude) > 180) return false;
  for (const [key, max] of Object.entries({ unit_number: 50, name: 120, description: 2000,
    entry_instructions: 2000, parking_instructions: 2000, wifi_name: 200, wifi_password: 200 })) {
    if (value[key] !== undefined && !text(value[key], 0, max)) return false;
  }
  if (!!value.wifi_name !== !!value.wifi_password) return false;
  if (!['house', 'apartment', 'condo', 'townhouse', 'studio', 'rv', 'mobile_home', 'trailer', 'multi_unit', 'other'].includes(String(value.home_type))) return false;
  for (const key of ['bedrooms', 'bathrooms', 'sq_ft', 'lot_sq_ft', 'year_built']) {
    const n = value[key];
    if (n !== undefined && (typeof n !== 'number' || !Number.isFinite(n) || n < 0
      || (key !== 'bathrooms' && !Number.isInteger(n))
      || (['bedrooms', 'bathrooms'].includes(key) && n > 99)
      || (key === 'year_built' && (n < 1600 || n > 2100)))) return false;
  }
  return value.amenities === undefined || (object(value.amenities) && Object.values(value.amenities).every(v => typeof v === 'boolean'));
}

export function validHomeCreationOutcome(value: unknown, draft: HomeCreationDraft): value is HomeCreationOutcome {
  if (!object(value) || !['pending', 'completed', 'cancelled', 'rejected'].includes(String(value.state))
    || !object(value.command) || value.command.actor_id !== draft.actor_id || value.command.request_id !== draft.request_id
    || !['created_at', 'updated_at'].every(k => typeof value.command === 'object' && value.command !== null
      && typeof (value.command as Record<string, unknown>)[k] === 'string'
      && Number.isFinite(Date.parse((value.command as Record<string, string>)[k])))) return false;
  if (value.state !== 'completed') return value.home == null && value.ownership_claim_id == null && value.access_secret_ids == null
    && (value.state !== 'rejected' || (typeof value.code === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(value.code)));
  const input = JSON.parse(draft.request_json) as HomeCreationInput;
  const ids = value.access_secret_ids;
  return object(value.home) && uuid(value.home.id) && value.role === input.role
    && value.requires_verification === true && value.current_access === 'not_checked'
    && value.verification_type === (input.role === 'owner' ? 'ownership' : 'residency')
    && (input.role === 'owner' ? uuid(value.ownership_claim_id) : value.ownership_claim_id === null)
    && Array.isArray(ids) && ids.length === (input.wifi_name || input.wifi_password ? 1 : 0)
    && ids.every(uuid) && new Set(ids).size === ids.length;
}

/** Retain only the verified proof fields, never arbitrary response metadata. */
export function projectHomeCreationOutcome(value: HomeCreationOutcome): HomeCreationOutcome {
  return { state: value.state, command: { actor_id: value.command.actor_id, request_id: value.command.request_id,
    created_at: value.command.created_at, updated_at: value.command.updated_at },
    ...(value.state === 'completed' ? { home: { id: value.home!.id }, ownership_claim_id: value.ownership_claim_id,
      access_secret_ids: [...value.access_secret_ids!], role: value.role, requires_verification: true,
      verification_type: value.verification_type, current_access: 'not_checked' } : {}),
    ...(value.state === 'rejected' ? { code: value.code } : {}) };
}
export function sameHomeCreationDecision(a: HomeCreationOutcome, b: HomeCreationOutcome): boolean {
  const decision = (value: HomeCreationOutcome) => ({ ...projectHomeCreationOutcome(value),
    command: { actor_id: value.command.actor_id, request_id: value.command.request_id } });
  return JSON.stringify(decision(a)) === JSON.stringify(decision(b));
}
export function validHomeCreationDraft(value: unknown, origin: string, actorId: string): value is HomeCreationDraft {
  try {
    if (!object(value) || value.version !== 1 || value.origin !== origin || value.actor_id !== actorId
      || !uuid(actorId) || !uuid(value.request_id) || typeof value.request_json !== 'string') return false;
    const input = JSON.parse(value.request_json);
    return input.request_id === value.request_id && validHomeCreationInput(input)
      && (value.outcome === undefined || validHomeCreationOutcome(value.outcome, value as unknown as HomeCreationDraft));
  } catch { return false; }
}
