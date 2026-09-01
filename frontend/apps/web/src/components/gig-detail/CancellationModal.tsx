'use client';

import {
  RefreshCw,
  Hand,
  DollarSign,
  Siren,
  Calendar,
  XCircle,
  AlertTriangle,
  MessageCircle,
} from 'lucide-react';

const OWNER_REASONS = [
  { value: 'changed_plans', label: 'Changed my plans', icon: <RefreshCw className="w-4 h-4" /> },
  { value: 'found_someone_else', label: 'Found someone else', icon: <Hand className="w-4 h-4" /> },
  { value: 'too_expensive', label: 'Bids too expensive', icon: <DollarSign className="w-4 h-4" /> },
  { value: 'emergency', label: 'Emergency', icon: <Siren className="w-4 h-4" /> },
  { value: 'other', label: 'Other', icon: <MessageCircle className="w-4 h-4" /> },
];

const WORKER_REASONS = [
  { value: 'schedule_conflict', label: 'Schedule conflict', icon: <Calendar className="w-4 h-4" /> },
  { value: 'unable_to_complete', label: 'Unable to complete', icon: <XCircle className="w-4 h-4" /> },
  { value: 'emergency', label: 'Emergency', icon: <Siren className="w-4 h-4" /> },
  { value: 'safety_concern', label: 'Safety concern', icon: <AlertTriangle className="w-4 h-4" /> },
  { value: 'other', label: 'Other', icon: <MessageCircle className="w-4 h-4" /> },
];

const MAX_NOTE_LENGTH = 1000;

interface CancellationModalProps {
  show: boolean;
  onClose: () => void;
  cancelPreview: {
    policy_label?: string;
    fee: number;
    fee_pct?: number;
    zone_label: string;
    zone?: number;
    in_grace?: boolean;
    policy_description?: string;
  } | null;
  cancelReason: string;
  setCancelReason: (reason: string) => void;
  customReason?: string;
  onChangeCustomReason?: (text: string) => void;
  cancelling: boolean;
  onConfirm: () => void;
  isOwner: boolean;
}

export default function CancellationModal({
  show, onClose, cancelPreview, cancelReason, setCancelReason,
  customReason = '', onChangeCustomReason,
  cancelling, onConfirm, isOwner,
}: CancellationModalProps) {
  if (!show) return null;

  const reasons = isOwner ? OWNER_REASONS : WORKER_REASONS;
  const hasReason = cancelReason === 'other'
    ? customReason.trim().length > 0
    : cancelReason.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-app-surface rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-app-border-subtle">
          <h3 className="text-lg font-semibold text-app-text">Cancel Gig</h3>
          <p className="text-sm text-app-text-secondary mt-1">Please review what happens when you cancel.</p>
        </div>

        {cancelPreview ? (
          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-app-text-secondary uppercase">Policy:</span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-app-surface-sunken text-app-text-strong">
                {cancelPreview.policy_label || 'Standard'}
              </span>
            </div>

            <div className={`rounded-lg p-4 ${cancelPreview.fee > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              <p className={`text-sm font-medium ${cancelPreview.fee > 0 ? 'text-red-900' : 'text-green-900'}`}>
                {cancelPreview.fee > 0
                  ? `Cancellation fee: $${cancelPreview.fee.toFixed(2)} (${cancelPreview.fee_pct || 0}% of task price)`
                  : 'No cancellation fee'}
              </p>
              <p className={`text-xs mt-1 ${cancelPreview.fee > 0 ? 'text-red-700' : 'text-green-700'}`}>
                {cancelPreview.fee > 0 && !cancelPreview.in_grace
                  ? 'The grace period has expired. This fee will be charged.'
                  : cancelPreview.in_grace
                    ? 'You are within the grace period. No fee applies.'
                    : 'This policy does not charge a fee at this stage.'}
              </p>
              {cancelPreview.policy_description && (
                <p className="text-xs mt-2 text-app-text-muted">{cancelPreview.policy_description}</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-app-text-strong mb-2">What happened?</p>
              <div className="space-y-1.5">
                {reasons.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setCancelReason(r.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition text-sm ${
                      cancelReason === r.value
                        ? 'border-red-400 bg-red-50'
                        : 'border-app-border hover:border-app-border'
                    }`}
                  >
                    <span>{r.icon}</span>
                    <span className="font-medium text-app-text">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom reason input (when "Other" selected) */}
            {cancelReason === 'other' && (
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-1.5">
                  Please describe
                </label>
                <textarea
                  value={customReason}
                  onChange={(e) => onChangeCustomReason?.(e.target.value)}
                  placeholder="Why are you cancelling?"
                  maxLength={MAX_NOTE_LENGTH}
                  disabled={cancelling}
                  rows={3}
                  className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 disabled:opacity-50 resize-none"
                />
                <p className="text-xs text-app-text-muted mt-1 text-right">
                  {customReason.length}/{MAX_NOTE_LENGTH}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-app-border border-t-gray-600 mx-auto" />
            <p className="text-xs text-app-text-secondary mt-2">Loading cancellation details...</p>
          </div>
        )}

        <div className="px-6 py-4 flex gap-3 justify-end border-t border-app-border-subtle">
          <button
            onClick={onClose}
            className="px-4 py-2 text-app-text-strong hover:bg-app-hover rounded-lg font-medium text-sm"
          >
            Keep Gig
          </button>
          <button
            onClick={onConfirm}
            disabled={cancelling || !hasReason || !cancelPreview}
            className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelling ? 'Cancelling\u2026' : 'Cancel Gig'}
          </button>
        </div>
      </div>
    </div>
  );
}
