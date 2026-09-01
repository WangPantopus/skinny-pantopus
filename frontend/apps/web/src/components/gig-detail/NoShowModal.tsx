'use client';

import { AlertTriangle } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';

const MAX_NOTE_LENGTH = 1000;

interface NoShowCheck {
  can_report: boolean;
  reason?: string;
  minutes_overdue?: number;
  hours_since_accept?: number;
  expected_start?: string;
  can_report_after?: string;
}

interface NoShowModalProps {
  open: boolean;
  isOwner: boolean;
  noShowCheck: NoShowCheck | null;
  noShowDescription: string;
  onChangeDescription: (text: string) => void;
  reportingNoShow: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export default function NoShowModal({
  open,
  isOwner,
  noShowCheck,
  noShowDescription,
  onChangeDescription,
  reportingNoShow,
  onSubmit,
  onClose,
}: NoShowModalProps) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={AlertTriangle}
      iconColor="#ea580c"
      iconBgColor="#fff7ed"
      title="Report No-Show"
      subtitle={
        isOwner
          ? "The worker didn't show up or start work as expected."
          : 'The poster is unresponsive and the task cannot proceed.'
      }
      cancelLabel="Go Back"
      onCancel={onClose}
      cancelDisabled={reportingNoShow}
      submitLabel="Report No-Show"
      onSubmit={onSubmit}
      submitDisabled={reportingNoShow}
      submitting={reportingNoShow}
    >
      {/* Consequences info */}
      <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 mb-4">
        <p className="text-sm font-medium text-orange-900 mb-2">What happens when you report:</p>
        <ul className="space-y-1 text-sm text-orange-800">
          <li>&bull; The task will be cancelled</li>
          <li>&bull; A 25% no-show fee may apply</li>
          <li>&bull; Their reliability score will be reduced</li>
          <li>&bull; The no-show is recorded on their profile</li>
        </ul>
      </div>

      {/* Stats */}
      {noShowCheck && (
        <div className="rounded-lg bg-app-surface-sunken p-4 mb-4 space-y-1">
          {(noShowCheck.minutes_overdue ?? 0) > 0 && (
            <p className="text-sm text-app-text-secondary">
              Worker is {noShowCheck.minutes_overdue} min overdue.
            </p>
          )}
          {(noShowCheck.hours_since_accept ?? 0) > 0 && (
            <p className="text-sm text-app-text-secondary">
              Accepted {noShowCheck.hours_since_accept}h ago with no response.
            </p>
          )}
          {noShowCheck.expected_start && (
            <p className="text-sm text-app-text-secondary">
              Expected start: {new Date(noShowCheck.expected_start).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Description input */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-1.5">
          Additional details (optional)
        </label>
        <textarea
          value={noShowDescription}
          onChange={(e) => onChangeDescription(e.target.value)}
          placeholder="Describe what happened..."
          maxLength={MAX_NOTE_LENGTH}
          disabled={reportingNoShow}
          rows={3}
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 disabled:opacity-50 resize-none"
        />
        <p className="text-xs text-app-text-muted mt-1 text-right">
          {noShowDescription.length}/{MAX_NOTE_LENGTH}
        </p>
      </div>
    </ModalShell>
  );
}
