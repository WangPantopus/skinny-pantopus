'use client';

import { useSyncExternalStore } from 'react';
import { toastStore } from './toast-store';
import Toast from './Toast';

export default function ToastContainer() {
  const toasts = useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getSnapshot,
    toastStore.getSnapshot, // SSR snapshot
  );

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end
        max-sm:right-0 max-sm:left-0 max-sm:items-center max-sm:px-4"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={toastStore.dismiss} />
      ))}
    </div>
  );
}
