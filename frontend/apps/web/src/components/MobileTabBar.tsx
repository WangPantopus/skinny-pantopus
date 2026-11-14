'use client';

// MobileTabBar — the app's tabs as a bottom bar on phone-width web:
// Place · Today · Mail · Pulse while the Mailbox is on, Place · Today · Pulse
// without it. Founder decision 2026-11-13: Mail is third (your home, your day,
// your mailbox, then what's happening around you), as on iPhone and Android;
// from November 1 to December 25, while Christmas cards are open, its icon is
// a red envelope (cardDoors useChristmasMail). Messages left the
// bar (founder decision 2026-11-08, as on iPhone and Android): the chat button
// at the top right of the top bar opens it, with the unread count. Native gets
// these tabs on day one; on mobile web they used to hide behind the hamburger,
// which made the app read as a single long page. Desktop keeps the sidebar
// (AppShell), in its own order. No Plans tab: Plans on the web comes later (founder, 2026-10-27).

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { NavIcons } from '@/lib/icons';
import { launchFeatures } from '@/lib/featureFlags';
import { afterInboxRows } from '@/lib/shellReads';
import { useChristmasMail } from '@/components/mailbox/cards/cardDoors';

type Tab = {
  key: 'place' | 'today' | 'nearby' | 'mail';
  label: string;
  href: string;
  icon: typeof NavIcons.place;
  matches: (path: string) => boolean;
};

const starts = (path: string, ...prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export const MOBILE_TABS: Tab[] = [
  // "Verified homes nearby" (/app/nearby) opens from Place (founder decision 2026-11-07).
  { key: 'place', label: 'Place', href: '/app/place', icon: NavIcons.place, matches: (p) => starts(p, '/app/place', '/app/homes', '/app/nearby', '/app/neighborhood') },
  { key: 'today', label: 'Today', href: '/app/today', icon: NavIcons.today, matches: (p) => starts(p, '/app/today', '/app/hub/today') },
  // Launch cut #10 (Mailbox): Mail is its own tab (founder, 2026-10-26), third
  // since the founder's November 13 decision. It opens the Me drawer.
  ...(launchFeatures.mailbox
    ? [{ key: 'mail' as const, label: 'Mail', href: '/app/mailbox/personal', icon: NavIcons.mail, matches: (p: string) => starts(p, '/app/mailbox') }]
    : []),
  // The Pulse tab, named Nearby until the founder's November 7 decision (its key stays): the feed under its List | Map
  // switch. Connections is in the menu.
  { key: 'nearby', label: 'Pulse', href: '/app/feed', icon: NavIcons.pulse, matches: (p) => starts(p, '/app/feed', '/app/beacons', '/app/gigs', '/app/marketplace') },
];

// With the Mailbox on, Mail's badge is the drawings' red count (Mail tab
// design, 2026-10-27).
const BADGE_CLASS = launchFeatures.mailbox
  ? 'absolute left-1/2 top-0.5 ml-1 min-w-[18px] rounded-full border-2 border-app-surface bg-red-700 px-1 text-center text-[10px] font-bold leading-[14px] text-white'
  : 'absolute right-[calc(50%-18px)] top-1 min-w-[16px] rounded-full bg-primary-600 px-1 text-center text-[10px] font-bold leading-4 text-white';

export function activeMobileTab(pathname: string): Tab['key'] | null {
  return MOBILE_TABS.find((t) => t.matches(pathname))?.key ?? null;
}

// A conversation has the whole window on a phone (founder, 2026-11-06), a
// person's, a group's or the assistant's: leaving it brings the bar back on the
// screen underneath. The Messages list keeps the bar, with no tab lit.
export function isConversation(pathname: string): boolean {
  return pathname.startsWith('/app/chat/');
}

// Sending a Christmas card is a full-screen flow on a phone too (launch key
// card_table): its steps and the "on its way" page have no bar (design plan 1.3,
// founder 2026-11-09). Back leaves it.
export function hidesMobileTabs(pathname: string): boolean {
  return isConversation(pathname) || (launchFeatures.cardTable && pathname === '/app/mailbox/cards');
}

export default function MobileTabBar({ unreadMail = 0 }: { unreadMail?: number }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const active = activeMobileTab(pathname);
  const christmasMail = useChristmasMail();

  // The sidebar prefetches each tab on hover; phones have no hover, so
  // warm every tab once instead of giving the slowest connections the
  // coldest navigation. A cold Messages inbox paints its rows first (lib/shellReads.ts), and AppShell
  // prefetches Messages for the top bar's chat button.
  useEffect(() => afterInboxRows(() => {
    MOBILE_TABS.forEach((tab) => router.prefetch(tab.href));
  }), [router]);

  return (
    <nav
      aria-label="Primary"
      data-testid="mobile-tab-bar"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-app bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${MOBILE_TABS.length}, minmax(0, 1fr))` }}>
        {MOBILE_TABS.map((tab) => {
          // The red envelope keeps its own colours, selected or not; the label keeps the tab's.
          const Icon = tab.key === 'mail' && christmasMail ? NavIcons.christmasMail : tab.icon;
          const isActive = active === tab.key;
          // Mail counts unopened mail; unread chats show on the top bar's chat button.
          const count = tab.key === 'mail' ? unreadMail : 0;
          const countLabel = count > 0 ? `${tab.label}, ${count} unopened` : undefined;
          return (
            <li key={tab.key} className="min-w-0">
              <button
                type="button"
                onClick={() => router.push(tab.href)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={countLabel}
                data-testid={`mobile-tab-${tab.key}`}
                className={`relative flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium leading-none transition-colors ${
                  isActive ? 'text-primary-700 dark:text-primary-400' : 'text-app-text-secondary'
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                <span className="max-w-full truncate px-0.5">{tab.label}</span>
                {count > 0 ? (
                  <span aria-hidden className={BADGE_CLASS}>
                    {count > 99 ? '99+' : count}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
