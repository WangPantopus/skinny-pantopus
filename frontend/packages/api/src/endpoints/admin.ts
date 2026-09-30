// ============================================================
// ADMIN ENDPOINTS — Platform admin operations
// ============================================================

import { get, post } from '../client';

export interface AdminClaim {
  id: string;
  home_id: string;
  claimant_user_id: string;
  claim_type: string;
  state: string;
  method: string;
  risk_score: number;
  created_at: string;
  updated_at: string;
  home: {
    id: string;
    address: string;
    city: string;
    state: string;
    zipcode: string;
    name: string;
  } | null;
  claimant: {
    id: string;
    username: string;
    name: string;
    email: string;
    created_at: string;
    profile_picture_url: string | null;
  } | null;
  evidence_count: number;
}

export interface ClaimEvidence {
  available?: boolean;
  eligible_for_review?: boolean;
  availability_code?: string;
  id: string;
  evidence_type: string;
  provider: string;
  status: string;
  storage_ref: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface ClaimDetail {
  claim: any;
  home: any;
  claimant: any;
  evidence: ClaimEvidence[];
  claim_session: { actor_id: string; session_scope: string; home_id: string; claim_id: string };
}

export async function getPendingClaims(): Promise<{ claims: AdminClaim[]; total: number; review_session: { actor_id: string; session_scope: string } }> {
  return get('/api/admin/pending-claims');
}

export async function getClaimDetail(claimId: string, sessionScope?: string): Promise<ClaimDetail> {
  return get(`/api/admin/claims/${claimId}`, undefined, { headers: sessionScope ? { 'x-pantopus-session-scope': sessionScope } : undefined });
}

export async function reviewClaim(
  claimId: string,
  data: { action: 'approve' | 'reject' | 'request_more_info'; review_token: string; note?: string },
  sessionScope?: string,
): Promise<{ message: string }> {
  return post(`/api/admin/claims/${claimId}/review`, data, { headers: sessionScope ? { 'x-pantopus-session-scope': sessionScope } : undefined });
}

// ── Report review queue ─────────────────────────────────────

export type ReportKind = 'user' | 'post' | 'gig' | 'message';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface ReportPerson {
  id: string;
  username: string | null;
  name: string | null;
}

export interface AdminReport {
  kind: ReportKind;
  id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  target_id: string;
  /** The reported person, or a post or neighbor message ({ title, excerpt, author }) or task ({ title, status, poster }). */
  target: (ReportPerson & Record<string, unknown>) | {
    id: string;
    title: string | null;
    excerpt?: string;
    post_type?: string | null;
    archived?: boolean;
    status?: string | null;
    author?: ReportPerson | null;
    poster?: ReportPerson | null;
  } | null;
  reporter: ReportPerson | null;
  /** False for neighbor-message reports, which have no review status yet. */
  closable: boolean;
}

export async function getReports(status: ReportStatus = 'pending'): Promise<{
  status: ReportStatus;
  reports: AdminReport[];
  counts: Record<ReportKind, number>;
  total: number;
}> {
  return get('/api/admin/reports', { status });
}

export async function resolveReport(
  kind: ReportKind,
  reportId: string,
  outcome: 'resolved' | 'dismissed',
): Promise<{ report: AdminReport }> {
  return post(`/api/admin/reports/${kind}/${reportId}/resolve`, { outcome });
}
