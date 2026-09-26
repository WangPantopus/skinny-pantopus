'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getDateKey, formatDateLabel } from '../../hooks/useChatMessages';
import ChatDateSeparator from './ChatDateSeparator';
import ChatMessageBubble from './ChatMessageBubble';
import type { ChatMessage } from './ChatMessageBubble';

interface ChatMessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  /** Check if a message is from the current user */
  isOwnMessage: (msg: ChatMessage) => boolean;
  /** Optional extra items to render before the main messages (e.g. historical messages) */
  headerContent?: React.ReactNode;
  /** Optional topic divider renderer */
  renderTopicDivider?: (msg: ChatMessage, prevMsg: ChatMessage | null) => React.ReactNode | null;
  /** Called when an image attachment is clicked */
  onImageClick?: (url: string, title?: string) => void;
  /** Called when a user reacts to a message */
  onReact?: (messageId: string, emoji: string) => void;
  /** Called when the user retries a failed (not refused) send */
  onRetry?: (messageId: string) => void;
}

/** Within this distance of the bottom, the list follows new messages. */
const FOLLOW_SLACK_PX = 120;

export default function ChatMessageList({
  messages,
  loading,
  error,
  hasMore,
  loadingOlder,
  onLoadOlder,
  isOwnMessage,
  headerContent,
  renderTopicDivider,
  onImageClick,
  onReact,
  onRetry,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  // True while the reader is at the newest message. Only then does the list
  // follow new messages and photos or videos that finish loading.
  const followingRef = useRef(true);
  // The list as last laid out, to tell a new message from an older page.
  const laidOutRef = useRef<{ firstId?: string; lastId?: string; count: number; height: number }>({ count: 0, height: 0 });
  const [newBelow, setNewBelow] = useState(false);

  const scrollToNewest = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    followingRef.current = true;
    setNewBelow(false);
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const before = laidOutRef.current;
    const firstId = messages[0]?.id;
    const lastId = messages[messages.length - 1]?.id;
    if (el && messages.length > 0) {
      const sameConversation = messages.some((m) => m.id === before.lastId || m.id === before.firstId);
      if (!sameConversation) {
        // First page, or another conversation: open at the newest message.
        scrollToNewest();
      } else if (lastId === before.lastId && firstId !== before.firstId) {
        // An older page went in above: keep the reader on the same message.
        el.scrollTop += el.scrollHeight - before.height;
      } else if (lastId !== before.lastId && messages.length > before.count) {
        // A new message: follow it if the reader is at the bottom or sent it,
        // and otherwise say it's there instead of pulling them away.
        if (followingRef.current || isOwnMessage(messages[messages.length - 1])) scrollToNewest();
        else setNewBelow(true);
      }
    }
    laidOutRef.current = { firstId, lastId, count: messages.length, height: el?.scrollHeight ?? 0 };
  }, [messages, isOwnMessage, scrollToNewest]);

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === 'undefined') return;
    // Photos and videos grow the list as they load: stay at the newest
    // message if the reader was there.
    const observer = new ResizeObserver(() => {
      if (followingRef.current) el.scrollTop = el.scrollHeight;
      laidOutRef.current.height = el.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    followingRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_SLACK_PX;
    if (followingRef.current) setNewBelow(false);
  }, []);

  return (
    <main
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-scroll overscroll-contain"
      tabIndex={0}
      role="region"
      aria-label="Chat messages"
    >
      <div ref={contentRef} className="max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-sm text-app-muted">Loading messages…</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-4xl mb-2">👋</div>
              <div className="text-app-text-secondary text-sm">No messages yet. Say hello!</div>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Load older button */}
            <div className="flex justify-center mb-3">
              <button
                onClick={onLoadOlder}
                disabled={!hasMore || loadingOlder}
                className="px-3 py-1.5 rounded-full text-xs border border-app-border-strong bg-surface text-app-text-strong hover-bg-app disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingOlder ? 'Loading earlier…' : hasMore ? 'Load earlier messages' : 'No earlier messages'}
              </button>
            </div>

            {/* Optional header content (e.g. historical messages) */}
            {headerContent}

            {/* Messages with date grouping */}
            {(() => {
              let lastDateKey = '';
              let lastSenderId: string | null = null;
              // One flat list keyed by date, topic and message id: a page of
              // older messages going in above must not remount the bubbles
              // below it (a remount reloads photos and breaks a loading video).
              return messages.flatMap((msg, idx) => {
                const nodes: React.ReactNode[] = [];
                const dKey = getDateKey(msg.created_at || '');

                // Date separator
                if (dKey !== lastDateKey) {
                  nodes.push(<ChatDateSeparator key={`date-${dKey}`} label={formatDateLabel(dKey)} />);
                  lastDateKey = dKey;
                  lastSenderId = null;
                }

                // Topic divider
                if (renderTopicDivider) {
                  const prevMsg = idx > 0 ? messages[idx - 1] : null;
                  const divider = renderTopicDivider(msg, prevMsg);
                  if (divider) nodes.push(divider);
                }

                const senderId = msg.user_id || msg.sender_id || msg.sender?.id;
                const isMine = isOwnMessage(msg);
                const showSender = !isMine && senderId !== lastSenderId;
                lastSenderId = senderId || null;

                nodes.push(
                  <ChatMessageBubble key={msg.id} msg={msg} isMine={isMine} showSender={showSender} onImageClick={onImageClick} onReact={onReact} onRetry={onRetry} />
                );

                return nodes;
              });
            })()}
          </div>
        )}
      </div>
      {newBelow && (
        <div className="sticky bottom-3 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={scrollToNewest}
            className="pointer-events-auto px-3 py-1.5 rounded-full text-xs border border-app-border-strong bg-surface text-app-text-strong hover-bg-app shadow-sm"
          >
            New messages ↓
          </button>
        </div>
      )}
    </main>
  );
}
