'use client';

import { Clock } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';

const ETA_PRESETS = [10, 20, 30, 45, 60];
const MAX_NOTE_LENGTH = 1000;

interface RunningLateModalProps {
  open: boolean;
  eta: string;
  onChangeEta: (text: string) => void;
  note: string;
  onChangeNote: (text: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export default function RunningLateModal({
  open,
  eta,
  onChangeEta,
  note,
  onChangeNote,
  submitting,
  onSubmit,
  onClose,
}: RunningLateModalProps) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={Clock}
      iconColor="#d97706"
      iconBgColor="#fffbeb"
      title="Running Late"
      subtitle="Let the task owner know your estimated arrival."
      cancelLabel="Go Back"
      onCancel={onClose}
      cancelDisabled={submitting}
      submitLabel="Send Update"
      onSubmit={onSubmit}
      submitDisabled={submitting || !eta}
      submitting={submitting}
    >
      {/* ETA presets */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-app-text-strong mb-2">
          Estimated arrival (minutes)
        </label>
        <div className="flex gap-2 mb-3">
          {ETA_PRESETS.map((minutes) => {
            const selected = eta === String(minutes);
            return (
              <button
                key={minutes}
                type="button"
                onClick={() => onChangeEta(String(minutes))}
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition ${
                  selected
                    ? 'border-sky-500 bg-sky-50 text-sky-700 font-bold'
                    : 'border-app-border bg-white text-app-text hover:border-sky-300'
                } disabled:opacity-50`}
              >
                {minutes}m
              </button>
            );
          })}
        </div>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Or type custom minutes..."
          value={eta}
          onChange={(e) => onChangeEta(e.target.value.replace(/[^0-9]/g, ''))}
          maxLength={3}
          disabled={submitting}
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text text-center placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 disabled:opacity-50"
        />
      </div>

      {/* Optional note */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-1.5">
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => onChangeNote(e.target.value)}
          placeholder="e.g. Stuck in traffic, on my way..."
          maxLength={MAX_NOTE_LENGTH}
          disabled={submitting}
          rows={3}
          className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 disabled:opacity-50 resize-none"
        />
        <p className="text-xs text-app-text-muted mt-1 text-right">
          {note.length}/{MAX_NOTE_LENGTH}
        </p>
      </div>
    </ModalShell>
  );
}
