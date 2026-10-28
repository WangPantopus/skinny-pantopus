'use client';

import { useEffect, useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subhead?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function BottomSheet({
  open,
  onClose,
  title,
  subhead,
  children,
  footer,
  className = '',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  // On document.body the sheet comes last in the Tab order, so it takes focus
  // when it opens (unless a field in it already has it), keeps Tab inside and
  // gives focus back when it closes (unless focus is already elsewhere, e.g.
  // in a sheet still open on top). Tab inside a sheet opened on top of this
  // one is left to that sheet; focus that fell to the page (the focused
  // control was removed) comes back to the top sheet.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!open || !mounted || !sheet) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!sheet.contains(document.activeElement)) sheet.focus();
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const active = document.activeElement;
      const dropped = (!active || active === document.body)
        && Array.from(document.querySelectorAll('[aria-modal="true"]')).pop() === sheet;
      if (!dropped && !sheet.contains(active)) return;
      const controls = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        e.preventDefault();
        sheet.focus();
      } else if (dropped) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === sheet)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      const active = document.activeElement;
      if ((!active || active === document.body) && opener?.isConnected) opener.focus();
    };
  }, [open, mounted]);

  if (!open || !mounted) return null;

  // Rendered on document.body, like ModalShell: AppShell's <main> is its own
  // stacking context (relative z-0), so from inside it the phone tab bar (z-40)
  // covered the sheet's footer, and the header stayed above the backdrop.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop – fade in */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_0.2s_ease-out]"
        onClick={onClose}
      />

      {/* Sheet – slide up */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative w-full max-w-md sm:max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl border border-app shadow-2xl overflow-hidden outline-none animate-[slideUp_0.25s_ease-out] ${className}`}
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
                {title && <h3 id={titleId} className="text-sm font-bold text-app">{title}</h3>}
                {subhead && <p className="mt-0.5 text-xs text-app-muted">{subhead}</p>}
              </div>
              <button aria-label="Close"
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
    </div>,
    document.body,
  );
}
