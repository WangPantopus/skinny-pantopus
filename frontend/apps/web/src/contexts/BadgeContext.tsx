'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import type { Socket } from 'socket.io-client';
import { getAuthToken } from '@pantopus/api';
import * as api from '@pantopus/api';
import { useSocket, useSocketConnected } from '@/contexts/SocketContext';
import { launchFeatures } from '@/lib/featureFlags';
import { afterInboxRows } from '@/lib/shellReads';

// Launch cut #10 (Mailbox): the Mail tab's count. Loaded only while Mailbox is
// on, so the shell's first scripts leave the Mailbox's queries out.
const MailUnreadReader = dynamic(() => import('@/components/mailbox/MailUnreadReader'), { ssr: false });

// ── Types ────────────────────────────────────────────────────
export interface BadgeCounts {
  unreadMessages: number;
  totalMessages: number;
  pendingOffers: number;
  notifications: number;
  /**
   * P2.3 — per-firewall breakdown of unread notifications. Lets the
   * Personal bell and the Audience megaphone render distinct counts
   * from one /unread-count call. Always defined; default zeros.
   */
  notificationsByContext: {
    personal: number;
    audience: number;
    platform: number;
  };
}

interface BadgeContextValue extends BadgeCounts {
  /** Unopened mail in Me, Home and Biz: the Mail tab badge (0 while Mailbox is off). */
  unreadMail: number;
  /** true when the socket is connected */
  connected: boolean;
  /** the underlying socket instance (for gig detail real-time, etc.) */
  socket: Socket | null;
  setUnreadMessages: (value: number | ((prev: number) => number)) => void;
  setTotalMessages: (value: number | ((prev: number) => number)) => void;
}

const defaultCounts: BadgeCounts = {
  unreadMessages: 0,
  totalMessages: 0,
  pendingOffers: 0,
  notifications: 0,
  notificationsByContext: { personal: 0, audience: 0, platform: 0 },
};

const BadgeContext = createContext<BadgeContextValue>({
  ...defaultCounts,
  unreadMail: 0,
  connected: false,
  socket: null,
  setUnreadMessages: () => {},
  setTotalMessages: () => {},
});

// ── Provider ─────────────────────────────────────────────────
const FALLBACK_POLL_MS = 15_000;

export function BadgeProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const connected = useSocketConnected();
  const [counts, setCounts] = useState<BadgeCounts>(defaultCounts);
  // The Mail tab's count, from MailUnreadReader (rendered below while Mailbox is on).
  const [unreadMail, setUnreadMail] = useState(0);
  const socketNotifications = useRef<number | null>(null);
  // When this session's last full badge read succeeded, and the notification
  // total it saw. The socket's own badge:update on connect carries the same
  // counts, so connecting right after a read does not read them again.
  const lastPolledAt = useRef(0);
  const polledNotifications = useRef<number | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const active = useRef(true);
  const revision = useRef(0);
  const pollInFlight = useRef<{ marker: string; promise: Promise<boolean> } | null>(null);
  const notificationInFlight = useRef<Promise<void> | null>(null);
  const notificationAgain = useRef(false);

  // One request batch per account. Socket updates that arrive during the read
  // win over that older HTTP snapshot, and a failure preserves known counts.
  const pollBadges = useCallback((): Promise<boolean> => {
    if (!getAuthToken() || !navigator.onLine || document.visibilityState !== 'visible') return Promise.resolve(false);
    const marker = api.authSessionMarker();
    if (pollInFlight.current?.marker === marker) return pollInFlight.current.promise;
    const startedRevision = revision.current;
    const promise = (async () => {
      const [notifRes, chatRes, offersRes] = await Promise.allSettled([
        api.notifications.getUnreadCount({ suppressDevErrorOverlay: true }),
        api.chat.getChatStats({ suppressDevErrorOverlay: true }),
        launchFeatures.openGigs ? api.gigs.getReceivedOffers(undefined, { suppressDevErrorOverlay: true }) : Promise.resolve({ offers: [] }),
      ]);
      if (!active.current || marker !== api.authSessionMarker() || startedRevision !== revision.current) return true;
      const succeeded = notifRes.status === 'fulfilled' && Boolean(notifRes.value)
        && chatRes.status === 'fulfilled' && Boolean(chatRes.value?.stats);
      if (succeeded) lastPolledAt.current = Date.now();
      if (notifRes.status === 'fulfilled' && notifRes.value) {
        const value = notifRes.value as { count?: number; total?: number };
        polledNotifications.current = Number(value.total ?? value.count) || 0;
      }
      setCounts((previous) => {
        const next = { ...previous };
        if (notifRes.status === 'fulfilled' && notifRes.value) {
          const value = notifRes.value as { count?: number; total?: number; byContext?: { personal?: number; audience?: number; platform?: number } };
          next.notifications = Number(value.total ?? value.count ?? previous.notifications) || 0;
          if (value.byContext) next.notificationsByContext = {
            personal: Number(value.byContext.personal ?? 0) || 0,
            audience: Number(value.byContext.audience ?? 0) || 0,
            platform: Number(value.byContext.platform ?? 0) || 0,
          };
        }
        if (chatRes.status === 'fulfilled' && chatRes.value?.stats) {
          next.unreadMessages = Number(chatRes.value.stats.total_unmuted_unread ?? chatRes.value.stats.total_unread ?? previous.unreadMessages) || 0;
          next.totalMessages = Number(chatRes.value.stats.total_messages ?? previous.totalMessages) || 0;
        }
        if (offersRes.status === 'fulfilled' && Array.isArray(offersRes.value?.offers)) next.pendingOffers = offersRes.value.offers.filter((offer: { status?: string }) => offer.status === 'pending').length;
        return next;
      });
      return succeeded;
    })().finally(() => { if (pollInFlight.current?.promise === promise) pollInFlight.current = null; });
    pollInFlight.current = { marker, promise };
    return promise;
  }, []);

  // Notification totals use the web's existing context filter. Coalesce bursts
  // and defer hidden/offline work until the next foreground refresh.
  const refreshNotificationContexts = useCallback(() => {
    if (!getAuthToken() || !navigator.onLine || document.visibilityState !== 'visible') return;
    if (notificationInFlight.current) { notificationAgain.current = true; return; }
    const marker = api.authSessionMarker();
    const promise = (async () => {
      do {
        notificationAgain.current = false;
        try {
          const value = await api.notifications.getUnreadCount({ suppressDevErrorOverlay: true }) as {
            count?: number; total?: number; byContext?: { personal?: number; audience?: number; platform?: number };
          };
          if (!active.current || marker !== api.authSessionMarker() || !value) return;
          if (!notificationAgain.current) setCounts((previous) => ({ ...previous,
            notifications: Number(value.total ?? value.count ?? previous.notifications) || 0,
            notificationsByContext: value.byContext ? {
              personal: Number(value.byContext.personal ?? 0) || 0,
              audience: Number(value.byContext.audience ?? 0) || 0,
              platform: Number(value.byContext.platform ?? 0) || 0,
            } : previous.notificationsByContext }));
        } catch { /* The next foreground or badge signal retries. */ }
      } while (notificationAgain.current && navigator.onLine && document.visibilityState === 'visible' && marker === api.authSessionMarker());
    })().finally(() => { if (notificationInFlight.current === promise) notificationInFlight.current = null; });
    notificationInFlight.current = promise;
  }, []);

  useEffect(() => {
    active.current = true;
    const changed = () => {
      revision.current += 1;
      socketNotifications.current = null;
      lastPolledAt.current = 0;
      polledNotifications.current = null;
      setCounts(defaultCounts);
      void pollBadges();
    };
    const stop = api.onTokenChange(changed);
    return () => { active.current = false; stop(); };
  }, [pollBadges]);

  const setUnreadMessages = useCallback((value: number | ((prev: number) => number)) => {
    revision.current += 1;
    setCounts((prev) => {
      const nextValue = typeof value === 'function' ? value(prev.unreadMessages) : value;
      return { ...prev, unreadMessages: Math.max(0, Number(nextValue) || 0) };
    });
  }, []);

  const setTotalMessages = useCallback((value: number | ((prev: number) => number)) => {
    revision.current += 1;
    setCounts((prev) => {
      const nextValue = typeof value === 'function' ? value(prev.totalMessages) : value;
      return { ...prev, totalMessages: Math.max(0, Number(nextValue) || 0) };
    });
  }, []);

  // Listen for badge:update from the shared socket
  useEffect(() => {
    if (!socket) return;

    const handleBadgeUpdate = (data: Partial<BadgeCounts> & { unmutedUnreadMessages?: number }) => {
      if (!getAuthToken()) return;
      revision.current += 1;
      if (data?.notifications != null) {
        const total = Number(data.notifications) || 0;
        if (total !== socketNotifications.current) {
          // The first push after connecting usually repeats the total this
          // session's startup badge read just loaded with its breakdown. Any
          // other first push still reads the breakdown: one that arrives before
          // that read has landed (a read still under way is discarded by this
          // push, and a cold Messages inbox holds it until its rows paint) or
          // after it failed.
          const repeatsRead = socketNotifications.current === null
            && polledNotifications.current !== null && total === polledNotifications.current;
          socketNotifications.current = total;
          if (!repeatsRead) void refreshNotificationContexts();
        }
      }
      setCounts((prev) => ({
        ...prev,
        unreadMessages: Number(data?.unmutedUnreadMessages ?? data?.unreadMessages ?? prev.unreadMessages) || 0,
        totalMessages: Number(data?.totalMessages ?? prev.totalMessages) || 0,
        pendingOffers: Number(data?.pendingOffers ?? prev.pendingOffers) || 0,
      }));
    };

    socket.on('badge:update', handleBadgeUpdate);
    return () => {
      socket.off('badge:update', handleBadgeUpdate);
    };
  }, [socket, refreshNotificationContexts]);

  useEffect(() => {
    let cancelled = false;
    let delay = FALLBACK_POLL_MS;
    const stop = () => { if (fallbackRef.current) clearTimeout(fallbackRef.current); fallbackRef.current = undefined; };
    const poll = async () => {
      stop();
      if (cancelled || !getAuthToken() || !navigator.onLine || document.visibilityState !== 'visible') return;
      const succeeded = await pollBadges();
      if (cancelled || connected) return;
      delay = succeeded ? FALLBACK_POLL_MS : Math.min(60_000, delay * 2);
      fallbackRef.current = setTimeout(() => void poll(), delay + Math.random() * 500);
    };
    const foreground = () => {
      if (navigator.onLine && document.visibilityState === 'visible') { delay = FALLBACK_POLL_MS; void poll(); }
      else stop();
    };
    // This effect also runs again when the socket connects or drops. A read
    // that just succeeded is current: the socket's badge:update on connect
    // carries the same counts, and a dropped socket resumes the fallback reads
    // on their usual interval.
    const start = () => {
      const age = Date.now() - lastPolledAt.current;
      if (age >= FALLBACK_POLL_MS) { foreground(); return; }
      if (!connected) fallbackRef.current = setTimeout(() => void poll(), FALLBACK_POLL_MS - age + Math.random() * 500);
    };
    // A cold Messages inbox paints its rows first (lib/shellReads.ts).
    const cancelStart = afterInboxRows(start);
    document.addEventListener('visibilitychange', foreground);
    window.addEventListener('online', foreground);
    window.addEventListener('offline', foreground);
    return () => { cancelled = true; cancelStart(); stop(); document.removeEventListener('visibilitychange', foreground); window.removeEventListener('online', foreground); window.removeEventListener('offline', foreground); };
  }, [connected, pollBadges]);

  const contextValue = useMemo(
    () => ({ ...counts, unreadMail, connected, socket, setUnreadMessages, setTotalMessages }),
    [counts, unreadMail, connected, socket, setUnreadMessages, setTotalMessages],
  );

  return (
    <BadgeContext.Provider value={contextValue}>
      {launchFeatures.mailbox && <MailUnreadReader onCount={setUnreadMail} />}
      {children}
    </BadgeContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────
export function useBadges(): BadgeContextValue {
  return useContext(BadgeContext);
}
