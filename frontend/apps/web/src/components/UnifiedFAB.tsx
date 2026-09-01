'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Plus,
  Sparkles,
  MessageCircle,
  Building2,
  Hammer,
  UserPlus,
  Newspaper,
  ImagePlus,
  type LucideIcon,
} from 'lucide-react';
import { openFeedComposer } from '@/lib/feedComposerEvents';

export interface UnifiedFABAction {
  key: string;
  icon: LucideIcon;
  label: string;
  iconColor?: string;
  onAction: () => void;
}

/**
 * Routes where a page-level UnifiedFAB with custom context actions is rendered.
 * The global (AppShell) FAB hides on these to avoid double FABs.
 */
const ROUTES_WITH_PAGE_FAB = ['/app/homes/'];

interface UnifiedFABProps {
  /** Extra context-specific actions to prepend (e.g. home dashboard actions) */
  contextActions?: UnifiedFABAction[];
  /** Whether to include the "Hire Help" / magic task action */
  showHireHelp?: boolean;
  onHireHelp?: () => void;
  /** Hub-specific props */
  hasHome?: boolean;
  hasBusiness?: boolean;
  activeHomeId?: string | null;
  /** If true, hide on routes that have their own page-level FAB */
  hideOnPageFABRoutes?: boolean;
}

export default function UnifiedFAB({
  contextActions,
  showHireHelp = false,
  onHireHelp,
  hasHome = false,
  hasBusiness = false,
  activeHomeId,
  hideOnPageFABRoutes = false,
}: UnifiedFABProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  // Hide global FAB on routes that render their own page-level FAB
  if (hideOnPageFABRoutes && ROUTES_WITH_PAGE_FAB.some((r) => pathname.startsWith(r))) {
    return null;
  }

  // Build actions list
  const actions: UnifiedFABAction[] = [];

  // Context actions first (e.g. home dashboard specific)
  if (contextActions) {
    actions.push(...contextActions);
  }

  // Hire Help (Magic Task)
  if (showHireHelp && onHireHelp) {
    actions.push({
      key: 'hire-help',
      icon: Sparkles,
      label: 'Hire Help',
      iconColor: 'text-blue-600',
      onAction: onHireHelp,
    });
  }

  actions.push({
    key: 'post-feed',
    icon: Newspaper,
    label: 'Post to Pulse',
    iconColor: 'text-indigo-600',
    onAction: () => openFeedComposer(),
  });

  // Common actions
  actions.push({
    key: 'post-task',
    icon: Hammer,
    label: 'Post Task',
    iconColor: 'text-primary-600',
    onAction: () => router.push('/app/gigs/new'),
  });

  actions.push({
    key: 'snap-sell',
    icon: ImagePlus,
    label: 'Snap & Sell',
    iconColor: 'text-amber-600',
    onAction: () => router.push('/app/marketplace?snapSell=1'),
  });

  actions.push({
    key: 'new-message',
    icon: MessageCircle,
    label: 'New Message',
    iconColor: 'text-green-600',
    onAction: () => router.push('/app/chat'),
  });

  if (hasHome && activeHomeId) {
    actions.push({
      key: 'invite-member',
      icon: UserPlus,
      label: 'Invite Member',
      iconColor: 'text-orange-600',
      onAction: () => router.push(`/app/homes/${activeHomeId}/dashboard?tab=members`),
    });
  }

  if (hasBusiness) {
    actions.push({
      key: 'my-businesses',
      icon: Building2,
      label: 'My Businesses',
      iconColor: 'text-violet-600',
      onAction: () => router.push('/app/businesses'),
    });
  }

  // De-duplicate by key (contextActions may overlap with defaults)
  const seen = new Set<string>();
  const dedupedActions = actions.filter((a) => {
    if (seen.has(a.key)) return false;
    seen.add(a.key);
    return true;
  });

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-50">
      {/* Backdrop overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Action menu */}
      {open && (
        <div className="absolute bottom-16 right-0 bg-app-surface rounded-xl border border-app-border shadow-lg py-2 min-w-[200px] animate-fade-in-up z-50">
          {dedupedActions.map((action, idx) => (
            <button
              key={action.key}
              onClick={() => {
                action.onAction();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-app-text-strong hover:bg-app-hover transition text-left"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <action.icon className={`w-4 h-4 flex-shrink-0 ${action.iconColor || ''}`} />
              <span className="font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(!open)}
        className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-2xl transition-all duration-200 z-50 ${
          open
            ? 'bg-gray-700 rotate-45'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl'
        }`}
        aria-label="Quick actions"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
