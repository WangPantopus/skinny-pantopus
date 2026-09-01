'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useDrawerMeta, useCounterItems } from '@/lib/mailbox-queries';
import type { DrawerMeta } from '@/types/mailbox';
import { MailboxIcons, NavIcons } from '@/lib/icons';
import type { LucideIcon } from 'lucide-react';

type MailboxNavProps = {
  composeSlot?: React.ReactNode;
  iconOnly?: boolean;
};

// ── Drawer icons & labels ────────────────────────────────────
const drawerConfig: Record<string, { icon: LucideIcon; label: string }> = {
  personal: { icon: MailboxIcons.personal, label: 'Personal' },
  home: { icon: MailboxIcons.home, label: 'Home' },
  business: { icon: MailboxIcons.business, label: 'Business' },
  earn: { icon: MailboxIcons.earn, label: 'Earn' },
};

// ── Static nav sections ──────────────────────────────────────
type NavEntry = {
  icon: LucideIcon;
  label: string;
  href: string;
  matchPrefix?: string;
};

// Chat threads are just another kind of mail (wedge Phase 1.5): the
// Messages inbox sits at the top of the Mail nav instead of on its own tab.
const inboxSection: NavEntry[] = [
  { icon: NavIcons.messages, label: 'Messages', href: '/app/chat', matchPrefix: '/app/chat' },
];

const mailboxSection: NavEntry[] = [
  { icon: MailboxIcons.counter, label: 'Counter', href: '/app/mailbox/counter', matchPrefix: '/app/mailbox/counter' },
  { icon: MailboxIcons.vault, label: 'Vault', href: '/app/mailbox/vault', matchPrefix: '/app/mailbox/vault' },
];

const homeSection: NavEntry[] = [
  { icon: MailboxIcons.map, label: 'Map', href: '/app/mailbox/map', matchPrefix: '/app/mailbox/map' },
  { icon: MailboxIcons.community, label: 'Community', href: '/app/mailbox/community', matchPrefix: '/app/mailbox/community' },
  { icon: MailboxIcons.tasks, label: 'Tasks', href: '/app/mailbox/tasks', matchPrefix: '/app/mailbox/tasks' },
  { icon: MailboxIcons.records, label: 'Records', href: '/app/mailbox/records', matchPrefix: '/app/mailbox/records' },
];

const profileSection: NavEntry[] = [
  { icon: MailboxIcons.earnWallet, label: 'Earn Wallet', href: '/app/mailbox/earn/wallet', matchPrefix: '/app/mailbox/earn' },
  { icon: MailboxIcons.mailDay, label: 'Mail Day', href: '/app/mailbox/settings/mail-day', matchPrefix: '/app/mailbox/settings/mail-day' },
  { icon: MailboxIcons.stamps, label: 'Stamps & Themes', href: '/app/mailbox/settings/themes', matchPrefix: '/app/mailbox/settings/themes' },
  { icon: MailboxIcons.memory, label: 'Memory', href: '/app/mailbox/memory', matchPrefix: '/app/mailbox/memory' },
  { icon: MailboxIcons.travel, label: 'Travel Mode', href: '/app/mailbox/travel', matchPrefix: '/app/mailbox/travel' },
];

export default function MailboxNav({ composeSlot }: MailboxNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Fetch drawer metadata (live counts, 30s polling)
  const { data: drawers } = useDrawerMeta({ refetchInterval: 30_000 });

  // Counter items for badge
  const { data: counterItems } = useCounterItems({ refetchInterval: 30_000 });
  const counterCount = counterItems?.length ?? 0;

  const isActive = (href: string, matchPrefix?: string) => {
    if (matchPrefix) return pathname.startsWith(matchPrefix);
    return pathname === href;
  };

  const isDrawerActive = (drawer: string) =>
    pathname === `/app/mailbox/${drawer}` || pathname.startsWith(`/app/mailbox/${drawer}/`);

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-3 py-3 border-b border-app flex-shrink-0">
        <button
          type="button"
          onClick={() => router.push('/app/mailbox')}
          className="flex items-center gap-2 hover-bg-app rounded-lg px-2 py-1.5 transition-colors w-full"
        >
          <MailboxIcons.brand className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold text-app hidden lg:inline truncate">
            Mailbox
          </span>
        </button>
      </div>

      {/* Compose button */}
      {composeSlot && (
        <div className="px-3 pt-3 flex-shrink-0">
          {composeSlot}
        </div>
      )}

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {/* ── INBOX (chat) ─────────────────────────────── */}
        <SectionLabel>Inbox</SectionLabel>
        {inboxSection.map((e) => (
          <NavItem
            key={e.href}
            icon={e.icon}
            label={e.label}
            active={isActive(e.href, e.matchPrefix)}
            onClick={() => router.push(e.href)}
          />
        ))}

        {/* ── DRAWERS ──────────────────────────────────── */}
        <SectionLabel>Drawers</SectionLabel>
        {(drawers ?? []).map((d: DrawerMeta) => {
          const cfg = drawerConfig[d.drawer] ?? { icon: MailboxIcons.brand, label: d.display_name };
          return (
            <NavItem
              key={d.drawer}
              icon={cfg.icon}
              label={cfg.label}
              active={isDrawerActive(d.drawer)}
              count={d.unread_count}
              onClick={() => router.push(`/app/mailbox/${d.drawer}`)}
            />
          );
        })}

        {/* Skeleton while loading */}
        {!drawers && (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <div className="w-5 h-5 rounded bg-gray-300 animate-pulse" />
                <div className="h-3 rounded bg-gray-300 animate-pulse flex-1 hidden lg:block" />
              </div>
            ))}
          </>
        )}

        <NavDivider />

        {/* ── MAILBOX ──────────────────────────────────── */}
        <SectionLabel>Mailbox</SectionLabel>
        {mailboxSection.map((entry) => (
          <NavItem
            key={entry.href}
            icon={entry.icon}
            label={entry.label}
            active={isActive(entry.href, entry.matchPrefix)}
            count={entry.label === 'Counter' ? counterCount : undefined}
            pulse={entry.label === 'Counter' && counterCount > 0}
            onClick={() => router.push(entry.href)}
          />
        ))}

        <NavDivider />

        {/* ── HOME ─────────────────────────────────────── */}
        <SectionLabel>Home</SectionLabel>
        {homeSection.map((entry) => (
          <NavItem
            key={entry.href}
            icon={entry.icon}
            label={entry.label}
            active={isActive(entry.href, entry.matchPrefix)}
            onClick={() => router.push(entry.href)}
          />
        ))}

        <NavDivider />

        {/* ── PROFILE ──────────────────────────────────── */}
        <SectionLabel>Profile</SectionLabel>
        {profileSection.map((entry) => (
          <NavItem
            key={entry.href}
            icon={entry.icon}
            label={entry.label}
            active={isActive(entry.href, entry.matchPrefix)}
            onClick={() => router.push(entry.href)}
          />
        ))}
      </nav>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Sub-components
 * ───────────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-app-muted hidden lg:block">
      {children}
    </p>
  );
}

function NavDivider() {
  return <div className="h-px bg-app mx-2 my-1.5" />;
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  count,
  pulse = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  count?: number;
  pulse?: boolean;
  onClick: () => void;
}) {
  const countLabel = count != null && count > 0
    ? `, ${count} unread`
    : '';

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={`${label}${countLabel}`}
      aria-current={active ? 'page' : undefined}
      className={`group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[36px] relative ${
        active
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 border-l-[3px] border-primary-600 dark:border-primary-400'
            : 'text-app-muted hover-bg-app border-l-[3px] border-transparent'
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 text-left truncate hidden lg:inline">{label}</span>

      {/* Count badge */}
      {count != null && count > 0 && (
        <span
          aria-hidden="true"
          className={`min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0 ${
            pulse
              ? 'bg-amber-500 text-white animate-pulse'
              : 'bg-red-500 text-white'
          }`}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}

      {/* Tablet tooltip (shown on hover when label is hidden) */}
      <span className="absolute left-full ml-2 px-2 py-1 bg-surface text-app text-xs rounded border border-app shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity lg:hidden z-50" aria-hidden="true">
        {label}
      </span>
    </button>
  );
}
