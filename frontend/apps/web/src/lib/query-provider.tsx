'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { purgeExpiredPlacePreviews } from '@/components/place/pendingPlace';
import { subscribeConnectivity } from '@/lib/connectivity';
import { clearCachedMapTiles } from '@/utils/tilePrefetch';
import { AUTH_SESSION_CHANGE_KEY, getAuthToken, onTokenChange } from '@pantopus/api';
import { setActiveQueryClient } from '@/lib/active-query-client';

// Queries pause while offline. React Query's own detection believes the
// browser's offline event, which can be wrong while requests still work.
onlineManager.setEventListener((setOnline) => subscribeConnectivity(setOnline));

// What this browser keeps for the signed-in account: the private Place inputs
// (your rent, mortgage balance and rate), refund recovery and the map tiles
// around where you live. None of it may outlive the account's session.
const ACCOUNT_STORAGE_PREFIXES = ['place:rent:', 'place:equity:', 'pantopus:refund:v1:'];
// A booking's manage token can belong to a signed-out invitee too, so only an
// ending session clears it.
const BOOKING_TOKEN_PREFIX = 'pantopus.calendarly.manageToken.';

function clearAccountDeviceData(sessionEnded: boolean) {
  const prefixes = sessionEnded ? [...ACCOUNT_STORAGE_PREFIXES, BOOKING_TOKEN_PREFIX] : ACCOUNT_STORAGE_PREFIXES;
  try {
    Object.keys(window.localStorage)
      .filter((key) => prefixes.some((prefix) => key.startsWith(prefix)))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch { /* storage disabled: nothing was kept */ }
  clearCachedMapTiles();
}

// Instant Screens (contract §6): the web keeps what it loaded in memory only,
// at most 200 entries, and drops an entry nobody has used for 30 minutes. A
// screen shows what it has at once; loading shows only when it has nothing.
const UNUSED_ENTRY_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 200;

function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: UNUSED_ENTRY_MS,
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors. The API client rejects with `statusCode`.
          const failure = error as { statusCode?: number; status?: number } | null;
          const status = failure?.statusCode ?? failure?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  // Past 200 entries, the least recently updated ones no screen is showing go
  // first (never the entry being added, nor one still loading).
  const cache = client.getQueryCache();
  cache.subscribe((event) => {
    if (event.type !== 'added' || cache.getAll().length <= MAX_ENTRIES) return;
    const unused = cache.getAll()
      .filter((query) => query !== event.query && query.getObserversCount() === 0 && query.state.fetchStatus === 'idle')
      .sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt);
    unused.slice(0, cache.getAll().length - MAX_ENTRIES).forEach((query) => cache.remove(query));
  });
  return client;
}

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { purgeExpiredPlacePreviews(); }, []);
  useEffect(() => {
    // A visit without a session keeps nothing from an account whose session
    // lapsed while the browser was closed; every sign-out clears the rest.
    if (getAuthToken() === null) clearAccountDeviceData(false);
    return onTokenChange((token) => { if (token === null) clearAccountDeviceData(true); });
  }, []);
  const [queryClient, setQueryClient] = useState(createQueryClient);
  const [sessionGeneration, setSessionGeneration] = useState(0);
  // Set while rendering, so children's first effects already read this session's cache.
  setActiveQueryClient(queryClient);

  useEffect(() => {
    const retire = () => {
      try { window.sessionStorage.removeItem('pantopus_pending_withdrawal'); } catch {}
      // Retire both cached queries and component-local state belonging to the
      // previous account. A fresh client cannot accept an old pending result.
      queryClient.clear();
      setQueryClient(createQueryClient());
      setSessionGeneration(generation => generation + 1);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === AUTH_SESSION_CHANGE_KEY || event.key === null) retire();
    };
    const unsubscribe = onTokenChange(retire);
    window.addEventListener('storage', storage);
    return () => { unsubscribe(); window.removeEventListener('storage', storage); };
  }, [queryClient]);

  return (
    <QueryClientProvider key={sessionGeneration} client={queryClient}>{children}</QueryClientProvider>
  );
}
