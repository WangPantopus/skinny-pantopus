'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { chatPersonName, getDateKey, formatDateLabel } from '../../hooks/useChatMessages';
import type { ChatReplyTarget } from '../../hooks/useChatMessages';
import { chatReplyRoomHref } from './chatOutbox';
import ChatDateSeparator from './ChatDateSeparator';
import ChatMessageBubble from './ChatMessageBubble';
import type { ChatMessage, ChatReplyQuote } from './ChatMessageBubble';

interface ChatMessageListProps {
  asBusinessUserId?: string;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onVisibleMessage?: (messageId: string) => void;
  anchorMessageId?: string | null;
  onReturnToLatest?: () => void;
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
  /** Explicitly retry a failed send or a retained person reply after a refusal. */
  onRetry?: (messageId: string) => void;
  onRemovePending?: (messageId: string) => void;
  /** Called when the user picks Reply on a message; leave it out where the composer can't send. */
  onReply?: (target: ChatReplyTarget) => void;
  canChangeMessage?: (message: ChatMessage) => boolean;
  onEdit?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
}

/** Within this distance of the bottom, the list follows new messages. */
const FOLLOW_SLACK_PX = 120;

/**
 * How a reply quotes the message it answers, as in the apps: "You" for your
 * own message (your bubbles carry no name), else its sender's name.
 */
function replyQuote(original: ChatMessage, isMine: boolean): ChatReplyQuote {
  return {
    senderName: isMine ? 'You' : chatPersonName(original.sender) || 'Message',
    text: original.message_text || original.message || original.content || '',
  };
}

export default function ChatMessageList({
  asBusinessUserId,
  messages,
  loading,
  error,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onVisibleMessage,
  anchorMessageId,
  onReturnToLatest,
  isOwnMessage,
  headerContent,
  renderTopicDivider,
  onImageClick,
  onReact,
  onRetry,
  onRemovePending,
  onReply,
  canChangeMessage,
  onEdit,
  onDelete,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  // True while the reader is at the newest message. Only then does the list
  // follow new messages and photos or videos that finish loading.
  const followingRef = useRef(true);
  const userScrollAtRef = useRef(0);
  // The list as last laid out, to tell a new message from an older page.
  const laidOutRef = useRef<{ firstId?: string; lastId?: string; count: number; height: number }>({ count: 0, height: 0 });
  const [newBelow, setNewBelow] = useState(false);
  const prependAnchorRef = useRef<{ id: string; top: number } | null>(null);
  const anchorFrameRef = useRef<number | null>(null);
  const focusedAnchorRef = useRef<string | null>(null);
  // Loaded originals provide the quote; older ones retain an explicit link
  // to the existing authorized context view.
  const messagesById = useMemo(() => new Map(messages.map((m) => [String(m.id), m])), [messages]);
  // The composer's reply bar names the message as its quote will.
  const handleReply = useCallback(
    (msg: ChatMessage) => onReply?.({ messageId: String(msg.id), ...replyQuote(msg, isOwnMessage(msg)) }),
    [onReply, isOwnMessage],
  );

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => String(messages[index].id),
    estimateSize: (index) => {
      const message = messages[index];
      return message.attachments?.length ? 300 : Math.max(76, Math.ceil((message.message_text?.length || 0) / 65) * 20 + 56);
    },
    overscan: 8,
    scrollMargin,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const renderedIds = virtualRows.map((row) => row.key).join(',');
  useLayoutEffect(() => {
    const root = scrollRef.current;
    const rows = rowsRef.current;
    if (!root || !rows) return;
    const update = () => setScrollMargin(rows.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop);
    update();
    const observer = new ResizeObserver(update);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [messages.length, loading, error, headerContent]);

  const handleLoadOlder = useCallback(() => {
    const root = scrollRef.current;
    if (root) {
      const top = root.getBoundingClientRect().top;
      const visible = Array.from(root.querySelectorAll<HTMLElement>('[data-chat-message-id]'))
        .find((element) => element.getBoundingClientRect().bottom > top);
      if (visible?.dataset.chatMessageId) prependAnchorRef.current = { id: visible.dataset.chatMessageId, top: visible.getBoundingClientRect().top - top };
    }
    onLoadOlder();
  }, [onLoadOlder]);

  useEffect(() => () => { if (anchorFrameRef.current !== null) cancelAnimationFrame(anchorFrameRef.current); }, []);

  const scrollToNewest = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    followingRef.current = true;
    userScrollAtRef.current = 0;
    setNewBelow(false);
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const before = laidOutRef.current;
    const firstId = messages[0]?.id;
    const lastId = messages[messages.length - 1]?.id;
    if (el && anchorMessageId && focusedAnchorRef.current !== anchorMessageId) {
      const index = messages.findIndex((message) => String(message.id) === anchorMessageId);
      if (index >= 0) {
        focusedAnchorRef.current = anchorMessageId;
        followingRef.current = false;
        virtualizer.scrollToIndex(index, { align: 'center' });
        let frames = 0;
        const settle = () => {
          virtualizer.scrollToIndex(index, { align: 'center' });
          if (++frames < 4) anchorFrameRef.current = requestAnimationFrame(settle);
          else anchorFrameRef.current = null;
        };
        anchorFrameRef.current = requestAnimationFrame(settle);
      }
    } else if (el && messages.length > 0) {
      const sameConversation = messages.some((m) => m.id === before.lastId || m.id === before.firstId);
      if (!sameConversation) {
        // First page, or another conversation: open at the newest message.
        scrollToNewest();
      } else if (lastId === before.lastId && firstId !== before.firstId) {
        // An older page went in above: keep the reader on the same message.
        const anchor = prependAnchorRef.current;
        prependAnchorRef.current = null;
        const index = anchor ? messages.findIndex((message) => String(message.id) === anchor.id) : -1;
        if (anchor && index >= 0) {
          followingRef.current = false;
          virtualizer.scrollToIndex(index, { align: 'start' });
          // Variable-height rows settle after measurement. Restore the actual
          // visible bubble, rather than an estimated total-height difference.
          let attempts = 0;
          let settled = 0;
          const restore = () => {
            const element = Array.from(el.querySelectorAll<HTMLElement>('[data-chat-message-id]'))
              .find((node) => node.dataset.chatMessageId === anchor.id);
            if (element) {
              const difference = element.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.top;
              if (Math.abs(difference) > 1) { el.scrollTop += difference; settled = 0; } else settled += 1;
            }
            if (++attempts < 12 && settled < 3) anchorFrameRef.current = requestAnimationFrame(restore);
            else anchorFrameRef.current = null;
          };
          anchorFrameRef.current = requestAnimationFrame(restore);
        } else el.scrollTop += el.scrollHeight - before.height;
      } else if (lastId !== before.lastId && messages.length > before.count) {
        // A new message: follow it if the reader is at the bottom or sent it,
        // and otherwise say it's there instead of pulling them away.
        if (followingRef.current || isOwnMessage(messages[messages.length - 1])) scrollToNewest();
        else setNewBelow(true);
      }
    }
    laidOutRef.current = { firstId, lastId, count: messages.length, height: el?.scrollHeight ?? 0 };
  }, [messages, isOwnMessage, scrollToNewest, virtualizer, anchorMessageId]);

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
    if (!el || Date.now() - userScrollAtRef.current > 1000) return;
    followingRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_SLACK_PX;
    if (followingRef.current) setNewBelow(false);
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !onVisibleMessage || typeof IntersectionObserver === 'undefined') return;
    const order = new Map(messages.map((message, index) => [String(message.id), index]));
    const visible = new Set<string>();
    const report = () => {
      if (document.visibilityState !== 'visible') return;
      // Report each actually visible room boundary. A person conversation can
      // span several rooms; its globally newest bubble cannot acknowledge the others.
      const newest = new Map<string, string>();
      for (const id of visible) {
        const index = order.get(id);
        const message = index === undefined ? undefined : messages[index];
        if (!message?.room_id) continue;
        const previous = newest.get(message.room_id);
        if (!previous || index! > (order.get(previous) ?? -1)) newest.set(message.room_id, id);
      }
      newest.forEach((id) => onVisibleMessage(id));
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.chatMessageId;
        if (!id) continue;
        if (entry.isIntersecting) visible.add(id); else visible.delete(id);
      }
      report();
    }, { root, threshold: 0.01 });
    root.querySelectorAll('[data-chat-message-id]').forEach((element) => observer.observe(element));
    document.addEventListener('visibilitychange', report);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', report); };
  }, [messages, onVisibleMessage, renderedIds]);

  return (
    <section
      ref={scrollRef}
      onScroll={handleScroll}
      onWheel={() => { userScrollAtRef.current = Date.now(); }}
      onTouchMove={() => { userScrollAtRef.current = Date.now(); }}
      onPointerDown={() => { userScrollAtRef.current = Date.now(); }}
      onKeyDown={() => { userScrollAtRef.current = Date.now(); }}
      className="flex-1 min-h-0 overflow-y-scroll overscroll-contain"
      tabIndex={0}
      aria-label="Chat messages"
      style={{ overflowAnchor: 'none' }}
    >
      <div ref={contentRef} className="max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {onReturnToLatest && <div className="sticky top-0 z-10 flex justify-center mb-3"><button onClick={onReturnToLatest} className="rounded-full border border-app bg-surface px-3 py-1.5 text-xs text-primary-700 shadow-sm">Back to latest messages ↓</button></div>}
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
                onClick={handleLoadOlder}
                disabled={!hasMore || loadingOlder}
                className="px-3 py-1.5 rounded-full text-xs border border-app-border-strong bg-surface text-app-text-strong hover-bg-app disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingOlder ? 'Loading earlier…' : hasMore ? 'Load earlier messages' : 'No earlier messages'}
              </button>
            </div>

            {/* Optional header content (e.g. historical messages) */}
            {headerContent}

            {/* Stable message keys retain measurements when older pages arrive.
                Only the visible window and a small overscan mount media/bubbles. */}
            <div ref={rowsRef} style={{ height: virtualizer.getTotalSize(), position: 'relative', overflowAnchor: 'none' }}>
              {virtualRows.map((row) => {
                const msg = messages[row.index];
                const previous = row.index > 0 ? messages[row.index - 1] : null;
                const dateKey = getDateKey(msg.created_at || '');
                const startsDate = !previous || getDateKey(previous.created_at || '') !== dateKey;
                const senderId = msg.user_id || msg.sender_id || msg.sender?.id;
                const previousSenderId = previous?.user_id || previous?.sender_id || previous?.sender?.id;
                const isMine = isOwnMessage(msg);
                const original = msg.reply_to_id ? messagesById.get(String(msg.reply_to_id)) : undefined;
                const reply: ChatReplyQuote | undefined = original ? replyQuote(original, isOwnMessage(original)) : msg.reply_to_id ? {
                  senderName: 'Reply', text: 'Original message is not loaded.',
                  href: msg.room_id ? chatReplyRoomHref(msg.room_id, asBusinessUserId, msg.reply_to_id) : undefined,
                } : undefined;
                return (
                  <div key={row.key} data-index={row.index} ref={virtualizer.measureElement} className={String(msg.id) === anchorMessageId ? 'rounded-lg bg-primary-50 ring-1 ring-primary-200' : undefined}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', paddingBottom: 4,
                      transform: `translateY(${row.start - scrollMargin}px)` }}>
                    {startsDate && <ChatDateSeparator label={formatDateLabel(dateKey)} />}
                    {renderTopicDivider?.(msg, previous)}
                    <ChatMessageBubble msg={msg} isMine={isMine} showSender={!isMine && (startsDate || senderId !== previousSenderId)} reply={reply}
                      onEdit={!canChangeMessage || canChangeMessage(msg) ? onEdit : undefined} onDelete={!canChangeMessage || canChangeMessage(msg) ? onDelete : undefined} onImageClick={onImageClick} onReact={onReact} onRetry={onRetry} onRemovePending={onRemovePending}
                      onReply={onReply ? handleReply : undefined} />
                  </div>
                );
              })}
            </div>
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
    </section>
  );
}
