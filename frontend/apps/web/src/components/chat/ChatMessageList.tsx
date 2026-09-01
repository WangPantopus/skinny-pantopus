'use client';

import { useEffect, useRef } from 'react';
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
}

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
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <main
      className="flex-1 min-h-0 overflow-y-scroll overscroll-contain"
      tabIndex={0}
      role="region"
      aria-label="Chat messages"
    >
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
              return messages.map((msg, idx) => {
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
                  <ChatMessageBubble key={msg.id} msg={msg} isMine={isMine} showSender={showSender} onImageClick={onImageClick} onReact={onReact} />
                );

                return nodes;
              });
            })()}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </main>
  );
}
