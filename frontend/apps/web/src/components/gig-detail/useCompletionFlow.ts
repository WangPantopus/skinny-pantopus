'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

interface NoShowCheck {
  can_report: boolean;
  reason?: string;
  minutes_overdue?: number;
  hours_since_accept?: number;
  expected_start?: string;
  can_report_after?: string;
}

interface UseCompletionFlowOptions {
  gigId: string;
  gig: any;
  isOwner: boolean;
  currentUserId: string | undefined;
  gigStatus: string;
  onStatusChange?: () => void;
}

const REMINDER_COOLDOWN_MS = 15 * 60 * 1000;

function formatCooldownRemaining(endDate: Date): string | null {
  const diffMs = endDate.getTime() - Date.now();
  if (diffMs <= 0) return null;
  const totalMin = Math.ceil(diffMs / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function useCompletionFlow({
  gigId,
  gig,
  isOwner,
  currentUserId,
  gigStatus,
  onStatusChange,
}: UseCompletionFlowOptions) {
  // ---- Confirm Completion modal state ----
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmSatisfaction, setConfirmSatisfaction] = useState(0);
  const [confirmNote, setConfirmNote] = useState('');
  const [submittingConfirm, setSubmittingConfirm] = useState(false);

  // ---- No-show state ----
  const [noShowCheck, setNoShowCheck] = useState<NoShowCheck | null>(null);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [noShowDescription, setNoShowDescription] = useState('');
  const [reportingNoShow, setReportingNoShow] = useState(false);

  // ---- Reminder cooldown state ----
  const [reminderCooldownEnd, setReminderCooldownEnd] = useState<Date | null>(null);
  const [reminderCooldownRemaining, setReminderCooldownRemaining] = useState<string | null>(null);

  // ---- Worker ack state ----
  const [showRunningLateModal, setShowRunningLateModal] = useState(false);
  const [runningLateEta, setRunningLateEta] = useState('');
  const [runningLateNote, setRunningLateNote] = useState('');
  const [submittingAck, setSubmittingAck] = useState(false);

  // ---- Cancel task modal state ----
  const [showCancelTaskModal, setShowCancelTaskModal] = useState(false);
  const [cancelTaskReason, setCancelTaskReason] = useState('');
  const [cancelTaskCustomReason, setCancelTaskCustomReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // ---- Leave Review modal state ----
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [existingReview, setExistingReview] = useState<any | null>(null);

  // ---- Fetch existing reviews on mount ----
  useEffect(() => {
    if (!gigId || !currentUserId) return;
    (async () => {
      try {
        const result = await api.reviews.getGigReviews(gigId);
        const reviews = (result as any)?.reviews || [];
        const myReview = reviews.find(
          (r: any) => String(r.reviewer_id) === String(currentUserId),
        );
        if (myReview) setExistingReview(myReview);
      } catch {
        // Non-critical
      }
    })();
  }, [gigId, currentUserId]);

  // ---- Check no-show eligibility ----
  useEffect(() => {
    if (!gigId || !currentUserId) return;
    if (gigStatus !== 'assigned' && gigStatus !== 'in_progress') return;
    (async () => {
      try {
        const result = await api.gigs.checkNoShow(gigId);
        setNoShowCheck(result as NoShowCheck);
      } catch {
        setNoShowCheck(null);
      }
    })();
  }, [gigId, gigStatus, currentUserId]);

  // ---- Reminder cooldown helpers ----
  const setCooldown = useCallback((end: Date | null) => {
    setReminderCooldownEnd(end);
    setReminderCooldownRemaining(end ? formatCooldownRemaining(end) : null);
  }, []);

  useEffect(() => {
    if (!gig?.last_worker_reminder_at) {
      setCooldown(null);
      return;
    }
    const endMs = Date.parse(gig.last_worker_reminder_at) + REMINDER_COOLDOWN_MS;
    if (endMs > Date.now()) {
      setCooldown(new Date(endMs));
    } else {
      setCooldown(null);
    }
  }, [gig?.last_worker_reminder_at, setCooldown]);

  useEffect(() => {
    if (!reminderCooldownEnd) return;
    const tick = () => {
      const remaining = formatCooldownRemaining(reminderCooldownEnd);
      if (remaining === null) {
        setCooldown(null);
      } else {
        setReminderCooldownRemaining(remaining);
      }
    };
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [reminderCooldownEnd, setCooldown]);

  const isReminderOnCooldown = reminderCooldownEnd !== null && reminderCooldownRemaining !== null;

  // ---- Handlers ----

  const handleReportNoShow = useCallback(async () => {
    setReportingNoShow(true);
    try {
      await api.gigs.reportNoShow(gigId, { description: noShowDescription || undefined });
      setShowNoShowModal(false);
      setNoShowDescription('');
      toast.success('No-show reported');
      onStatusChange?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to report no-show');
    } finally {
      setReportingNoShow(false);
    }
  }, [gigId, noShowDescription, onStatusChange]);

  const handleStartingNow = useCallback(async () => {
    setSubmittingAck(true);
    try {
      await api.gigs.workerAck(gigId, { status: 'starting_now' });
      toast.success('Starting now — the owner has been notified');
      onStatusChange?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send update');
    } finally {
      setSubmittingAck(false);
    }
  }, [gigId, onStatusChange]);

  const handleStartWork = useCallback(async () => {
    const onSite = await confirmStore.open({
      title: 'Are you on-site?',
      description: 'Starting work will change the task status to In Progress.',
      confirmLabel: 'Yes, start work',
      cancelLabel: 'Not yet — notify owner',
      variant: 'primary',
    });

    if (onSite) {
      try {
        await api.gigs.startGig(gigId);
        toast.success('Work started!');
        onStatusChange?.();
      } catch (err: any) {
        if (err?.data?.code === 'payer_authorization_required') {
          toast.error('The task owner has not authorized payment yet. Please wait or message them.');
        } else {
          toast.error(err?.message || 'Failed to start work');
        }
      }
    } else {
      await handleStartingNow();
    }
  }, [gigId, onStatusChange, handleStartingNow]);

  const handleRemindWorker = useCallback(async () => {
    try {
      const result = await api.gigs.remindWorker(gigId);
      toast.success((result as any)?.message || 'Reminder sent to the worker');
      if ((result as any)?.sent_at) {
        setCooldown(new Date(Date.parse((result as any).sent_at) + REMINDER_COOLDOWN_MS));
      }
    } catch (err: any) {
      const nextAllowed = err?.data?.next_allowed_at;
      if (nextAllowed) {
        setCooldown(new Date(nextAllowed));
      }
      toast.error(err?.message || 'Failed to send reminder');
    }
  }, [gigId, setCooldown]);

  const handleReplaceWorker = useCallback(async () => {
    const yes = await confirmStore.open({
      title: 'Replace Worker',
      description:
        'This will unassign the current worker, release any payment hold, and reopen the task for bids. Use this only before work starts.',
      confirmLabel: 'Replace Worker',
      variant: 'destructive',
    });
    if (!yes) return;

    try {
      const result = await api.gigs.reopenBidding(gigId);
      toast.success((result as any)?.message || 'Worker removed and bidding reopened');
      onStatusChange?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to replace worker');
    }
  }, [gigId, onStatusChange]);

  const handleRunningLate = useCallback(() => {
    setRunningLateEta('');
    setRunningLateNote('');
    setShowRunningLateModal(true);
  }, []);

  const submitRunningLate = useCallback(async () => {
    setSubmittingAck(true);
    try {
      const etaNum = runningLateEta ? parseInt(runningLateEta, 10) : undefined;
      await api.gigs.workerAck(gigId, {
        status: 'running_late',
        eta_minutes: etaNum && Number.isFinite(etaNum) ? etaNum : undefined,
        note: runningLateNote || undefined,
      });
      setShowRunningLateModal(false);
      toast.success('Running late update sent to the owner');
      onStatusChange?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send update');
    } finally {
      setSubmittingAck(false);
    }
  }, [gigId, runningLateEta, runningLateNote, onStatusChange]);

  const handleCantMakeIt = useCallback(async () => {
    const yes = await confirmStore.open({
      title: "Can't Make It",
      description:
        'This will unassign you from the task and reopen it for new bids. Any payment hold will be released.',
      confirmLabel: "I Can't Make It",
      variant: 'destructive',
    });
    if (!yes) return;

    setSubmittingAck(true);
    try {
      const result = await api.gigs.workerRelease(gigId);
      toast.success((result as any)?.message || 'You have been released from this task');
      onStatusChange?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to release from task');
    } finally {
      setSubmittingAck(false);
    }
  }, [gigId, onStatusChange]);

  const closeRunningLateModal = useCallback(() => {
    setShowRunningLateModal(false);
    setRunningLateEta('');
    setRunningLateNote('');
  }, []);

  // ---- Cancel task handlers ----

  const handleOpenCancelTask = useCallback(() => {
    setCancelTaskReason('');
    setCancelTaskCustomReason('');
    setShowCancelTaskModal(true);
  }, []);

  const submitCancelTask = useCallback(async () => {
    const reason = cancelTaskReason === 'other' ? cancelTaskCustomReason.trim() : cancelTaskReason;
    if (!reason) return;

    setSubmittingCancel(true);
    try {
      await api.gigs.cancelGig(gigId, reason);
      setShowCancelTaskModal(false);
      toast.success('Task cancelled');
      onStatusChange?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel task');
    } finally {
      setSubmittingCancel(false);
    }
  }, [gigId, cancelTaskReason, cancelTaskCustomReason, onStatusChange]);

  const closeCancelTaskModal = useCallback(() => {
    setShowCancelTaskModal(false);
    setCancelTaskReason('');
    setCancelTaskCustomReason('');
  }, []);

  const handleMarkCompleted = useCallback(async () => {
    const yes = await confirmStore.open({
      title: 'Complete Task',
      description: 'Mark this task as completed?',
      confirmLabel: 'Complete',
      variant: 'primary',
    });
    if (!yes) return;

    try {
      await api.gigs.markGigCompleted(gigId, {});
      toast.success('Marked as completed!');
      onStatusChange?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to mark completed');
    }
  }, [gigId, onStatusChange]);

  const handleConfirmCompletion = useCallback(() => {
    setConfirmSatisfaction(0);
    setConfirmNote('');
    setShowConfirmModal(true);
  }, []);

  const openLeaveReview = useCallback(() => {
    setReviewRating(0);
    setReviewComment('');
    setShowReviewModal(true);
  }, []);

  const submitConfirmation = useCallback(async () => {
    setSubmittingConfirm(true);
    try {
      await api.gigs.confirmGigCompletion(gigId, {
        satisfaction: confirmSatisfaction > 0 ? confirmSatisfaction : undefined,
        note: confirmNote || undefined,
      });
      setShowConfirmModal(false);
      onStatusChange?.();
      toast.success('Completion confirmed!');
      openLeaveReview();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to confirm completion');
    } finally {
      setSubmittingConfirm(false);
    }
  }, [gigId, confirmSatisfaction, confirmNote, onStatusChange, openLeaveReview]);

  const submitReview = useCallback(async (reviewMediaFiles: any[]) => {
    if (reviewRating === 0) {
      toast.warning('Please select a star rating before submitting.');
      return;
    }
    setSubmittingReview(true);
    try {
      const revieweeId = isOwner ? gig.accepted_by : gig.user_id;
      if (!revieweeId) {
        toast.error('Cannot determine who to review.');
        return;
      }

      const result: any = await api.reviews.createReview({
        gig_id: gigId,
        reviewee_id: revieweeId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });

      const createdReviewId = result?.review?.id;

      if (createdReviewId && reviewMediaFiles.length > 0) {
        try {
          await api.upload.uploadReviewMedia(createdReviewId, reviewMediaFiles);
        } catch {
          toast.info('Review posted, but some media failed to upload.');
        }
      }

      setShowReviewModal(false);
      setExistingReview(result?.review);
      toast.success('Review submitted!');
      onStatusChange?.();
    } catch (err: any) {
      if (err?.message?.includes('already reviewed')) {
        toast.info('You have already reviewed this gig');
        setShowReviewModal(false);
      } else {
        toast.error(err?.message || 'Failed to submit review');
      }
    } finally {
      setSubmittingReview(false);
    }
  }, [gigId, isOwner, gig, reviewRating, reviewComment, onStatusChange]);

  const closeNoShowModal = useCallback(() => {
    setShowNoShowModal(false);
    setNoShowDescription('');
  }, []);

  return {
    // Confirm completion
    showConfirmModal, setShowConfirmModal,
    confirmSatisfaction, setConfirmSatisfaction,
    confirmNote, setConfirmNote,
    submittingConfirm,
    handleConfirmCompletion, submitConfirmation,

    // No-show
    noShowCheck,
    showNoShowModal, setShowNoShowModal,
    noShowDescription, setNoShowDescription,
    reportingNoShow,
    handleReportNoShow, closeNoShowModal,

    // Review
    showReviewModal, setShowReviewModal,
    reviewRating, setReviewRating,
    reviewComment, setReviewComment,
    submittingReview,
    existingReview,
    openLeaveReview, submitReview,

    // Reminder cooldown
    isReminderOnCooldown, reminderCooldownRemaining,

    // Worker acknowledgement
    showRunningLateModal, setShowRunningLateModal,
    runningLateEta, setRunningLateEta,
    runningLateNote, setRunningLateNote,
    submittingAck,
    handleStartingNow,
    handleRunningLate, submitRunningLate,
    handleCantMakeIt, closeRunningLateModal,

    // Cancel task
    showCancelTaskModal,
    cancelTaskReason, setCancelTaskReason,
    cancelTaskCustomReason, setCancelTaskCustomReason,
    submittingCancel,
    handleOpenCancelTask, submitCancelTask, closeCancelTaskModal,

    // Worker actions
    handleRemindWorker, handleReplaceWorker,
    handleStartWork, handleMarkCompleted,
  };
}
