'use client';

import {
  createContext,
  useContext,
  useCallback,
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

// The server keeps no dismissal for the Mail Day summary, so this browser
// remembers the day it was dismissed; the banner returns the next day.
const MAIL_DAY_DISMISSED_KEY = 'pantopus_mailday_summary_dismissed';

function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readMailDayDismissed(): boolean {
  try { return window.localStorage.getItem(MAIL_DAY_DISMISSED_KEY) === localDay(); } catch { return false; }
}

// ── Provider ─────────────────────────────────────────────────

export function MailboxProvider({ children }: { children: ReactNode }) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>('personal');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mailDayBannerDismissed, setDismissed] = useState(readMailDayDismissed);
  const setMailDayBannerDismissed = useCallback((dismissed: boolean) => {
    setDismissed(dismissed);
    try {
      if (dismissed) window.localStorage.setItem(MAIL_DAY_DISMISSED_KEY, localDay());
      else window.localStorage.removeItem(MAIL_DAY_DISMISSED_KEY);
    } catch { /* Dismissal still works in memory when browser storage is unavailable. */ }
  }, []);

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
    [activeDrawer, selectedItemId, activeTheme, travelModeActive, mailDayBannerDismissed, setMailDayBannerDismissed],
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
