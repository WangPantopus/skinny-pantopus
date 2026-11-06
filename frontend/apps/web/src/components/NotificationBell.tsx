'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Megaphone } from 'lucide-react';
import { useBadges } from '@/contexts/BadgeContext';
import { launchFeatures } from '@/lib/featureFlags';
import { NOTIFICATION_PANEL_CLASS, type NotificationBellMode } from './notificationPanelFrame';

export type { NotificationBellMode } from './notificationPanelFrame';

type PanelProps = { mode: NotificationBellMode; open: boolean; unreadCount: number; onClose: () => void };

// The dropdown (its list, live additions and actions) loads on the bell's first
// open, and hovering or focusing the bell fetches it ahead, so every page's first
// scripts leave it out. A failed load (offline, say) is tried again next time.
let panelModule: Promise<{ default: ComponentType<PanelProps> }> | null = null;
function loadPanel() {
  panelModule ??= import('./NotificationPanel').catch((error: unknown) => {
    panelModule = null;
    throw error;
  });
  return panelModule;
}

/**
 * NotificationBell — top-bar inbox dropdown.
 *
 * `mode` selects the firewall slice the bell represents (notificationPanelFrame.ts).
 * Two streams MUST never merge — the dropdown only shows notifications
 * from the bell's mode.
 */
export default function NotificationBell({
  mode = 'all',
}: {
  mode?: NotificationBellMode;
}) {
  const [open, setOpen] = useState(false);
  // Once loaded, the panel stays mounted, so a reopened panel keeps what it had while it reads again.
  const [Panel, setPanel] = useState<ComponentType<PanelProps> | null>(null);
  const [panelFailed, setPanelFailed] = useState(false);
  const { notifications: totalUnread, notificationsByContext } = useBadges();
  const panelRef = useRef<HTMLDivElement>(null);

  // Per-mode unread count. Personal-zone bell counts personal+platform
  // (the user's own private/billing notifications). Audience megaphone
  // counts audience only. Legacy bell counts everything.
  const unreadCount =
    mode === 'audience'
      ? notificationsByContext.audience
      : mode === 'personal'
      ? notificationsByContext.personal + notificationsByContext.platform
      // Launch cut #1 (Beacon): the combined bell leaves out the Audience stream.
      : launchFeatures.beacon ? totalUnread : Math.max(0, totalUnread - notificationsByContext.audience);

  // Audience zone gets a megaphone + teal accent; personal/all keeps the bell.
  const isAudience = mode === 'audience';
  const ariaLabel = isAudience
    ? 'Audience notifications'
    : mode === 'personal'
    ? 'Personal notifications'
    : 'Notifications';

  const showPanel = () => {
    setPanelFailed(false);
    loadPanel().then((loaded) => setPanel(() => loaded.default), () => setPanelFailed(true));
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    // flex: the wrapper is the button's height, not a line of (large) text, so the bell lines up with Messages.
    <div className="relative flex" ref={panelRef}>
      {/* Bell / megaphone button. Below the desktop layout it keeps its size whatever the text size (AppShell's top bar). */}
      <button
        onClick={() => {
          if (!open && !Panel) showPanel();
          setOpen(!open);
        }}
        onPointerEnter={() => void loadPanel().catch(() => {})}
        onFocus={() => void loadPanel().catch(() => {})}
        className="p-2 max-lg:p-[8px] hover-bg-app rounded-lg relative"
        aria-label={ariaLabel}
        title={ariaLabel}
        data-testid={`notification-bell-${mode}`}
        data-mode={mode}
      >
        {isAudience ? (
          <Megaphone className="w-5 h-5 max-lg:w-[20px] max-lg:h-[20px] text-teal-600" aria-hidden />
        ) : (
          <svg className="w-5 h-5 max-lg:w-[20px] max-lg:h-[20px] text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        )}
        {unreadCount > 0 && (
          <span
            className={`absolute top-0.5 right-0.5 min-w-[18px] h-[18px] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ${
              isAudience ? 'bg-teal-700' : 'bg-red-600'
            }`}
            data-testid={`notification-badge-${mode}`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {Panel ? (
        <Panel mode={mode} open={open} unreadCount={unreadCount} onClose={() => setOpen(false)} />
      ) : open ? (
        // While the panel loads: its frame, as it looks while its list loads.
        <div data-notification-panel className={NOTIFICATION_PANEL_CLASS}>
          <div className="px-4 py-3 border-b border-app">
            <h3 className="text-sm font-semibold text-app">Notifications</h3>
          </div>
          {panelFailed ? (
            <div role="alert" className="px-4 py-3 text-sm text-amber-900 bg-amber-50">
              <p>Could not load your notifications.</p>
              <button onClick={showPanel} className="mt-1 font-medium underline underline-offset-2">Retry</button>
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-app-border border-t-gray-600 dark:border-t-gray-300 mx-auto" />
              <p className="text-xs text-app-muted mt-2">Loading...</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
