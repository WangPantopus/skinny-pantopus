'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import type { VerificationStatus } from '@pantopus/api';

// ---- Status badge helper ----
function VerificationBadge({ status }: { status: string }) {
  switch (status) {
    case 'self_attested':
      return (
        <span className="inline-flex items-center rounded-full bg-app-surface-sunken px-2.5 py-0.5 text-xs font-medium text-app-text-secondary border border-app-border">
          Self-attested
        </span>
      );
    case 'document_verified':
      return (
        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
          Verified
        </span>
      );
    case 'government_verified':
      return (
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
          Gov Verified
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
          Unverified
        </span>
      );
  }
}

function EvidenceStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 border border-green-200">Approved</span>;
    case 'rejected':
      return <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 border border-red-200">Rejected</span>;
    default:
      return <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-[11px] font-medium text-yellow-700 border border-yellow-200">Pending</span>;
  }
}

const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  business_license: 'Business License',
  ein_letter: 'EIN Letter',
  utility_bill: 'Utility Bill',
  state_registration: 'State Registration',
  self_attestation: 'Self-Attestation',
};

export default function BusinessSettingsLegalPage() {
  const params = useParams();
  const businessId = String(params.id || '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verificationData, setVerificationData] = useState<VerificationStatus | null>(null);
  const [access, setAccess] = useState<{ isOwner: boolean }>({ isOwner: false });

  // Legal settings (kept from original page)
  const [legalForm, setLegalForm] = useState({ legal_name: '', tax_id_last4: '', support_email: '' });
  const [savingLegal, setSavingLegal] = useState(false);

  // Self-attestation form
  const [attestForm, setAttestForm] = useState({ legal_name: '', address_confirmed: false });
  const [attesting, setAttesting] = useState(false);
  const [attestError, setAttestError] = useState('');
  const [attestSuccess, setAttestSuccess] = useState('');

  // Evidence upload form
  const [evidenceForm, setEvidenceForm] = useState({ evidence_type: 'business_license', file_id: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Review state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [verRes, privateRes, accessRes] = await Promise.all([
        api.businesses.getVerificationStatus(businessId),
        api.businesses.getBusinessPrivate(businessId).catch(() => ({ private: {} as Record<string, any> })),
        api.businessIam.getMyBusinessAccess(businessId).catch(() => ({ isOwner: false })),
      ]);
      setVerificationData(verRes);
      setAccess({ isOwner: (accessRes as { isOwner?: boolean }).isOwner || false });

      const priv = (privateRes as { private?: Record<string, any> }).private || {};
      const privLegalName = typeof priv.legal_name === 'string' ? priv.legal_name : '';
      setLegalForm({
        legal_name: privLegalName,
        tax_id_last4: typeof priv.tax_id_last4 === 'string' ? priv.tax_id_last4 : '',
        support_email: typeof priv.support_email === 'string' ? priv.support_email : '',
      });

      // Pre-fill attestation form with legal name if available
      if (!attestForm.legal_name && privLegalName) {
        setAttestForm((f) => ({ ...f, legal_name: privLegalName }));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load verification data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- Legal settings save ----
  const saveLegal = async () => {
    setSavingLegal(true);
    try {
      await api.businesses.updateBusinessPrivate(businessId, {
        legal_name: legalForm.legal_name.trim() || undefined,
        tax_id_last4: legalForm.tax_id_last4.trim() || undefined,
        support_email: legalForm.support_email.trim() || undefined,
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingLegal(false);
    }
  };

  // ---- Self-attestation ----
  const handleSelfAttest = async () => {
    setAttestError('');
    setAttestSuccess('');
    if (!attestForm.legal_name.trim()) {
      setAttestError('Legal business name is required');
      return;
    }
    if (!attestForm.address_confirmed) {
      setAttestError('You must confirm the business address');
      return;
    }
    setAttesting(true);
    try {
      const res = await api.businesses.selfAttest(businessId, {
        legal_name: attestForm.legal_name.trim(),
        address_confirmed: true,
      });
      setAttestSuccess(res.message);
      await load();
    } catch (e: unknown) {
      setAttestError(e instanceof Error ? e.message : 'Self-attestation failed');
    } finally {
      setAttesting(false);
    }
  };

  // ---- Evidence upload ----
  const handleUploadEvidence = async () => {
    setUploadError('');
    setUploadSuccess('');
    if (!evidenceForm.file_id.trim()) {
      setUploadError('File ID is required');
      return;
    }
    setUploading(true);
    try {
      const res = await api.businesses.uploadVerificationEvidence(businessId, {
        evidence_type: evidenceForm.evidence_type,
        file_id: evidenceForm.file_id.trim(),
      });
      setUploadSuccess(res.message);
      setEvidenceForm((f) => ({ ...f, file_id: '' }));
      await load();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ---- Evidence review ----
  const handleReview = async (evidenceId: string, decision: 'approved' | 'rejected') => {
    setReviewing(true);
    try {
      await api.businesses.reviewVerificationEvidence(businessId, {
        evidence_id: evidenceId,
        decision,
        notes: reviewNotes.trim() || undefined,
      });
      setReviewingId(null);
      setReviewNotes('');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setReviewing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app-surface-raised flex items-center justify-center">
        <div className="text-app-text-secondary">Loading verification...</div>
      </div>
    );
  }

  const status = verificationData?.verification_status || 'unverified';
  const evidence = verificationData?.evidence || [];
  const canSelfAttest = verificationData?.can_self_attest || false;
  const canUploadEvidence = verificationData?.can_upload_evidence || false;
  const pendingEvidence = evidence.filter((e) => e.status === 'pending');

  return (
    <div className="min-h-screen bg-app-surface-raised">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-app-text">Business Verification</h1>
              <VerificationBadge status={status} />
            </div>
            <p className="text-sm text-app-text-secondary mt-1">Verify your business identity to unlock badges and ranking boosts</p>
          </div>
          <Link
            href={`/app/businesses/${businessId}/dashboard`}
            className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover"
          >
            Dashboard
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Verification Tiers Explanation */}
        <div className="bg-app-surface border border-app-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-app-text mb-3">Verification Tiers</h2>
          <div className="space-y-3">
            <TierRow
              active={status === 'unverified'}
              label="Unverified"
              description="Your business appears in search with reduced visibility"
              badge={<span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />}
            />
            <TierRow
              active={status === 'self_attested'}
              label="Self-Attested"
              description="You've confirmed your legal name and address. Full search visibility."
              badge={<span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />}
            />
            <TierRow
              active={status === 'document_verified'}
              label="Document Verified"
              description="Document-verified businesses receive a Verified badge and ranking boost"
              badge={<span className="w-2 h-2 rounded-full bg-green-500 inline-block" />}
            />
            <TierRow
              active={status === 'government_verified'}
              label="Government Verified"
              description="Coming soon — automatic matching with state business registries"
              badge={<span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />}
            />
          </div>
        </div>

        {/* Self-Attestation Section */}
        <div className="bg-app-surface border border-app-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-app-text mb-3">Self-Attestation</h2>
          {canSelfAttest ? (
            <div className="space-y-3">
              <p className="text-sm text-app-text-secondary">
                Confirm your legal business name and address to unlock full search visibility.
              </p>
              <label className="block">
                <div className="text-sm font-medium text-app-text-strong mb-1">Legal Business Name</div>
                <input
                  value={attestForm.legal_name}
                  onChange={(e) => setAttestForm((f) => ({ ...f, legal_name: e.target.value }))}
                  placeholder="e.g. Smith Plumbing LLC"
                  className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attestForm.address_confirmed}
                  onChange={(e) => setAttestForm((f) => ({ ...f, address_confirmed: e.target.checked }))}
                  className="mt-0.5 rounded border-app-border text-violet-600 focus:ring-violet-500"
                />
                <span className="text-sm text-app-text-strong">
                  I confirm the business address on file is accurate and current
                </span>
              </label>
              {attestError && <div className="text-sm text-red-600">{attestError}</div>}
              {attestSuccess && <div className="text-sm text-green-600">{attestSuccess}</div>}
              <button
                onClick={handleSelfAttest}
                disabled={attesting}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
              >
                {attesting ? 'Submitting...' : 'Confirm Business Identity'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <span className="text-green-600 font-bold">&#10003;</span>
              <span>
                Self-attestation complete
                {verificationData?.verified_at && (
                  <span className="text-app-text-muted ml-1">
                    ({new Date(verificationData.verified_at).toLocaleDateString()})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Document Upload Section */}
        <div className="bg-app-surface border border-app-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-app-text mb-3">Document Verification</h2>
          {canUploadEvidence ? (
            <div className="space-y-3">
              <p className="text-sm text-app-text-secondary">
                Upload a document to verify your business and earn a Verified badge.
              </p>
              <label className="block">
                <div className="text-sm font-medium text-app-text-strong mb-1">Evidence Type</div>
                <select
                  value={evidenceForm.evidence_type}
                  onChange={(e) => setEvidenceForm((f) => ({ ...f, evidence_type: e.target.value }))}
                  className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                >
                  <option value="business_license">Business License</option>
                  <option value="ein_letter">EIN Letter</option>
                  <option value="utility_bill">Utility Bill</option>
                  <option value="state_registration">State Registration</option>
                </select>
              </label>
              <label className="block">
                <div className="text-sm font-medium text-app-text-strong mb-1">File ID</div>
                <input
                  value={evidenceForm.file_id}
                  onChange={(e) => setEvidenceForm((f) => ({ ...f, file_id: e.target.value }))}
                  placeholder="Upload your document via the file manager, then paste the file ID here"
                  className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
                <p className="text-xs text-app-text-muted mt-1">
                  Upload your document through the file manager, then enter the file ID above.
                </p>
              </label>
              {uploadError && <div className="text-sm text-red-600">{uploadError}</div>}
              {uploadSuccess && <div className="text-sm text-green-600">{uploadSuccess}</div>}
              <button
                onClick={handleUploadEvidence}
                disabled={uploading}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
              >
                {uploading ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          ) : status === 'government_verified' ? (
            <div className="text-sm text-blue-700 flex items-center gap-2">
              <span className="font-bold">&#9632;</span>
              <span>Government-verified. No further documents needed.</span>
            </div>
          ) : pendingEvidence.length > 0 ? (
            <div className="text-sm text-yellow-700">
              You have evidence pending review. New uploads are available once current reviews are complete.
            </div>
          ) : (
            <div className="text-sm text-app-text-secondary">Document uploads are not available at this time.</div>
          )}
        </div>

        {/* Evidence History */}
        {evidence.length > 0 && (
          <div className="bg-app-surface border border-app-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-app-text mb-3">Evidence History</h2>
            <div className="space-y-2">
              {evidence.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-app-border-subtle last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-app-text">
                        {EVIDENCE_TYPE_LABELS[e.type] || e.type}
                      </span>
                      <EvidenceStatusBadge status={e.status} />
                    </div>
                    <div className="text-xs text-app-text-muted mt-0.5">
                      Submitted {new Date(e.created_at).toLocaleDateString()}
                      {e.reviewed_at && ` · Reviewed ${new Date(e.reviewed_at).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence Review Section (owner only) */}
        {access.isOwner && pendingEvidence.length > 0 && (
          <div className="bg-app-surface border border-app-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-app-text mb-1">Review Pending Evidence</h2>
            <p className="text-xs text-app-text-muted mb-3">
              In v1.1, this will be restricted to platform administrators.
            </p>
            <div className="space-y-3">
              {pendingEvidence.map((e) => (
                <div key={e.id} className="border border-app-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-app-text">
                        {EVIDENCE_TYPE_LABELS[e.type] || e.type}
                      </span>
                      <EvidenceStatusBadge status={e.status} />
                    </div>
                    <span className="text-xs text-app-text-muted">
                      {new Date(e.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {reviewingId === e.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={reviewNotes}
                        onChange={(ev) => setReviewNotes(ev.target.value)}
                        placeholder="Notes (optional)"
                        className="w-full rounded-lg border border-app-border px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-violet-500"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReview(e.id, 'approved')}
                          disabled={reviewing}
                          className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReview(e.id, 'rejected')}
                          disabled={reviewing}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => { setReviewingId(null); setReviewNotes(''); }}
                          className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReviewingId(e.id); setReviewNotes(''); }}
                      className="text-sm text-violet-600 hover:underline"
                    >
                      Review
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legal Settings (original page content preserved) */}
        <div className="bg-app-surface border border-app-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-app-text mb-1">Legal Settings</h2>
          <p className="text-xs text-app-text-muted mb-3">Private. Only visible to the business owner.</p>
          <div className="space-y-3">
            <label className="block">
              <div className="text-sm font-medium text-app-text-strong mb-1">Legal Business Name</div>
              <input
                value={legalForm.legal_name}
                onChange={(e) => setLegalForm((f) => ({ ...f, legal_name: e.target.value }))}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </label>
            <label className="block">
              <div className="text-sm font-medium text-app-text-strong mb-1">Tax ID (last 4)</div>
              <input
                value={legalForm.tax_id_last4}
                onChange={(e) => setLegalForm((f) => ({ ...f, tax_id_last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </label>
            <label className="block">
              <div className="text-sm font-medium text-app-text-strong mb-1">Support Email</div>
              <input
                value={legalForm.support_email}
                onChange={(e) => setLegalForm((f) => ({ ...f, support_email: e.target.value }))}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </label>
            <button
              onClick={saveLegal}
              disabled={savingLegal}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              {savingLegal ? 'Saving...' : 'Save Legal Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TierRow({
  active,
  label,
  description,
  badge,
}: {
  active: boolean;
  label: string;
  description: string;
  badge: React.ReactNode;
}) {
  return (
    <div className={`flex items-start gap-3 py-2 px-3 rounded-lg ${active ? 'bg-violet-50 border border-violet-200' : ''}`}>
      <div className="mt-1">{badge}</div>
      <div>
        <div className={`text-sm font-medium ${active ? 'text-violet-800' : 'text-app-text-strong'}`}>{label}</div>
        <div className="text-xs text-app-text-secondary">{description}</div>
      </div>
    </div>
  );
}
