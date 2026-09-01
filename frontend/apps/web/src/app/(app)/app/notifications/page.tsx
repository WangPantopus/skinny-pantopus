'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { formatTimeAgo as timeAgo } from '@pantopus/ui-utils';
import { useSocket } from '@/contexts/SocketContext';
import { useBadges } from '@/contexts/BadgeContext';
import { useFeatureFlagState } from '@/hooks/useFeatureFlag';
import { queryKeys } from '@/lib/query-keys';
import { resolveWebNotificationPath } from '@/lib/notificationRoutes';
import type { Notification } from '@pantopus/types';
import NotificationRow from './NotificationRow';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type Filter = 'all' | 'unread' | 'read';
/**
 * Firewall zone tab on the notifications page (P2.3 / unified-IA §6.1).
 * Personal-zone tab covers personal+platform; Audience-zone tab covers
 * audience only. Two streams, never combined.
 */
type ZoneTab = 'personal' | 'audience';

type ApiNotificationsPage = Awaited<ReturnType<typeof api.notifications.getNotifications>>;
type NotificationPageParam = { all: number; personal: number; platform: number; audience: number };
type NotificationsPage = ApiNotificationsPage & { nextPageParam?: NotificationPageParam };

const LIMIT = 30;
const INITIAL_PAGE_PARAM: NotificationPageParam = { all: 0, personal: 0, platform: 0, audience: 0 };

function isZoneTab(value: string | null | undefined): value is ZoneTab {
  return value === 'personal' || value === 'audience';
}

export default function NotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { notificationsByContext } = useBadges();
  const audienceFlag = useFeatureFlagState('audience_profile');

  const [filter, setFilter] = useState<Filter>('all');
  const requestedContext = searchParams?.get('context') ?? null;
  const hasExplicitZone = isZoneTab(requestedContext);
  const showAudienceZone = audienceFlag.enabled || requestedContext === 'audience';
  const useScopedZones = showAudienceZone || hasExplicitZone;
  const initialZone: ZoneTab = hasExplicitZone ? (requestedContext as ZoneTab) : 'personal';
  const [zone, setZone] = useState<ZoneTab>(initialZone);
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);

  // Auth guard
  useEffect(() => {
    if (!getAuthToken()) router.push('/login');
  }, [router]);

  // Reflect zone into the URL so deep-links and back/forward navigation
  // keep the right tab selected.
  useEffect(() => {
    if (!useScopedZones) return;
    const current = searchParams?.get('context') ?? null;
    if (current === zone) return;
    const params = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);
    params.set('context', zone);
    router.replace(`/app/notifications?${params.toString()}`);
  }, [useScopedZones, zone, router, searchParams]);

  // If the audience zone disappears while selected, fall back to personal.
  useEffect(() => {
    if (audienceFlag.isFetched && !showAudienceZone && zone === 'audience') {
      setZone('personal');
    }
  }, [audienceFlag.isFetched, showAudienceZone, zone]);

  // Query key for this filter combo — filter + zone segment the cache.
  // `infinite` segment avoids stale cache from an old prefetchQuery that
  // stored a flat API payload.
  const notifKey = useMemo(() => [...queryKeys.notifications(), 'infinite', filter, useScopedZones ? zone : 'all'] as const, [filter, useScopedZones, zone]);

  // ── Notifications list: useInfiniteQuery (30 per page) ──────
  const notifQuery = useInfiniteQuery<NotificationsPage, Error, InfiniteData<NotificationsPage>, typeof notifKey, NotificationPageParam>({
    queryKey: notifKey,
    initialPageParam: INITIAL_PAGE_PARAM,
    queryFn: async ({ pageParam }) => {
      const baseParams = {
        limit: LIMIT,
        ...(filter === 'unread' ? { unread: true as const } : {}),
      };
      if (!useScopedZones) {
        const res = await api.notifications.getNotifications({
          ...baseParams,
          offset: pageParam.all,
        });
        return {
          ...res,
          nextPageParam: {
            ...pageParam,
            all: pageParam.all + (res.notifications?.length || 0),
          },
        };
      }
      if (zone === 'audience') {
        const res = await api.notifications.getNotifications({
          ...baseParams,
          offset: pageParam.audience,
          context: 'audience',
        });
        return {
          ...res,
          nextPageParam: {
            ...pageParam,
            audience: pageParam.audience + (res.notifications?.length || 0),
          },
        };
      }
      // Personal-zone tab = personal + platform notifications. The route
      // accepts a single firewall value, so fan out and merge client-side.
      const [personalRes, platformRes] = await Promise.all([
        api.notifications.getNotifications({
          ...baseParams,
          offset: pageParam.personal,
          context: 'personal',
        }),
        api.notifications.getNotifications({
          ...baseParams,
          offset: pageParam.platform,
          context: 'platform',
        }),
      ]);
      const seen = new Set<string>();
      const merged: Notification[] = [];
      for (const n of [...personalRes.notifications, ...platformRes.notifications]) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        merged.push(n);
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return {
        notifications: merged,
        unreadCount: (personalRes.unreadCount || 0) + (platformRes.unreadCount || 0),
        hasMore: Boolean(personalRes.hasMore || platformRes.hasMore),
        nextPageParam: {
          ...pageParam,
          personal: pageParam.personal + (personalRes.notifications?.length || 0),
          platform: pageParam.platform + (platformRes.notifications?.length || 0),
        },
      };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.hasMore) return undefined;
      return lastPage.nextPageParam;
    },
    staleTime: 30_000,
  });

  // Derived state (preserves the useState shape consumed by the JSX below)
  const notifications = useMemo<Notification[]>(() => {
    const pages = notifQuery.data?.pages ?? [];
    const seen = new Set<string>();
    const out: Notification[] = [];
    for (const page of pages) {
      for (const n of page?.notifications || []) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        out.push(n);
      }
    }
    return out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [notifQuery.data]);

  const loading = notifQuery.isPending;
  const loadingMore = notifQuery.isFetchingNextPage;
  const hasMore = notifQuery.hasNextPage ?? false;

  // Cache mutation helpers
  const mutateNotifications = useCallback(
    (updater: (n: Notification) => Notification) => {
      queryClient.setQueryData<InfiniteData<NotificationsPage>>(notifKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            notifications: (page.notifications || []).map(updater),
          })),
        };
      });
    },
    [queryClient, notifKey]
  );

  const removeNotification = useCallback(
    (predicate: (n: Notification) => boolean) => {
      queryClient.setQueryData<InfiniteData<NotificationsPage>>(notifKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            notifications: (page.notifications || []).filter((n) => !predicate(n)),
          })),
        };
      });
    },
    [queryClient, notifKey]
  );

  const prependNotification = useCallback(
    (notif: Notification) => {
      queryClient.setQueryData<InfiniteData<NotificationsPage>>(notifKey, (old) => {
        if (!old) return old;
        // Dedupe — check all pages to avoid duplicate entries from socket + refetch races
        for (const page of old.pages) {
          if ((page.notifications || []).some((n) => n.id === notif.id)) return old;
        }
        const [firstPage, ...rest] = old.pages;
        if (!firstPage) return old;
        return {
          ...old,
          pages: [{ ...firstPage, notifications: [notif, ...(firstPage.notifications || [])] }, ...rest],
        };
      });
    },
    [queryClient, notifKey]
  );

  const notificationMatchesZone = useCallback(
    (notif: Notification) => {
      if (!useScopedZones) return true;
      const context = notif.context || 'personal';
      return zone === 'audience' ? context === 'audience' : context === 'personal' || context === 'platform';
    },
    [useScopedZones, zone]
  );

  // Listen for real-time notification:new from socket
  useEffect(() => {
    if (!socket) return;
    const handleNewNotification = (notif: Notification) => {
      if (!notificationMatchesZone(notif)) return;
      prependNotification(notif);
    };
    socket.on('notification:new', handleNewNotification);
    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket, prependNotification, notificationMatchesZone]);

  const handleNotificationClick = useCallback(
    async (notif: Notification) => {
      // Mark as read
      if (!notif.is_read) {
        try {
          await api.notifications.markAsRead(notif.id);
          mutateNotifications((n) => (n.id === notif.id ? { ...n, is_read: true } : n));
        } catch {}
      }

      // If has a link, navigate directly through authenticated app routes when available.
      if (notif.link) {
        router.push(resolveWebNotificationPath(notif.link) || notif.link);
      } else {
        setSelectedNotif(notif);
      }
    },
    [router, mutateNotifications]
  );

  const handleMarkAllRead = async () => {
    try {
      const readScope: api.notifications.NotificationReadScope = !useScopedZones ? { context: 'all' } : zone === 'audience' ? { context: 'audience' } : { contexts: ['personal', 'platform'] };
      await api.notifications.markAllAsRead(readScope);
      mutateNotifications((n) => ({ ...n, is_read: true }));
    } catch {}
  };

  const handleDelete = useCallback(
    async (notifId: string) => {
      try {
        await api.notifications.deleteNotification(notifId);
        removeNotification((n) => n.id === notifId);
        setSelectedNotif((prev) => (prev?.id === notifId ? null : prev));
      } catch {}
    },
    [removeNotification]
  );

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  // Filter locally for "read" since API only supports "unread" filter
  const displayedNotifications = useMemo(() => (filter === 'read' ? notifications.filter((n) => n.is_read) : notifications), [filter, notifications]);

  // Group by date (memoized — was being recomputed every render)
  const grouped = useMemo(() => groupByDate(displayedNotifications), [displayedNotifications]);

  // Flatten groups into a single (Header | Notification)[] array for virtualization.
  // Each date-group header becomes a single "header" virtual item that sits above
  // its group's notifications.
  type FlatItem =
    | { type: 'header'; label: string; key: string }
    | {
        type: 'notification';
        notif: Notification;
        groupLabel: string;
        isFirst: boolean;
        isLast: boolean;
      };

  const flatItems = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = [];
    for (const group of grouped) {
      out.push({ type: 'header', label: group.label, key: `header:${group.label}` });
      group.items.forEach((notif, i) => {
        out.push({
          type: 'notification',
          notif,
          groupLabel: group.label,
          isFirst: i === 0,
          isLast: i === group.items.length - 1,
        });
      });
    }
    return out;
  }, [grouped]);

  // ── Virtualize flat list ──────────────────────────────────
  const listScrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: (index) => (flatItems[index]?.type === 'header' ? 36 : 84),
    overscan: 8,
  });

  // Shim for load-more button onClick
  const loadNotifications = useCallback(
    (_reset = false) => {
      if (_reset) void notifQuery.refetch();
      else void notifQuery.fetchNextPage();
    },
    [notifQuery]
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-app-text">Notifications</h1>
          <p className="text-sm text-app-text-secondary mt-0.5">{unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition">
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Zone tabs appear only when the page is explicitly scoped. Without
          them, /app/notifications remains the legacy all-context feed. */}
      {useScopedZones ? (
        <div role="tablist" aria-label="Notification zone" className="mb-4 flex gap-1 border-b border-app-border-subtle" data-testid="notifications-zone-tabs">
          <button role="tab" type="button" aria-selected={zone === 'personal'} data-testid="zone-tab-personal" data-zone="personal" data-active={zone === 'personal' ? 'true' : 'false'} onClick={() => setZone('personal')} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${zone === 'personal' ? 'border-blue-600 text-blue-700' : 'border-transparent text-app-text-secondary hover:text-app-text'}`}>
            Personal
            {notificationsByContext.personal + notificationsByContext.platform > 0 ? <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{notificationsByContext.personal + notificationsByContext.platform}</span> : null}
          </button>
          {showAudienceZone ? (
            <button role="tab" type="button" aria-selected={zone === 'audience'} data-testid="zone-tab-audience" data-zone="audience" data-active={zone === 'audience' ? 'true' : 'false'} onClick={() => setZone('audience')} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${zone === 'audience' ? 'border-teal-600 text-teal-700' : 'border-transparent text-app-text-secondary hover:text-app-text'}`}>
              Audience
              {notificationsByContext.audience > 0 ? <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">{notificationsByContext.audience}</span> : null}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Read/unread sub-filter (within the selected zone) */}
      <div className="flex items-center gap-1 mb-4">
        {(['all', 'unread', 'read'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition capitalize ${filter === f ? 'bg-gray-900 text-white' : 'text-app-text-secondary hover:bg-app-hover'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Detail panel (right side overlay on mobile, inline on desktop) */}
      {selectedNotif && (
        <div className="mb-4 bg-app-surface rounded-xl border border-app-border p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{selectedNotif.icon || '🔔'}</span>
              <div>
                <h2 className="text-base font-semibold text-app-text">{selectedNotif.title}</h2>
                <p className="text-xs text-app-text-muted mt-0.5">{formatDate(selectedNotif.created_at)}</p>
              </div>
            </div>
            <button onClick={() => setSelectedNotif(null)} className="p-1.5 hover:bg-app-hover rounded-lg transition text-app-text-muted hover:text-app-text-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {selectedNotif.body && <p className="text-sm text-app-text-strong leading-relaxed whitespace-pre-wrap">{selectedNotif.body}</p>}

          {selectedNotif.link && (
            <button onClick={() => router.push(resolveWebNotificationPath(selectedNotif.link) || selectedNotif.link!)} className="mt-4 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition">
              View Details →
            </button>
          )}

          <div className="mt-4 pt-3 border-t border-app-border-subtle flex items-center gap-3">
            <span className="text-xs text-app-text-muted capitalize">Type: {selectedNotif.type?.replace(/_/g, ' ')}</span>
            <button onClick={() => handleDelete(selectedNotif.id)} className="text-xs text-red-500 hover:text-red-700 font-medium ml-auto">
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Notification list */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-600 mx-auto" />
          <p className="mt-4 text-sm text-app-text-secondary">Loading notifications...</p>
        </div>
      ) : displayedNotifications.length === 0 ? (
        <div className="text-center py-16 bg-app-surface rounded-xl border border-app-border">
          <div className="text-5xl mb-3">🔔</div>
          <h3 className="text-lg font-semibold text-app-text mb-1">{filter === 'unread' ? 'No unread notifications' : filter === 'read' ? 'No read notifications' : 'No notifications yet'}</h3>
          <p className="text-sm text-app-text-secondary">{filter === 'all' ? "We'll notify you when something happens." : 'Try a different filter.'}</p>
        </div>
      ) : (
        <div>
          <div ref={listScrollRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = flatItems[virtualRow.index];
                return (
                  <div
                    key={item.type === 'header' ? item.key : item.notif.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {item.type === 'header' ? (
                      <h3 className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2 px-1 pt-4 first:pt-0">{item.label}</h3>
                    ) : (
                      <div className={`bg-app-surface border-l border-r border-app-border ${item.isFirst ? 'rounded-t-xl border-t' : ''} ${item.isLast ? 'rounded-b-xl border-b mb-4' : 'border-b border-b-app-border-subtle'} overflow-hidden`}>
                        <NotificationRow notif={item.notif} isSelected={selectedNotif?.id === item.notif.id} onClick={handleNotificationClick} onDelete={handleDelete} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="text-center py-3">
              <button onClick={() => loadNotifications(false)} disabled={loadingMore} className="px-4 py-2 text-sm font-medium text-app-text-secondary hover:text-app-text hover:bg-app-hover rounded-lg transition disabled:opacity-50">
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Group notifications by date
function groupByDate(notifications: Notification[]) {
  const groups: { label: string; items: Notification[] }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const buckets: Record<string, Notification[]> = {};

  for (const notif of notifications) {
    const d = new Date(notif.created_at);
    d.setHours(0, 0, 0, 0);
    let label: string;

    if (d >= today) {
      label = 'Today';
    } else if (d >= yesterday) {
      label = 'Yesterday';
    } else if (d >= weekAgo) {
      label = 'This Week';
    } else {
      label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    if (!buckets[label]) buckets[label] = [];
    buckets[label].push(notif);
  }

  for (const [label, items] of Object.entries(buckets)) {
    groups.push({ label, items });
  }

  return groups;
}
