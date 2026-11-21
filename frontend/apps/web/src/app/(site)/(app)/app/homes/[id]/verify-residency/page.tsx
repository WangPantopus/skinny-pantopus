'use client';

// Verify residency — the instant door (Wedge Phase 2, D3). Adapted from
// claim-owner/evidence: a claim of type `resident`, residency documents
// only, no challenge routing, and honest latency copy.

import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, FileText, Upload, X, Info, Lock, Camera } from 'lucide-react';
import * as api from '@pantopus/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useClaimUploadSession } from '@/components/home/useClaimUploadSession';
import { openInfoRequest } from '@/components/homes/ClaimApprovalChecklist';
import ClaimInfoRequestNote from '@/components/homes/ClaimInfoRequestNote';
import { myClaimsQuery } from '@/lib/myHomes';
import { toast } from '@/components/ui/toast-store';
import { useVerifyOptions, invalidateVerifyOptions } from '@/components/place/fastVerify/useVerifyOptions';
import { FAST_VERIFY_WORDS } from '@/components/place/fastVerify/fastVerifyWords';

type EvidenceType = 'utility_bill' | 'lease';

// The instant door (Wedge Phase 2, D3): documents that prove you LIVE
// here. Ownership documents have their own flow at claim-owner/evidence.
const DOC_OPTIONS: { id: EvidenceType; label: string; desc: string }[] = [
  { id: 'utility_bill', label: 'Utility bill', desc: 'Electric, gas, water, or internet bill at this address, dated in the last 90 days' },
  { id: 'lease', label: 'Lease agreement', desc: 'Your current rental or lease agreement with this address on it' },
];

const ACCEPT_TYPES = 'application/pdf,image/jpeg,image/png,image/webp,image/heic';
const MAX_SIZE_MB = 25;

function sameHomeId(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function isClaimUsableForEvidence(status: string | undefined): boolean {
  if (!status) return false;
  return ['draft', 'submitted', 'under_review', 'pending', 'initiated', 'needs_more_info'].includes(status);
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
  const uploadSession = useClaimUploadSession(homeId);
  const uploadOperation = useRef<{ file: File; type: string; id: string } | null>(null);
  const submitInFlight = useRef(false);
  const savedClaim = useRef<string | undefined>(undefined);
  const existingClaimId = searchParams?.get('claimId') || undefined;
  const returnQuery = searchParams?.get('return') === 'place' ? '?return=place' : '';
  const queryClient = useQueryClient();
  // FASTVERIFY phase 4: someone holding a claim, with the bill read at once on (home_fast_verify_document), gets the
  // Bill check: one photo, read at once; anything unsure goes to today's review. Off (or an answer to a reviewer's
  // request): today's upload, unchanged.
  const verifyOptions = useVerifyOptions(homeId).data;
  const [billOutcome, setBillOutcome] = useState<'review' | 'unreadable' | null>(null);
  // Once the Bill check has answered it stays on screen (the refreshed options then say the document is in review).
  const documentOption = verifyOptions?.options.find((o) => o.id === 'document');
  const billMode = billOutcome !== null || (!existingClaimId && documentOption?.available === true
    // The server says whether the photo is read at once; older answers had no hint (a claim then meant yes).
    && (documentOption.fast ?? verifyOptions?.level === 'added'));

  // What a Pantopus reviewer asked for on this claim (Request info), until a document answers it.
  const myClaims = useQuery(myClaimsQuery());
  const claimForNote = (myClaims.data?.claims ?? []).find((c) => (existingClaimId ? c.id === existingClaimId
    : sameHomeId(c.home_id, homeId) && c.claim_type === 'resident' && c.status === 'under_review'));
  const asked = claimForNote ? openInfoRequest(claimForNote) : null;

  const [selectedDoc, setSelectedDoc] = useState<EvidenceType | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    savedClaim.current = undefined; uploadOperation.current = null;
    setPickedFile(null); setSelectedDoc(null);
  }, [homeId, existingClaimId, uploadSession.scope?.actor_id, uploadSession.scope?.session_scope]);
  // The Bill check reads a bill (or a lease): no type to pick.
  useEffect(() => { if (billMode && !selectedDoc) setSelectedDoc('utility_bill'); }, [billMode, selectedDoc]);
  const preview = useMemo(() => (pickedFile && pickedFile.type.startsWith('image/') ? URL.createObjectURL(pickedFile) : null), [pickedFile]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickDocument = useCallback(() => {
    setBillOutcome((o) => (o === 'unreadable' ? null : o));
    if (uploadSession.scope) fileInputRef.current?.click();
  }, [uploadSession.scope]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadSession.scope) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Please select a file smaller than ${MAX_SIZE_MB} MB.`);
      return;
    }
    setPickedFile(file);
    e.target.value = '';
  }, [uploadSession.scope]);

  const removeFile = useCallback(() => {
    setPickedFile(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitInFlight.current || !uploadSession.scope) return;
    if (!selectedDoc) {
      toast.error('Please select what kind of document you are uploading.');
      return;
    }
    if (!pickedFile) {
      toast.error('Please select a document to upload.');
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    try {
      await uploadSession.assertCurrent();
      let claimId = savedClaim.current || existingClaimId;
      let claimCreateErr: { statusCode?: number; data?: { code?: string } } | null = null;

      if (!claimId) {
        try {
          const claimRes = await api.homeOwnership.submitOwnershipClaim(homeId, {
            claim_type: 'resident',
            method: 'doc_upload',
          }, uploadSession.scope.session_scope);
          claimId = claimRes.claim?.id;
          await uploadSession.assertCurrent();
          savedClaim.current = claimId;
        } catch (claimErr: unknown) {
          claimCreateErr = claimErr as { statusCode?: number; data?: { code?: string } };
          console.warn('[Evidence] Failed to create claim:', claimErr);
        }
      }

      if (!claimId) {
        try {
          const claimsRes = await api.homeOwnership.getMyOwnershipClaims(uploadSession.scope.session_scope);
          const matchingClaim = claimsRes?.claims?.find(
            (c: { home_id: string; status: string; claim_type?: string }) =>
              sameHomeId(c.home_id, homeId) && c.claim_type === 'resident' && isClaimUsableForEvidence(c.status)
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
            : 'A new residency request cannot be started right now. Check your requests in My Homes or contact Support.'
        );
        setSubmitting(false);
        return;
      }

      savedClaim.current = claimId;
      await uploadSession.assertCurrent();
      if (!uploadOperation.current || uploadOperation.current.file !== pickedFile || uploadOperation.current.type !== selectedDoc) {
        uploadOperation.current = { file: pickedFile, type: selectedDoc, id: crypto.randomUUID() };
      }
      setUploading(true);
      const uploaded = await api.upload.uploadOwnershipEvidence(homeId, claimId, pickedFile, selectedDoc, uploadOperation.current.id, uploadSession.scope.session_scope);
      await uploadSession.assertCurrent();
      setUploading(false);

      // The Bill check's answer: verified at once (B3), or a person reviews it as today.
      const read = billMode ? uploaded?.fast_check?.result : undefined;
      if (read === 'verified') {
        await Promise.all([
          invalidateVerifyOptions(queryClient, homeId),
          queryClient.invalidateQueries({ queryKey: ['place'] }),
          queryClient.invalidateQueries({ queryKey: ['hub'] }),
        ]);
        router.replace(`/app/place?verified=1&home=${encodeURIComponent(homeId)}`);
        return;
      }
      if (read === 'needs_review') {
        void invalidateVerifyOptions(queryClient, homeId);
        setBillOutcome('review');
        return;
      }
      if (read === 'unreadable') {
        // Nothing could be read: ask for another photo (the person may also verify another way).
        uploadOperation.current = null;
        setPickedFile(null);
        setBillOutcome('unreadable');
        return;
      }

      const submittedPath = `/app/homes/${homeId}/verify-residency/submitted${returnQuery}`;
      router.push(submittedPath);
    } catch (err: unknown) {
      setUploading(false);
      toast.error(err instanceof Error ? err.message : 'Could not upload evidence. Please try again.');
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  }, [homeId, existingClaimId, selectedDoc, pickedFile, uploadSession, router, returnQuery, billMode, queryClient]);

  if (!uploadSession.scope) return <div className="p-6"><p role="status">{uploadSession.error || 'Verifying your current session…'}</p>
    {uploadSession.error && <button type="button" onClick={uploadSession.retry}>Retry</button>}</div>;

  if (billMode) {
    const back = returnQuery ? '/app/place' : `/app/homes/${homeId}/dashboard`;
    const fileInput = (
      <input ref={fileInputRef} type="file" accept={ACCEPT_TYPES} onChange={handleFileChange} className="hidden" />
    );
    return (
      <div className="min-h-screen bg-app-surface-raised">
        <main className="max-w-xl mx-auto px-4 py-6 space-y-5 text-app-text" data-testid="bill-check">
          <div className="grid grid-cols-[44px_1fr_44px] items-center">
            <Link href={back} aria-label="Back" className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full hover:bg-app-hover">
              <ChevronLeft className="w-[22px] h-[22px]" />
            </Link>
            <p className="text-center text-[17px] font-semibold">Bill check</p>
            <span />
          </div>
          {billOutcome === 'review' ? (
            <>
              <p role="status" className="rounded-2xl border border-app-border bg-app-surface p-5 text-[15px] leading-[22px]">
                We couldn&apos;t read this clearly, so a person will review it. You can also verify another way.
              </p>
              <Link href={`/app/homes/${homeId}/verify-postcard${returnQuery}`} className="w-full min-h-[52px] rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold flex items-center justify-center">
                {FAST_VERIFY_WORDS.mailMeACode}
              </Link>
              <Link href={`/app/homes/${homeId}/verify-residency/submitted${returnQuery}`} className="w-full min-h-[48px] rounded-xl text-primary-600 dark:text-primary-300 font-semibold flex items-center justify-center hover:bg-app-hover">
                {FAST_VERIFY_WORDS.notNow}
              </Link>
            </>
          ) : (
            <>
              {billOutcome === 'unreadable' ? (
                <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                  We couldn&apos;t read this photo. Take another one, or verify another way.
                </p>
              ) : null}
              <div>
                <h1 className="text-[26px] font-bold -tracking-[0.02em]">Take a photo of a bill</h1>
                <p className="mt-1 text-[15px] text-app-text-secondary">A utility bill, bank statement or lease from the last 90 days.</p>
              </div>
              {fileInput}
              {pickedFile ? (
                <div className="rounded-2xl border border-app-border bg-app-surface p-4 flex items-center gap-4">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="Your photo" className="w-24 h-32 rounded-lg object-cover border border-app-border" />
                  ) : (
                    <span className="w-24 h-32 rounded-lg border border-dashed border-app-border flex items-center justify-center"><FileText className="w-8 h-8 text-app-text-muted" /></span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{pickedFile.name}</p>
                    <p className="text-xs text-app-text-secondary">{formatFileSize(pickedFile.size)}</p>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={pickDocument} className="w-full rounded-2xl border-2 border-dashed border-app-border bg-app-surface py-10 flex flex-col items-center gap-2 hover:bg-app-hover">
                  <Camera className="w-9 h-9 text-app-text-muted" aria-hidden />
                  <span className="text-[15px] font-semibold">Take a photo of a bill</span>
                  <span className="text-xs text-app-text-muted">PDF, JPG, PNG — max {MAX_SIZE_MB} MB</span>
                </button>
              )}
              <p className="flex items-start gap-2 rounded-xl bg-primary-50 dark:bg-primary-950/30 px-3.5 py-3 text-[13.5px] text-primary-800 dark:text-primary-200">
                <Info size={16} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />You&apos;re verified as soon as you use this photo. A person at Pantopus also reviews it afterwards.
              </p>
              <p className="flex items-start gap-2 text-[13px] text-app-text-secondary">
                <Lock size={15} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />Cover account numbers if you like. We only read the name, address and date.
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!pickedFile || submitting}
                className="w-full min-h-[52px] rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold"
              >
                {submitting ? 'Reading…' : 'Use this photo'}
              </button>
              {pickedFile ? (
                <button type="button" onClick={() => { removeFile(); pickDocument(); }} disabled={submitting} className="w-full min-h-[48px] rounded-xl text-primary-600 dark:text-primary-300 font-semibold hover:bg-app-hover">
                  Retake
                </button>
              ) : null}
            </>
          )}
        </main>
      </div>
    );
  }

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
          Upload one document with this address on it. A person reviews it. Nothing you have now is taken away while
          you wait.
        </p>

        {asked ? <ClaimInfoRequestNote request={asked} className="mb-6" /> : null}

        <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl mb-6">
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Your document is seen by one reviewer, never by others, and deleted once your claim is decided. Cover account numbers if you like; we only
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
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
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
                <span className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs">✓</span>
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
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20'
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
          disabled={!uploadSession.scope || !selectedDoc || !pickedFile || submitting}
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
          Reviewed by a person. Prefer not to upload anything? A postcard with a code takes 3–7 days and is yours to
          keep.
        </p>
      </main>
    </div>
  );
}
