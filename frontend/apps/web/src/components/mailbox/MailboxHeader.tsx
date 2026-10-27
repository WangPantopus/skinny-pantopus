'use client';

// ============================================================
// The Mailbox's navigation, in the page itself so phones reach every page
// (the left column it replaces was desktop-only): the title and the "…" menu,
// the drawer chips (Me · Home · Biz) and the tabs (Incoming · Counter ·
// Vault), as on the Mail tab drawings (Main, R9-Counter, R10-Vault boards,
// 2026-10-27). The Mailbox's other pages get a back bar with the same menu.
// ============================================================

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, MoreHorizontal, PenLine, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MailboxIcons } from '@/lib/icons';
import { launchFeatures } from '@/lib/featureFlags';
import { useCounterItems, useDrawerMeta, useOwnsBusiness } from '@/lib/mailbox-queries';

export type MailboxDrawer = 'personal' | 'home' | 'business' | 'earn';
export type MailboxTab = 'incoming' | 'counter' | 'vault';

/**
 * What the Mailbox shows at a path: one of its main screens (a drawer's
 * Incoming, Counter or Vault, `pushed` for a letter or folder opened from
 * one), another Mailbox page (`page`), or a link that is still redirecting
 * (`none`).
 */
export type MailboxView =
  | { kind: 'main'; tab: MailboxTab; drawer: MailboxDrawer; pushed: boolean }
  | { kind: 'page' }
  | { kind: 'none' };

// Launch cut #8 (Mail extras): Earn (offers and ad earnings) is hidden.
export const MAILBOX_DRAWERS: MailboxDrawer[] = ['personal', 'home', 'business', ...(launchFeatures.mailExtras ? ['earn' as const] : [])];

export const DRAWER_LABELS: Record<MailboxDrawer, string> = { personal: 'Me', home: 'Home', business: 'Biz', earn: 'Earn' };

const DRAWER_ICONS: Record<MailboxDrawer, LucideIcon> = {
  personal: MailboxIcons.personal,
  home: MailboxIcons.home,
  business: MailboxIcons.business,
  earn: MailboxIcons.earn,
};

const TABS: { key: MailboxTab; label: string }[] = [
  { key: 'incoming', label: 'Incoming' },
  { key: 'counter', label: 'Counter' },
  { key: 'vault', label: 'Vault' },
];

// The Mailbox's other pages: a letter id or any other word in their place is
// a link the drawer route sends on (to the letter, or to Me).
const MAILBOX_PAGES = new Set([
  'search', 'deleted', 'travel', 'vacation', 'map', 'tasks', 'records', 'settings', 'memory', 'stamps',
  'booklet', 'coupon', 'disambiguate', 'certified', 'community', 'party', 'translation', 'package', 'unboxing', 'gig',
]);

export function isMailboxDrawer(value: string | null | undefined): value is MailboxDrawer {
  return !!value && (MAILBOX_DRAWERS as string[]).includes(value);
}

export function mailboxView(pathname: string, drawerParam: string | null): MailboxView {
  const [, , first, second] = pathname.split('/').filter(Boolean);
  const drawer = isMailboxDrawer(drawerParam) ? drawerParam : 'personal';
  if (first === 'counter') return { kind: 'main', tab: 'counter', drawer, pushed: false };
  if (first === 'vault') return { kind: 'main', tab: 'vault', drawer, pushed: !!second };
  if (isMailboxDrawer(first)) return { kind: 'main', tab: 'incoming', drawer: first, pushed: !!second };
  if (first && MAILBOX_PAGES.has(first)) return { kind: 'page' };
  return { kind: 'none' };
}

/** A main screen's address: Incoming is the drawer's own page; Counter and Vault carry the drawer. */
export function mailboxHref(tab: MailboxTab, drawer: MailboxDrawer): string {
  if (tab === 'incoming') return `/app/mailbox/${drawer}`;
  return drawer === 'personal' ? `/app/mailbox/${tab}` : `/app/mailbox/${tab}?drawer=${drawer}`;
}

type MenuEntry = { label: string; href: string; icon: LucideIcon };

// The pages the left column listed, minus Messages (its own tab now).
const MENU_GROUPS: MenuEntry[][] = [
  [
    { label: 'Recently shredded', href: '/app/mailbox/deleted', icon: MailboxIcons.deleted },
    { label: 'Travel Mode', href: '/app/mailbox/travel', icon: MailboxIcons.travel },
  ],
  [
    { label: 'Map', href: '/app/mailbox/map', icon: MailboxIcons.map },
    // Launch cut #8 (Mail extras): the community mail stream is hidden.
    ...(launchFeatures.mailExtras ? [{ label: 'Community', href: '/app/mailbox/community', icon: MailboxIcons.community }] : []),
    { label: 'Tasks', href: '/app/mailbox/tasks', icon: MailboxIcons.tasks },
    { label: 'Records', href: '/app/mailbox/records', icon: MailboxIcons.records },
  ],
  [
    { label: 'Mail Day', href: '/app/mailbox/settings/mail-day', icon: MailboxIcons.mailDay },
    { label: 'Stamps & Themes', href: '/app/mailbox/settings/themes', icon: MailboxIcons.stamps },
    { label: 'Memory', href: '/app/mailbox/memory', icon: MailboxIcons.memory },
    // Launch cut #8 (Mail extras): Earn (offers and ad earnings) is hidden.
    ...(launchFeatures.mailExtras ? [{ label: 'Earn Wallet', href: '/app/mailbox/earn/wallet', icon: MailboxIcons.earnWallet }] : []),
  ],
];

export default function MailboxHeader({
  view,
  backHref,
  hero,
  onWriteLetter,
}: {
  view: MailboxView;
  /** Where the back bar returns to: the main screen last shown. */
  backHref: string;
  /** Your mailbox and today's delivery, shown above the drawers on Incoming. */
  hero?: ReactNode;
  /** Opens the letter composer; only passed while Mail extras is on. */
  onWriteLetter?: () => void;
}) {
  if (view.kind === 'none') return null;

  if (view.kind === 'page') {
    return (
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-app-border-subtle px-2 py-1.5">
        <Link
          href={backHref}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-medium text-app-text-secondary transition-colors hover:bg-app-hover hover:text-app-text"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
          Mail
        </Link>
        <div className="flex-1" />
        <MailboxMenu onWriteLetter={onWriteLetter} />
      </div>
    );
  }

  // A letter or folder opened from a main screen is its own screen on phones,
  // with its own Back; wider screens keep the list beside it.
  return (
    <div className={`flex-shrink-0 bg-app ${view.pushed ? 'hidden md:block' : ''}`}>
      <div className="flex items-center gap-1 px-4 pb-1 pt-3">
        <h1 className="flex-1 text-2xl font-bold tracking-tight text-app-text">Mail</h1>
        <Link
          href="/app/mailbox/search"
          aria-label="Search all mail"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-app-text transition-colors hover:bg-app-hover"
        >
          <Search className="h-[22px] w-[22px]" aria-hidden />
        </Link>
        <MailboxMenu onWriteLetter={onWriteLetter} />
      </div>
      {view.tab === 'incoming' ? hero : null}
      <DrawerChips view={view} />
      <MailboxTabs view={view} />
    </div>
  );
}

function DrawerChips({ view }: { view: Extract<MailboxView, { kind: 'main' }> }) {
  const { data: drawers } = useDrawerMeta();
  const { data: ownsBusiness = false } = useOwnsBusiness();
  const unread = (drawer: MailboxDrawer) => drawers?.find((d) => d.drawer === drawer)?.unread_count ?? 0;
  // Biz is for business owners; anyone with unopened Biz mail (or on it now) still sees it.
  const shown = MAILBOX_DRAWERS.filter((drawer) => drawer !== 'business' || ownsBusiness || unread('business') > 0 || view.drawer === 'business');

  return (
    <div role="group" aria-label="Drawers" className="flex gap-2 overflow-x-auto px-4 pb-1 pt-2">
      {shown.map((drawer) => {
        const Icon = DRAWER_ICONS[drawer];
        const on = drawer === view.drawer;
        const count = unread(drawer);
        return (
          <Link
            key={drawer}
            href={mailboxHref(view.tab, drawer)}
            aria-current={on ? 'page' : undefined}
            aria-label={count > 0 ? `${DRAWER_LABELS[drawer]}, ${count} unopened` : DRAWER_LABELS[drawer]}
            className={`inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-full pl-3 pr-3.5 text-sm font-semibold transition-colors ${
              on
                ? 'bg-primary-600 text-white'
                : 'border border-app-border bg-app-surface text-app-text-strong hover:bg-app-hover'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={on ? 2.25 : 2} aria-hidden />
            <span>{DRAWER_LABELS[drawer]}</span>
            {count > 0 ? (
              <span
                aria-hidden
                className={`min-w-[20px] rounded-full px-1.5 text-center text-[11px] font-bold leading-5 ${
                  on ? 'bg-app-surface text-app-text' : 'bg-primary-100 text-primary-800'
                }`}
              >
                {count > 99 ? '99+' : count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

function MailboxTabs({ view }: { view: Extract<MailboxView, { kind: 'main' }> }) {
  const { data: counterItems } = useCounterItems();
  const counterCount = (counterItems ?? []).filter((item) => item.drawer === view.drawer).length;

  return (
    <nav aria-label="Mailbox sections" className="flex border-b border-app-border px-2 md:px-4">
      {TABS.map((tab) => {
        const on = tab.key === view.tab;
        const count = tab.key === 'counter' ? counterCount : 0;
        return (
          <Link
            key={tab.key}
            href={mailboxHref(tab.key, view.drawer)}
            aria-current={on ? 'page' : undefined}
            className={`-mb-px flex-1 whitespace-nowrap border-b-2 px-4 py-3 text-center text-sm transition md:flex-none ${
              on
                ? 'border-primary-600 font-semibold text-primary-600'
                : 'border-transparent font-medium text-app-text-secondary hover:text-app-text'
            }`}
          >
            {tab.label}
            {count > 0 ? <span className="ml-1.5 font-normal text-app-text-muted">({count})</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function MailboxMenu({ onWriteLetter }: { onWriteLetter?: () => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The first entry takes focus when the menu opens from the keyboard or a tap.
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;
    event.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowDown' ? (at + 1) % items.length
          : (at - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div
      className="relative"
      onKeyDown={onKeyDown}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="More Mailbox pages"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-app-text transition-colors hover:bg-app-hover"
      >
        <MoreHorizontal className="h-6 w-6" aria-hidden />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Mailbox pages"
          className="absolute right-0 top-full z-30 mt-1 w-60 overflow-hidden rounded-xl border border-app-border bg-app-surface py-1 shadow-lg"
        >
          {onWriteLetter ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); onWriteLetter(); }}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-sm font-medium text-app-text transition-colors hover:bg-app-hover focus:bg-app-hover focus:outline-none"
              >
                <PenLine className="h-4 w-4 text-app-text-secondary" aria-hidden />
                Write a letter
              </button>
              <div role="separator" className="my-1 h-px bg-app-border-subtle" />
            </>
          ) : null}
          {MENU_GROUPS.map((group, index) => (
            <div key={group[0].href}>
              {index > 0 ? <div role="separator" className="my-1 h-px bg-app-border-subtle" /> : null}
              {group.map((entry) => {
                const Icon = entry.icon;
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex min-h-[44px] items-center gap-3 px-4 text-sm font-medium text-app-text transition-colors hover:bg-app-hover focus:bg-app-hover focus:outline-none"
                  >
                    <Icon className="h-4 w-4 text-app-text-secondary" aria-hidden />
                    {entry.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
