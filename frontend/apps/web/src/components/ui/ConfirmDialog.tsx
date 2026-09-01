'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { confirmStore } from './confirm-store';

export default function ConfirmDialog() {
  const state = useSyncExternalStore(
    confirmStore.subscribe,
    confirmStore.getSnapshot,
    () => null, // SSR
  );

  const [visible, setVisible] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Animate in when state appears
  useEffect(() => {
    if (state) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
  }, [state]);

  // Focus the confirm button when dialog opens
  useEffect(() => {
    if (state && visible) {
      confirmBtnRef.current?.focus();
    }
  }, [state, visible]);

  // Escape key to dismiss
  useEffect(() => {
    if (!state) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        confirmStore.close(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state]);

  // Trap focus inside dialog
  useEffect(() => {
    if (!state || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    dialog.addEventListener('keydown', handler);
    return () => dialog.removeEventListener('keydown', handler);
  }, [state]);

  if (!state) return null;

  const { title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'primary' } = state.options;

  const confirmBtnClass =
    variant === 'destructive'
      ? 'bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-500'
      : 'bg-primary-600 hover:bg-primary-700 text-white focus-visible:ring-primary-500';

  return (
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center p-4
        transition-opacity duration-150 ease-out
        ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => confirmStore.close(false)}
        aria-hidden="true"
      />

      {/* Dialog card */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? 'confirm-dialog-desc' : undefined}
        className={`relative w-full max-w-md bg-app-surface rounded-xl shadow-xl p-6
          transition-transform duration-150 ease-out
          ${visible ? 'scale-100' : 'scale-95'}`}
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-app-text"
        >
          {title}
        </h2>

        {description && (
          <p
            id="confirm-dialog-desc"
            className="mt-2 text-sm text-app-text-secondary dark:text-app-text-muted"
          >
            {description}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => confirmStore.close(false)}
            className="px-4 py-2 text-sm font-medium rounded-lg
              text-app-text-strong
              border border-app-border
              hover:bg-app-hover dark:hover:bg-gray-700
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
              transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => confirmStore.close(true)}
            className={`px-4 py-2 text-sm font-medium rounded-lg
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
              transition-colors ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
