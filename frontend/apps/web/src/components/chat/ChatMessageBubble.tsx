'use client';

import React, { useState } from 'react';
import type { ChatMessage } from '@pantopus/types';
import { extractAttachments, resolveMessageType } from '../../hooks/useChatMessages';
import ChatRichCard from './ChatRichCard';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import MessageReactionBar from './MessageReactionBar';
import QuickReactionPicker from './QuickReactionPicker';
import EmojiPickerPopover from './EmojiPickerPopover';

const EMOJI_ONLY_REGEX = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?){1,5}$/u;
function isEmojiOnly(text?: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 30) return false;
  return EMOJI_ONLY_REGEX.test(trimmed);
}

export type { ChatMessage };

interface ChatMessageBubbleProps {
  msg: ChatMessage;
  isMine: boolean;
  showSender?: boolean;
  onImageClick?: (url: string, title?: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onRetry?: (messageId: string) => void;
}

function ChatMessageBubble({ msg, isMine, showSender = false, onImageClick, onReact, onRetry }: ChatMessageBubbleProps) {
  const [hovered, setHovered] = useState(false);
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);

  const who = msg.sender?.name || msg.sender?.username || 'Someone';
  const ts = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const msgText = msg.message_text || msg.message || msg.content || '';
  const attachments = extractAttachments(msg);
  const metadata = msg.metadata || {};
  const msgType = resolveMessageType(msg);
  const isOptimistic = msg._optimistic;
  const isFailed = msg._failed;

  const isEdited = msg.edited || msg.is_edited;
  const replyMeta = msg.reply_to_id ? (metadata as Record<string, any>)?.replyContext : null;

  const isAutoPlaceholder = msgText && /^\[.+ attachment\]$/i.test(msgText.trim());
  const showText = msgText && !(isAutoPlaceholder && attachments.length > 0);

  const handleQuickReact = (emoji: string) => {
    onReact?.(msg.id, emoji);
    setShowQuickPicker(false);
  };

  const handleFullReact = (emoji: string) => {
    onReact?.(msg.id, emoji);
    setShowFullPicker(false);
    setShowQuickPicker(false);
  };

  const handleReactionBarClick = (emoji: string) => {
    onReact?.(msg.id, emoji);
  };

  const reactionTrigger = !isOptimistic && onReact && (
    <button
      type="button"
      onClick={() => setShowQuickPicker(!showQuickPicker)}
      className={`absolute ${isMine ? '-left-8' : '-right-8'} top-0 w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-app shadow-sm text-sm hover:bg-surface-muted transition-all ${
        hovered || showQuickPicker ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
      }`}
    >
      😊
    </button>
  );

  const reactionOverlays = (showQuickPicker || showFullPicker) && (
    <div className={`absolute ${isMine ? 'right-0' : 'left-0'} bottom-full mb-1 z-20`}>
      {showFullPicker ? (
        <EmojiPickerPopover
          onSelect={handleFullReact}
          onClose={() => { setShowFullPicker(false); setShowQuickPicker(false); }}
        />
      ) : (
        <QuickReactionPicker
          onSelect={handleQuickReact}
          onOpenFullPicker={() => setShowFullPicker(true)}
        />
      )}
    </div>
  );

  const reactionBar = msg.reactions && msg.reactions.length > 0 && (
    <div className={`${isMine ? 'flex justify-end' : ''}`}>
      <MessageReactionBar reactions={msg.reactions} onReact={handleReactionBarClick} />
    </div>
  );

  // Rich card types get a special rendering
  if (msgType === 'location' || msgType === 'gig_offer' || msgType === 'listing_offer') {
    return (
      <div className={`flex mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[75%] ${isMine ? 'order-1' : ''} relative`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { setHovered(false); if (!showQuickPicker && !showFullPicker) return; }}
        >
          {showSender && !isMine && (
            <div className="mb-0.5 ml-1">
              <UserIdentityLink
                userId={msg.sender?.id}
                username={msg.sender?.username}
                displayName={who}
                avatarUrl={msg.sender?.profile_picture_url}
                textClassName="text-xs text-app-muted hover:text-primary-600 hover:underline"
              />
            </div>
          )}
          <div className="relative">
            {reactionTrigger}
            {reactionOverlays}
            <ChatRichCard msgType={msgType} metadata={metadata} msgText={msgText} isMine={isMine} />
          </div>
          <div className={`text-[10px] text-app-muted mt-0.5 ${isMine ? 'text-right mr-1' : 'ml-1'}`}>
            {isEdited && <span>edited · </span>}{ts}
          </div>
          {reactionBar}
        </div>
      </div>
    );
  }

  // Emoji-only messages: large text, no bubble
  const emojiOnly = showText && isEmojiOnly(msgText) && attachments.length === 0;

  // Standard text + attachment message
  return (
    <div className={`flex mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] ${isMine ? 'order-1' : ''} relative`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); if (!showQuickPicker && !showFullPicker) return; }}
      >
        {showSender && !isMine && (
            <div className="mb-0.5 ml-1">
              <UserIdentityLink
                userId={msg.sender?.id}
                username={msg.sender?.username}
                displayName={who}
                avatarUrl={msg.sender?.profile_picture_url}
                textClassName="text-xs text-app-muted hover:text-primary-600 hover:underline"
              />
            </div>
          )}
        <div className="relative">
          {reactionTrigger}
          {reactionOverlays}
          {emojiOnly ? (
            <div className={`text-4xl leading-snug ${isOptimistic ? 'opacity-60' : ''} ${isFailed ? 'opacity-70 ring-1 ring-red-400' : ''}`}>
              {msgText}
            </div>
          ) : (
          <div
            className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
              isMine
                ? 'bg-primary-600 text-white rounded-br-md'
                : 'bg-surface text-app border border-app rounded-bl-md'
            } ${isOptimistic ? 'opacity-60' : ''} ${isFailed ? 'opacity-70 ring-1 ring-red-400' : ''}`}
          >
            {replyMeta && (
              <div className={`border-l-[3px] rounded px-2 py-1 mb-1.5 text-xs ${
                isMine
                  ? 'border-white/50 bg-white/15'
                  : 'border-primary-500 bg-primary-500/[0.08]'
              }`}>
                <div className={`font-semibold ${isMine ? 'text-white/90' : 'text-primary-600'}`}>
                  {(replyMeta as Record<string, any>).senderName || 'Message'}
                </div>
                <div className={`line-clamp-2 ${isMine ? 'text-white/70' : 'text-app-muted'}`}>
                  {(replyMeta as Record<string, any>).text || ''}
                </div>
              </div>
            )}
            {showText && msgText}
            {attachments.length > 0 && (
              <div className={`${showText ? 'mt-2' : ''} space-y-2`}>
                {attachments.map((a: Record<string, any>, i: number) => {
                  const mime = String(a?.mime_type || '');
                  const isImage = mime.startsWith('image/');
                  const url = a?.file_url as string | undefined;
                  if (isImage && url) {
                    return (
                      <button
                        key={`${msg.id}-att-${i}`}
                        type="button"
                        onClick={() => onImageClick ? onImageClick(url, a.original_filename) : window.open(url, '_blank')}
                        className={`block max-w-[min(100%,240px)] overflow-hidden rounded-lg text-left ${
                          isMine ? 'bg-primary-700/40' : 'bg-black/[0.06]'
                        }`}
                      >
                        {/* Native img: user URLs + cookies on /api/chat/files/; avoids next/image dev sizing warnings. */}
                        <img
                          src={url}
                          alt={(a.original_filename as string) || 'Image'}
                          className="rounded-lg transition-opacity hover:opacity-90"
                          loading="lazy"
                          decoding="async"
                          style={{
                            width: 'auto',
                            height: 'auto',
                            maxWidth: '100%',
                            maxHeight: 'min(180px, 48vw)',
                            objectFit: 'contain',
                          }}
                        />
                      </button>
                    );
                  }
                  return (
                    <a
                      key={`${msg.id}-att-${i}`}
                      href={url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                        isMine ? 'bg-primary-500 text-blue-100 hover:bg-primary-400' : 'bg-surface-muted text-app-text-strong hover-bg-app'
                      } transition-colors`}
                    >
                      <span>📄</span>
                      <span className="truncate flex-1">{a.original_filename as string || `Attachment ${i + 1}`}</span>
                      <span>↓</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </div>
        <div className={`text-[10px] text-app-muted mt-0.5 ${isMine ? 'text-right mr-1' : 'ml-1'}`}>
          {isFailed ? (
            <span className="text-red-500">
              Failed to send{' '}
              {onRetry && (
                <button
                  type="button"
                  className="underline hover:text-red-600 cursor-pointer"
                  onClick={() => onRetry(msg.id)}
                >
                  Retry
                </button>
              )}
            </span>
          ) : isOptimistic ? 'Sending…' : <>{isEdited && <span>edited · </span>}{ts}</>}
        </div>
        {reactionBar}
      </div>
    </div>
  );
}

export default React.memo(ChatMessageBubble, (prev, next) => {
  return prev.msg.id === next.msg.id
    && prev.msg.is_edited === next.msg.is_edited
    && prev.msg._optimistic === next.msg._optimistic
    && prev.msg._failed === next.msg._failed
    && prev.isMine === next.isMine
    && prev.showSender === next.showSender
    && prev.msg.reactions === next.msg.reactions
    && prev.onReact === next.onReact
    && prev.onImageClick === next.onImageClick
    && prev.onRetry === next.onRetry;
});
