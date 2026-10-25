'use client';

// The app shell's own reads on a cold load of Messages (/app/chat).
//
// The inbox's saved rows come out of browser storage in about eight steps, and
// each step's callback waits for the main thread. The shell's background reads
// and warm-ups (the badge counts, the Place switcher's homes and businesses,
// your primary home, the phone tab bar's prefetches) used to run in between
// those steps, so they start once the inbox has painted its first rows or
// settled without them, or after 1.5 seconds. On any other first page, and
// after the first page, they start at once.

import { useSyncExternalStore } from 'react';

const HOLD_MS = 1500;

const listeners = new Set<() => void>();
let holding = typeof window !== 'undefined' && window.location.pathname === '/app/chat';
if (holding) setTimeout(releaseShellReads, HOLD_MS);

/** Called by the Messages inbox once its first rows, or its empty or error state, have painted. */
export function releaseShellReads(): void {
  if (!holding) return;
  holding = false;
  [...listeners].forEach((listener) => listener());
}

/** Runs `start` now, or once a cold Messages inbox has painted; returns the cancel for an effect's cleanup. */
export function afterInboxRows(start: () => void): () => void {
  if (!holding) {
    start();
    return () => {};
  }
  const run = () => {
    listeners.delete(run);
    start();
  };
  listeners.add(run);
  return () => { listeners.delete(run); };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** False while a cold Messages inbox holds the shell's reads (and in the server's render). */
export function useShellReadsReleased(): boolean {
  return useSyncExternalStore(subscribe, () => !holding, () => false);
}
