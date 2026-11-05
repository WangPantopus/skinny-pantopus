'use client';

import type { ReactNode } from 'react';
import { useHydrated } from '@/hooks/useHydrated';

/** Children that follow this browser's clock, time zone or locale: rendered once hydrated (hooks/useHydrated.ts). */
export default function AfterHydration({ children }: { children: ReactNode }) {
  return useHydrated() ? children : null;
}
