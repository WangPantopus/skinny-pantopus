'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AUTH_SESSION_CHANGE_KEY, getApiBaseUrl, getAuthToken, onTokenChange } from '@pantopus/api';
import { useSocket } from '@/contexts/SocketContext';
import { useBadges } from '@/contexts/BadgeContext';
import { resolveWebNotificationPath } from '@/lib/notificationRoutes';
import type { Notification as AppNotification } from '@pantopus/types';

const BASE_TITLE = 'Pantopus';

/**
 * Hook that manages desktop notification features:
 * 1. Updates tab title with unread count: "Pantopus (3)"
 * 2. Shows native browser notifications for new items
 */
export function useDesktopNotifications() {
  const socket = useSocket();
  const router = useRouter();
  const { notifications: unreadCount } = useBadges();
  const seen = useRef(new Set<string>());

  // Update tab title when unread count changes
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = unreadCount > 0 ? `${BASE_TITLE} (${unreadCount})` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [unreadCount]);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => {});
    }
  }, []);

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
