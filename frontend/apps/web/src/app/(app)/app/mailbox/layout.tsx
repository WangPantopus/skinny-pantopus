'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getAuthToken } from '@pantopus/api';
import MailboxHeader, { mailboxHref, mailboxView } from '@/components/mailbox/MailboxHeader';
import MailboxErrorBoundary from '@/components/mailbox/MailboxErrorBoundary';
import { MailboxToastProvider } from '@/components/mailbox/MailboxToast';
import { MailboxProvider, useMailboxContext } from '@/contexts/MailboxContext';
import {
  useMailDaySummary,
  useVacationHold,
} from '@/lib/mailbox-queries';
import { launchFeatures } from '@/lib/featureFlags';
import { MailboxIcons } from '@/lib/icons';
import ComposeLetter from './_components/ComposeLetter';

/**
 * Route-level layout for all /mailbox/* pages.
 *
 * Provides:
 * - Auth redirect (client-side)
 * - MailboxContext + MailboxToastProvider
 * - The Mailbox's navigation in the page (MailboxHeader): the title and "…"
 *   menu, drawer chips and tabs on the main screens, a back bar on the others
 * - Mail Day summary banner (dismissible for the rest of the day in this browser)
 * - Travel dates banner
 * - Error boundaries around each major section
 * - Children fill the remaining space (nested layouts handle list/detail split)
 *
 * Phones scroll the page like every other tab (and keep the tab's place);
 * from md up the Mailbox fills the window and its list and letter scroll
 * side by side.
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
        <Suspense>
          <MailboxLayoutInner>{children}</MailboxLayoutInner>
        </Suspense>
      </MailboxToastProvider>
    </MailboxProvider>
  );
}

// ── Inner layout (has access to context + toast) ─────────────

function MailboxLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const view = mailboxView(pathname, searchParams.get('drawer'));

  // The main screen last shown: where the other pages' back bar returns.
  const [backHref, setBackHref] = useState('/app/mailbox/personal');
  const mainHref = view.kind === 'main' && !view.pushed ? mailboxHref(view.tab, view.drawer) : null;
  useEffect(() => {
    if (mainHref) setBackHref(mainHref);
  }, [mainHref]);

  // Launch cut #8 (Mail extras): writing a letter is hidden.
  const [composeOpen, setComposeOpen] = useState(false);

  // ── Mail Day summary banner ────────────────────────────
  const { data: mailDay } = useMailDaySummary();
  const { mailDayBannerDismissed: mailDayDismissed, setMailDayBannerDismissed } = useMailboxContext();

  const showMailDayBanner =
    !mailDayDismissed &&
    mailDay &&
    mailDay.total_new > 0;

  const handleDismissMailDay = useCallback(() => {
    setMailDayBannerDismissed(true);
  }, [setMailDayBannerDismissed]);

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

  // ── Travel dates banner ───────────────────────────────
  const { data: vacationHold } = useVacationHold();
  const isTravelActive =
    vacationHold &&
    (vacationHold.status === 'active' || vacationHold.status === 'scheduled');

  // The banners belong to the main screens; a letter or folder opened from one
  // is its own screen on phones.
  const bannerClass = view.kind === 'main' ? (view.pushed ? 'hidden md:flex' : 'flex') : 'hidden';

  return (
    <div className="bg-app md:flex md:h-[calc(100vh-3.5rem)] md:flex-col md:overflow-hidden">
      <MailboxHeader
        view={view}
        backHref={backHref}
        onWriteLetter={launchFeatures.mailExtras ? () => setComposeOpen(true) : undefined}
      />

      {/* Travel dates banner */}
      {isTravelActive && (
        <button
          type="button"
          onClick={() => router.push('/app/mailbox/travel')}
          className={`${bannerClass} items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-left flex-shrink-0`}
          aria-label={`Travel dates ${vacationHold?.status === 'scheduled' ? 'scheduled' : 'current'}. Open Travel Mode.`}
        >
          <MailboxIcons.travel className="w-4 h-4 flex-shrink-0 text-amber-700" aria-hidden="true" />
          <span className="text-xs font-medium text-amber-700 truncate">
            Travel dates {vacationHold?.status === 'scheduled' ? 'scheduled' : 'current'} · Returns{' '}
            {new Date(`${vacationHold!.end_date.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </button>
      )}

      {/* Mail Day banner */}
      {showMailDayBanner && (
        <div
          className={`${bannerClass} items-center gap-3 px-4 py-2.5 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800 flex-shrink-0`}
          role="status"
        >
          <span className="text-base" aria-hidden="true">&#9993;</span>
          <p className="flex-1 text-sm text-primary-800 dark:text-primary-200 min-w-0">
            <span className="font-medium">{mailDay!.greeting}</span>
            <span className="text-primary-600 dark:text-primary-400">
              {' · '}
              {mailDay!.total_new} new item{mailDay!.total_new !== 1 ? 's' : ''}
              {/* The most urgent unread letter, which may be older than today's mail. */}
              {mailDay!.needs_attention.length > 0 && (
                <> · Needs attention: {mailDay!.needs_attention[0].display_title || mailDay!.needs_attention[0].subject}</>
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
      <div className="md:flex-1 md:min-h-0 md:overflow-hidden">
        <MailboxErrorBoundary section="mailbox">
          {children}
        </MailboxErrorBoundary>
      </div>

      {composeOpen && <ComposeLetter onClose={() => setComposeOpen(false)} />}
    </div>
  );
}
