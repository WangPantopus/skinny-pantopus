'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getAuthToken } from '@pantopus/api';
import MailboxHeader, { mailboxHref, mailboxView } from '@/components/mailbox/MailboxHeader';
import MailboxHero, { deliveryState } from '@/components/mailbox/MailboxHero';
import MailboxErrorBoundary from '@/components/mailbox/MailboxErrorBoundary';
import { MailboxToastProvider } from '@/components/mailbox/MailboxToast';
import { MailboxProvider, useMailboxContext } from '@/contexts/MailboxContext';
import { useMailboxDrawers, useVacationHold } from '@/lib/mailbox-queries';
import { useMe } from '@/lib/me';
import { launchFeatures } from '@/lib/featureFlags';
import { MailboxIcons } from '@/lib/icons';
import ComposeLetter from './_components/ComposeLetter';

// The delivery moment plays the first time you open Mail after a round,
// remembered per account in this browser (contract `delivery.last_at`).
const ROUND_SEEN_KEY = 'pantopus_mail_round_seen:';
const MOMENT_MS = 1800;

/**
 * Route-level layout for all /mailbox/* pages.
 *
 * Provides:
 * - Auth redirect (client-side)
 * - MailboxContext + MailboxToastProvider
 * - The Mailbox's navigation in the page (MailboxHeader): the title, search
 *   and "…" menu, drawer chips and tabs on the main screens, a back bar on
 *   the others
 * - Your mailbox and today's delivery (MailboxHero) on Incoming, with the
 *   delivery moment once per round
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

  // ── Your mailbox and today's delivery ──────────────────
  const { data: drawers } = useMailboxDrawers();
  const { data: me } = useMe();
  const { deliveryOpening, setDeliveryOpening } = useMailboxContext();
  const delivery = drawers?.delivery;
  const today = deliveryState(delivery);
  const roundAt = today?.kind === 'came' ? today.at : null;
  const onIncoming = view.kind === 'main' && view.tab === 'incoming' && !view.pushed;
  // The first time Incoming shows after a round, the door opens and today's
  // pieces slide out (under 2 seconds); Reduce Motion skips it.
  useEffect(() => {
    if (!onIncoming || !roundAt || !me?.id) return;
    const key = `${ROUND_SEEN_KEY}${me.id}`;
    let seen: string | null = null;
    try { seen = window.localStorage.getItem(key); } catch { /* storage off: it plays each visit */ }
    if (seen && new Date(seen).getTime() >= new Date(roundAt).getTime()) return;
    try { window.localStorage.setItem(key, roundAt); } catch { /* storage off */ }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setDeliveryOpening(true);
    const done = window.setTimeout(() => setDeliveryOpening(false), MOMENT_MS);
    return () => { window.clearTimeout(done); setDeliveryOpening(false); };
  }, [onIncoming, roundAt, me?.id, setDeliveryOpening]);

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
        hero={drawers ? <MailboxHero delivery={delivery} homes={drawers.homes} opening={deliveryOpening} /> : null}
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
