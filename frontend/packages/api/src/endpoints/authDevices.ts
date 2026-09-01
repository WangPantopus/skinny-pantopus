// ============================================================
// AUTH DEVICES / SESSIONS / STEP-UP ENDPOINTS  (/api/auth/*)
// Persistent login & trusted devices — see
// docs/persistent-login/CONTRACT.md (pinned wire contract, wins over docs).
//
// Everything here works over the web cookie transport (CSRF header is added
// by the shared client for unsafe methods) and over Bearer for legacy mobile.
// Endpoints that need a DPoP proof (/devices/register, /resume, /step-up-key)
// are native-only and intentionally NOT exposed here — the shared JS client
// has no device key.
// ============================================================

import { get, post, del, patch, type ApiRequestConfig } from '../client';

// ---------- Types (mirror CONTRACT.md §"New router /api/auth") ----------

export type DevicePlatform = 'ios' | 'android' | 'web' | (string & {});
export type DeviceTrustLevel = 'trusted' | 'unverified' | 'suspect';
export type SessionContext = 'interactive' | 'restored' | 'oauth';

export type StepUpPurpose =
  | 'delete_account'
  | 'revoke_device'
  | 'revoke_sessions'
  | 'change_security_prefs'
  | 'generic';

export type StepUpMethod = 'password' | 'device_key';

export interface AuthDeviceSummary {
  id: string;
  deviceId: string;
  platform: DevicePlatform;
  name: string | null;
  model: string | null;
  osVersion: string | null;
  appVersion: string | null;
  isCurrent: boolean;
  trustLevel: DeviceTrustLevel;
  trustedAt: string | null;
  lastSeenAt: string | null;
  lastIp?: string | null;
  createdAt: string;
}

export interface AuthSessionSummary {
  id: string;
  platform: DevicePlatform;
  userAgent: string | null;
  isCurrent: boolean;
  lastSeenAt: string | null;
  issuedAt: string;
}

export interface AuthSecurityEvent {
  id: string | number;
  type: string;
  createdAt: string;
  deviceId?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface AuthDevicesResponse {
  devices: AuthDeviceSummary[];
  sessions: AuthSessionSummary[];
  events: AuthSecurityEvent[];
}

export interface SecurityPrefs {
  allowRestoreGrants: boolean;
  newDeviceEmail: boolean;
}

export interface StepUpResponse {
  stepUpToken: string;
  expiresAt: string | number;
  purpose: StepUpPurpose | string;
}

export interface StepUpRequiredBody {
  error?: string;
  code: 'STEP_UP_REQUIRED';
  purpose?: StepUpPurpose | string;
  methods?: StepUpMethod[];
}

export interface AuthChallengeResponse {
  challengeId: string;
  challenge: string; // base64url, 32 bytes
  expiresAt: string | number;
}

/** Header carrying the opaque step-up token (CONTRACT.md §Headers). */
export const STEP_UP_HEADER = 'X-Step-Up';

function withStepUp(stepUpToken?: string | null, base?: ApiRequestConfig): ApiRequestConfig | undefined {
  if (!stepUpToken) return base;
  return {
    ...base,
    headers: { ...(base?.headers as Record<string, string> | undefined), [STEP_UP_HEADER]: stepUpToken },
  };
}

// ---------- Error helpers ----------

/**
 * The shared client rejects with `{ message, code, statusCode, data }` where
 * `data` is the raw backend envelope `{ error, code, ... }`. Read the machine
 * code from there (the top-level `code` is the legacy human `error` string).
 */
export function getApiErrorCode(err: unknown): string | undefined {
  const anyErr = err as { data?: { code?: unknown }; code?: unknown } | null | undefined;
  const fromData = anyErr?.data?.code;
  if (typeof fromData === 'string') return fromData;
  return undefined;
}

/** True when the backend answered 403 `STEP_UP_REQUIRED` (CONTRACT.md §Error envelope). */
export function isStepUpRequired(err: unknown): err is { statusCode: 403; data: StepUpRequiredBody } {
  const anyErr = err as { statusCode?: number } | null | undefined;
  return anyErr?.statusCode === 403 && getApiErrorCode(err) === 'STEP_UP_REQUIRED';
}

/** 401 codes that mean "signed out for security" — clients wipe tokens, keep the display hint. */
export const SECURITY_SIGN_OUT_CODES = new Set([
  'TOKEN_REUSE',
  'DEVICE_MISMATCH',
  'DEVICE_REVOKED',
  'SESSION_REVOKED',
  'SESSION_EXPIRED_INACTIVE',
  'DPOP_REQUIRED',
]);

export function isSecuritySignOutCode(code: string | undefined | null): boolean {
  return Boolean(code && SECURITY_SIGN_OUT_CODES.has(code));
}

// ---------- Devices & sessions ----------

/** GET /api/auth/devices → devices + web sessions + recent events. */
export async function getDevices(): Promise<AuthDevicesResponse> {
  const res = await get<Partial<AuthDevicesResponse>>('/api/auth/devices');
  return {
    devices: Array.isArray(res?.devices) ? res.devices : [],
    sessions: Array.isArray(res?.sessions) ? res.sessions : [],
    events: Array.isArray(res?.events) ? res.events : [],
  };
}

/** DELETE /api/auth/devices/:id — requires step-up (purpose `revoke_device`). */
export async function revokeDevice(deviceRowId: string, stepUpToken: string): Promise<{ ok: boolean }> {
  return del<{ ok: boolean }>(
    `/api/auth/devices/${encodeURIComponent(deviceRowId)}`,
    undefined,
    withStepUp(stepUpToken),
  );
}

/** POST /api/auth/sessions/revoke-others — requires step-up (purpose `revoke_sessions`). */
export async function revokeOtherSessions(stepUpToken: string): Promise<{ revoked: number }> {
  return post<{ revoked: number }>('/api/auth/sessions/revoke-others', {}, withStepUp(stepUpToken));
}

/**
 * POST /api/auth/sessions/revoke-all ("Lockdown") — requires step-up
 * (purpose `revoke_sessions`). The caller MUST sign itself out afterwards
 * (cookies/tokens are dead server-side).
 */
export async function revokeAllSessions(stepUpToken: string): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>('/api/auth/sessions/revoke-all', {}, withStepUp(stepUpToken));
}

// ---------- Step-up ----------

/** POST /api/auth/step-up { method:'password' } → step-up token (5 min, purpose-bound). */
export async function stepUpWithPassword(purpose: StepUpPurpose, password: string): Promise<StepUpResponse> {
  return post<StepUpResponse>('/api/auth/step-up', { purpose, method: 'password', password });
}

/**
 * POST /api/auth/step-up { method:'device_key' } — native only in practice
 * (needs a biometry-bound step-up key). Exposed for parity with the contract.
 */
export async function stepUpWithDeviceKey(
  purpose: StepUpPurpose,
  challengeId: string,
  signature: string,
): Promise<StepUpResponse> {
  return post<StepUpResponse>('/api/auth/step-up', { purpose, method: 'device_key', challengeId, signature });
}

/** POST /api/auth/challenge — unauthenticated nonce for step_up / resume / attestation. */
export async function createChallenge(
  purpose: 'step_up' | 'resume' | 'attestation',
): Promise<AuthChallengeResponse> {
  return post<AuthChallengeResponse>('/api/auth/challenge', { purpose });
}

// ---------- Security prefs & events ----------

/** GET /api/auth/security-prefs */
export async function getSecurityPrefs(): Promise<SecurityPrefs> {
  const res = await get<Partial<SecurityPrefs>>('/api/auth/security-prefs');
  return {
    allowRestoreGrants: res?.allowRestoreGrants !== false,
    newDeviceEmail: res?.newDeviceEmail !== false,
  };
}

/** PATCH /api/auth/security-prefs — requires step-up (purpose `change_security_prefs`). */
export async function updateSecurityPrefs(
  prefs: Partial<SecurityPrefs>,
  stepUpToken: string,
): Promise<SecurityPrefs> {
  const res = await patch<Partial<SecurityPrefs>>('/api/auth/security-prefs', prefs, withStepUp(stepUpToken));
  return {
    allowRestoreGrants: res?.allowRestoreGrants !== false,
    newDeviceEmail: res?.newDeviceEmail !== false,
  };
}

/** GET /api/auth/security-events?limit=50 */
export async function getSecurityEvents(limit = 50): Promise<{ events: AuthSecurityEvent[] }> {
  const res = await get<{ events?: AuthSecurityEvent[] }>('/api/auth/security-events', { limit });
  return { events: Array.isArray(res?.events) ? res.events : [] };
}
