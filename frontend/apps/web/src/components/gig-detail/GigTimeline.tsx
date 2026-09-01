'use client';

import {
  PenLine,
  Tag,
  Handshake,
  Wrench,
  Package,
  CheckCircle,
  Star,
  Ban,
} from 'lucide-react';

// ─── Types ───

interface TimelineStep {
  key: string;
  label: string;
  icon: React.ReactNode;
  status: 'done' | 'current' | 'upcoming' | 'skipped';
  timestamp?: string | null;
  action?: { label: string; actionKey: string; variant: 'primary' | 'secondary' | 'danger' } | null;
}

// ─── GigTimeline Component ───

export default function GigTimeline({
  gig,
  isMyGig,
  iAmWorker,
  onAction,
}: {
  gig: Record<string, any>;
  isMyGig: boolean;
  iAmWorker: boolean;
  onAction: (action: string) => void;
}) {
  const status = String(gig?.status || '');
  const isCancelled = status === 'cancelled';

  // Build steps
  const steps: TimelineStep[] = [];

  // 1. Posted
  steps.push({
    key: 'posted',
    label: 'Posted',
    icon: <PenLine className="w-4 h-4" />,
    status: 'done',
    timestamp: gig?.created_at,
  });

  // 2. Bidding
  steps.push({
    key: 'bidding',
    label: 'Bidding',
    icon: <Tag className="w-4 h-4" />,
    status: status === 'open' ? 'current' : 'done',
    action: status === 'open' && isMyGig
      ? { label: 'Compare Bids', actionKey: 'compare_bids', variant: 'primary' }
      : null,
  });

  // 3. Bid Selected
  steps.push({
    key: 'selected',
    label: 'Bid Selected',
    icon: <Handshake className="w-4 h-4" />,
    status: status === 'open' ? 'upcoming'
      : status === 'assigned' ? 'current'
      : ['in_progress', 'completed'].includes(status) ? 'done'
      : isCancelled && gig?.accepted_by ? 'done'
      : 'upcoming',
    timestamp: gig?.accepted_at,
  });

  // 4. In Progress
  steps.push({
    key: 'in_progress',
    label: 'In Progress',
    icon: <Wrench className="w-4 h-4" />,
    status: ['open', 'assigned'].includes(status) ? 'upcoming'
      : status === 'in_progress' ? 'current'
      : status === 'completed' ? 'done'
      : 'upcoming',
    timestamp: gig?.started_at,
    action: status === 'assigned' && iAmWorker
      ? { label: 'Start Work', actionKey: 'start_work', variant: 'primary' }
      : status === 'in_progress' && iAmWorker
      ? { label: 'Mark Complete', actionKey: 'mark_complete', variant: 'primary' }
      : status === 'in_progress' && isMyGig
      ? { label: 'Message Worker', actionKey: 'message', variant: 'secondary' }
      : null,
  });

  // 5. Completed
  const workerCompleted = Boolean(gig?.worker_completed_at);
  const ownerConfirmed = Boolean(gig?.owner_confirmed_at);
  steps.push({
    key: 'completed',
    label: 'Delivered',
    icon: <Package className="w-4 h-4" />,
    status: status === 'completed' && workerCompleted && !ownerConfirmed ? 'current'
      : status === 'completed' && ownerConfirmed ? 'done'
      : 'upcoming',
    timestamp: gig?.worker_completed_at,
    action: status === 'completed' && workerCompleted && !ownerConfirmed && isMyGig
      ? { label: 'Confirm Completion', actionKey: 'confirm_complete', variant: 'primary' }
      : null,
  });

  // 6. Confirmed
  steps.push({
    key: 'confirmed',
    label: 'Confirmed',
    icon: <CheckCircle className="w-4 h-4" />,
    status: ownerConfirmed ? 'done' : 'upcoming',
    timestamp: gig?.owner_confirmed_at,
  });

  // 7. Reviewed
  steps.push({
    key: 'reviewed',
    label: 'Reviewed',
    icon: <Star className="w-4 h-4" />,
    status: ownerConfirmed ? 'current' : 'upcoming',
    action: ownerConfirmed && (isMyGig || iAmWorker)
      ? { label: 'Leave Review', actionKey: 'leave_review', variant: 'secondary' }
      : null,
  });

  // Find current step index
  const currentIdx = steps.findIndex((s) => s.status === 'current');

  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-4 sm:p-5">
      {/* Cancelled banner */}
      {isCancelled && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
          <span className="text-red-600 text-sm font-semibold"><Ban className="w-4 h-4 inline-block" /> Cancelled</span>
          {gig?.cancellation_reason && (
            <span className="text-xs text-red-500">— {String(gig.cancellation_reason).replace(/_/g, ' ')}</span>
          )}
        </div>
      )}

      {/* Timeline track */}
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const isDone = step.status === 'done';
          const isCurrent = step.status === 'current';
          const isCancelledStep = isCancelled && i > (currentIdx >= 0 ? currentIdx : steps.length);

          return (
            <div key={step.key} className="flex items-start flex-1 min-w-0">
              {/* Step node */}
              <div className="flex flex-col items-center min-w-[52px] sm:min-w-[64px]">
                {/* Circle */}
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base border-2 transition-all ${
                    isDone
                      ? 'bg-green-100 border-green-400 text-green-700'
                      : isCurrent
                      ? 'bg-primary-100 border-primary-500 text-primary-700 ring-2 ring-primary-200'
                      : isCancelledStep
                      ? 'bg-red-50 border-red-200 text-red-300'
                      : 'bg-app-surface-raised border-app-border text-app-text-muted'
                  }`}
                >
                  {isDone ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs sm:text-sm">{step.icon}</span>
                  )}
                </div>
                {/* Label */}
                <span
                  className={`text-[10px] sm:text-xs mt-1 text-center leading-tight font-medium ${
                    isDone ? 'text-green-700' : isCurrent ? 'text-primary-700' : 'text-app-text-muted'
                  }`}
                >
                  {step.label}
                </span>
                {/* Timestamp */}
                {step.timestamp && (
                  <span className="text-[9px] text-app-text-muted mt-0.5">
                    {new Date(step.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="flex-1 flex items-center pt-4 sm:pt-[18px] px-0.5">
                  <div
                    className={`h-0.5 w-full rounded ${
                      isDone ? 'bg-green-300' : 'bg-app-surface-sunken'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current step action bar */}
      {!isCancelled && currentIdx >= 0 && steps[currentIdx]?.action && (
        <div className="mt-3 pt-3 border-t border-app-border-subtle flex items-center justify-between">
          <div className="text-xs text-app-text-secondary">
            <span className="font-medium text-app-text-strong">Next:</span>{' '}
            {isMyGig ? 'Your action needed' : iAmWorker ? 'Your action needed' : 'Waiting for updates'}
          </div>
          <button
            onClick={() => onAction(steps[currentIdx].action!.actionKey)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
              steps[currentIdx].action!.variant === 'primary'
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : steps[currentIdx].action!.variant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-app-surface-sunken text-app-text-strong hover:bg-app-hover'
            }`}
          >
            {steps[currentIdx].action!.label}
          </button>
        </div>
      )}
    </div>
  );
}
