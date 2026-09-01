'use client';

import { useCallback, useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import type { UnifiedConversationItem, ConversationTopic } from '@pantopus/types';
import { getInitials } from '@pantopus/ui-utils';
import { useSocketEvent } from '../../hooks/useSocket';

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
  const [conversations, setConversations] = useState<UnifiedConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.chat.getUnifiedConversations({ limit: 50 });
      setConversations((result?.conversations || []) as UnifiedConversationItem[]);
    } catch {
      setError('Failed to load conversations');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Real-time: when a new message arrives, update preview and bump to top
  useSocketEvent('message:new', useCallback((msg: Record<string, any>) => {
    if (!msg?.room_id) return;
    const roomId = String(msg.room_id);
    const msgText = (msg.message_text as string) || (msg.message as string) || '';
    const createdAt = (msg.created_at as string) || new Date().toISOString();

    let shouldReload = false;
    setConversations(prev => {
      const idx = prev.findIndex(conv =>
        conv._type === 'room'
          ? String(conv.id) === roomId
          : (conv.room_ids || []).map(String).includes(roomId)
      );

      if (idx === -1) {
        shouldReload = true;
        return prev;
      }

      const updated = { ...prev[idx] };
      updated.last_message_preview = msgText.substring(0, 100) || '[Attachment]';
      updated.last_message_at = createdAt;
      updated.total_unread = (updated.total_unread || 0) + 1;

      const next = [updated as UnifiedConversationItem, ...prev.filter((_, i) => i !== idx)];
      return next;
    });

    if (shouldReload) {
      void fetchConversations();
    }
  }, [fetchConversations]));

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
    <div className="flex-1 overflow-y-auto overscroll-contain">
      {conversations.map((conv) => {
        const isRoom = conv._type === 'room';
        const isHome = isRoom && conv.room_type === 'home';

        const title = isRoom
          ? (conv.room_name || (isHome ? 'Home Chat' : 'Group Chat'))
          : (conv.other_participant_name || conv.other_participant_username || 'Chat');
        const avatarUrl = !isRoom ? conv.other_participant_avatar : null;
        const preview = conv.last_message_preview || '';
        const lastMessageAt = conv.last_message_at || null;
        const unread = conv.total_unread || 0;
        const isUnread = unread > 0;
        const topics: ConversationTopic[] = conv.topics || [];
        const key = isRoom ? String(conv.id) : String(conv.other_participant_id);

        return (
          <button
            key={key}
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
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-blue-500 text-white">
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
  );
}
