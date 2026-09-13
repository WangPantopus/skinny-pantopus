'use client';

import { useCallback, useEffect, useRef } from 'react';
import * as api from '@pantopus/api';
import type { Notification } from '@pantopus/types';

/** Keep an awaited notification interaction within its opening account and view. */
export function useNotificationTap(enabled = true) {
  const lifetime = useRef({ active: false, revision: 0 });
  useEffect(() => {
    const view = { active: enabled, revision: 0 };
    lifetime.current = view;
    const invalidate = () => { view.revision++; };
    const unsubscribe = api.onTokenChange(invalidate);
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) invalidate();
    };
    const visibility = () => { if (document.visibilityState === 'hidden') invalidate(); };
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      view.active = false;
      unsubscribe();
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled]);

  return useCallback(async (notification: Notification, markRead: () => void, open: () => void) => {
    const view = lifetime.current;
    const revision = view.revision;
    const token = api.getAuthToken();
    const origin = api.getApiBaseUrl();
    let marker: string | null;
    try { marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY); } catch { return; }
    const current = () => {
      try {
        return view.active && view === lifetime.current && view.revision === revision
          && document.visibilityState !== 'hidden' && !!token && api.getAuthToken() === token
          && api.getApiBaseUrl() === origin && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === marker;
      } catch { return false; }
    };
    if (!current() || !notification.user_id) return;
    try {
      const profile = await api.users.getMyProfile();
      if (!current() || profile.id !== notification.user_id) return;
    } catch { return; }
    if (!notification.is_read) {
      try {
        await api.notifications.markAsRead(notification.id);
        if (!current()) return;
        markRead();
      } catch { /* Reading a notification is independent of opening current content. */ }
    }
    if (current()) open();
  }, []);
}
