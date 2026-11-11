import { useSyncExternalStore } from 'react';

/**
 * The busy state of an auth form that outlives the form.
 *
 * A sign-in or sign-up that worked is followed by the next page loading. Until that page shows,
 * the form is still on screen, and the auth pages can render their content a second time as a
 * Suspense fallback (components/auth/WithSearchParams): a copy with fresh state. Either way the
 * button came back enabled, which reads as a sign-in that failed and invites a second try. The
 * moment of leaving is kept here, outside the component, so every copy of the form stays busy
 * until the next page takes over. It ends once no auth form is on screen any more (so coming back
 * to sign-in from the next page finds a form that works), and gives up after LEAVING_MAX_MS, so a
 * page that never arrives leaves a form that can be used again.
 */
const LEAVING_MAX_MS = 20_000;
let leftAt = 0;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    // The form is gone. When a fresh copy takes its place it subscribes in the same commit, so
    // look once that commit is over: nobody listening means the page was left.
    if (listeners.size === 0 && leftAt !== 0) {
      setTimeout(() => {
        if (listeners.size === 0) leftAt = 0;
      }, 0);
    }
  };
}

function leaving(): boolean {
  return leftAt !== 0 && Date.now() - leftAt < LEAVING_MAX_MS;
}

/** Call once an auth request has succeeded, before navigating away. */
export function markLeavingAuthPage(): void {
  leftAt = Date.now();
  notify();
  setTimeout(notify, LEAVING_MAX_MS + 50);
}

/** True from markLeavingAuthPage() until this page is gone, or LEAVING_MAX_MS has passed. */
export function useLeavingAuthPage(): boolean {
  return useSyncExternalStore(subscribe, leaving, () => false);
}
