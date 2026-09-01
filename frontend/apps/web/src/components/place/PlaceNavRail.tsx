// ============================================================
// PlaceNavRail — the desktop (lg+) section rail for the Place surface.
//
// On wide viewports the dashboard and the group-detail pages share this
// persistent left rail, so moving between Overview ⇄ Today ⇄ Risk … is
// one click instead of a full back-and-forth through the dashboard.
// Hidden below lg — the mobile experience keeps the designed stacked
// pages with the back header.
// ============================================================

'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Sun,
  House,
  ShieldAlert,
  Users,
  Wallet,
  Landmark,
  BadgeCheck,
  Activity,
} from 'lucide-react';

export interface PlaceNavRailProps {
  /** 'overview' | a detail slug ('today', 'risk', …) | 'pulse'. */
  active: string;
}

const NAV_ITEMS: Array<{ key: string; href: string; label: string; icon: LucideIcon }> = [
  { key: 'overview', href: '/app/place', label: 'Overview', icon: LayoutDashboard },
  { key: 'today', href: '/app/place/today', label: 'Today', icon: Sun },
  { key: 'your-home', href: '/app/place/your-home', label: 'Your home', icon: House },
  { key: 'risk', href: '/app/place/risk', label: 'Risk & readiness', icon: ShieldAlert },
  { key: 'block', href: '/app/place/block', label: 'Your block', icon: Users },
  { key: 'money', href: '/app/place/money', label: 'Money signals', icon: Wallet },
  { key: 'civic', href: '/app/place/civic', label: 'Civic', icon: Landmark },
  { key: 'identity', href: '/app/place/identity', label: 'Identity', icon: BadgeCheck },
];

export default function PlaceNavRail({ active }: PlaceNavRailProps) {
  return (
    <nav aria-label="Place sections" className="sticky top-[72px] self-start">
      <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-app-text-muted px-3 mb-2">
        Your place
      </div>
      <ul className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ key, href, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-semibold -tracking-[0.005em] transition-colors ${
                  isActive
                    ? 'bg-app-home-bg text-app-home'
                    : 'text-app-text-secondary hover:bg-app-hover hover:text-app-text'
                }`}
              >
                <Icon size={17} strokeWidth={2} className={isActive ? 'text-app-home' : 'text-app-text-muted'} />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 pt-3 border-t border-app-border-subtle">
        <Link
          href="/app/place/pulse"
          aria-current={active === 'pulse' ? 'page' : undefined}
          className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-semibold -tracking-[0.005em] transition-colors ${
            active === 'pulse'
              ? 'bg-app-home-bg text-app-home'
              : 'text-app-text-secondary hover:bg-app-hover hover:text-app-text'
          }`}
        >
          <Activity size={17} strokeWidth={2} className={active === 'pulse' ? 'text-app-home' : 'text-app-text-muted'} />
          Today&apos;s Pulse
        </Link>
      </div>
    </nav>
  );
}
