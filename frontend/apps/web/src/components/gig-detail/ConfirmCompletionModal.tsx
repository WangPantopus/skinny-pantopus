'use client';

import { CheckCircle, CheckSquare, Square } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import StarRating from '@/components/ui/StarRating';

const SATISFACTION_LABELS: Record<number, string> = {
  0: 'Tap to rate',
  1: 'Not satisfied',
  2: 'Not satisfied',
  3: 'It was okay',
  4: 'Good work!',
  5: 'Excellent!',
};

const MAX_NOTE_LENGTH = 1000;

interface ConfirmCompletionModalProps {
  open: boolean;
  gig: any;
  confirmSatisfaction: number;
  onSelectSatisfaction: (n: number) => void;
  confirmNote: string;
  onChangeNote: (text: string) => void;
  submittingConfirm: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export default function ConfirmCompletionModal({
  open,
  gig,
  confirmSatisfaction,
  onSelectSatisfaction,
  confirmNote,
  onChangeNote,
  submittingConfirm,
  onSubmit,
  onClose,
}: ConfirmCompletionModalProps) {
  const hasSubmission =
    !!gig?.completion_note ||
    gig?.completion_photos?.length > 0;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={CheckCircle}
      iconColor="#16a34a"
      iconBgColor="#f0fdf4"
      title="Review Work"
      subtitle="Check the worker's submission and confirm completion."
      cancelLabel="Go Back"
      onCancel={onClose}
      cancelDisabled={submittingConfirm}
      submitLabel="Confirm & Approve"
      onSubmit={onSubmit}
      submitDisabled={submittingConfirm}
      submitting={submittingConfirm}
    >
      {/* Worker's Submission Preview */}
      {hasSubmission ? (
        <div className="rounded-lg border border-app-border bg-app-surface-sunken p-4 mb-4">
          <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wide mb-3">
            Worker&apos;s Submission
          </p>

          {gig?.completion_note && (
            <div className="mb-3">
              <p className="text-xs font-medium text-app-text-secondary mb-1">Note:</p>
              <p className="text-sm text-app-text bg-white rounded-lg p-3 border border-app-border-subtle">
                {gig.completion_note}
              </p>
            </div>
          )}

          {gig?.completion_photos?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-app-text-secondary mb-2">
                Photos ({gig.completion_photos.length}):
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {gig.completion_photos.map((url: string, i: number) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <img
                      src={url}
                      alt={`Completion photo ${i + 1}`}
                      className="w-20 h-20 rounded-lg object-cover border border-app-border hover:ring-2 hover:ring-emerald-400 transition"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {gig?.completion_checklist?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-app-text-secondary mb-2">Checklist:</p>
              <div className="space-y-1.5">
                {gig.completion_checklist.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    {c.done ? (
                      <CheckSquare className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${c.done ? 'text-app-text' : 'text-app-text-muted'}`}>
                      {c.item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-4">
          <p className="text-sm text-amber-800">
            The worker marked this gig complete but did not attach proof. You can still
            confirm if you&apos;re satisfied.
          </p>
        </div>
      )}

      {/* Satisfaction Rating */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-app-text-strong mb-2">
          Quick completion rating
        </label>
        <StarRating
          rating={confirmSatisfaction}
          onChange={onSelectSatisfaction}
          size={28}
          valueLabel={SATISFACTION_LABELS[confirmSatisfaction] || 'Tap to rate'}
        />
        <p className="text-xs text-app-text-muted mt-2">
          This is internal completion feedback. Public profile reviews are submitted on the
          next step.
        </p>
      </div>

      {/* Completion Note */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-1.5">
          Completion note (optional)
        </label>
        <textarea
          value={confirmNote}
          onChange={(e) => onChangeNote(e.target.value)}
          placeholder="Any comments for the worker..."
          maxLength={MAX_NOTE_LENGTH}
          disabled={submittingConfirm}
          rows={3}
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 disabled:opacity-50 resize-none"
        />
        <p className="text-xs text-app-text-muted mt-1 text-right">
          {confirmNote.length}/{MAX_NOTE_LENGTH}
        </p>
      </div>
    </ModalShell>
  );
}
