'use client';

import { useEffect, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useBadges } from '@/contexts/BadgeContext';
import { resolveWebNotificationPath } from '@/lib/notificationRoutes';
import type { Notification } from '@pantopus/types';

const BASE_TITLE = 'Pantopus';

/**
 * Hook that manages desktop notification features:
 * 1. Updates tab title with unread count: "Pantopus (3)"
 * 2. Shows native browser notifications for new items
 */
export function useDesktopNotifications() {
  const socket = useSocket();
  const { notifications: unreadCount } = useBadges();
  const permissionRef = useRef<NotificationPermission>('default');

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
    if (Notification.permission === 'granted') {
      permissionRef.current = 'granted';
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        permissionRef.current = perm;
      });
    }
  }, []);

  // Show native notification when notification:new arrives via socket
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notif: Notification) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;

      // Don't show if tab is focused
      if (document.hasFocus()) return;

      try {
        const n = new Notification(notif.title, {
          body: notif.body || undefined,
          icon: '/icon-192.png',
          tag: notif.id, // dedupe
        });

        // Auto-close after 5 seconds
        setTimeout(() => n.close(), 5000);

        // Navigate on click
        if (notif.link) {
          n.onclick = () => {
            window.focus();
            window.location.href = resolveWebNotificationPath(notif.link) || notif.link!;
            n.close();
          };
        }
      } catch {
        // Notification constructor can throw in some environments
      }
    };

    socket.on('notification:new', handleNewNotification);
    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);
}
