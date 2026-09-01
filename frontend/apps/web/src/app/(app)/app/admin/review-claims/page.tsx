'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CheckCircle, XCircle, HelpCircle, MapPin, User,
  FileText, Image as ImageIcon, Shield, ChevronRight, X, AlertCircle,
  RefreshCw,
} from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { formatTimeAgo } from '@pantopus/ui-utils';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

type ClaimForReview = api.admin.AdminClaim;
type EvidenceItem = api.admin.ClaimEvidence;

const METHOD_LABELS: Record<string, string> = {
  doc_upload: 'Document Upload',
  escrow_agent: 'Escrow/Title Agent',
  property_data_match: 'ID Verification',
  invite: 'Invited',
  vouch: 'Vouched',
  landlord_portal: 'Landlord Portal',
};

const EVIDENCE_LABELS: Record<string, string> = {
  deed: 'Deed',
  closing_disclosure: 'Closing Disclosure',
  tax_bill: 'Tax Bill',
  utility_bill: 'Utility Bill',
  lease: 'Lease Agreement',
  escrow_attestation: 'Escrow Attestation',
  title_match: 'Title Match',
  idv: 'ID Verification',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminReviewClaimsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<ClaimForReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail panel (right side on desktop, overlay on mobile)
  const [selectedClaim, setSelectedClaim] = useState<ClaimForReview | null>(null);
  const [claimDetail, setClaimDetail] = useState<api.admin.ClaimDetail | null>(null);
  const [comparison, setComparison] = useState<api.homeOwnership.OwnershipClaimComparison | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewingAction, setReviewingAction] = useState<string | null>(null);

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  // Evidence viewer
  const [evidenceViewerUrl, setEvidenceViewerUrl] = useState<string | null>(null);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchClaims = useCallback(async () => {
    try {
      const result = await api.admin.getPendingClaims();
      setClaims(result.claims || []);
    } catch (err: any) {
      if (err?.statusCode === 403 || err?.status === 403) {
        toast.error('You do not have admin access.');
        router.back();
      }
    }
  }, [router]);

  useEffect(() => {
    setLoading(true);
    fetchClaims().finally(() => setLoading(false));
  }, [fetchClaims]);

  const openClaimDetail = async (claim: ClaimForReview) => {
    setSelectedClaim(claim);
    setDetailLoading(true);
    setClaimDetail(null);
    setComparison(null);
    try {
      const detail = await api.admin.getClaimDetail(claim.id);
      setClaimDetail(detail);
      try {
        const compare = await api.homeOwnership.getOwnershipClaimComparison(claim.home_id);
        setComparison(compare);
      } catch {
        setComparison(null);
      }
    } catch {
      toast.error('Failed to load claim details');
    } finally {
      setDetailLoading(false);
    }
  };

  const renderComparisonSection = () => {
    if (!comparison) return null;

    return (
      <section>
        <h3 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider mb-2">Household Comparison</h3>
        <div className="space-y-3">
          <div className="rounded-xl border border-app-border bg-app-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-violet-100 text-violet-700">
                {comparison.household_resolution_state.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-slate-100 text-slate-700">
                Security: {comparison.home.security_state.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-amber-100 text-amber-700">
                Incumbent: {comparison.incumbent.challenge_state.replace(/_/g, ' ')}
              </span>
            </div>
            {comparison.incumbent.owners.length > 0 ? (
              <div className="mt-3 space-y-2">
                {comparison.incumbent.owners.map((owner) => (
                  <div key={owner.id} className="rounded-lg bg-app-surface-sunken px-3 py-2">
                    <p className="text-sm font-semibold text-app-text">
                      {owner.user?.name || owner.user?.username || owner.subject_id}
                    </p>
                    <p className="text-xs text-app-text-secondary">
                      {owner.owner_status} {owner.verification_tier ? `· ${owner.verification_tier}` : ''}
                      {owner.is_primary_owner ? ' · primary' : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-app-text-secondary">No verified incumbent owners.</p>
            )}
          </div>

          <div className="space-y-3">
            {comparison.claims.map((compareClaim) => (
              <div
                key={compareClaim.id}
                className={`rounded-xl border p-4 ${
                  compareClaim.id === claimDetail?.claim?.id
                    ? 'border-violet-500 bg-violet-50/40'
                    : 'border-app-border bg-app-surface'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-app-text">
                      {compareClaim.claimant?.name || compareClaim.claimant?.username || compareClaim.claimant_user_id}
                    </p>
                    <p className="text-xs text-app-text-secondary">
                      {compareClaim.claim_type} · {compareClaim.method}
                    </p>
                  </div>
                  {compareClaim.id === claimDetail?.claim?.id ? (
                    <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-violet-600 text-white">
                      selected
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-amber-100 text-amber-700">
                    {(compareClaim.claim_phase_v2 || compareClaim.state || 'unknown').replace(/_/g, ' ')}
                  </span>
                  {compareClaim.routing_classification ? (
                    <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-blue-100 text-blue-700">
                      {compareClaim.routing_classification.replace(/_/g, ' ')}
                    </span>
                  ) : null}
                  {compareClaim.claim_strength ? (
                    <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-slate-100 text-slate-700">
                      {compareClaim.claim_strength.replace(/_/g, ' ')}
                    </span>
                  ) : null}
                  {compareClaim.challenge_state && compareClaim.challenge_state !== 'none' ? (
                    <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-red-100 text-red-700">
                      {compareClaim.challenge_state.replace(/_/g, ' ')}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2">
                  {compareClaim.evidence.length > 0 ? (
                    compareClaim.evidence.map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between rounded-lg bg-app-surface-sunken px-3 py-2">
                        <div>
                          <p className="text-xs font-semibold text-app-text">{EVIDENCE_LABELS[ev.evidence_type] || ev.evidence_type}</p>
                          <p className="text-[11px] text-app-text-secondary">
                            {ev.provider} · {ev.status}
                            {ev.confidence_level ? ` · ${ev.confidence_level}` : ''}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-app-text-secondary">No evidence attached.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const handleReview = async (
    claimId: string,
    action: 'approve' | 'reject' | 'request_more_info',
    note?: string,
  ) => {
    setReviewingAction(action);
    try {
      await api.admin.reviewClaim(claimId, { action, note });
      toast.success(
        action === 'approve' ? 'Claim approved. User has been verified.'
          : action === 'reject' ? 'Claim rejected. User has been notified.'
          : 'More info requested. User has been notified.',
      );
      setSelectedClaim(null);
      setClaimDetail(null);
      setComparison(null);
      setShowRejectModal(false);
      setRejectNote('');
      await fetchClaims();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to review claim');
    } finally {
      setReviewingAction(null);
    }
  };

  const handleApprove = async (claimId: string) => {
    const ok = await confirmStore.open({
      title: 'Approve Claim',
      description: 'This will verify the user and grant them access. Are you sure?',
      confirmLabel: 'Approve',
    });
    if (ok) handleReview(claimId, 'approve');
  };

  // ── CLAIM LIST ──
  const renderClaimList = () => (
    <div className="space-y-3">
      {claims.map(claim => (
        <button key={claim.id} onClick={() => openClaimDetail(claim)}
          className={`w-full text-left bg-app-surface border rounded-xl p-4 hover:shadow-md transition ${
            selectedClaim?.id === claim.id ? 'border-violet-500 shadow-md' : 'border-app-border'
          }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${
              claim.claim_type === 'owner'
                ? 'bg-violet-100 text-violet-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {claim.claim_type === 'owner' ? 'Ownership' : 'Residency'}
            </span>
            <span className="text-xs text-app-text-muted">{formatTimeAgo(claim.created_at)}</span>
          </div>

          <p className="text-sm font-semibold text-app-text truncate mb-2">
            {claim.home
              ? [claim.home.name || claim.home.address, claim.home.city, claim.home.state].filter(Boolean).join(', ')
              : 'Unknown address'}
          </p>

          <div className="flex items-center gap-4 text-xs text-app-text-secondary mb-2">
            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{claim.claimant?.name || claim.claimant?.username || 'Unknown'}</span>
            <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{claim.evidence_count} doc{claim.evidence_count !== 1 ? 's' : ''}</span>
            <span className={`flex items-center gap-1 ${claim.risk_score > 50 ? 'text-red-600' : ''}`}>
              <Shield className="w-3.5 h-3.5" />Risk: {claim.risk_score}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-app-border-subtle">
            <span className="text-xs text-app-text-muted">{METHOD_LABELS[claim.method] || claim.method}</span>
            <ChevronRight className="w-4 h-4 text-app-text-muted" />
          </div>
        </button>
      ))}
    </div>
  );

  // ── DETAIL PANEL ──
  const renderDetailPanel = () => {
    if (!selectedClaim) return (
      <div className="hidden lg:flex flex-1 items-center justify-center text-app-text-muted">
        <p className="text-sm">Select a claim to review</p>
      </div>
    );

    return (
      <div className={`${selectedClaim ? 'fixed inset-0 z-50 bg-app-surface lg:static lg:z-auto' : 'hidden lg:block'} flex flex-col flex-1 overflow-hidden`}>
        {/* Detail header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-app-border flex-shrink-0">
          <button onClick={() => { setSelectedClaim(null); setClaimDetail(null); setComparison(null); }} className="lg:hidden p-1.5 hover:bg-app-hover rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-base font-semibold text-app-text">Review Claim</h2>
          <button onClick={() => { setSelectedClaim(null); setClaimDetail(null); setComparison(null); }} className="hidden lg:block p-1.5 hover:bg-app-hover rounded-lg"><X className="w-5 h-5 text-app-text-muted" /></button>
        </div>

        {detailLoading ? (
          <div className="flex-1 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-3 border-violet-600 border-t-transparent rounded-full" /></div>
        ) : claimDetail ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Home info */}
            <section>
              <h3 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider mb-2">Home</h3>
              <div className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4">
                <MapPin className="w-5 h-5 text-violet-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-app-text truncate">{claimDetail.home?.name || claimDetail.home?.address}</p>
                  <p className="text-xs text-app-text-secondary">{[claimDetail.home?.address, claimDetail.home?.city, claimDetail.home?.state, claimDetail.home?.zipcode].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            </section>

            {/* Claimant info */}
            <section>
              <h3 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider mb-2">Claimant</h3>
              <div className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4">
                {claimDetail.claimant?.profile_picture_url ? (
                  <img src={claimDetail.claimant.profile_picture_url} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-app-surface-sunken flex items-center justify-center">
                    <User className="w-5 h-5 text-app-text-muted" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-app-text">{claimDetail.claimant?.name || claimDetail.claimant?.username || 'Unknown'}</p>
                  <p className="text-xs text-app-text-secondary">{claimDetail.claimant?.email}</p>
                  {claimDetail.claimant?.created_at && (
                    <p className="text-[11px] text-app-text-muted mt-0.5">Account created: {formatDate(claimDetail.claimant.created_at)}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Claim details grid */}
            <section>
              <h3 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider mb-2">Claim Details</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Type', value: claimDetail.claim?.claim_type === 'owner' ? 'Ownership' : claimDetail.claim?.claim_type === 'resident' ? 'Residency' : claimDetail.claim?.claim_type },
                  { label: 'Method', value: METHOD_LABELS[claimDetail.claim?.method] || claimDetail.claim?.method },
                  { label: 'Risk Score', value: claimDetail.claim?.risk_score ?? 'N/A', danger: (claimDetail.claim?.risk_score || 0) > 50 },
                  { label: 'Submitted', value: formatDate(claimDetail.claim?.created_at) },
                ].map(item => (
                  <div key={item.label} className="bg-app-surface border border-app-border rounded-xl p-3">
                    <p className="text-[11px] text-app-text-muted font-semibold mb-1">{item.label}</p>
                    <p className={`text-sm font-semibold ${(item as any).danger ? 'text-red-600' : 'text-app-text'}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {renderComparisonSection()}

            {/* Evidence */}
            <section>
              <h3 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider mb-2">
                Evidence ({claimDetail.evidence?.length || 0})
              </h3>
              {(!claimDetail.evidence || claimDetail.evidence.length === 0) ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800">No documents uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {claimDetail.evidence.map((ev: EvidenceItem) => (
                    <div key={ev.id} className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-3">
                      <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                        {ev.mime_type?.startsWith('image/') ? <ImageIcon className="w-5 h-5 text-violet-600" /> : <FileText className="w-5 h-5 text-violet-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-app-text">{EVIDENCE_LABELS[ev.evidence_type] || ev.evidence_type}</p>
                        <p className="text-xs text-app-text-secondary truncate">{ev.file_name || 'Document'}</p>
                        {ev.file_size && <p className="text-[11px] text-app-text-muted">{(ev.file_size / 1024).toFixed(0)} KB &middot; {formatDate(ev.created_at)}</p>}
                      </div>
                      {ev.file_url && (
                        <button onClick={() => setEvidenceViewerUrl(ev.file_url!)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 text-violet-600 text-xs font-semibold rounded-lg hover:bg-violet-100 transition">
                          View
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Actions */}
            <section className="pt-4 border-t border-app-border space-y-3">
              <button onClick={() => handleApprove(claimDetail.claim.id)} disabled={!!reviewingAction}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition">
                {reviewingAction === 'approve' ? 'Approving...' : <><CheckCircle className="w-5 h-5" /> Approve</>}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowRejectModal(true)} disabled={!!reviewingAction}
                  className="flex items-center justify-center gap-1.5 py-2.5 border-2 border-red-300 bg-red-50 text-red-700 font-semibold rounded-xl hover:bg-red-100 disabled:opacity-50 transition">
                  <XCircle className="w-4.5 h-4.5" /> Reject
                </button>
                <button onClick={() => handleReview(claimDetail.claim.id, 'request_more_info', 'Please upload additional documents.')} disabled={!!reviewingAction}
                  className="flex items-center justify-center gap-1.5 py-2.5 border-2 border-amber-300 bg-amber-50 text-amber-700 font-semibold rounded-xl hover:bg-amber-100 disabled:opacity-50 transition">
                  {reviewingAction === 'request_more_info' ? 'Sending...' : <><HelpCircle className="w-4.5 h-4.5" /> Request Info</>}
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-app-text-secondary text-sm">Failed to load claim details</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-app-surface">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-app-border bg-app-surface">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text flex-1">Review Claims</h1>
        <span className="bg-violet-600 text-white text-xs font-bold px-2.5 py-1 rounded-full min-w-[24px] text-center">{claims.length}</span>
        <button onClick={() => { setLoading(true); fetchClaims().finally(() => setLoading(false)); }} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <RefreshCw className={`w-4.5 h-4.5 text-app-text-secondary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="animate-spin h-8 w-8 border-3 border-violet-600 border-t-transparent rounded-full" /></div>
      ) : claims.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <CheckCircle className="w-14 h-14 text-emerald-500 mb-4" />
          <p className="text-lg font-semibold text-app-text">All caught up!</p>
          <p className="text-sm text-app-text-secondary mt-1">No pending claims to review</p>
        </div>
      ) : (
        <div className="flex max-w-6xl mx-auto">
          {/* Left: claim list */}
          <div className={`w-full lg:w-[400px] lg:flex-shrink-0 lg:border-r lg:border-app-border overflow-y-auto p-4 ${selectedClaim ? 'hidden lg:block' : ''}`} style={{ maxHeight: 'calc(100vh - 57px)' }}>
            {renderClaimList()}
          </div>

          {/* Right: detail panel */}
          {renderDetailPanel()}
        </div>
      )}

      {/* Evidence viewer modal */}
      {evidenceViewerUrl && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="w-full max-w-4xl mx-4 bg-app-surface rounded-xl shadow-2xl border border-app-border flex flex-col" style={{ height: '85vh' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-app-border">
              <h3 className="text-sm font-semibold text-app-text">Document Viewer</h3>
              <button onClick={() => setEvidenceViewerUrl(null)} className="p-1 text-app-text-muted hover:text-app-text-secondary"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1">
              <iframe src={evidenceViewerUrl} className="w-full h-full border-0 rounded-b-xl" title="Evidence document" />
            </div>
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {showRejectModal && claimDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="w-full max-w-md mx-4 bg-app-surface rounded-xl shadow-2xl border border-app-border p-6">
            <h3 className="text-lg font-bold text-app-text mb-2">Reject Claim</h3>
            <p className="text-sm text-app-text-secondary mb-3">Optionally provide a reason for rejection:</p>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3}
              placeholder="e.g., Document doesn't match address..."
              className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-red-500 resize-none mb-4" />
            <button onClick={() => handleReview(claimDetail.claim.id, 'reject', rejectNote || undefined)} disabled={!!reviewingAction}
              className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition mb-2">
              {reviewingAction === 'reject' ? 'Rejecting...' : 'Reject Claim'}
            </button>
            <button onClick={() => { setShowRejectModal(false); setRejectNote(''); }}
              className="w-full py-2.5 text-app-text-secondary font-medium hover:bg-app-hover rounded-xl transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
