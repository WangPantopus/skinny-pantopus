// ─────────────────────────────────────────────────────────────
// Signal Buffer — batches implicit view signals and sends them
// to the backend periodically or on page unload.
// ─────────────────────────────────────────────────────────────

import * as api from '@pantopus/api';

export interface ViewSignal {
  gig_id: string;
  category: string;
  dwell_ms: number;
  timestamp: string;
}

const FLUSH_INTERVAL_MS = 60_000; // 60 seconds
const MAX_BUFFER_SIZE = 10;

const buffer: ViewSignal[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function send(signals: ViewSignal[]) {
  if (signals.length === 0) return;
  try {
    api.users.sendSignals(signals);
  } catch {
    // Fire and forget — don't block UI for signal failures
  }
}

function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0);
  send(batch);
}

function startTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
}

function ensureUnloadHandler() {
  if (typeof window === 'undefined') return;
  // Use a module-scoped flag to avoid adding multiple listeners
  if ((window as any).__signalUnloadBound) return;
  (window as any).__signalUnloadBound = true;

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export function pushSignal(signal: ViewSignal) {
  buffer.push(signal);
  startTimer();
  ensureUnloadHandler();

  if (buffer.length >= MAX_BUFFER_SIZE) {
    flush();
  }
}

/** Force-flush any remaining signals (e.g. on logout). */
export function flushSignals() {
  flush();
}
