'use client';

// Verify residency — the instant door (Wedge Phase 2, D3). Adapted from
// claim-owner/evidence: a claim of type `resident`, residency documents
// only, no challenge routing, and honest latency copy.

import { useCallback, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, FileText, Upload, X } from 'lucide-react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

type EvidenceType = 'utility_bill' | 'lease' | 'idv';

// The instant door (Wedge Phase 2, D3): documents that prove you LIVE
// here. Ownership documents have their own flow at claim-owner/evidence.
const DOC_OPTIONS: { id: EvidenceType; label: string; desc: string }[] = [
  { id: 'utility_bill', label: 'Utility bill', desc: 'Electric, gas, water, or internet bill at this address, dated in the last 90 days' },
  { id: 'lease', label: 'Lease agreement', desc: 'Your current rental or lease agreement with this address on it' },
  { id: 'idv', label: 'Government ID', desc: 'A driver\'s license or state ID showing this address' },
];

const ACCEPT_TYPES = 'application/pdf,image/jpeg,image/png,image/webp,image/heic';
const MAX_SIZE_MB = 25;

function sameHomeId(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function isClaimUsableForEvidence(status: string | undefined): boolean {
  if (!status) return false;
  return !['rejected', 'revoked', 'approved'].includes(status);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VerifyResidencyPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const homeId = params?.id ?? '';
  const existingClaimId = searchParams?.get('claimId') || undefined;
  const returnQuery = searchParams?.get('return') === 'place' ? '?return=place' : '';

  const [selectedDoc, setSelectedDoc] = useState<EvidenceType | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickDocument = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Please select a file smaller than ${MAX_SIZE_MB} MB.`);
      return;
    }
    setPickedFile(file);
    e.target.value = '';
  }, []);

  const removeFile = useCallback(() => {
    setPickedFile(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedDoc) {
      toast.error('Please select what kind of document you are uploading.');
      return;
    }
    if (!pickedFile) {
      toast.error('Please select a document to upload.');
      return;
    }

    setSubmitting(true);
    try {
      let claimId = existingClaimId;
      let claimCreateErr: { statusCode?: number; data?: { code?: string } } | null = null;
      let routingClassification: string | undefined;

      if (!claimId) {
        try {
          const claimRes = await api.homeOwnership.submitOwnershipClaim(homeId, {
            claim_type: 'resident',
            method: 'doc_upload',
          });
          claimId = claimRes.claim?.id;
          routingClassification = claimRes.claim?.routing_classification || undefined;
        } catch (claimErr: unknown) {
          claimCreateErr = claimErr as { statusCode?: number; data?: { code?: string } };
          console.warn('[Evidence] Failed to create claim:', claimErr);
        }
      }

      if (!claimId) {
        try {
          const claimsRes = await api.homeOwnership.getMyOwnershipClaims();
          const matchingClaim = claimsRes?.claims?.find(
            (c: { home_id: string; status: string }) =>
              sameHomeId(c.home_id, homeId) && isClaimUsableForEvidence(c.status)
          );
          if (matchingClaim?.id) claimId = matchingClaim.id;
        } catch {
          // ignore
        }
      }

      if (!claimId) {
        const code = claimCreateErr?.data?.code;
        const status = claimCreateErr?.statusCode;
        const blockedByOther =
          status === 409 &&
          (code === 'EXISTING_IN_FLIGHT_CLAIM' || code === 'DUPLICATE_CLAIM');
        toast.error(
          blockedByOther
            ? 'A verification for this address is already in progress. If that is yours, wait for the decision; otherwise contact Support.'
            : 'Could not start your residency verification. Please try again.'
        );
        setSubmitting(false);
        return;
      }

      setUploading(true);
      const uploadRes = await api.upload.uploadOwnershipEvidence(homeId, claimId, pickedFile, selectedDoc);
      setUploading(false);

      if (uploadRes?.evidence?.id) {
        try {
          await api.homeOwnership.uploadClaimEvidence(homeId, claimId, {
            evidence_type: selectedDoc,
            provider: 'manual',
            storage_ref: uploadRes.evidence.file_url || null,
          });
        } catch {
          // Non-fatal
        }
      }

      const submittedPath = `/app/homes/${homeId}/verify-residency/submitted${returnQuery}`;
      router.push(submittedPath);
    } catch (err: unknown) {
      setUploading(false);
      toast.error(err instanceof Error ? err.message : 'Could not upload evidence. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [homeId, existingClaimId, selectedDoc, pickedFile, router, returnQuery]);

  return (
    <div className="min-h-screen bg-app-surface-raised">
      <main className="max-w-xl mx-auto px-4 py-8">
        <Link
          href={returnQuery ? '/app/place' : `/app/homes/${homeId}/dashboard`}
          className="inline-flex items-center gap-1 text-sm text-app-text-secondary hover:text-app-text mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>

        <h1 className="text-2xl font-bold text-app-text mb-2">Verify that you live here</h1>
        <p className="text-app-text-secondary text-[15px] leading-relaxed mb-6">
          Upload one document with this address on it. A person reviews it, usually within hours. Nothing you have now
          is taken away while you wait.
        </p>

        <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl mb-6">
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Your document is seen by one reviewer, never by neighbors, and deleted once your claim is decided. Cover account numbers if you like; we only
            need your name and this address. Own this home? Use the ownership flow instead.
          </p>
        </div>

        {/* Document type */}
        <label className="block text-sm font-semibold text-app-text mb-3">1. Select document type</label>
        <div className="space-y-2 mb-6">
          {DOC_OPTIONS.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setSelectedDoc(doc.id)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${
                selectedDoc === doc.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                  : 'border-app-border bg-app-surface hover:border-app-border'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selectedDoc === doc.id ? 'bg-primary-100 dark:bg-primary-900/50' : 'bg-app-surface-sunken'
                }`}
              >
                <FileText className={`w-5 h-5 ${selectedDoc === doc.id ? 'text-primary-600' : 'text-app-text-muted'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${selectedDoc === doc.id ? 'text-primary-700 dark:text-primary-300' : 'text-app-text'}`}>
                  {doc.label}
                </p>
                <p className="text-xs text-app-text-secondary mt-0.5">{doc.desc}</p>
              </div>
              {selectedDoc === doc.id && (
                <span className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Upload area */}
        {selectedDoc && (
          <>
            <label className="block text-sm font-semibold text-app-text mb-3">2. Upload your document</label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_TYPES}
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              role="button"
              tabIndex={0}
              onClick={pickDocument}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  pickDocument();
                }
              }}
              className={`w-full flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                pickedFile
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                  : 'border-app-border hover:border-app-text-muted hover:bg-app-surface-sunken'
              }`}
            >
              {pickedFile ? (
                <div className="flex items-center gap-3 w-full max-w-md">
                  <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-app-text truncate">{pickedFile.name}</p>
                    <p className="text-xs text-app-text-secondary">{formatFileSize(pickedFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    aria-label="Remove file"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-app-text-muted" />
                  <span className="text-sm font-medium text-app-text-secondary">Click to select document</span>
                  <span className="text-xs text-app-text-muted">PDF, JPG, PNG — max {MAX_SIZE_MB} MB</span>
                </>
              )}
            </div>
          </>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedDoc || !pickedFile || submitting}
          className="mt-6 w-full py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              {uploading ? 'Uploading...' : 'Submitting...'}
            </>
          ) : (
            'Submit for review'
          )}
        </button>

        <p className="text-center text-xs text-app-text-muted mt-6">
          Reviewed by a person, usually within hours. Prefer not to upload anything? A postcard with a code takes 3–7
          days and is yours to keep.
        </p>
      </main>
    </div>
  );
}
