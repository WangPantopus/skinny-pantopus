import { useSyncExternalStore } from 'react';

const subscribeNever = () => () => {};

/**
 * False in the server's HTML and while the browser hydrates it; true right after,
 * and from the first render of anything that starts in the browser (a navigation).
 * Text that depends on the clock, the time zone, the locale or the window (a
 * "5m ago", a local time, the viewport's height) renders once it is true, so the
 * browser's first render matches a server elsewhere.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}
