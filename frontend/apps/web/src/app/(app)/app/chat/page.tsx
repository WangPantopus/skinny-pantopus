'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import Image from 'next/image';
import * as api from '@pantopus/api';
import { formatTimeAgo, getInitials } from '@pantopus/ui-utils';
import { MessageCircle, Search, Home, Users, Wrench, ShoppingCart, Sparkles } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import SearchInput from '@/components/SearchInput';
import { useSocketEvent, useSocketConnected } from '@/hooks/useSocket';
import { useBadges } from '@/contexts/BadgeContext';
import { queryKeys } from '@/lib/query-keys';
import type { UnifiedConversationItem, ConversationTopic, User } from '@pantopus/types';

type IncomingChatMessage = {
  room_id?: string;
  message?: string;
  message_text?: string;
  created_at?: string;
  user_id?: string;
  sender_id?: string;
  sender?: { id?: string };
};

type ConversationsResponse = Awaited<ReturnType<typeof api.chat.getUnifiedConversations>>;

// TODO: Add cursor pagination (50/page) when the backend supports it.
// Today `getUnifiedConversations` only accepts a `limit` param and returns
// everything up to that limit; we request `limit: 200` to match prior behavior.
const CONVERSATIONS_LIMIT = 200;

export default function ChatListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatQuery, setNewChatQuery] = useState('');
  const [newChatResults, setNewChatResults] = useState<User[]>([]);
  const [newChatSearching, setNewChatSearching] = useState(false);
  const [newChatError, setNewChatError] = useState<string | null>(null);
  const [startingChatUserId, setStartingChatUserId] = useState<string | null>(null);
  const connected = useSocketConnected();
  const { setUnreadMessages, setTotalMessages } = useBadges();

  // Refs for batching badge syncs and throttling reload
  const badgeSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReloadTimeRef = useRef(0);
  const activeConversationRoomRef = useRef<string | null>(null);

  // ── Conversations via useQuery ─────────────────────────────
  const conversationsKey = queryKeys.conversations();
  const conversationsQuery = useQuery<ConversationsResponse>({
    queryKey: conversationsKey,
    queryFn: () => api.chat.getUnifiedConversations({ limit: CONVERSATIONS_LIMIT }),
    staleTime: 30_000,
  });

  const conversations = useMemo<UnifiedConversationItem[]>(
    () => conversationsQuery.data?.conversations ?? [],
    [conversationsQuery.data],
  );
  const totalUnread = Number(conversationsQuery.data?.totalUnread || 0);
  const loading = conversationsQuery.isPending;
  const error = conversationsQuery.error
    ? (conversationsQuery.error instanceof Error ? conversationsQuery.error.message : 'Failed to load conversations')
    : null;

  // Shim for imperative refetch calls (fallback polling, reload after new message from unknown room)
  const load = useCallback(async () => {
    await conversationsQuery.refetch();
  }, [conversationsQuery]);

  // ── setQueryData helpers ───────────────────────────────────
  const updateConversations = useCallback(
    (updater: (conversations: UnifiedConversationItem[], totalUnread: number) => {
      conversations: UnifiedConversationItem[];
      totalUnread: number;
    }) => {
      queryClient.setQueryData<ConversationsResponse>(conversationsKey, (old) => {
        if (!old) return old;
        const next = updater(old.conversations || [], Number(old.totalUnread || 0));
        return {
          ...old,
          conversations: next.conversations,
          totalUnread: next.totalUnread,
        };
      });
    },
    [queryClient, conversationsKey],
  );

  // Batch badge syncs: collapse rapid changes into a single BadgeContext update
  useEffect(() => {
    if (badgeSyncTimerRef.current) clearTimeout(badgeSyncTimerRef.current);
    badgeSyncTimerRef.current = setTimeout(() => {
      setUnreadMessages(totalUnread);
      badgeSyncTimerRef.current = null;
    }, 500);
    return () => {
      if (badgeSyncTimerRef.current) clearTimeout(badgeSyncTimerRef.current);
    };
  }, [totalUnread, setUnreadMessages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.users.getMyProfile();
        if (!cancelled) setCurrentUserId(String(me?.id || ''));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (connected) return;
    const timer = setInterval(() => {
      void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [connected, load]);

  useEffect(() => {
    if (!newChatOpen) return;
    const q = newChatQuery.trim();
    if (!q) {
      setNewChatResults([]);
      setNewChatError(null);
      setNewChatSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setNewChatSearching(true);
        setNewChatError(null);
        const resp = await api.users.searchUsers(q, { type: 'people', limit: 8 });
        if (!cancelled) setNewChatResults(resp?.users || []);
      } catch (e: unknown) {
        if (!cancelled) setNewChatError(e instanceof Error ? e.message : 'Failed to search users');
      } finally {
        if (!cancelled) setNewChatSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [newChatOpen, newChatQuery]);

  const handleIncomingListMessage = useCallback((msg: IncomingChatMessage) => {
    if (!msg?.room_id) return;
    const roomId = String(msg.room_id);
    const preview = msg.message || msg.message_text || '';
    const timestamp = msg.created_at || new Date().toISOString();
    const senderId = String(msg.user_id || msg.sender_id || msg?.sender?.id || '');
    const isOwn = !!currentUserId && senderId === String(currentUserId);
    // Don't increment unread for the conversation the user is currently viewing
    // (the useChatMessages hook is already handling it via its own socket listener)
    const isActiveRoom = activeConversationRoomRef.current === roomId;
    let shouldReload = false;
    setTotalMessages((prev) => prev + 1);

    // Reorder and bump the conversation in the cache via setQueryData.
    // The O(n) findIndex + splice + unshift is preserved — just moved here.
    updateConversations((prev, prevTotalUnread) => {
      const idx = prev.findIndex(conv =>
        conv._type === 'room'
          ? String(conv.id) === roomId
          : (conv.room_ids || []).map(String).includes(roomId)
      );

      if (idx === -1) {
        shouldReload = true;
        return { conversations: prev, totalUnread: prevTotalUnread };
      }

      const updated = [...prev];
      const conv = { ...updated[idx] };
      conv.last_message_preview = String(preview);
      conv.last_message_at = timestamp;
      if (!isOwn && !isActiveRoom) conv.total_unread = (conv.total_unread || 0) + 1;

      // Move to top
      updated.splice(idx, 1);
      updated.unshift(conv as UnifiedConversationItem);
      return {
        conversations: updated,
        totalUnread: (!isOwn && !isActiveRoom) ? prevTotalUnread + 1 : prevTotalUnread,
      };
    });
    // Throttle full reload to at most once per 10 seconds
    if (shouldReload) {
      const now = Date.now();
      if (now - lastReloadTimeRef.current >= 10000) {
        lastReloadTimeRef.current = now;
        void load();
      }
    }
  }, [currentUserId, load, setTotalMessages, updateConversations]);

  // ── Real-time: update conversation list when a new message arrives ──
  useSocketEvent('message:new', handleIncomingListMessage);
  useSocketEvent('newMessage', handleIncomingListMessage);

  const getLastMessagePreview = (conv: UnifiedConversationItem) => {
    const raw = conv?.last_message_preview ?? '';
    if (/^\[[^\]]*attachment\]$/i.test(String(raw).trim())) return 'Media';
    return raw;
  };

  const handleConversationPress = (conv: UnifiedConversationItem) => {
    const unread = Number(conv.total_unread || 0);
    if (unread > 0) {
      updateConversations((prev, prevTotalUnread) => ({
        conversations: prev.map((item) => {
          const sameConv = item._type === 'room' && conv._type === 'room'
            ? String(item.id) === String(conv.id)
            : item._type === 'conversation' && conv._type === 'conversation'
            ? String(item.other_participant_id) === String(conv.other_participant_id)
            : false;
          return sameConv ? { ...item, total_unread: 0 } : item;
        }),
        totalUnread: Math.max(0, prevTotalUnread - unread),
      }));
    }

    if (conv._type === 'room') {
      void api.chat.markMessagesAsRead(String(conv.id)).catch(() => {});
      router.push(`/app/chat/${conv.id}`);
    } else {
      void api.chat.markConversationAsRead(String(conv.other_participant_id)).catch(() => {});
      router.push(`/app/chat/conversation/${conv.other_participant_id}`);
    }
  };

  const openNewChat = () => {
    setNewChatOpen(true);
    setNewChatQuery('');
    setNewChatResults([]);
    setNewChatSearching(false);
    setNewChatError(null);
    setStartingChatUserId(null);
  };

  const startDirectChat = async (user: User) => {
    const userId = String(user?.id || '');
    if (!userId) return;
    try {
      setStartingChatUserId(userId);
      await api.chat.createDirectChat(userId);
      setNewChatOpen(false);
      router.push(`/app/chat/conversation/${userId}`);
    } catch (e: unknown) {
      setNewChatError(e instanceof Error ? e.message : 'Unable to start chat');
    } finally {
      setStartingChatUserId(null);
    }
  };

  const filteredConversations = useMemo(() => conversations.filter((conv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const isRoom = conv._type === 'room';
    const name = isRoom
      ? (conv.room_name || '').toLowerCase()
      : (conv.other_participant_name || conv.other_participant_username || '').toLowerCase();
    const preview = (conv.last_message_preview || '').toLowerCase();
    const topicTitles = (conv.topics || []).map((t: ConversationTopic) => (t.title || '').toLowerCase()).join(' ');
    return name.includes(q) || preview.includes(q) || topicTitles.includes(q);
  }), [conversations, search]);

  // ── Virtualize conversation list ──────────────────────────
  const listScrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredConversations.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
  ];
  const getColor = (name: string) => {
    const idx = name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % colors.length;
    return colors[idx];
  };

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <PageHeader
          title="Messages"
          subtitle={totalUnread > 0 ? `${totalUnread} unread` : `${conversations.length} conversations`}
          ctaLabel="New message"
          ctaOnClick={openNewChat}
        >
          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search conversations…"
              className="max-w-sm flex-1"
            />
            <button
              onClick={load}
              className="px-3 py-2 rounded-lg border border-app text-sm text-app hover-bg-app transition"
            >
              Refresh
            </button>
          </div>
        </PageHeader>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button onClick={load} className="ml-2 underline font-medium">Try again</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-surface rounded-xl border border-app p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-surface-muted" />
                  <div className="flex-1">
                    <div className="h-4 bg-surface-muted rounded w-1/3 mb-2" />
                    <div className="h-3 bg-surface-muted rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-app shadow-sm p-10 text-center mt-4">
            <div className="mb-3 flex justify-center"><MessageCircle className="w-10 h-10 text-app-muted" /></div>
            <div className="text-app font-semibold text-lg">No messages yet</div>
            <div className="text-sm text-app-text-secondary mt-1">
              Messages will appear here when you chat about tasks, listings, or anything else.
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-app shadow-sm p-10 text-center mt-4">
            <div className="mb-3 flex justify-center"><Search className="w-8 h-8 text-app-muted" /></div>
            <div className="text-app font-semibold text-lg">No matches</div>
            <div className="text-sm text-app-text-secondary mt-1">No conversations match &ldquo;{search}&rdquo;</div>
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-app shadow-sm overflow-hidden">
            {/* Pinned AI Assistant entry (outside the virtualized list) */}
            <button
              onClick={() => router.push('/app/chat/ai-assistant')}
              className="w-full text-left px-4 py-3 hover:bg-violet-50/60 transition-colors bg-gradient-to-r from-violet-50/40 to-transparent border-b border-app"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">Pantopus Assistant</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold uppercase tracking-wide">AI</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">Draft gigs, listings, posts &amp; more with AI</p>
                </div>
              </div>
            </button>

            {/* Virtualized conversation list */}
            <div
              ref={listScrollRef}
              className="overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 280px)' }}
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const conv = filteredConversations[virtualRow.index];
                  const isRoom = conv._type === 'room';
                  const isHome = conv._type === 'room' && conv.room_type === 'home';

                  // Name + avatar
                  const title = isRoom
                    ? (conv.room_name || (isHome ? 'Home Chat' : 'Group Chat'))
                    : (conv.other_participant_name || conv.other_participant_username || 'Chat');
                  const avatarUrl = !isRoom ? conv.other_participant_avatar : null;
                  const preview = getLastMessagePreview(conv) || '';
                  const timeStr = conv.last_message_at ? formatTimeAgo(conv.last_message_at, 'full') : '';
                  const unread = conv.total_unread || 0;
                  // messageCount removed — per-room count queries were an N+1 bottleneck
                  const topics: ConversationTopic[] = conv.topics || [];
                  const initials = getInitials(title);

                  return (
                    <div
                      key={isRoom ? conv.id : conv.other_participant_id}
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
                      <button
                        onClick={() => handleConversationPress(conv)}
                        className={`w-full text-left px-4 py-3 hover-bg-app transition-colors border-b border-app ${unread > 0 ? 'bg-blue-50/40' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          {isRoom ? (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${isHome ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                              {isHome ? <Home className="w-5 h-5 text-amber-600" /> : <Users className="w-5 h-5 text-emerald-600" />}
                            </div>
                          ) : avatarUrl ? (
                            <Image src={avatarUrl} alt={title} width={48} height={48} sizes="48px" quality={75} className="w-12 h-12 rounded-full object-cover flex-shrink-0 bg-surface-muted" />
                          ) : (
                            <div className={`w-12 h-12 rounded-full ${getColor(title)} text-white flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                              {initials}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            {/* Name + time */}
                            <div className="flex items-center justify-between gap-2">
                              <div className={`truncate ${unread > 0 ? 'font-bold text-app' : 'font-semibold text-app'}`}>
                                {title}
                              </div>
                              <div className={`text-xs flex-shrink-0 ${unread > 0 ? 'text-primary-600 font-semibold' : 'text-app-muted'}`}>
                                {timeStr}
                              </div>
                            </div>

                            {/* Preview + message count + unread badge */}
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <div className={`text-sm truncate ${unread > 0 ? 'text-app-text-strong font-medium' : 'text-app-text-secondary'}`}>
                                {preview || 'No messages yet'}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {unread > 0 && (
                                  <div className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                                    {unread > 99 ? '99+' : unread}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Topic chips */}
                            {topics.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1.5 overflow-hidden">
                                {topics.slice(0, 2).map((topic: ConversationTopic) => (
                                  <span
                                    key={topic.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-muted text-[11px] text-app-text-secondary max-w-[140px] truncate"
                                  >
                                    {topic.topic_type === 'task' ? <Wrench className="w-3 h-3" /> : <ShoppingCart className="w-3 h-3" />}
                                    <span className="truncate">{topic.title}</span>
                                  </span>
                                ))}
                                {topics.length > 2 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-muted text-[11px] text-app-text-secondary">
                                    +{topics.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {newChatOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-start justify-center p-4 sm:p-6">
          <div className="w-full max-w-lg rounded-2xl border border-app bg-surface shadow-2xl mt-8">
            <div className="flex items-center justify-between px-4 py-3 border-b border-app">
              <div>
                <h2 className="text-base font-semibold text-app">Start new chat</h2>
                <p className="text-xs text-app-muted">Search by name or username</p>
              </div>
              <button
                onClick={() => setNewChatOpen(false)}
                className="p-1.5 rounded-lg hover-bg-app text-app-muted hover:text-app"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              <SearchInput
                value={newChatQuery}
                onChange={setNewChatQuery}
                placeholder="Type a person's name…"
              />

              {newChatError && (
                <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {newChatError}
                </div>
              )}

              <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-app divide-y divide-app">
                {!newChatQuery.trim() ? (
                  <div className="p-4 text-sm text-app-muted">Start typing to find people.</div>
                ) : newChatSearching ? (
                  <div className="p-4 text-sm text-app-muted">Searching…</div>
                ) : newChatResults.length === 0 ? (
                  <div className="p-4 text-sm text-app-muted">No users found.</div>
                ) : (
                  newChatResults.map((u) => {
                    const uid = String(u?.id || '');
                    const name = u.name || u.firstName || u.username || 'User';
                    const username = u?.username ? `@${u.username}` : '';
                    const avatar = u?.profile_picture_url;
                    const initials = name
                      .split(' ')
                      .map((w: string) => w[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    const isStarting = startingChatUserId === uid;

                    return (
                      <button
                        key={uid}
                        onClick={() => startDirectChat(u)}
                        disabled={isStarting}
                        className="w-full px-3 py-2.5 text-left hover-bg-app transition disabled:opacity-70"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {avatar ? (
                              <Image src={avatar} alt={name} width={36} height={36} sizes="36px" quality={75} className="w-9 h-9 rounded-full object-cover bg-surface-muted" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-semibold">
                                {initials || 'U'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-app truncate">{name}</div>
                              <div className="text-xs text-app-muted truncate">{username}</div>
                            </div>
                          </div>
                          <span className="text-xs font-medium text-primary-600">
                            {isStarting ? 'Opening…' : 'Chat'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
