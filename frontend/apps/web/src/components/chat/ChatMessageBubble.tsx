'use client';

import React, { useState } from 'react';
import { Copy, MoreHorizontal, Reply, Pencil, Trash2 } from 'lucide-react';
import type { ChatMessage } from '@pantopus/types';
import { chatPersonAvatar, chatPersonHandle, chatPersonName, extractAttachments, resolveMessageType } from '../../hooks/useChatMessages';
import ChatRichCard from './ChatRichCard';
import ImageLightbox from './ImageLightbox';
import { PostLinkContent } from '../feed/LinkPreviewCard';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import MessageReactionBar from './MessageReactionBar';
import QuickReactionPicker from './QuickReactionPicker';
import EmojiPickerPopover from './EmojiPickerPopover';
import MessageActionMenu from './MessageActionMenu';
import type { MessageAction } from './MessageActionMenu';
import { launchFeatures } from '@/lib/featureFlags';

const EMOJI_ONLY_REGEX = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?){1,5}$/u;
function isEmojiOnly(text?: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 30) return false;
  return EMOJI_ONLY_REGEX.test(trimmed);
}

export type { ChatMessage };

/** The message a reply answers, as its quote shows it. */
export interface ChatReplyQuote {
  senderName: string;
  text: string;
}

interface ChatMessageBubbleProps {
  msg: ChatMessage;
  isMine: boolean;
  showSender?: boolean;
  /** Set when this message replies to one that is loaded. */
  reply?: ChatReplyQuote;
  onImageClick?: (url: string, title?: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onRetry?: (messageId: string) => void;
  onRemovePending?: (messageId: string) => void;
  /** Picked from the message's actions menu: the composer replies to this message. */
  onReply?: (msg: ChatMessage) => void;
  onEdit?: (msg: ChatMessage) => void;
  onDelete?: (msg: ChatMessage) => void;
}

// The actions menu's size (its row of quick reactions sets the width), to keep it on screen next to its button.
const MENU_WIDTH = 304;


function ChatMessageBubble({ msg, isMine, showSender = false, reply, onImageClick, onReact, onRetry, onRemovePending, onReply, onEdit, onDelete }: ChatMessageBubbleProps) {
  const [preview, setPreview] = useState<{ url: string; title?: string; mimeType?: string; liveUrl?: string } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [menuAt, setMenuAt] = useState<{ top: number; left: number } | null>(null);

  const who = chatPersonName(msg.sender) || 'Someone';
  const ts = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const msgText = msg.message_text || msg.message || msg.content || '';
  const allAttachments = extractAttachments(msg);
  const attachments = allAttachments.filter(a => !(a.id && a.live_photo_file_id && allAttachments.some(still => still.id && still.live_video_file_id === a.id && a.live_photo_file_id === still.id)));
  const metadata = msg.metadata || {};
  const msgType = resolveMessageType(msg);
  const isOptimistic = msg._optimistic;
  const isFailed = msg._failed;
  const isRefused = msg._refused;
  const pending = msg as ChatMessage & { _queued?: boolean; _outbox?: boolean; _error?: string };
  const receipt = isMine ? ((msg as ChatMessage & { read_at?: string }).read_at ? 'Read' : 'Sent') : null;
  // Launch cut #3 (Marketplace): a shared listing card is not shown.
  if (msgType === 'listing_offer' && !launchFeatures.marketplace) return null;

  const isEdited = msg.edited || msg.is_edited;

  // Text the server fills in for a message that is only attachments ("Photo",
  // "Document"), or an older client's "[1 attachment]"; not a caption.
  const isAutoPlaceholder = msgText && /^(\[.+ attachments?\]|Photo|Video|Document|Media)$/i.test(msgText.trim());
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
      aria-label="Add reaction"
      className={`absolute ${isMine ? '-left-8' : '-right-8'} top-0 w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-app shadow-sm text-sm hover:bg-surface-muted transition-all focus-visible:opacity-100 focus-visible:scale-100 ${
        hovered || showQuickPicker ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
      }`}
    >
      😊
    </button>
  );

  // Reply and Copy text, in the menu the message's actions button opens (with quick reactions on top).
  const menuActions: MessageAction[] = [
    ...(onReply ? [{ key: 'reply', label: 'Reply', icon: Reply }] : []),
    ...(showText ? [{ key: 'copy', label: 'Copy text', icon: Copy }] : []),
    ...(isMine && showText && onEdit && !['location', 'gig_offer', 'listing_offer'].includes(msgType) ? [{ key: 'edit', label: 'Edit', icon: Pencil }] : []),
    ...(isMine && onDelete ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true }] : []),
  ];
  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(isMine ? rect.right - MENU_WIDTH : rect.left, window.innerWidth - MENU_WIDTH - 8));
    const MENU_HEIGHT = 68 + menuActions.length * 40;
    const top = rect.bottom + 4 + MENU_HEIGHT > window.innerHeight ? Math.max(8, rect.top - 4 - MENU_HEIGHT) : rect.bottom + 4;
    setMenuAt({ top, left });
  };
  const handleMenuAction = (key: string) => {
    if (key === 'reply') onReply?.(msg);
    else if (key === 'edit') onEdit?.(msg);
    else if (key === 'delete') onDelete?.(msg);
    else if (key === 'copy') void navigator.clipboard?.writeText(msgText).catch(() => {});
    else if (key === 'emoji_picker') setShowFullPicker(true);
  };
  const actionsTrigger = !isOptimistic && !isFailed && onReact && menuActions.length > 0 && (
    <button
      type="button"
      onClick={openMenu}
      aria-label="Message actions"
      aria-haspopup="menu"
      aria-expanded={menuAt !== null}
      className={`absolute ${isMine ? '-left-16' : '-right-16'} top-0 w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-app shadow-sm hover:bg-surface-muted transition-all focus-visible:opacity-100 focus-visible:scale-100 ${
        hovered || menuAt ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
      }`}
    >
      <MoreHorizontal className="w-4 h-4 text-app-text-secondary" aria-hidden />
    </button>
  );
  const actionsMenu = actionsTrigger && (
    <MessageActionMenu
      open={menuAt !== null}
      onClose={() => setMenuAt(null)}
      onAction={handleMenuAction}
      onReact={(emoji) => onReact?.(msg.id, emoji)}
      actions={menuActions}
      anchorPosition={menuAt ?? undefined}
    />
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
      <div data-chat-message-id={msg.id} className={`flex mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[75%] ${isMine ? 'order-1' : ''} relative`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { setHovered(false); if (!showQuickPicker && !showFullPicker) return; }}
        >
          {showSender && !isMine && (
            <div className="mb-0.5 ml-1">
              <UserIdentityLink
                userId={msg.sender?.id}
                username={chatPersonHandle(msg.sender)}
                displayName={who}
                avatarUrl={chatPersonAvatar(msg.sender)}
                textClassName="text-xs text-app-muted hover:text-primary-600 hover:underline"
              />
            </div>
          )}
          <div className="relative">
            {reactionTrigger}
            {actionsTrigger}
            {reactionOverlays}
            <ChatRichCard msgType={msgType} metadata={metadata} msgText={msgText} isMine={isMine} />
          </div>
          <div className={`text-[10px] text-app-muted mt-0.5 ${isMine ? 'text-right mr-1' : 'ml-1'}`}>
            {isEdited && <span>edited · </span>}{ts}{receipt && ` · ${receipt}`}
          </div>
          {reactionBar}
          {actionsMenu}
        </div>
      </div>
    );
  }

  // Emoji-only messages: large text, no bubble
  const emojiOnly = showText && isEmojiOnly(msgText) && attachments.length === 0;

  // Standard text + attachment message
  return (
    <div data-chat-message-id={msg.id} className={`flex mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] ${isMine ? 'order-1' : ''} relative`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); if (!showQuickPicker && !showFullPicker) return; }}
      >
        {showSender && !isMine && (
            <div className="mb-0.5 ml-1">
              <UserIdentityLink
                userId={msg.sender?.id}
                username={chatPersonHandle(msg.sender)}
                displayName={who}
                avatarUrl={chatPersonAvatar(msg.sender)}
                textClassName="text-xs text-app-muted hover:text-primary-600 hover:underline"
              />
            </div>
          )}
        <div className="relative">
          {reactionTrigger}
          {actionsTrigger}
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
            {reply && (
              <div className={`border-l-[3px] rounded px-2 py-1 mb-1.5 text-xs ${
                isMine
                  ? 'border-white/50 bg-white/15'
                  : 'border-primary-500 bg-primary-500/[0.08]'
              }`}>
                <div className={`font-semibold ${isMine ? 'text-white/90' : 'text-primary-600'}`}>
                  {reply.senderName}
                </div>
                <div className={`line-clamp-2 ${isMine ? 'text-white/70' : 'text-app-muted'}`}>
                  {reply.text}
                </div>
              </div>
            )}
            {showText && <span className="[&_a]:text-inherit"><PostLinkContent content={msgText} /></span>}
            {attachments.length > 0 && (
              <div className={`${showText ? 'mt-2' : ''} space-y-2`}>
                {attachments.map((a: Record<string, any>, i: number) => {
                  const mime = String(a?.mime_type || '');
                  const isImage = mime.startsWith('image/');
                  const url = a?.file_url as string | undefined;
                  const live = a.id && a.live_video_file_id
                    ? allAttachments.find(clip => clip.id === a.live_video_file_id && clip.live_photo_file_id === a.id)
                    : undefined;
                  if (mime === 'application/pdf' && url) {
                    return <button key={`${msg.id}-att-${i}`} type="button" className="block rounded-lg border p-3 text-left"
                      onClick={() => setPreview({ url, title: a.original_filename, mimeType: mime })}>
                      PDF · {a.original_filename || 'Tap to read'}
                    </button>;
                  }
                  if (isImage && url) {
                    return (
                      <button
                        key={`${msg.id}-att-${i}`}
                        type="button"
                        onClick={() => live || !onImageClick ? setPreview({ url, title: a.original_filename, liveUrl: live?.file_url }) : onImageClick(url, a.original_filename)}
                        className={`block max-w-[min(100%,240px)] overflow-hidden rounded-lg text-left ${
                          isMine ? 'bg-primary-700/40' : 'bg-black/[0.06]'
                        }`}
                      >
                        {live && <span className="block px-2 py-1 text-xs">● LIVE</span>}
                        {/* Native img: user URLs + cookies on /api/chat/files/; avoids next/image dev sizing warnings. */}
                        <img
                          src={url}
                          alt={showText ? `Photo: ${msgText}` : 'Photo'}
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
                  if (mime.startsWith('video/') && url) {
                    return (
                      <video
                        key={`${msg.id}-att-${i}`}
                        src={url}
                        controls
                        playsInline
                        preload="metadata"
                        aria-label={a.original_filename ? `Video: ${a.original_filename}` : 'Video'}
                        className="block rounded-lg bg-black"
                        style={{ width: 'min(100%, 280px)', maxHeight: 'min(220px, 56vw)' }}
                      />
                    );
                  }
                  return (
                    <a
                      key={`${msg.id}-att-${i}`}
                      href={url || '#'}
                      download={a.original_filename as string || 'attachment'}
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                        isMine ? 'bg-primary-600 text-blue-100 hover:bg-primary-700' : 'bg-surface-muted text-app-text-strong hover-bg-app'
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
          {isFailed && isRefused ? (
            <span className="text-red-500">Not sent</span>
          ) : isFailed ? (
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
          ) : isOptimistic ? (pending._queued ? 'Queued' : 'Sending…') : <>{isEdited && <span>edited · </span>}{ts}{receipt && ` · ${receipt}`}</>}
          {pending._outbox && (isFailed || pending._queued) && onRemovePending && (
            <button type="button" className="ml-2 underline" onClick={() => onRemovePending(msg.id)}>Remove</button>
          )}
          {isFailed && pending._error && <div className="text-red-500">{pending._error}</div>}
        </div>
        {reactionBar}
        {actionsMenu}
        <ImageLightbox imageUrl={preview?.url ?? null} title={preview?.title} mimeType={preview?.mimeType}
          liveUrl={preview?.liveUrl} onClose={() => setPreview(null)} />
      </div>
    </div>
  );
}

export default React.memo(ChatMessageBubble, (prev, next) => {
  return prev.msg === next.msg
    && prev.isMine === next.isMine
    && prev.showSender === next.showSender
    && prev.reply?.senderName === next.reply?.senderName
    && prev.reply?.text === next.reply?.text
    && prev.onReact === next.onReact
    && prev.onImageClick === next.onImageClick
    && prev.onRetry === next.onRetry
    && prev.onRemovePending === next.onRemovePending
    && prev.onReply === next.onReply
    && prev.onEdit === next.onEdit
    && prev.onDelete === next.onDelete;
});
