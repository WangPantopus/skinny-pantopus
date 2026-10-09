import type { QueryClient } from '@tanstack/react-query';

// The query client of the session that is signed in now (lib/query-provider.tsx
// replaces it at sign-out and account switches). Code outside React, such as
// controllers and event handlers, reads the shared cache through it.
let current: QueryClient | null = null;

export function activeQueryClient(): QueryClient | null {
  return current;
}

export function setActiveQueryClient(client: QueryClient): void {
  current = client;
}
