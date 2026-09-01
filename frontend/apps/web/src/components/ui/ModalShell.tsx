'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  /** Lucide icon component rendered in the header badge */
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  title: string;
  subtitle?: string;
  /** Cancel / go-back button */
  cancelLabel?: string;
  onCancel: () => void;
  cancelDisabled?: boolean;
  /** Primary action button */
  submitLabel: string;
  onSubmit: () => void;
  submitDisabled?: boolean;
  submitting?: boolean;
  /** Optional lucide icon before the submit label */
  submitIcon?: LucideIcon;
  /** Width override (Tailwind class) */
  maxWidth?: string;
  children: ReactNode;
}

export default function ModalShell({
  open,
  onClose,
  icon: Icon,
  iconColor = '#10b981',
  iconBgColor = '#ecfdf5',
  title,
  subtitle,
  cancelLabel = 'Go Back',
  onCancel,
  cancelDisabled = false,
  submitLabel,
  onSubmit,
  submitDisabled = false,
  submitting = false,
  submitIcon: SubmitIcon,
  maxWidth = 'max-w-lg',
  children,
}: ModalShellProps) {
  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    },
    [onClose, submitting],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => { if (!submitting) onClose(); }}
      />

      {/* Modal */}
      <div
        className={`relative w-full ${maxWidth} bg-app-surface rounded-2xl shadow-2xl border border-app-border-subtle overflow-hidden flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable header + body */}
        <div className="overflow-y-auto flex-1">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-start gap-4">
              {Icon && (
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: iconBgColor }}
                >
                  <Icon size={24} style={{ color: iconColor }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-app-text">{title}</h2>
                {subtitle && (
                  <p className="text-sm text-app-text-secondary mt-0.5">{subtitle}</p>
                )}
              </div>
              {/* Close button */}
              <button
                onClick={() => { if (!submitting) onClose(); }}
                disabled={submitting}
                className="flex-shrink-0 p-1.5 text-app-text-muted hover:text-app-text hover:bg-app-hover rounded-lg transition disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-4">
            {children}
          </div>
        </div>

        {/* Footer (sticky) */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-app-border-subtle bg-app-surface">
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelDisabled || submitting}
            className="flex-1 px-4 py-2.5 border border-app-border rounded-lg text-app-text-strong font-medium hover:bg-app-hover transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled || submitting}
            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <>
                {SubmitIcon && <SubmitIcon size={16} />}
                {submitLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
