'use client';

import { useEffect } from 'react';

let preparing: Promise<void> | null = null;
let preparedAt = 0;

export function navigateChatPath(path: string, navigate: (path: string) => void) {
  // Client route responses are deliberately not in the worker cache. A full
  // offline navigation uses the fixed shell for these existing chat routes.
  if (!navigator.onLine && navigator.serviceWorker?.controller && /^\/app\/chat(?:\/|\?|$)/.test(path)) window.location.assign(path);
  else navigate(path);
}

/** Save only an anonymous shell and public build assets. Private messages and
 * attachments remain in the existing account-bound encrypted store. */
export function useChatOfflineShell() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !window.isSecureContext || !('serviceWorker' in navigator)) return;
    const prepare = () => {
      if (!navigator.onLine || preparing || Date.now() - preparedAt < 30 * 60 * 1000) return;
      preparing = navigator.serviceWorker.register('/chat-service-worker.js', { scope: '/', updateViaCache: 'none' })
        .then(async (registration) => {
          await registration.update().catch(() => {});
          if (registration.active) {
            registration.active.postMessage({ type: 'prepare-chat-shell' });
            preparedAt = Date.now();
          }
        }).catch(() => {}).finally(() => { preparing = null; });
    };
    prepare();
    const online = () => { preparedAt = 0; prepare(); };
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, []);
}
