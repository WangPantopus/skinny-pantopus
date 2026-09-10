import apiClient, { get, post } from '../client';

export interface ClaimEvidenceSession {
  actor_id: string;
  session_scope: string;
  home_id: string;
  claim_id: string;
}
export interface PrivateClaimEvidence {
  id: string;
  home_id: string;
  claim_id: string;
  evidence_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  status: string;
  state: 'reserved' | 'ready' | 'retired';
  available: boolean;
  eligible_for_review: boolean;
}
function headers(scope: ClaimEvidenceSession) {
  if (!scope?.actor_id || !scope.home_id || !scope.claim_id || !/^[a-f0-9]{64}$/.test(scope.session_scope)) {
    throw new Error('Reopen the claim to verify your current session.');
  }
  return { 'x-pantopus-session-scope': scope.session_scope };
}
function path(scope: ClaimEvidenceSession, evidenceId?: string) {
  return `/api/upload/home-claim-evidence/${scope.home_id}/${scope.claim_id}${evidenceId ? `/${evidenceId}` : ''}`;
}
export async function assertClaimSession(scope: ClaimEvidenceSession, platformAdmin = false): Promise<void> {
  const response = await get<{ claim_session: ClaimEvidenceSession }>(path(scope), { review: platformAdmin ? 'platform' : 'home' }, { headers: headers(scope) });
  if (Object.keys(scope).some(key => scope[key as keyof ClaimEvidenceSession] !== response.claim_session?.[key as keyof ClaimEvidenceSession])) {
    throw new Error('Your signed-in session changed. Reopen the claim.');
  }
}
export async function inspectClaimEvidence(scope: ClaimEvidenceSession, evidenceId: string, reviewToken: string, platformAdmin = false): Promise<{ bytes: Blob; inspection: string }> {
  await assertClaimSession(scope, platformAdmin);
  const response = await apiClient.get<Blob>(`${path(scope, evidenceId)}/download`, {
    responseType: 'blob', headers: headers(scope), params: { review: platformAdmin ? 'platform' : 'home', review_token: reviewToken },
  });
  await assertClaimSession(scope, platformAdmin);
  const inspection = response.headers['x-claim-evidence-inspection'];
  if (typeof inspection !== 'string' || !/^[a-f0-9]{64}$/.test(inspection)) throw new Error('Could not confirm the inspected document. Open it again.');
  return { bytes: response.data, inspection };
}
/** Existing verified evidence remains readable without minting another review receipt. */
export async function readClaimEvidence(scope: ClaimEvidenceSession, evidenceId: string, platformAdmin = false): Promise<Blob> {
  await assertClaimSession(scope, platformAdmin);
  const response = await apiClient.get<Blob>(`${path(scope, evidenceId)}/download`, {
    responseType: 'blob', headers: headers(scope), params: { review: platformAdmin ? 'platform' : 'home' },
  });
  await assertClaimSession(scope, platformAdmin);
  return response.data;
}
export async function verifyClaimEvidence(scope: ClaimEvidenceSession, evidenceId: string, reviewToken: string, inspection: string, platformAdmin = false): Promise<{ review_token: string; record: PrivateClaimEvidence; replayed: boolean }> {
  await assertClaimSession(scope, platformAdmin);
  const result = await post<{ ok: boolean; home_id: string; claim_id: string; upload_id: string; action: string; review_token: string; record: PrivateClaimEvidence; replayed: boolean }>(
    `${path(scope, evidenceId)}/verify?review=${platformAdmin ? 'platform' : 'home'}`, { review_token: reviewToken, inspection }, { headers: headers(scope) },
  );
  await assertClaimSession(scope, platformAdmin);
  if (!result.ok || result.home_id !== scope.home_id || result.claim_id !== scope.claim_id || result.upload_id !== evidenceId
    || result.action !== 'verify_evidence' || result.record?.id !== evidenceId || result.record.home_id !== scope.home_id
    || result.record.claim_id !== scope.claim_id || result.record.status !== 'verified' || !result.record.eligible_for_review
    || !/^[a-f0-9]{64}$/.test(result.review_token) || typeof result.replayed !== 'boolean') throw new Error('Could not confirm the evidence review. Retry the same decision.');
  return result;
}
