'use client';

import {
  CheckCircle,
  Star,
  CheckCheck,
  Hourglass,
  Bell,
  MessageCircle,
  RefreshCw,
  PlayCircle,
  Clock,
  XCircle,
  Wrench,
  AlertTriangle,
  CreditCard,
} from 'lucide-react';

interface NoShowCheck {
  can_report: boolean;
  reason?: string;
  minutes_overdue?: number;
  hours_since_accept?: number;
  expected_start?: string;
  can_report_after?: string;
}

interface CompletionActionCardsProps {
  gigStatus: string;
  gig: any;
  isOwner: boolean;
  isWorker: boolean;
  existingReview: any;
  noShowCheck: NoShowCheck | null;
  onConfirmCompletion: () => void;
  onLeaveReview: () => void;
  onRemindWorker: () => void;
  onReplaceWorker: () => void;
  onStartWork: () => void;
  onMarkCompleted: () => void;
  onOpenChat: () => void;
  onReportNoShow: () => void;
  isReminderOnCooldown: boolean;
  reminderCooldownRemaining: string | null;
  onRunningLate: () => void;
  onCantMakeIt: () => void;
  submittingAck: boolean;
  onCancelTask: () => void;
}

function formatTimeUntil(isoString?: string | null): string | null {
  if (!isoString) return null;
  const targetMs = new Date(isoString).getTime();
  if (!Number.isFinite(targetMs)) return null;

  const diffMs = targetMs - Date.now();
  if (diffMs <= 0) return 'now';

  const totalMinutes = Math.ceil(diffMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function getOwnerAssignedSubtitle(noShowCheck: NoShowCheck | null): string {
  if (noShowCheck?.can_report) {
    return 'The worker has not started yet. You can report a no-show now if needed.';
  }
  const unlockIn = formatTimeUntil(noShowCheck?.can_report_after);
  if (unlockIn) {
    return `You can remind the worker now. If they still do not start, no-show reporting unlocks in ${unlockIn}.`;
  }
  return 'You can remind the worker, open chat, or replace them before work starts.';
}

function getWorkerAssignedSubtitle(noShowCheck: NoShowCheck | null): string {
  if (noShowCheck?.can_report) {
    return 'Begin working on this task, or report a no-show if the owner is unresponsive.';
  }
  return 'Begin working on this task. If the owner becomes unresponsive, you can report a no-show later.';
}

export default function CompletionActionCards({
  gigStatus,
  gig,
  isOwner,
  isWorker,
  existingReview,
  noShowCheck,
  onConfirmCompletion,
  onLeaveReview,
  onRemindWorker,
  onReplaceWorker,
  onStartWork,
  onMarkCompleted,
  onOpenChat,
  onReportNoShow,
  isReminderOnCooldown,
  reminderCooldownRemaining,
  onRunningLate,
  onCantMakeIt,
  submittingAck,
  onCancelTask,
}: CompletionActionCardsProps) {
  const isPaid = gig?.price && parseFloat(gig.price) > 0;
  const paymentReady = !isPaid || gig?.payment_status === 'authorized';

  return (
    <div className="space-y-3">
      {/* Owner: Confirm completion (worker marked done but owner hasn't confirmed) */}
      {isOwner &&
        (gigStatus === 'completed' || gigStatus === 'delivered') &&
        !!gig?.worker_completed_at &&
        !gig?.owner_confirmed_at && (
          <div className="bg-app-surface rounded-xl border border-app-border p-5">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-7 h-7 text-green-600" />
              <div>
                <p className="font-semibold text-app-text">Worker marked this as complete</p>
                <p className="text-sm text-app-text-secondary">Review and confirm the completion</p>
              </div>
            </div>
            <button
              onClick={onConfirmCompletion}
              className="w-full mt-3 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition"
            >
              Review & Confirm
            </button>
          </div>
        )}

      {/* Owner/Worker: Leave Review (after owner confirmed) */}
      {(isOwner || isWorker) &&
        gigStatus === 'completed' &&
        !!gig?.owner_confirmed_at &&
        !existingReview && (
          <div className="bg-app-surface rounded-xl border border-app-border p-5">
            <div className="flex items-center gap-3 mb-2">
              <Star className="w-7 h-7 text-amber-500" />
              <div>
                <p className="font-semibold text-app-text">Leave a Review</p>
                <p className="text-sm text-app-text-secondary">
                  Share your experience with the {isOwner ? 'worker' : 'task poster'}
                </p>
              </div>
            </div>
            <button
              onClick={onLeaveReview}
              className="w-full mt-3 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition flex items-center justify-center gap-2"
            >
              <Star className="w-4 h-4" /> Write Review
            </button>
          </div>
        )}

      {/* Existing review badge */}
      {existingReview && (
        <div className="bg-app-surface rounded-xl border border-app-border p-5">
          <div className="flex items-center gap-3">
            <CheckCheck className="w-7 h-7 text-green-600" />
            <div>
              <p className="font-semibold text-app-text">Review Submitted</p>
              <p className="text-sm text-app-text-secondary">
                You gave {existingReview.rating} &#9733; — Thank you for your feedback!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* OWNER: Worker Ack Banners */}
      {isOwner && gigStatus === 'assigned' && gig?.worker_ack_status === 'starting_now' && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">
              Worker says they&apos;re starting now
            </p>
            {gig?.worker_ack_updated_at && (
              <p className="text-xs text-green-600 mt-0.5">
                Updated {new Date(gig.worker_ack_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      )}

      {isOwner && gigStatus === 'assigned' && gig?.worker_ack_status === 'running_late' && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Worker is running late
              {gig?.worker_ack_eta_minutes ? ` · ETA: ~${gig.worker_ack_eta_minutes} min` : ''}
            </p>
            {gig?.worker_ack_note && (
              <p className="text-xs text-amber-700 mt-1 italic">&ldquo;{gig.worker_ack_note}&rdquo;</p>
            )}
            {gig?.worker_ack_updated_at && (
              <p className="text-xs text-amber-600 mt-0.5">
                Updated {new Date(gig.worker_ack_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* OWNER ACTIONS: Assigned */}
      {isOwner && gigStatus === 'assigned' && (
        <div className="bg-app-surface rounded-xl border border-app-border p-5">
          <div className="flex items-center gap-3 mb-2">
            <Hourglass className="w-7 h-7 text-emerald-600" />
            <div>
              <p className="font-semibold text-app-text">Waiting for worker to start</p>
              <p className="text-sm text-app-text-secondary">
                {!paymentReady
                  ? 'Authorize payment first so the worker can start. You can message them in the meantime.'
                  : getOwnerAssignedSubtitle(noShowCheck)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onRemindWorker}
              disabled={isReminderOnCooldown || !paymentReady}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              <Bell className="w-4 h-4" />
              {isReminderOnCooldown ? `Sent · retry in ${reminderCooldownRemaining}` : 'Remind Worker'}
            </button>
            <button
              onClick={onOpenChat}
              className="flex-1 px-4 py-2.5 border border-app-border rounded-lg font-medium text-app-text hover:bg-app-hover transition flex items-center justify-center gap-2 text-sm"
            >
              <MessageCircle className="w-4 h-4" /> Message Worker
            </button>
          </div>
          <button
            onClick={onReplaceWorker}
            className="w-full mt-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 transition flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Replace Worker
          </button>
          <p className="text-xs text-app-text-muted mt-1.5">
            This keeps the task open and releases the current hold before work starts.
          </p>
          <button
            onClick={onCancelTask}
            className="w-full mt-2 text-sm text-red-500 hover:text-red-700 hover:underline"
          >
            Cancel Task
          </button>
        </div>
      )}

      {/* WORKER: Waiting for payment authorization */}
      {isWorker && gigStatus === 'assigned' && gig?.payment_status && gig.payment_status !== 'authorized' && gig.payment_status !== 'none' && (
        <div className="bg-app-surface rounded-xl border border-app-border p-5">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-7 h-7 text-amber-600" />
            <div>
              <p className="font-semibold text-app-text">Waiting for payment authorization</p>
              <p className="text-sm text-app-text-secondary">
                The task owner needs to authorize payment before you can start.
                You can message them or let them know your availability while you wait.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onOpenChat}
              className="flex-1 px-4 py-2.5 border border-app-border rounded-lg font-medium text-app-text hover:bg-app-hover transition flex items-center justify-center gap-2 text-sm"
            >
              <MessageCircle className="w-4 h-4" /> Message Owner
            </button>
            <button
              onClick={onRunningLate}
              disabled={submittingAck}
              className="flex-1 px-4 py-2.5 border border-app-border rounded-lg font-medium text-app-text hover:bg-app-hover transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <Clock className="w-4 h-4" /> Running Late
            </button>
          </div>
          <button
            onClick={onCantMakeIt}
            disabled={submittingAck}
            className="w-full mt-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> Can&apos;t Make It
          </button>
        </div>
      )}

      {/* WORKER ACTIONS: Ready to start (payment authorized or free gig) */}
      {isWorker && gigStatus === 'assigned' && (!gig?.payment_status || gig.payment_status === 'authorized' || gig.payment_status === 'none') && (
        <div className="bg-app-surface rounded-xl border border-app-border p-5">
          <div className="flex items-center gap-3 mb-2">
            <PlayCircle className="w-7 h-7 text-emerald-600" />
            <div>
              <p className="font-semibold text-app-text">Ready to start?</p>
              <p className="text-sm text-app-text-secondary">{getWorkerAssignedSubtitle(noShowCheck)}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onStartWork}
              disabled={submittingAck}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 text-sm"
            >
              Start Work
            </button>
            <button
              onClick={onOpenChat}
              className="flex-1 px-4 py-2.5 border border-app-border rounded-lg font-medium text-app-text hover:bg-app-hover transition flex items-center justify-center gap-2 text-sm"
            >
              <MessageCircle className="w-4 h-4" /> Message Owner
            </button>
          </div>
          <button
            onClick={onRunningLate}
            disabled={submittingAck}
            className="w-full mt-2 px-4 py-2 border border-app-border rounded-lg font-medium text-app-text hover:bg-app-hover transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <Clock className="w-4 h-4" /> Running Late
          </button>
          <button
            onClick={onCantMakeIt}
            disabled={submittingAck}
            className="w-full mt-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> Can&apos;t Make It
          </button>
          <p className="text-xs text-app-text-muted mt-1.5">
            Can&apos;t make it releases you and reopens the task for new bids.
          </p>
        </div>
      )}

      {/* WORKER: In progress */}
      {isWorker && gigStatus === 'in_progress' && (
        <div className="bg-app-surface rounded-xl border border-app-border p-5">
          <div className="flex items-center gap-3 mb-2">
            <Wrench className="w-7 h-7 text-amber-500" />
            <div>
              <p className="font-semibold text-app-text">Work in progress</p>
              <p className="text-sm text-app-text-secondary">Mark as done when finished</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onMarkCompleted}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition text-sm"
            >
              Mark Completed
            </button>
            <button
              onClick={onOpenChat}
              className="flex-1 px-4 py-2.5 border border-app-border rounded-lg font-medium text-app-text hover:bg-app-hover transition flex items-center justify-center gap-2 text-sm"
            >
              <MessageCircle className="w-4 h-4" /> Chat
            </button>
          </div>
        </div>
      )}

      {/* NO-SHOW REPORT BUTTON */}
      {noShowCheck?.can_report && (isOwner || isWorker) &&
        (gigStatus === 'assigned' || gigStatus === 'in_progress') && (
          <div className="bg-app-surface rounded-xl border border-orange-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-7 h-7 text-orange-600" />
              <div>
                <p className="font-semibold text-app-text">Report No-Show</p>
                <p className="text-sm text-app-text-secondary">
                  {isOwner
                    ? "The worker didn't show up or start work as expected."
                    : 'The poster is unresponsive and the task cannot proceed.'}
                  {(noShowCheck.minutes_overdue ?? 0) > 0 &&
                    ` (${noShowCheck.minutes_overdue}min overdue)`}
                </p>
              </div>
            </div>
            <button
              onClick={onReportNoShow}
              className="w-full mt-3 px-4 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition flex items-center justify-center gap-2 text-sm"
            >
              <AlertTriangle className="w-4 h-4" /> Report No-Show
            </button>
          </div>
        )}
    </div>
  );
}
