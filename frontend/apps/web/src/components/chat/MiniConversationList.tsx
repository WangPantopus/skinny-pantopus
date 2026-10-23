'use client';

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { UnifiedConversationItem, ConversationTopic } from '@pantopus/types';
import { getInitials } from '@pantopus/ui-utils';
import { useSocketEvent } from '../../hooks/useSocket';
import { launchFeatures } from '@/lib/featureFlags';
import { chosenUsername } from '@pantopus/utils';
import { conversationsQuery, conversationKey, compareConversationTime, useConversationPages, type ConversationsReply } from '@/lib/conversations';
import { useMe } from '@/lib/me';

interface MiniConversationListProps {
  onSelectConversation: (chat: {
    roomId?: string;
    otherUserId?: string;
    name: string;
    avatar?: string;
  }) => void;
}

/** Compact relative time (e.g. "now", "3m", "2h", "Yesterday", "Jan 5") */
function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MiniConversationList({ onSelectConversation }: MiniConversationListProps) {
  // The same Messages list the Messages page shows (lib/conversations.ts):
  // opening the widget again shows it at once and refreshes quietly.
  const queryClient = useQueryClient();
  const pages = useConversationPages();
  const listQuery = pages.query;
  const conversations = pages.conversations;
  const loading = listQuery.isPending;
  const error = listQuery.isError && !listQuery.data ? 'Failed to load conversations' : null;
  const fetchConversations = useCallback(() => { void listQuery.refetch(); }, [listQuery]);
  const myId = useMe().data?.id;
  const seenEvents = useRef(new Set<string>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({ count: conversations.length, getScrollElement: () => scrollRef.current,
    getItemKey: (index) => conversationKey(conversations[index]), estimateSize: () => 80, overscan: 5 });

  // Real-time: when a new message arrives, update preview and bump to top.
  // (The widget is never open on /app/chat, whose page applies the same update.)
  useSocketEvent('message:new', useCallback((msg: Record<string, any>) => {
    if (!myId || !msg?.room_id || !msg.id || seenEvents.current.has(String(msg.id))) return;
    seenEvents.current.add(String(msg.id));
    if (seenEvents.current.size > 1000) seenEvents.current.delete(seenEvents.current.values().next().value!);
    const roomId = String(msg.room_id);
    const msgText = (msg.preview as string) || (msg.message_text as string) || (msg.message as string) || '';
    const createdAt = (msg.created_at as string) || new Date().toISOString();
    // Your own messages (sent from another tab or device) are never unread.
    const senderId = String(msg.user_id || msg.sender_id || msg?.sender?.id || '');
    const isOwn = !!myId && senderId === String(myId);

    let shouldReload = false;
    queryClient.setQueryData<ConversationsReply>(conversationsQuery().queryKey, (old) => {
      if (!old) return old;
      const prev = (old.conversations || []) as UnifiedConversationItem[];
      const idx = prev.findIndex(conv =>
        conv._type === 'room'
          ? String(conv.id) === roomId
          : String(conv.other_participant_id) === msg.other_user_id || (conv.room_ids || []).map(String).includes(roomId)
      );

      if (idx === -1) {
        shouldReload = true;
        return old;
      }

      const updated = { ...prev[idx] };
      if (!updated.last_message_at || compareConversationTime(createdAt, updated.last_message_at) >= 0) {
        updated.last_message_preview = msgText.substring(0, 100) || '[Attachment]';
        updated.last_message_at = createdAt;
      }
      const oldUnread = Number(updated.total_unread) || 0;
      updated.total_unread = typeof msg.unread_for === 'number' ? msg.unread_for : oldUnread + (isOwn ? 0 : 1);
      if (updated._type !== 'room') updated.room_ids = [...new Set([...(updated.room_ids || []), roomId])];

      return {
        ...old,
        conversations: prev.map((conversation, index) => index === idx ? updated : conversation)
          .sort((a, b) => compareConversationTime(b.last_message_at, a.last_message_at)),
        totalUnread: Math.max(0, Number(old.totalUnread || 0) + updated.total_unread - oldUnread),
      };
    });

    if (shouldReload) {
      void queryClient.invalidateQueries({ queryKey: conversationsQuery().queryKey });
    }
  }, [queryClient, myId]));

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-app-muted">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3">
        <div className="text-sm text-red-600">{error}</div>
        <button
          type="button"
          onClick={fetchConversations}
          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-3xl mb-2">💬</div>
          <div className="text-sm text-app-text-secondary">No conversations yet</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain" aria-label="Conversations panel" tabIndex={0}>
      <div style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => {
        const conv = conversations[row.index];
        const isRoom = conv._type === 'room';
        const isHome = isRoom && conv.room_type === 'home';

        const title = isRoom
          ? (conv.room_name || (isHome ? 'Home Chat' : 'Group Chat'))
          : (conv.other_participant_name || chosenUsername(conv.other_participant_username) || 'Chat');
        const avatarUrl = !isRoom ? conv.other_participant_avatar : null;
        const preview = conv.last_message_preview || '';
        const lastMessageAt = conv.last_message_at || null;
        const unread = conv.total_unread || 0;
        const isUnread = unread > 0;
        // Launch cut #3 (Marketplace): listing topic chips are not shown.
        const topics: ConversationTopic[] = (conv.topics || []).filter((t: ConversationTopic) => launchFeatures.marketplace || t.topic_type !== 'listing');
        const key = isRoom ? String(conv.id) : String(conv.other_participant_id);

        return (
          <button
            key={key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{ position: 'absolute', top: 0, left: 0, transform: `translateY(${row.start}px)` }}
            type="button"
            onClick={() => {
              if (isRoom) {
                onSelectConversation({
                  roomId: String(conv.id),
                  name: title,
                  avatar: undefined,
                });
              } else {
                onSelectConversation({
                  otherUserId: String(conv.other_participant_id),
                  name: title,
                  avatar: conv.other_participant_avatar || undefined,
                });
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-muted transition-colors text-left"
          >
            {/* Avatar */}
            {isRoom ? (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                isHome ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
              }`}>
                {isHome ? '🏠' : getInitials(title)}
              </div>
            ) : avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-blue-600 text-white">
                {getInitials(title)}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-sm truncate ${isUnread ? 'font-semibold text-app' : 'font-medium text-app'}`}>
                  {title}
                </span>
                <span className="text-[10px] text-app-muted flex-shrink-0 ml-2">
                  {timeAgo(lastMessageAt)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className={`text-xs truncate ${isUnread ? 'text-app-text-strong' : 'text-app-text-secondary'}`}>
                  {(/^\[[^\]]*attachment\]$/i.test(preview.trim()) ? 'Media' : preview) || 'No messages'}
                </span>
                {isUnread && (
                  <span className="ml-2 flex-shrink-0 w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>
              {/* Topic chips (compact) */}
              {topics.length > 0 && (
                <div className="flex items-center gap-1 mt-1 overflow-hidden">
                  {topics.slice(0, 2).map((topic: ConversationTopic) => (
                    <span
                      key={topic.id}
                      className="inline-flex items-center px-1.5 py-0 rounded-full bg-surface-muted text-[10px] text-app-text-secondary max-w-[100px] truncate"
                    >
                      {topic.title}
                    </span>
                  ))}
                  {topics.length > 2 && (
                    <span className="text-[10px] text-app-text-secondary">
                      +{topics.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          </button>
        );
      })}
      </div>
      {pages.moreError && <p role="alert" className="px-4 py-2 text-xs text-red-600">{pages.moreError}</p>}
      {pages.hasMore && <button className="w-full px-4 py-3 text-xs text-primary-700 disabled:opacity-50" disabled={pages.loadingMore}
        onClick={() => void pages.loadMore()}>{pages.loadingMore ? 'Loading conversations…' : 'Load more conversations'}</button>}
    </div>
  );
}
