"use client";

// Small destructive-confirm dialog used by reset-slug / regenerate-link flows
// (C1 + C3). Mirrors the design's centered confirm card with a red icon halo and
// a danger primary button. W4-local; the shared kit (W0) has no confirm dialog.

import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";

export default function ConfirmDialog({
  open,
  icon: Icon,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  icon: LucideIcon;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm rounded-2xl border border-app-border-subtle bg-app-surface p-5 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-app-error-bg">
          <Icon className="h-5 w-5 text-app-error" aria-hidden />
        </div>
        <h2 className="text-base font-bold text-app-text-strong">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-app-text-secondary">
          {body}
        </p>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-app-border bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text-strong hover:bg-app-hover disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-app-error px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
