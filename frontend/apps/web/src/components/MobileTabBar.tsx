'use client';

// MobileTabBar — the four-tab IA (Place · Today · Nearby · Mail) as a
// bottom bar on phone-width web. Native gets these tabs on day one; on
// mobile web they used to hide behind the hamburger, which made the app
// read as a single long page. Desktop keeps the sidebar (AppShell).

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { NavIcons } from '@/lib/icons';

type Tab = {
  key: 'place' | 'today' | 'nearby' | 'mail';
  label: string;
  href: string;
  icon: typeof NavIcons.place;
  matches: (path: string) => boolean;
};

const starts = (path: string, ...prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export const MOBILE_TABS: Tab[] = [
  { key: 'place', label: 'Place', href: '/app/place', icon: NavIcons.place, matches: (p) => starts(p, '/app/place', '/app/hub', '/app/homes') && !starts(p, '/app/hub/today') },
  { key: 'today', label: 'Today', href: '/app/today', icon: NavIcons.today, matches: (p) => starts(p, '/app/today', '/app/hub/today') },
  { key: 'nearby', label: 'Nearby', href: '/app/nearby', icon: NavIcons.nearby, matches: (p) => starts(p, '/app/nearby', '/app/neighborhood', '/app/feed', '/app/gigs', '/app/marketplace') },
  { key: 'mail', label: 'Mail', href: '/app/mailbox?scope=personal', icon: NavIcons.mail, matches: (p) => starts(p, '/app/mailbox', '/app/chat') },
];

export function activeMobileTab(pathname: string): Tab['key'] | null {
  return MOBILE_TABS.find((t) => t.matches(pathname))?.key ?? null;
}

export default function MobileTabBar({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const active = activeMobileTab(pathname);

  // The sidebar prefetches each tab on hover; phones have no hover, so
  // warm all four once instead of giving the slowest connections the
  // coldest navigation.
  useEffect(() => {
    MOBILE_TABS.forEach((tab) => router.prefetch(tab.href));
  }, [router]);

  return (
    <nav
      aria-label="Primary"
      data-testid="mobile-tab-bar"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-app bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <li key={tab.key}>
              <button
                type="button"
                onClick={() => router.push(tab.href)}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`mobile-tab-${tab.key}`}
                className={`relative flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium leading-none transition-colors ${
                  isActive ? 'text-primary-700 dark:text-primary-400' : 'text-app-text-secondary'
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                <span>{tab.label}</span>
                {tab.key === 'mail' && unread > 0 ? (
                  <span className="absolute right-[calc(50%-18px)] top-1 min-w-[16px] rounded-full bg-primary-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
                    {unread > 99 ? '99+' : unread}
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
