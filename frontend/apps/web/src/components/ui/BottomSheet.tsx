'use client';

import { useEffect, useCallback, type ReactNode } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subhead?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export default function BottomSheet({
  open,
  onClose,
  title,
  subhead,
  children,
  footer,
  className = '',
}: BottomSheetProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  // ESC listener
  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  // Lock body scroll while open
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop – fade in */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_0.2s_ease-out]"
        onClick={onClose}
      />

      {/* Sheet – slide up */}
      <div
        className={`relative w-full max-w-md sm:max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl border border-app shadow-2xl overflow-hidden animate-[slideUp_0.25s_ease-out] ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile feel) */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="w-8 h-1 rounded-full bg-app-muted/40" />
        </div>

        {(title || subhead) && (
          <div className="flex-shrink-0 border-b border-app px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {title && <h3 className="text-sm font-bold text-app">{title}</h3>}
                {subhead && <p className="mt-0.5 text-xs text-app-muted">{subhead}</p>}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-app-muted hover:text-app hover-bg-app rounded-lg transition flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="p-4 max-h-[70vh] overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-5 py-3 border-t border-app">{footer}</div>
        )}
      </div>
    </div>
  );
}
