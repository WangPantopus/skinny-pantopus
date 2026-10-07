// Verified connectivity for the offline banner and React Query.
//
// Browsers derive `navigator.onLine` and the `offline` event from the operating
// system's network state, which some VPN and network setups get wrong: the
// browser reports offline while every request still works. Taken at its word,
// that shows "You're offline" over a page that loads, and pauses React Query.
// So an offline report only counts once a request to this site fails; while
// offline, the site is retried until it answers or the browser reports online.

type Listener = (online: boolean) => void;

const RETRY_MS = 15_000;
const PROBE_TIMEOUT_MS = 5_000;

let online = true;
let probing: Promise<void> | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<Listener>();

async function siteAnswers(): Promise<boolean> {
  try {
    // Any HTTP answer proves the network; only a failed request means offline.
    await fetch(`/favicon.ico?online=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(PROBE_TIMEOUT_MS) : undefined,
    });
    return true;
  } catch {
    return false;
  }
}

function publish(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach((listener) => listener(next));
}

function check(): Promise<void> {
  clearTimeout(retry);
  probing ??= siteAnswers().then((answered) => {
    probing = null;
    publish(answered);
    if (!answered && listeners.size > 0) retry = setTimeout(check, RETRY_MS);
  });
  return probing;
}

const onOnline = () => {
  clearTimeout(retry);
  publish(true);
};
const onOffline = () => void check();
const onVisible = () => {
  if (!online && document.visibilityState === 'visible') void check();
};

/** The current verified state; true until an offline report is confirmed. */
export function isOnline(): boolean {
  return online;
}

/** Calls `listener` whenever the verified state changes. Returns the unsubscribe. */
export function subscribeConnectivity(listener: Listener): () => void {
  if (typeof window === 'undefined') return () => {};
  if (listeners.size === 0) {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    if (!navigator.onLine) void check();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    clearTimeout(retry);
  };
}
