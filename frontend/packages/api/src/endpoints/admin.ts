// ============================================================
// ADMIN ENDPOINTS — Platform admin operations
// ============================================================

import apiClient, { get, post } from '../client';
import type { ClaimReviewApproval } from './homeOwnership';

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
  /** When the last review action (approve, reject, flag, Request info) happened. */
  reviewed_at?: string | null;
  /** On a claim waiting on the claimant (Request info): documents they sent after the request. */
  documents_since_request?: number;
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
  /** Null when it couldn't be read; approval itself still decides. */
  approval?: ClaimReviewApproval | null;
  claim_session: { actor_id: string; session_scope: string; home_id: string; claim_id: string };
}

export async function getPendingClaims(): Promise<{ claims: AdminClaim[]; total: number; review_session: { actor_id: string; session_scope: string } }> {
  return get('/api/admin/pending-claims');
}

export async function getClaimDetail(claimId: string, sessionScope?: string): Promise<ClaimDetail> {
  return get(`/api/admin/claims/${claimId}`, undefined, { headers: sessionScope ? { 'x-pantopus-session-scope': sessionScope } : undefined });
}

/** Household roles a platform admin may approve a claim as (`approve_as`); omit it to grant what the claim type gives. */
export type ClaimApprovalRole = 'owner' | 'admin' | 'manager' | 'member' | 'lease_resident' | 'restricted_member' | 'guest';

export async function reviewClaim(
  claimId: string,
  data: {
    action: 'approve' | 'reject' | 'request_more_info';
    review_token: string;
    note?: string;
    approve_as?: ClaimApprovalRole;
    identity_confirmed?: boolean;
  },
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
  /** "Report this card" (launch key holiday_card_memories): the report shares that one card, opened with getReportedCard. */
  shared_card?: { kind: 'card' | 'reply' } | null;
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

/** The one card a "Report this card" shares, as the admins see it: never covered, both names, its dates. */
export interface ReportedCard {
  id: string;
  kind: 'card' | 'reply' | null;
  from_name: string | null;
  to_name: string | null;
  sent_on: string | null;
  delivered_on: string | null;
  card: {
    design: string;
    number: number | null;
    caption: string | null;
    paper: string | null;
    year: number | null;
    verse?: string | null;
    signature?: { w: number; h: number; strokes: number[][] } | null;
    photo?: { file_id: string; width: number | null; height: number | null; alt: string | null } | null;
    voice?: { file_id: string; duration_ms: number | null } | null;
  } | null;
  note: string;
}

/**
 * GET /api/admin/reports/user/:reportId/card: that card and nothing else. Every opening is logged on the server
 * (admin_opened_reported_card); 404 REPORT_CARD_NOT_FOUND when the report shares none.
 */
export async function getReportedCard(reportId: string): Promise<{
  report: { id: string; reason: string; details: string | null; status: ReportStatus; created_at: string };
  card: ReportedCard;
}> {
  return get(`/api/admin/reports/user/${encodeURIComponent(reportId)}/card`);
}

/** The shared card's own photo or voice greeting, as a Blob (private, no-store), through the report's route only. */
export async function getReportedCardMediaBlob(reportId: string, fileId: string, signal?: AbortSignal): Promise<Blob> {
  const response = await apiClient.get<Blob>(
    `/api/admin/reports/user/${encodeURIComponent(reportId)}/card/media/${encodeURIComponent(fileId)}`,
    { responseType: 'blob', signal },
  );
  return response.data;
}

/** Take a reported post down (moderation) and close every open report on it. */
export async function removeReportedPost(reportId: string): Promise<{
  removed: boolean;
  post_id: string;
  reports_closed: number;
}> {
  return post(`/api/admin/reports/post/${reportId}/remove`, {});
}

// ── Business verification documents (platform admins) ───────

export interface VerificationQueueItem {
  id: string;
  business_user_id: string;
  business: {
    id: string;
    username: string | null;
    name: string | null;
    profile_picture_url: string | null;
    /** The type the business says it is; approving verifies it. */
    business_type?: string | null;
  } | null;
  evidence_type: string;
  file_id: string | null;
  /** A link to the document that works for about ten minutes; null when the file is gone. */
  document_url: string | null;
  document_mime_type: string | null;
  /** The platform fee approving sets for the business (a reduced rate for its type), or null when it sets none. */
  fee_on_approval_pct?: number | null;
  /** Unverified pages with this business's name at one of its addresses; approving settles who keeps the name there. */
  same_name_pages?: { business_user_id: string; name: string; username: string | null }[];
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Documents businesses submitted for verification, oldest first. */
export async function getVerificationQueue(): Promise<{ items: VerificationQueueItem[]; total: number }> {
  return get('/api/admin/verification/queue');
}

/** Approve (business becomes document verified) or reject a submitted document. */
export async function reviewVerificationEvidence(
  evidenceId: string,
  decision: 'approve' | 'reject',
  notes?: string,
): Promise<Record<string, unknown>> {
  return post(`/api/admin/verification/${evidenceId}/${decision}`, notes ? { notes } : {});
}
