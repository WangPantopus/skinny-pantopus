'use client';

import { useEffect } from 'react';

let preparing: Promise<void> | null = null;

/** Save only an anonymous shell and public build assets. Private messages and
 * attachments remain in the existing account-bound encrypted store. */
export function useChatOfflineShell() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !window.isSecureContext || !('serviceWorker' in navigator)) return;
    const prepare = () => {
      if (!navigator.onLine || preparing) return;
      preparing = navigator.serviceWorker.register('/chat-service-worker.js', { scope: '/', updateViaCache: 'none' })
        .then(async (registration) => {
          await registration.update().catch(() => {});
          registration.active?.postMessage({ type: 'prepare-chat-shell' });
        }).catch(() => {}).finally(() => { preparing = null; });
    };
    prepare();
    window.addEventListener('online', prepare);
    return () => window.removeEventListener('online', prepare);
  }, []);
}
