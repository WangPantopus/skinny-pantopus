'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AUTH_SESSION_CHANGE_KEY, getApiBaseUrl, getAuthToken, onTokenChange } from '@pantopus/api';
import { useSocket } from '@/contexts/SocketContext';
import { useBadges } from '@/contexts/BadgeContext';
import { isHiddenOnWeb, resolveWebNotificationPath } from '@/lib/notificationRoutes';
import { APP_TITLE, SITE_TITLE } from '@/lib/siteTitle';
import type { Notification as AppNotification } from '@pantopus/types';

/**
 * Hook that manages desktop notification features:
 * 1. Adds the unread count to the tab title: "Bob Tester | Pantopus (3)", or "Pantopus (3)" on a
 *    page with no title of its own
 * 2. Shows native browser notifications for new items
 */
export function useDesktopNotifications() {
  const socket = useSocket();
  const router = useRouter();
  const { notifications: unreadCount } = useBadges();
  const seen = useRef(new Set<string>());
  const unread = useRef(unreadCount);
  const updateTitle = useRef<(() => void) | null>(null);

  // Next writes each page's own title from its metadata: on every navigation, when streamed
  // metadata arrives, and as hydration claims the server's title. This shell also mounts again
  // between the /app and profile layouts. So add the count to whatever title Next last wrote, and
  // again each time it writes one, instead of replacing it.
  useEffect(() => {
    let pageTitle = '';
    let shown = '';
    const update = () => {
      const current = document.title;
      if (current !== shown) pageTitle = current;
      // Nothing to add the count to yet. Writing now would add a <title> of our own, which can
      // hide the page's title when it streams in.
      if (!pageTitle) return;
      const base = pageTitle === SITE_TITLE ? APP_TITLE : pageTitle;
      const next = unread.current > 0 ? `${base} (${unread.current})` : base;
      if (next !== current) document.title = next;
      shown = document.title;
    };
    updateTitle.current = update;
    // The whole document: a title streamed in after the first paint sits in the body.
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
    update();
    return () => {
      observer.disconnect();
      updateTitle.current = null;
      // Give the page back its own title, unless the next page has already written one.
      if (shown !== pageTitle && document.title === shown) document.title = pageTitle;
    };
  }, []);

  useEffect(() => {
    unread.current = unreadCount;
    updateTitle.current?.();
  }, [unreadCount]);

  // Permission is asked for from Settings → Notification Preferences → Desktop alerts:
  // browsers ignore or quiet a prompt that doesn't follow a click.

  // notification:new updates in-app content even when push is off. Only the
  // server's separate, preference-checked alert event may create an OS alert.
  useEffect(() => {
    if (!socket) return;
    const openingToken = getAuthToken();
    const openingApi = getApiBaseUrl();
    let active = true;
    let openingMarker: string | null | undefined;
    try { openingMarker = localStorage.getItem(AUTH_SESSION_CHANGE_KEY); } catch { active = false; }
    const alerts = new Map<Notification, ReturnType<typeof setTimeout>>();
    const current = () => {
      if (!active || !openingToken || openingMarker === undefined) return false;
      try {
        return getAuthToken() === openingToken && getApiBaseUrl() === openingApi
          && localStorage.getItem(AUTH_SESSION_CHANGE_KEY) === openingMarker;
      } catch { return false; }
    };
    const closeAlerts = () => {
      for (const [alert, timer] of alerts) { clearTimeout(timer); alert.close(); }
      alerts.clear();
    };
    const invalidate = () => { active = false; seen.current.clear(); closeAlerts(); };
    const unsubscribe = onTokenChange(invalidate);
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null || event.key === AUTH_SESSION_CHANGE_KEY) invalidate();
    };
    window.addEventListener('storage', storageChanged);

    const handleAlert = (notif: AppNotification) => {
      if (!current() || !notif?.id || !notif.user_id || typeof notif.title !== 'string') return;
      // No OS alert for a hidden feature, or for a row only the apps open.
      if (isHiddenOnWeb(notif)) return;
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      const key = `${notif.user_id}:${notif.id}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      if (seen.current.size > 256) seen.current.delete(seen.current.values().next().value!);

      // Don't show if tab is focused
      if (document.hasFocus()) return;

      try {
        const n = new Notification(notif.title, {
          body: notif.body || undefined,
          icon: '/icon-192.png',
          tag: notif.id, // dedupe
        });

        // Auto-close after 5 seconds
        alerts.set(n, setTimeout(() => { n.close(); alerts.delete(n); }, 5000));

        // Navigate on click
        const path = resolveWebNotificationPath(notif.link, notif);
        if (path?.startsWith('/') && !path.startsWith('//') && !path.includes('\\')) {
          n.onclick = () => {
            if (!current()) { n.close(); return; }
            window.focus();
            router.push(path);
            n.close();
          };
        }
      } catch {
        // Notification constructor can throw in some environments
      }
    };

    socket.on('notification:alert', handleAlert);
    return () => {
      active = false;
      closeAlerts();
      unsubscribe();
      window.removeEventListener('storage', storageChanged);
      socket.off('notification:alert', handleAlert);
    };
  }, [socket, router]);
}
