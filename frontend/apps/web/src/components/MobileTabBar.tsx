'use client';

// MobileTabBar — the app's tabs as a bottom bar on phone-width web:
// Place · Today · Nearby · Messages, and Mail before Messages while the
// Mailbox is on. Native gets these tabs on day one; on mobile web they used
// to hide behind the hamburger, which made the app read as a single long
// page. Desktop keeps the sidebar (AppShell). No Plans tab: Plans on the web
// comes later (founder, 2026-10-27).

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { NavIcons } from '@/lib/icons';
import { launchFeatures } from '@/lib/featureFlags';
import { afterInboxRows } from '@/lib/shellReads';

type Tab = {
  key: 'place' | 'today' | 'nearby' | 'mail' | 'messages';
  label: string;
  href: string;
  icon: typeof NavIcons.place;
  matches: (path: string) => boolean;
};

const starts = (path: string, ...prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export const MOBILE_TABS: Tab[] = [
  { key: 'place', label: 'Place', href: '/app/place', icon: NavIcons.place, matches: (p) => starts(p, '/app/place', '/app/hub', '/app/homes') && !starts(p, '/app/hub/today') },
  { key: 'today', label: 'Today', href: '/app/today', icon: NavIcons.today, matches: (p) => starts(p, '/app/today', '/app/hub/today') },
  // Nearby opens on its Pulse segment; Neighborhood is /app/nearby, and Connections is in the menu (founder decision 2026-10-20).
  { key: 'nearby', label: 'Nearby', href: '/app/feed', icon: NavIcons.nearby, matches: (p) => starts(p, '/app/nearby', '/app/neighborhood', '/app/feed', '/app/beacons', '/app/gigs', '/app/marketplace') },
  // Launch cut #10 (Mailbox): Mail is its own tab beside Messages (founder,
  // 2026-10-26). It opens the Me drawer.
  ...(launchFeatures.mailbox
    ? [{ key: 'mail' as const, label: 'Mail', href: '/app/mailbox/personal', icon: NavIcons.mail, matches: (p: string) => starts(p, '/app/mailbox') }]
    : []),
  { key: 'messages', label: 'Messages', href: '/app/chat', icon: NavIcons.messages, matches: (p) => starts(p, '/app/chat') },
];

// With the Mailbox on, both badges are the drawings' red count (Mail tab
// design, 2026-10-27); with it off, the bar stays exactly as it was.
const BADGE_CLASS = launchFeatures.mailbox
  ? 'absolute left-1/2 top-0.5 ml-1 min-w-[18px] rounded-full border-2 border-app-surface bg-red-700 px-1 text-center text-[10px] font-bold leading-[14px] text-white'
  : 'absolute right-[calc(50%-18px)] top-1 min-w-[16px] rounded-full bg-primary-600 px-1 text-center text-[10px] font-bold leading-4 text-white';

export function activeMobileTab(pathname: string): Tab['key'] | null {
  return MOBILE_TABS.find((t) => t.matches(pathname))?.key ?? null;
}

export default function MobileTabBar({ unreadMail = 0, unreadMessages = 0 }: { unreadMail?: number; unreadMessages?: number }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const active = activeMobileTab(pathname);

  // The sidebar prefetches each tab on hover; phones have no hover, so
  // warm every tab once instead of giving the slowest connections the
  // coldest navigation. A cold Messages inbox paints its rows first (lib/shellReads.ts).
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
          const Icon = tab.icon;
          const isActive = active === tab.key;
          // Mail counts unopened mail; Messages counts unread chats.
          const count = tab.key === 'mail' ? unreadMail : tab.key === 'messages' ? unreadMessages : 0;
          const countLabel = count > 0 ? `${tab.label}, ${count} ${tab.key === 'mail' ? 'unopened' : 'unread'}` : undefined;
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
