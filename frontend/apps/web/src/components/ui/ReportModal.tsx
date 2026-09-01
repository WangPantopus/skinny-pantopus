'use client';

import { useState } from 'react';
import { Flag, X, Ban, Users, ShieldAlert, AlertTriangle, ShieldCheck, MessageCircle } from 'lucide-react';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading', icon: Ban },
  { value: 'harassment', label: 'Harassment or bullying', icon: Users },
  { value: 'inappropriate', label: 'Inappropriate content', icon: ShieldAlert },
  { value: 'misinformation', label: 'Misinformation', icon: AlertTriangle },
  { value: 'safety', label: 'Safety concern', icon: ShieldCheck },
  { value: 'other', label: 'Other', icon: MessageCircle },
] as const;

export type ReportReason = typeof REPORT_REASONS[number]['value'];

const ENTITY_LABELS: Record<string, string> = {
  post: 'Post',
  gig: 'Task',
  listing: 'Listing',
  user: 'User',
  message: 'Message',
};

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => Promise<void>;
  entityType: 'post' | 'gig' | 'listing' | 'user' | 'message';
}

export default function ReportModal({ open, onClose, onSubmit, entityType }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const label = ENTITY_LABELS[entityType] || 'Content';

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await onSubmit(reason, details.trim() || undefined);
      setReason('');
      setDetails('');
      onClose();
    } catch {
      // caller handles error
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    setDetails('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-app-surface rounded-2xl max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-6 pb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <Flag className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-app-text">Report {label}</h2>
              <p className="text-sm text-app-text-secondary">Why are you reporting this?</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1 text-app-text-muted hover:text-app-text-secondary rounded-lg hover:bg-app-hover">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reasons */}
        <div className="px-6 py-3 space-y-1.5">
          {REPORT_REASONS.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition text-sm ${
                  reason === r.value
                    ? 'border-red-400 bg-red-50'
                    : 'border-app-border hover:border-app-border'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium text-app-text">{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Details (shown for 'other', optional for all) */}
        {reason === 'other' && (
          <div className="px-6 pb-3">
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Tell us more..."
              className="w-full text-sm bg-app-surface-raised rounded-xl px-3 py-2 outline-none border border-app-border focus:border-red-300 resize-none h-20"
              maxLength={500}
            />
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3 justify-end border-t border-app-border-subtle">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 text-app-text-strong hover:bg-app-hover rounded-lg font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
