'use client';

// Change signals for screens that keep their own state instead of a query
// (the Home dashboard and its access re-check). hooks/useSyncChanged.ts relays
// the server's `sync:changed` topics here (contract §8), plus two of its own:
// RECONNECTED after the socket reconnects (signals may have been missed) and
// EVERYTHING when the browser tab comes back after 15 minutes.

export const RECONNECTED = 'client:reconnected';
export const EVERYTHING = 'client:everything';

type Listener = (topic: string) => void;
const listeners = new Set<Listener>();

/** Calls `listener` with each topic as it arrives; returns the unsubscribe. */
export function onSyncTopic(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitSyncTopics(topics: readonly string[]): void {
  for (const topic of topics) listeners.forEach((listener) => listener(topic));
}

/** Whether a topic means a Home's records or the viewer's access to it may have changed
 * (the server sends `home:{id}` for its tasks, members, roles, claims and records). */
export function touchesHome(topic: string, homeId: string): boolean {
  return topic === `home:${homeId}` || topic === RECONNECTED || topic === EVERYTHING;
}
