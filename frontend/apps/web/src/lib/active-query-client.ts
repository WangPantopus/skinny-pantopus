import type { QueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';

// The query client of the session that is signed in now (lib/query-provider.tsx
// replaces it at sign-out and account switches). Code outside React, such as
// controllers and event handlers, reads the shared cache through it.
//
// Each client remembers the session it was made for. Between a session change
// and the provider swapping clients (token-change listeners run in no fixed
// order), there is no active client, so callers ask the server instead of
// reading the previous account's entries.
const sessions = new WeakMap<QueryClient, string | null>();
let current: QueryClient | null = null;

function sessionMarker(): string | null {
  return typeof api.authSessionMarker === 'function' ? api.authSessionMarker() : null;
}

export function activeQueryClient(): QueryClient | null {
  if (!current || sessions.get(current) !== sessionMarker()) return null;
  return current;
}

export function setActiveQueryClient(client: QueryClient): void {
  if (!sessions.has(client)) sessions.set(client, sessionMarker());
  current = client;
}
