'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@pantopus/api';
import MailboxNav from '@/components/mailbox/MailboxNav';
import MailboxErrorBoundary from '@/components/mailbox/MailboxErrorBoundary';
import { MailboxToastProvider } from '@/components/mailbox/MailboxToast';
import { MailboxProvider } from '@/contexts/MailboxContext';
import {
  useDrawerMeta,
  useMailDaySummary,
  useDismissMailDaySummary,
  useVacationHold,
} from '@/lib/mailbox-queries';

/**
 * Route-level layout for all /mailbox/* pages.
 *
 * Provides:
 * - Auth redirect (client-side)
 * - MailboxContext + MailboxToastProvider
 * - Loading skeleton while DrawerMeta loads
 * - Error state with retry
 * - Mail Day summary banner (dismissible, API-backed)
 * - Travel mode banner in left nav
 * - MailboxNav in the left column
 * - Error boundaries around each major section
 * - Children fill the remaining space (nested layouts handle list/detail split)
 */
export default function MailboxRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  // ── Auth check ──────────────────────────────────────────
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setAuthChecked(true);
  }, [router]);

  // Not authenticated yet — render nothing before providers
  if (!authChecked) return null;

  return (
    <MailboxProvider>
      <MailboxToastProvider>
        <MailboxLayoutInner>{children}</MailboxLayoutInner>
      </MailboxToastProvider>
    </MailboxProvider>
  );
}

// ── Inner layout (has access to context + toast) ─────────────

function MailboxLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // ── Drawer meta (non-blocking — nav degrades gracefully) ──
  const {
    isLoading: drawersLoading,
    error: drawersError,
    refetch: retryDrawers,
  } = useDrawerMeta();

  // ── Mail Day summary banner ────────────────────────────
  const { data: mailDay } = useMailDaySummary();
  const dismissMailDay = useDismissMailDaySummary();
  const [mailDayDismissed, setMailDayDismissed] = useState(false);

  const showMailDayBanner =
    !mailDayDismissed &&
    mailDay &&
    mailDay.total_new > 0;

  const handleDismissMailDay = useCallback(() => {
    setMailDayDismissed(true);
    dismissMailDay.mutate();
  }, [dismissMailDay]);

  // Navigate to the drawer with the most urgent item
  const handleOpenMailDay = useCallback(() => {
    if (mailDay?.needs_attention.length) {
      const item = mailDay.needs_attention[0];
      router.push(`/app/mailbox/${item.drawer}/${item.id}`);
    } else if (mailDay?.arrivals.length) {
      const item = mailDay.arrivals[0];
      router.push(`/app/mailbox/${item.drawer}`);
    } else {
      router.push('/app/mailbox/personal');
    }
  }, [mailDay, router]);

  // ── Travel mode banner ────────────────────────────────
  const { data: vacationHold } = useVacationHold();
  const isTravelActive =
    vacationHold &&
    (vacationHold.status === 'active' || vacationHold.status === 'scheduled');

  // Drawer nav: show skeleton while loading, hide on error, show when ready.
  // Never block page content — children always render.
  const showNav = !drawersError && !drawersLoading;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-app">
      {/* ── Left Nav ─────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 w-[52px] lg:w-[220px] border-r border-app bg-surface-muted overflow-y-auto"
        role="navigation"
        aria-label="Mailbox navigation"
      >
        {/* Skeleton while drawer meta is loading */}
        {drawersLoading && (
          <div className="p-3 space-y-3">
            <div className="h-8 bg-gray-300 rounded animate-pulse" />
            <div className="h-px bg-app my-2" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded bg-gray-300 animate-pulse" />
                <div className="h-3 flex-1 bg-gray-300 rounded animate-pulse hidden lg:block" />
              </div>
            ))}
          </div>
        )}

        {/* Error state with retry — inline in nav, not blocking */}
        {drawersError && !drawersLoading && (
          <div className="p-3 text-center">
            <p className="text-xs text-app-muted mb-2">Nav unavailable</p>
            <button
              type="button"
              onClick={() => retryDrawers()}
              className="text-xs text-primary-600 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Actual nav when loaded */}
        {showNav && <MailboxNav />}

        {/* Travel mode banner in nav */}
        {isTravelActive && (
          <div className="px-2 py-2 mx-2 mb-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex-shrink-0">
            <button
              type="button"
              onClick={() => router.push('/app/mailbox/travel')}
              className="flex items-center gap-2 w-full text-left"
              aria-label="Travel Mode active. Click to manage."
            >
              <span className="text-sm flex-shrink-0">✈️</span>
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300 truncate hidden lg:inline">
                Travel Mode active · Returns{' '}
                {new Date(vacationHold!.end_date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </button>
          </div>
        )}
      </aside>

      {/* ── Content area ─────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden" role="main">
        {/* Mail Day banner */}
        {showMailDayBanner && (
          <div
            className="flex items-center gap-3 px-4 py-2.5 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800 flex-shrink-0"
            role="alert"
          >
            <span className="text-base" aria-hidden="true">&#9993;</span>
            <p className="flex-1 text-sm text-primary-800 dark:text-primary-200 min-w-0">
              <span className="font-medium">{mailDay!.greeting}</span>
              <span className="text-primary-600 dark:text-primary-400">
                {' · '}
                {mailDay!.total_new} new item{mailDay!.total_new !== 1 ? 's' : ''}
                {mailDay!.needs_attention.length > 0 && (
                  <> · {mailDay!.needs_attention[0].display_title || mailDay!.needs_attention[0].subject}</>
                )}
              </span>
            </p>
            <button
              type="button"
              onClick={handleOpenMailDay}
              className="flex-shrink-0 text-xs font-semibold text-primary-700 dark:text-primary-300 hover:underline"
            >
              Open
            </button>
            <button
              type="button"
              onClick={handleDismissMailDay}
              className="flex-shrink-0 p-1 text-primary-400 hover:text-primary-600 dark:hover:text-primary-200 transition-colors"
              aria-label="Dismiss mail day notification"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Nested layouts / pages fill remaining space */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <MailboxErrorBoundary section="mailbox">
            {children}
          </MailboxErrorBoundary>
        </div>
      </main>
    </div>
  );
}
