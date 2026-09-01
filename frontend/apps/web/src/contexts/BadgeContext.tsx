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
import type { Socket } from 'socket.io-client';
import { getAuthToken } from '@pantopus/api';
import * as api from '@pantopus/api';
import { useSocket, useSocketConnected } from '@/contexts/SocketContext';

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
  connected: false,
  socket: null,
  setUnreadMessages: () => {},
  setTotalMessages: () => {},
});

// ── Provider ─────────────────────────────────────────────────
const FALLBACK_POLL_MS = 5_000; // 5 seconds

export function BadgeProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const connected = useSocketConnected();
  const [counts, setCounts] = useState<BadgeCounts>(defaultCounts);
  const fallbackRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Fallback polling when socket is disconnected
  const pollBadges = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const [notifRes, chatRes, offersRes] = await Promise.allSettled([
        api.notifications.getUnreadCount({ suppressDevErrorOverlay: true }),
        api.chat.getChatStats({ suppressDevErrorOverlay: true }),
        api.gigs.getReceivedOffers(undefined, { suppressDevErrorOverlay: true }),
      ]);

      const notifPayload =
        notifRes.status === 'fulfilled'
          ? (notifRes.value as {
              count?: number;
              total?: number;
              byContext?: { personal?: number; audience?: number; platform?: number };
            })
          : null;
      const notifications = notifPayload?.total ?? notifPayload?.count ?? 0;
      const notificationsByContext = {
        personal: Number(notifPayload?.byContext?.personal ?? 0) || 0,
        audience: Number(notifPayload?.byContext?.audience ?? 0) || 0,
        platform: Number(notifPayload?.byContext?.platform ?? 0) || 0,
      };
      const unreadMessages =
        chatRes.status === 'fulfilled'
          ? (chatRes.value as { stats?: { total_unread?: number } })?.stats?.total_unread ?? 0
          : 0;
      const totalMessages =
        chatRes.status === 'fulfilled'
          ? (chatRes.value as { stats?: { total_messages?: number } })?.stats?.total_messages ?? 0
          : 0;
      const pendingOffers =
        offersRes.status === 'fulfilled'
          ? ((offersRes.value as { offers?: { status?: string }[] })?.offers || []).filter(
              (o: { status?: string }) => o.status === 'pending',
            ).length
          : 0;

      setCounts({
        unreadMessages,
        totalMessages,
        pendingOffers,
        notifications,
        notificationsByContext,
      });
    } catch {
      // silent
    }
  }, []);

  const setUnreadMessages = useCallback((value: number | ((prev: number) => number)) => {
    setCounts((prev) => {
      const nextValue = typeof value === 'function' ? value(prev.unreadMessages) : value;
      return { ...prev, unreadMessages: Math.max(0, Number(nextValue) || 0) };
    });
  }, []);

  const setTotalMessages = useCallback((value: number | ((prev: number) => number)) => {
    setCounts((prev) => {
      const nextValue = typeof value === 'function' ? value(prev.totalMessages) : value;
      return { ...prev, totalMessages: Math.max(0, Number(nextValue) || 0) };
    });
  }, []);

  const startFallbackPolling = useCallback(() => {
    if (fallbackRef.current) clearInterval(fallbackRef.current);
    pollBadges();
    fallbackRef.current = setInterval(pollBadges, FALLBACK_POLL_MS);
  }, [pollBadges]);

  const stopFallbackPolling = useCallback(() => {
    if (fallbackRef.current) {
      clearInterval(fallbackRef.current);
      fallbackRef.current = undefined;
    }
  }, []);

  // Listen for badge:update from the shared socket
  useEffect(() => {
    if (!socket) return;

    const handleBadgeUpdate = (data: Partial<BadgeCounts>) => {
      setCounts((prev) => ({
        ...prev,
        unreadMessages: Number(data?.unreadMessages ?? prev.unreadMessages) || 0,
        totalMessages: Number(data?.totalMessages ?? prev.totalMessages) || 0,
        pendingOffers: Number(data?.pendingOffers ?? prev.pendingOffers) || 0,
        notifications: Number(data?.notifications ?? prev.notifications) || 0,
        // The socket contract may not yet emit byContext. Keep the prior
        // per-context counts so the megaphone badge doesn't flicker to
        // zero between socket updates and the next /unread-count poll.
        notificationsByContext: data?.notificationsByContext
          ? {
              personal: Number(data.notificationsByContext.personal ?? prev.notificationsByContext.personal) || 0,
              audience: Number(data.notificationsByContext.audience ?? prev.notificationsByContext.audience) || 0,
              platform: Number(data.notificationsByContext.platform ?? prev.notificationsByContext.platform) || 0,
            }
          : prev.notificationsByContext,
      }));
    };

    socket.on('badge:update', handleBadgeUpdate);
    return () => {
      socket.off('badge:update', handleBadgeUpdate);
    };
  }, [socket]);

  // Manage fallback polling based on connection state
  useEffect(() => {
    if (connected) {
      stopFallbackPolling();
    } else {
      startFallbackPolling();
    }
    return () => stopFallbackPolling();
  }, [connected, startFallbackPolling, stopFallbackPolling]);

  // Initial poll so we have counts immediately
  useEffect(() => {
    pollBadges();
  }, [pollBadges]);

  const contextValue = useMemo(
    () => ({ ...counts, connected, socket, setUnreadMessages, setTotalMessages }),
    [counts, connected, socket, setUnreadMessages, setTotalMessages],
  );

  return (
    <BadgeContext.Provider value={contextValue}>
      {children}
    </BadgeContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────
export function useBadges(): BadgeContextValue {
  return useContext(BadgeContext);
}
