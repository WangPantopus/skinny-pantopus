// ============================================================
// TOAST STORE — lightweight pub/sub singleton
// Works outside React so toast can be called from anywhere.
// ============================================================

import type React from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: React.ReactNode;
  duration: number; // ms
}

type Listener = (toasts: ToastItem[]) => void;

/** Default auto-dismiss durations per variant (ms). */
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 3000,
  error: 5000,
  info: 4000,
  warning: 4000,
};

const MAX_VISIBLE = 3;

let nextId = 0;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => fn([...toasts]));
}

function add(variant: ToastVariant, message: React.ReactNode, duration?: number): number {
  const id = ++nextId;
  const item: ToastItem = {
    id,
    variant,
    message,
    duration: duration ?? DEFAULT_DURATION[variant],
  };
  // Keep only the newest MAX_VISIBLE toasts
  toasts = [...toasts.slice(-(MAX_VISIBLE - 1)), item];
  emit();
  return id;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ToastItem[] {
  return toasts;
}

export const toastStore = { add, dismiss, subscribe, getSnapshot };

/** Convenience API — can be imported and called from anywhere. */
export const toast = {
  success: (message: React.ReactNode, duration?: number) => add('success', message, duration),
  error: (message: React.ReactNode, duration?: number) => add('error', message, duration),
  info: (message: React.ReactNode, duration?: number) => add('info', message, duration),
  warning: (message: React.ReactNode, duration?: number) => add('warning', message, duration),
};
