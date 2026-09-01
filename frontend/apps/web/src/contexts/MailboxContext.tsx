'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { SeasonalTheme } from '@/types/mailbox';
import { useThemes, useVacationHold } from '@/lib/mailbox-queries';

// ── Types ────────────────────────────────────────────────────

type DrawerType = 'personal' | 'home' | 'business' | 'earn';

type MailboxContextValue = {
  activeDrawer: DrawerType;
  setActiveDrawer: (drawer: DrawerType) => void;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  activeTheme: SeasonalTheme | null;
  travelModeActive: boolean;
  mailDayBannerDismissed: boolean;
  setMailDayBannerDismissed: (v: boolean) => void;
};

const MailboxContext = createContext<MailboxContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────

export function MailboxProvider({ children }: { children: ReactNode }) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>('personal');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mailDayBannerDismissed, setMailDayBannerDismissed] = useState(false);

  // Theme from API
  const { data: themeData } = useThemes();
  const activeTheme = useMemo(() => {
    if (!themeData) return null;
    return themeData.themes.find((t) => t.id === themeData.active) ?? null;
  }, [themeData]);

  // Apply theme CSS variables when active theme changes
  useEffect(() => {
    if (!activeTheme || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--mailbox-accent', activeTheme.accent_color);
    root.setAttribute('data-mailbox-theme', activeTheme.id);
  }, [activeTheme]);

  // Travel mode — refresh every 5 minutes
  const { data: vacationHold } = useVacationHold({ refetchInterval: 5 * 60 * 1000 });
  const travelModeActive = useMemo(
    () =>
      !!vacationHold &&
      (vacationHold.status === 'active' || vacationHold.status === 'scheduled'),
    [vacationHold],
  );

  const value = useMemo<MailboxContextValue>(
    () => ({
      activeDrawer,
      setActiveDrawer,
      selectedItemId,
      setSelectedItemId,
      activeTheme,
      travelModeActive,
      mailDayBannerDismissed,
      setMailDayBannerDismissed,
    }),
    [activeDrawer, selectedItemId, activeTheme, travelModeActive, mailDayBannerDismissed],
  );

  return (
    <MailboxContext.Provider value={value}>{children}</MailboxContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────

export function useMailboxContext() {
  const ctx = useContext(MailboxContext);
  if (!ctx) {
    throw new Error('useMailboxContext must be used within a MailboxProvider');
  }
  return ctx;
}
