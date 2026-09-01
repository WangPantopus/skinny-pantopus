'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  Wrench,
  CheckCircle,
  AlertTriangle,
  Package,
  Square,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import * as api from '@pantopus/api';
import FileUpload from '@/components/FileUpload';
import StripeConnectOnboarding from '@/components/payments/StripeConnectOnboarding';
import TipModal from '@/components/payments/TipModal';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import CancellationModal from './CancellationModal';

/** Shape of gig data used by CompletionFlow */
interface CompletionGigData {
  price?: number | string;
  accepted_by?: string | null;
  acceptedBy?: string | null;
  payment_status?: string;
  completion_photos?: string[];
  completion_note?: string;
  completion_checklist?: Array<{ item: string; done: boolean }>;
  worker_completed_at?: string | null;
  owner_confirmed_at?: string | null;
  accepted_bid?: {
    bidder?: {
      name?: string;
      username?: string;
    };
  };
  [key: string]: unknown;
}

/** Extended gig API methods not in base type definitions */
interface GigsCompletionApiExt {
  reopenBidding: (gigId: string) => Promise<Record<string, any>>;
  startGig: (gigId: string) => Promise<unknown>;
  markGigCompleted: (gigId: string, data: Record<string, any>) => Promise<unknown>;
  confirmGigCompletion?: (gigId: string, data: Record<string, any>) => Promise<unknown>;
  completeGig?: (gigId: string, data: Record<string, any>) => Promise<unknown>;
}

export interface CompletionFlowHandle {
  openCancelModal: () => void;
  startWork: () => void;
  markCompleted: () => void;
  confirmCompletion: () => void;
}

interface CompletionFlowProps {
  gigId: string;
  gig: CompletionGigData;
  isOwner: boolean;
  isWorker: boolean;
  currentUserId: string | undefined;
  gigStatus: string;
  paymentLifecycleStatus: string;
  onStatusChange?: () => void;
  onOpenChat: () => void;
}

interface CancellationPreview {
  policy_label?: string;
  fee: number;
  fee_pct?: number;
  zone_label: string;
  zone?: number;
  in_grace?: boolean;
  policy_description?: string;
}

export default forwardRef<CompletionFlowHandle, CompletionFlowProps>(function CompletionFlow({
  gigId,
  gig,
  isOwner,
  isWorker,
  currentUserId,
  gigStatus,
  paymentLifecycleStatus,
  onStatusChange,
  onOpenChat,
}, ref) {
  const router = useRouter();

  const isAssigned = gigStatus === 'assigned';
  const isInProgress = gigStatus === 'in_progress';
  const isCompleted = gigStatus === 'completed';
  const isPaidGig = Number(gig?.price || 0) > 0;
  const acceptedBy = gig?.accepted_by ?? gig?.acceptedBy ?? null;
  const completionPhotos = gig.completion_photos ?? [];
  const completionChecklist = gig.completion_checklist ?? [];
  const iAmWorkerAssigned = isWorker && isAssigned;
  const iAmWorkerInProgress = isWorker && isInProgress;
  const iAmWorkerCompleted = isWorker && isCompleted;
  const workerBlockedByPaymentAuth = iAmWorkerAssigned && isPaidGig && paymentLifecycleStatus !== 'authorized';

  // Cancellation
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelPreview, setCancelPreview] = useState<CancellationPreview | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // No-show
  const [noShowCheck, setNoShowCheck] = useState<Record<string, any> | null>(null);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [noShowDescription, setNoShowDescription] = useState('');
  const [reportingNoShow, setReportingNoShow] = useState(false);

  // Worker completion proof
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [completionFiles, setCompletionFiles] = useState<File[]>([]);
  const [submittingCompletion, setSubmittingCompletion] = useState(false);

  // Poster confirm completion
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmSatisfaction, setConfirmSatisfaction] = useState(0);
  const [confirmNote, setConfirmNote] = useState('');
  const [submittingConfirm, setSubmittingConfirm] = useState(false);

  // Tip
  const [showTipModal, setShowTipModal] = useState(false);

  // Reopen bidding
  const handleReopenBidding = async () => {
    const confirmed = await confirmStore.open({
      title: 'Reopen bidding?',
      description: 'This will unassign the current worker and reactivate prior rejected offers.',
      confirmLabel: 'Reopen',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      const gigsExt = api.gigs as unknown as GigsCompletionApiExt;
      const result = await gigsExt.reopenBidding(gigId);
      onStatusChange?.();
      toast.success(String(result?.message || 'Bidding reopened.'));
    } catch (err: unknown) {
      console.error('Reopen bidding failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to reopen bidding');
    }
  };

  // Authorization pending
  const [continuingAuthorization, setContinuingAuthorization] = useState(false);
  const [refreshingAuthorization, setRefreshingAuthorization] = useState(false);
  const [continueAuthorizationError, setContinueAuthorizationError] = useState<string | null>(null);
  const [, setPaymentClientSecret] = useState<string | null>(null);
  const [, setPaymentIsSetupIntent] = useState(false);
  const [, setShowPaymentSetup] = useState(false);

  // Check no-show eligibility
  useEffect(() => {
    const checkNoShowEligibility = async () => {
      if (!gigId || !currentUserId) return;
      if (gigStatus !== 'assigned' && gigStatus !== 'in_progress') return;
      try {
        const result = await api.gigs.checkNoShow(gigId);
        setNoShowCheck(result);
      } catch {
        setNoShowCheck(null);
      }
    };
    checkNoShowEligibility();
  }, [gigId, gigStatus, currentUserId]);

  const openCancelModal = async () => {
    setShowCancelModal(true);
    setCancelReason('');
    setCancelPreview(null);
    try {
      const preview = await api.gigs.getCancellationPreview(gigId);
      setCancelPreview(preview as CancellationPreview);
    } catch {
      setCancelPreview({ zone: -1, zone_label: 'Unknown', fee: 0, in_grace: true, policy_label: 'Standard' });
    }
  };

  const handleCancelGig = async () => {
    setCancelling(true);
    try {
      await api.gigs.cancelGig(gigId, cancelReason || undefined);
      setShowCancelModal(false);
      onStatusChange?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel gig');
    } finally {
      setCancelling(false);
    }
  };

  const handleReportNoShow = async () => {
    setReportingNoShow(true);
    try {
      await api.gigs.reportNoShow(gigId, { description: noShowDescription || undefined });
      setShowNoShowModal(false);
      setNoShowDescription('');
      onStatusChange?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to report no-show');
    } finally {
      setReportingNoShow(false);
    }
  };

  const handleStartWork = async () => {
    try {
      const gigsExt = api.gigs as unknown as GigsCompletionApiExt;
      await gigsExt.startGig(gigId);
      onStatusChange?.();
      toast.success('Work started!');
    } catch (err: unknown) {
      console.error('Start work failed:', err);
      const errData = err && typeof err === 'object' ? (err as Record<string, any>) : null;
      if ((errData?.data as Record<string, any>)?.code === 'payer_authorization_required') {
        toast.warning('Waiting for requester payment authorization. Ask the gig owner to complete payment on the gig page.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to start work');
      }
    }
  };

  const handleMarkCompleted = () => {
    setShowCompletionModal(true);
    setCompletionNote('');
    setCompletionFiles([]);
  };

  const submitCompletion = async () => {
    setSubmittingCompletion(true);
    try {
      let photoUrls: string[] = [];
      if (completionFiles.length > 0) {
        const uploadRes = await api.upload.uploadGigCompletionMedia(gigId, completionFiles);
        photoUrls = (uploadRes?.media || []).map((m: Record<string, any>) => m.file_url).filter(Boolean) as string[];
      }
      const gigsExt = api.gigs as unknown as GigsCompletionApiExt;
      await gigsExt.markGigCompleted(gigId, {
        note: completionNote || undefined,
        photos: photoUrls.length > 0 ? photoUrls : undefined,
      });
      setShowCompletionModal(false);
      setCompletionFiles([]);
      onStatusChange?.();
    } catch (err: unknown) {
      console.error('Mark completed failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to mark completed');
    } finally {
      setSubmittingCompletion(false);
    }
  };

  const handleConfirmCompletion = () => {
    setShowConfirmModal(true);
    setConfirmSatisfaction(0);
    setConfirmNote('');
  };

  const submitConfirmation = async () => {
    setSubmittingConfirm(true);
    try {
      const gigsExt = api.gigs as unknown as GigsCompletionApiExt;
      const payload = {
        satisfaction: confirmSatisfaction > 0 ? confirmSatisfaction : undefined,
        note: confirmNote || undefined,
      };
      if (typeof gigsExt.confirmGigCompletion === 'function') {
        await gigsExt.confirmGigCompletion(gigId, payload);
      } else if (typeof gigsExt.completeGig === 'function') {
        await gigsExt.completeGig(gigId, payload);
      }
      setShowConfirmModal(false);
      onStatusChange?.();
      setShowTipModal(true);
    } catch (err: unknown) {
      console.error('Confirm completion failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to confirm');
    } finally {
      setSubmittingConfirm(false);
    }
  };

  const handleContinueAuthorization = async () => {
    setContinuingAuthorization(true);
    setContinueAuthorizationError(null);
    try {
      const result = await api.payments.continueAuthorization(gigId);
      if (result?.alreadyAuthorized) {
        onStatusChange?.();
        return;
      }
      if (result?.clientSecret) {
        setPaymentClientSecret(result.clientSecret);
        setPaymentIsSetupIntent(false);
        setShowPaymentSetup(true);
      } else {
        setContinueAuthorizationError('No authorization flow available right now. Please refresh and try again.');
      }
    } catch (err: unknown) {
      setContinueAuthorizationError(err instanceof Error ? err.message : 'Failed to continue authorization');
    } finally {
      setContinuingAuthorization(false);
    }
  };

  const handleRefreshAuthorizationStatus = async () => {
    setRefreshingAuthorization(true);
    setContinueAuthorizationError(null);
    try {
      await api.payments.refreshPaymentStatus(gigId);
      onStatusChange?.();
    } catch (err: unknown) {
      setContinueAuthorizationError(err instanceof Error ? err.message : 'Failed to refresh payment status');
    } finally {
      setRefreshingAuthorization(false);
    }
  };

  useImperativeHandle(ref, () => ({
    openCancelModal,
    startWork: handleStartWork,
    markCompleted: handleMarkCompleted,
    confirmCompletion: handleConfirmCompletion,
  }));

  return (
    <>
      {/* Owner panel */}
      {isOwner && (
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <p className="text-sm text-blue-900 font-medium mb-3">This is your gig</p>
          <div className="space-y-2">
            <button
              onClick={() => router.push(`/app/gigs/${gigId}/edit`)}
              className="w-full bg-app-surface text-app-text-strong py-2 rounded-lg hover:bg-app-hover font-medium"
            >
              Edit Gig
            </button>
            {isAssigned && (
              <button
                onClick={handleReopenBidding}
                className="w-full bg-app-surface text-amber-700 py-2 rounded-lg hover:bg-amber-50 font-medium border border-amber-200"
              >
                Reopen Bidding
              </button>
            )}
            <button
              onClick={openCancelModal}
              className="w-full bg-app-surface text-red-600 py-2 rounded-lg hover:bg-red-50 font-medium"
            >
              Close Gig
            </button>
          </div>
          {/* Poster report worker no-show */}
          {noShowCheck?.can_report && isOwner && (isAssigned || isInProgress) && (
            <button
              onClick={() => setShowNoShowModal(true)}
              className="w-full mt-3 bg-orange-50 text-orange-700 py-2 rounded-lg hover:bg-orange-100 font-medium border border-orange-200 text-sm"
            >
              <AlertTriangle className="w-4 h-4 inline-block" /> Report Worker No-Show
              {noShowCheck.minutes_overdue > 0 && (
                <span className="ml-1 text-orange-500">({noShowCheck.minutes_overdue}min overdue)</span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Authorization Pending Banner (owner only) */}
      {isOwner && gig?.payment_status === 'authorize_pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h4 className="font-semibold text-amber-900 text-sm">Payment Authorization In Progress</h4>
          <p className="text-sm text-amber-800 mt-1">
            The worker cannot start until you finish card authorization.
          </p>
          {continueAuthorizationError && (
            <p className="text-sm text-amber-900 mt-2 bg-amber-100 rounded p-2">
              {continueAuthorizationError}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleContinueAuthorization}
              disabled={continuingAuthorization || refreshingAuthorization}
              className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {continuingAuthorization ? 'Opening…' : 'Complete Authorization'}
            </button>
            <button
              onClick={handleRefreshAuthorizationStatus}
              disabled={refreshingAuthorization || continuingAuthorization}
              className="px-4 py-2 bg-app-surface text-amber-700 text-sm font-medium rounded-lg border border-amber-300 hover:bg-amber-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshingAuthorization ? 'Refreshing…' : 'Refresh Status'}
            </button>
          </div>
        </div>
      )}

      {/* Owner confirm completion panel */}
      {isOwner && isCompleted && Boolean(gig?.worker_completed_at) && !Boolean(gig?.owner_confirmed_at) && (
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Review & Confirm</h3>
          <p className="text-sm text-blue-800 mb-3">The worker marked this gig completed. Review their work and confirm.</p>

          {completionPhotos.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {completionPhotos.slice(0, 4).map((url: string, i: number) => (
                <Image
                  key={i}
                  src={url}
                  alt={`Proof ${i + 1}`}
                  width={56}
                  height={56}
                  className="rounded-lg object-cover border border-blue-200 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  quality={80}
                />
              ))}
              {completionPhotos.length > 4 && (
                <span className="text-xs text-blue-600 self-center">+{completionPhotos.length - 4} more</span>
              )}
            </div>
          )}
          {gig?.completion_note && (
            <p className="text-sm text-blue-800 bg-app-surface/50 rounded-lg p-2 mb-3 italic">
              &ldquo;{gig.completion_note.slice(0, 120)}{gig.completion_note.length > 120 ? '…' : ''}&rdquo;
            </p>
          )}

          <button
            onClick={handleConfirmCompletion}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-semibold"
          >
            Review & Confirm
          </button>
        </div>
      )}

      {/* Worker panel for non-owner */}
      {!isOwner && isWorker && (
        <div className="bg-green-50 rounded-xl p-6 border border-green-200">
          <h3 className="text-lg font-semibold text-green-900 mb-2"><Wrench className="w-4 h-4 inline-block" /> You&apos;re the worker</h3>
          <p className="text-sm text-green-800 mb-4">The owner selected you. Coordinate timing and complete the task.</p>
          <div className="flex gap-2">
            <button
              onClick={onOpenChat}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-semibold"
            >
              Message Owner
            </button>
            {iAmWorkerAssigned ? (
              <button
                onClick={() => {
                  if (workerBlockedByPaymentAuth) return;
                  handleStartWork();
                }}
                disabled={workerBlockedByPaymentAuth}
                className={`flex-1 py-2 rounded-lg font-semibold ${
                  workerBlockedByPaymentAuth
                    ? 'bg-app-surface-sunken border border-app-border text-app-text-secondary cursor-not-allowed'
                    : 'bg-app-surface border border-green-300 text-green-800 hover:bg-green-100'
                }`}
              >
                Start Work
              </button>
            ) : null}

            {iAmWorkerInProgress ? (
              <button
                onClick={handleMarkCompleted}
                className="flex-1 bg-app-surface border border-green-300 text-green-800 py-2 rounded-lg hover:bg-green-100 font-semibold"
              >
                Mark Completed
              </button>
            ) : null}

            {iAmWorkerCompleted ? (
              <div className="flex-1 flex items-center justify-center text-sm font-semibold text-green-900 bg-app-surface border border-green-300 rounded-lg">
                Waiting for owner <CheckCircle className="w-4 h-4 inline-block" />
              </div>
            ) : null}
          </div>
          {workerBlockedByPaymentAuth && (
            <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Waiting for requester payment authorization before you can start.
            </p>
          )}
          {/* Worker cancel option */}
          {(iAmWorkerAssigned || iAmWorkerInProgress) && (
            <button
              onClick={openCancelModal}
              className="w-full mt-3 text-sm text-red-600 hover:text-red-800 hover:underline"
            >
              Need to cancel?
            </button>
          )}
          {/* Worker report poster no-show */}
          {noShowCheck?.can_report && isWorker && (
            <button
              onClick={() => setShowNoShowModal(true)}
              className="w-full mt-2 text-sm text-orange-600 hover:text-orange-800 hover:underline"
            >
              <AlertTriangle className="w-4 h-4 inline-block" /> Report poster no-show ({noShowCheck.hours_since_accept}h unresponsive)
            </button>
          )}
        </div>
      )}

      {/* Stripe Connect Onboarding CTA for workers */}
      {isWorker && !isOwner && (
        <StripeConnectOnboarding variant="banner" />
      )}

      {/* Not open notice */}
      {!isOwner && gigStatus !== 'open' && !isWorker && (
        <div className="bg-app-surface-raised rounded-xl p-6 border border-app-border">
          <h3 className="text-lg font-semibold text-app-text mb-2">Not accepting bids</h3>
          <p className="text-sm text-app-text-strong">
            This gig is currently <span className="font-semibold">{gigStatus}</span>.
          </p>
        </div>
      )}

      {/* ─── Worker Completion Proof Modal ─── */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-app-surface rounded-2xl max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-6 pb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl"><Package className="w-8 h-8 inline-block" /></span>
                <div>
                  <h2 className="text-lg font-bold text-app-text">Submit Completion</h2>
                  <p className="text-sm text-app-text-secondary">Add proof of work to help the poster confirm quickly.</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-1">Completion Note</label>
                <textarea
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Describe what was done, any notes for the poster..."
                  rows={3}
                  maxLength={2000}
                  className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-app-text-muted mt-1">{completionNote.length}/2000</p>
              </div>

              <FileUpload
                label="Completion Attachments (optional)"
                accept={['image', 'video', 'document']}
                maxFiles={10}
                maxSize={100 * 1024 * 1024}
                files={completionFiles}
                onFilesSelected={setCompletionFiles}
                helperText="Upload photos, videos, or documents as proof. Up to 10 files."
              />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>Tip:</strong> Adding photos and a note helps the poster confirm faster and can lead to better reviews.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 flex gap-3 justify-end border-t border-app-border-subtle">
              <button
                onClick={() => setShowCompletionModal(false)}
                className="px-4 py-2 text-app-text-strong hover:bg-app-hover rounded-lg font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitCompletion}
                disabled={submittingCompletion}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50"
              >
                {submittingCompletion ? 'Submitting…' : 'Mark Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Poster Confirm Completion Modal ─── */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-app-surface rounded-2xl max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-6 pb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl"><CheckCircle className="w-8 h-8 inline-block" /></span>
                <div>
                  <h2 className="text-lg font-bold text-app-text">Review Work</h2>
                  <p className="text-sm text-app-text-secondary">Check the worker&apos;s submission and confirm completion.</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {(gig?.completion_note || completionPhotos.length > 0) ? (
                <div className="bg-app-surface-raised rounded-lg p-4 space-y-3">
                  <p className="text-xs font-semibold text-app-text-secondary uppercase tracking-wide">Worker&apos;s Submission</p>

                  {gig?.completion_note && (
                    <div>
                      <p className="text-xs text-app-text-secondary mb-0.5">Note:</p>
                      <p className="text-sm text-app-text whitespace-pre-wrap">{gig.completion_note}</p>
                    </div>
                  )}

                  {completionPhotos.length > 0 && (
                    <div>
                      <p className="text-xs text-app-text-secondary mb-1">Photos ({completionPhotos.length}):</p>
                      <div className="grid grid-cols-3 gap-2">
                        {completionPhotos.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <Image
                              src={url}
                              alt={`Proof ${i + 1}`}
                              width={200}
                              height={96}
                              className="w-full h-24 rounded-lg object-cover border border-app-border hover:opacity-80 transition"
                              onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              quality={80}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {completionChecklist.length > 0 && (
                    <div>
                      <p className="text-xs text-app-text-secondary mb-1">Checklist:</p>
                      <div className="space-y-1">
                        {completionChecklist.map((c: { item: string; done: boolean }, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span>{c.done ? <CheckCircle className="w-4 h-4 inline-block text-green-600" /> : <Square className="w-4 h-4 inline-block text-app-text-muted" />}</span>
                            <span className={c.done ? 'text-app-text' : 'text-app-text-secondary'}>{c.item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-700">The worker marked this gig complete but did not attach proof. You can still confirm if you&apos;re satisfied.</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-app-text-strong mb-2">Quick completion rating</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setConfirmSatisfaction(n)}
                      className={`w-10 h-10 rounded-lg text-lg transition ${
                        confirmSatisfaction >= n
                          ? 'bg-yellow-400 text-white'
                          : 'bg-app-surface-sunken text-app-text-muted hover:bg-app-hover'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <p className="text-xs text-app-text-muted mt-1">
                  {confirmSatisfaction === 0 ? 'Tap to rate' :
                   confirmSatisfaction <= 2 ? 'Not satisfied' :
                   confirmSatisfaction === 3 ? 'It was okay' :
                   confirmSatisfaction === 4 ? 'Good work!' : 'Excellent!'}
                </p>
                <p className="text-xs text-app-text-secondary mt-1">
                  This is internal completion feedback. Public profile reviews are submitted on the next step.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-1">Completion note (optional)</label>
                <textarea
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  placeholder="Any comments for the worker..."
                  rows={2}
                  maxLength={1000}
                  className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 flex gap-3 justify-end border-t border-app-border-subtle">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-app-text-strong hover:bg-app-hover rounded-lg font-medium text-sm"
              >
                Go Back
              </button>
              <button
                onClick={submitConfirmation}
                disabled={submittingConfirm}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50"
              >
                {submittingConfirm ? 'Confirming…' : 'Confirm & Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── No-Show Report Modal ─── */}
      {showNoShowModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-app-surface rounded-2xl max-w-md w-full shadow-xl">
            <div className="px-6 pt-6 pb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl"><AlertTriangle className="w-8 h-8 inline-block" /></span>
                <div>
                  <h2 className="text-lg font-bold text-app-text">Report No-Show</h2>
                  <p className="text-sm text-app-text-secondary">
                    {isOwner
                      ? 'The worker didn\'t show up or start work as expected.'
                      : 'The poster is unresponsive and the gig can\'t proceed.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm font-medium text-orange-800">What happens when you report:</p>
                <ul className="text-xs text-orange-700 mt-1 space-y-1 list-disc pl-4">
                  <li>The gig will be cancelled</li>
                  <li>A 25% no-show fee may apply to the no-show party</li>
                  <li>Their reliability score will be reduced</li>
                  <li>The no-show is recorded on their profile</li>
                </ul>
              </div>

              {noShowCheck && (
                <div className="bg-app-surface-raised rounded-lg p-3">
                  <p className="text-xs text-app-text-secondary">
                    {noShowCheck.minutes_overdue > 0 && (
                      <span>Worker is <strong>{noShowCheck.minutes_overdue} min</strong> overdue. </span>
                    )}
                    {noShowCheck.hours_since_accept > 0 && (
                      <span>Accepted <strong>{noShowCheck.hours_since_accept}h</strong> ago with no response. </span>
                    )}
                    {noShowCheck.expected_start && (
                      <span>Expected start: {new Date(noShowCheck.expected_start).toLocaleString()}</span>
                    )}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-1">Additional details (optional)</label>
                <textarea
                  value={noShowDescription}
                  onChange={(e) => setNoShowDescription(e.target.value)}
                  placeholder="Describe what happened..."
                  rows={3}
                  className="w-full border border-app-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 flex gap-3 justify-end border-t border-app-border-subtle">
              <button
                onClick={() => { setShowNoShowModal(false); setNoShowDescription(''); }}
                className="px-4 py-2 text-app-text-strong hover:bg-app-hover rounded-lg font-medium text-sm"
              >
                Go Back
              </button>
              <button
                onClick={handleReportNoShow}
                disabled={reportingNoShow}
                className="px-5 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm disabled:opacity-50"
              >
                {reportingNoShow ? 'Reporting…' : 'Report No-Show'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cancellation Modal ─── */}
      <CancellationModal
        show={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        cancelPreview={cancelPreview}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        cancelling={cancelling}
        onConfirm={handleCancelGig}
        isOwner={isOwner}
      />

      {/* ─── Tip Modal ─── */}
      {showTipModal && acceptedBy && (
        <TipModal
          gigId={gigId}
          workerName={
            gig?.accepted_bid?.bidder?.name ||
            gig?.accepted_bid?.bidder?.username ||
            'the worker'
          }
          onSuccess={(tipAmount) => {
            setShowTipModal(false);
            onStatusChange?.();
            toast.success(`Tip of $${(tipAmount / 100).toFixed(2)} sent!`);
          }}
          onClose={() => setShowTipModal(false)}
        />
      )}
    </>
  );
});
