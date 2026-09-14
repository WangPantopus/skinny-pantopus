// ============================================================
// TENANT ENDPOINTS
// Tenant-facing landlord verification flow: request approval,
// accept invites, check landlord status, manage lease.
// Mounted at /api/v1/tenant in the backend
// ============================================================

import apiClient, { del, get, post, uploadFile } from '../client';

// ── Types ───────────────────────────────────────────────────

export type LandlordInfo = {
  has_landlord: boolean;
  /** Masked name, e.g. "J*** S***" */
  landlord_name_masked?: string;
  landlord_entity_type?: 'user' | 'business' | 'trust';
  verification_tier?: 'weak' | 'standard' | 'strong' | 'legal';
};

export type TenantLeaseState = 'none' | 'pending' | 'active' | 'denied' | 'ended';

export type TenantLease = {
  id: string;
  home_id: string;
  state: TenantLeaseState;
  source: 'landlord_invite' | 'tenant_request' | 'admin';
  start_at: string;
  end_at: string | null;
  created_at: string;
  metadata?: {
    message?: string | null;
    lease_file_id?: string;
    denied_reason?: string | null;
    denied_at?: string | null;
  };
};

export type TenantHomeStatus = {
  request_context: { home_id: string; actor_id: string; lease_id: string | null;
    lease_state: 'pending' | 'active' | 'ended' | 'canceled' | null };
  home_id: string;
  landlord: LandlordInfo;
  lease: {
    state: TenantLeaseState;
    lease: TenantLease | null;
  };
};

// ── Endpoints ───────────────────────────────────────────────

/**
 * Check the landlord + lease status for a home from the tenant perspective.
 * Returns whether a landlord authority exists and the tenant's current lease state.
 */
export async function getTenantHomeStatus(homeId: string): Promise<TenantHomeStatus> {
  return get(`/api/v1/tenant/home/${homeId}/status`);
}

/**
 * Request lease approval from the landlord of a home.
 * Creates a pending HomeLease record.
 */
export async function requestApproval(data: {
  home_id: string;
  lease_file_id?: string;
  request_context?: TenantHomeStatus['request_context'];
  start_at?: string | null;
  end_at?: string | null;
  message?: string | null;
}, session?: LeaseFileSession): Promise<{ lease: TenantLease }> {
  if (session && (session.home_id !== data.home_id || session.actor_id !== data.request_context?.actor_id)) {
    throw new Error('Reopen this request to confirm the current account and Home.');
  }
  return session ? post('/api/v1/tenant/request-approval', data, { headers: leaseFileHeaders(session) })
    : post('/api/v1/tenant/request-approval', data);
}

export type LeaseFileSession = { home_id: string; actor_id: string; session_scope: string };
export type LeaseFile = { id: string; home_id: string; file_name: string; file_size: number;
  mime_type: string; available: boolean; lease_id: string | null };
const leaseFileUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LEASE_FILE_MIME_TYPES = ['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const LEASE_FILE_MAX_BYTES = 25 * 1024 * 1024;
function leaseFilePath(homeId: string, fileId?: string) {
  if (!leaseFileUUID.test(homeId) || (fileId !== undefined && !leaseFileUUID.test(fileId))) {
    throw new Error('Invalid Home or lease file.');
  }
  return `/api/v1/tenant/home/${homeId}/lease-files${fileId ? `/${fileId}` : ''}`;
}
function leaseFileHeaders(session: LeaseFileSession) {
  if (!leaseFileUUID.test(session?.home_id || '') || !leaseFileUUID.test(session?.actor_id || '')
    || !/^[0-9a-f]{64}$/.test(session?.session_scope || '')) throw new Error('Reopen the request to check your session.');
  return { 'x-pantopus-session-scope': session.session_scope };
}
function checkedLeaseFile(file: LeaseFile, homeId: string, fileId: string): LeaseFile {
  if (!file || file.id !== fileId || file.home_id !== homeId || !leaseFileUUID.test(file.id)
    || typeof file.file_name !== 'string' || !file.file_name || file.file_name.length > 255
    || !Number.isSafeInteger(file.file_size) || file.file_size <= 0 || file.file_size > LEASE_FILE_MAX_BYTES
    || !LEASE_FILE_MIME_TYPES.includes(file.mime_type) || file.available !== true
    || (file.lease_id !== null && !leaseFileUUID.test(file.lease_id))) throw new Error('Could not confirm this lease file. Please retry.');
  return file;
}
export async function getLeaseFileSession(homeId: string, expected?: LeaseFileSession): Promise<LeaseFileSession> {
  const session = await get<LeaseFileSession>(`${leaseFilePath(homeId)}/session`, undefined,
    expected ? { headers: leaseFileHeaders(expected) } : undefined);
  leaseFileHeaders(session);
  if (session.home_id !== homeId || (expected && (session.actor_id !== expected.actor_id || session.session_scope !== expected.session_scope))) {
    throw new Error('Your signed-in session changed. Reopen this request.');
  }
  return session;
}
export async function getLeaseFile(session: LeaseFileSession, fileId: string): Promise<LeaseFile> {
  const result = await get<{ file: LeaseFile }>(leaseFilePath(session.home_id, fileId), undefined, { headers: leaseFileHeaders(session) });
  return checkedLeaseFile(result.file, session.home_id, fileId);
}
export async function uploadLeaseFile(session: LeaseFileSession, uploadId: string, file: File,
  context: TenantHomeStatus['request_context']): Promise<LeaseFile> {
  leaseFilePath(session.home_id, uploadId);
  if (context.home_id !== session.home_id || context.actor_id !== session.actor_id
    || !LEASE_FILE_MIME_TYPES.includes(file.type) || file.size <= 0 || file.size > LEASE_FILE_MAX_BYTES) {
    throw new Error('Choose a nonempty PDF, text file or supported image of 25 MB or less.');
  }
  const result = await uploadFile<{ file: LeaseFile }>(leaseFilePath(session.home_id), file,
    { upload_id: uploadId, request_context: context }, { headers: leaseFileHeaders(session) });
  return checkedLeaseFile(result.file, session.home_id, uploadId);
}
export async function removeLeaseFile(session: LeaseFileSession, fileId: string): Promise<void> {
  const result = await del<{ deleted: boolean }>(leaseFilePath(session.home_id, fileId), undefined, { headers: leaseFileHeaders(session) });
  if (result.deleted !== true) throw new Error('Could not confirm file removal. Please retry.');
}
export async function downloadLeaseFile(session: LeaseFileSession, fileId: string): Promise<{ file: LeaseFile; bytes: Blob }> {
  const before = await getLeaseFile(session, fileId);
  const response = await apiClient.get<Blob>(`${leaseFilePath(session.home_id, fileId)}/content`, {
    responseType: 'blob', headers: leaseFileHeaders(session),
  });
  const file = await getLeaseFile(session, fileId);
  if (['id', 'home_id', 'file_name', 'file_size', 'mime_type', 'lease_id', 'available']
    .some(key => before[key as keyof LeaseFile] !== file[key as keyof LeaseFile]) || response.data.size !== file.file_size
    || response.data.type.split(';')[0].trim().toLowerCase() !== file.mime_type) {
    throw new Error('This lease file changed while opening. Open it again.');
  }
  return { file, bytes: response.data };
}

/**
 * Accept a lease invite by token.
 * The token is a 64-char hex string provided by the landlord.
 */
export async function previewInvite(token: string): Promise<{
  home: { id: string; name: string | null; city: string | null };
  invitation: { status: 'pending' | 'accepted'; proposed_start: string; proposed_end: string | null; expires_at: string };
  account_email: string;
}> {
  return post('/api/v1/tenant/preview-invite', { token });
}

export async function acceptInvite(token: string): Promise<{
  lease: TenantLease;
  occupancy: any;
}> {
  return post('/api/v1/tenant/accept-invite', { token });
}

/**
 * Cancel a pending lease request.
 */
export async function cancelRequest(leaseId: string): Promise<{ success: boolean }> {
  return post(`/api/v1/tenant/request/${leaseId}/cancel`);
}

/**
 * Tenant requests to end their own active lease (move out).
 */
export async function moveOut(leaseId: string, reason?: string): Promise<{ success: boolean }> {
  return post('/api/v1/tenant/move-out', { lease_id: leaseId, reason });
}
