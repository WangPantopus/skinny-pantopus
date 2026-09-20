'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { purgeExpiredPlacePreviews } from '@/components/place/pendingPlace';
import { AUTH_SESSION_CHANGE_KEY, onTokenChange } from '@pantopus/api';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          const status = (error as { status?: number })?.status;
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
}

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { purgeExpiredPlacePreviews(); }, []);
  const [queryClient, setQueryClient] = useState(createQueryClient);
  const [sessionGeneration, setSessionGeneration] = useState(0);

  useEffect(() => {
    const retire = () => {
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
