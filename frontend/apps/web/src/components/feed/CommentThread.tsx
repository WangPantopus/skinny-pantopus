'use client';

import Image from 'next/image';
import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Heart, ImagePlus, Smile, X } from 'lucide-react';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import EmojiPickerPopover from '@/components/chat/EmojiPickerPopover';
import FeedMediaImage from './FeedMediaImage';
import { formatTimeAgo as timeAgo } from '@pantopus/ui-utils';
import type { PostComment } from '@pantopus/types';

interface CommentThreadProps {
  comments: PostComment[];
  onAddComment: (input: { text: string; parentId?: string; files?: File[] }) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onLikeComment?: (commentId: string) => Promise<void>;
  currentUserId?: string;
  isPosting?: boolean;
  canCompose?: boolean;
  composeDisabledMessage?: string | null;
}

function isImageAttachment(mimeType?: string) {
  return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

/** Max visual indentation depth (comments deeper than this still nest but don't indent further) */
const MAX_INDENT_DEPTH = 4;
/** Number of replies shown by default before "View more" */
const INITIAL_REPLIES_SHOWN = 3;

export default function CommentThread({
  comments,
  onAddComment,
  onDeleteComment,
  onLikeComment,
  currentUserId,
  isPosting,
  canCompose = true,
  composeDisabledMessage,
}: CommentThreadProps) {
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  /** Keep blob URLs in sync with selectedFiles on the same render (useEffect + setState was one tick behind). */
  const previewUrls = useMemo(
    () => selectedFiles.map((file) => URL.createObjectURL(file)),
    [selectedFiles]
  );
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // Build replies map: parentId -> children[]
  const repliesMap: Record<string, PostComment[]> = {};
  comments
    .filter((c) => c.parent_comment_id)
    .forEach((c) => {
      const pid = c.parent_comment_id!;
      if (!repliesMap[pid]) repliesMap[pid] = [];
      repliesMap[pid].push(c);
    });

  const topLevel = comments.filter((c) => !c.parent_comment_id);

  const toggleExpanded = (commentId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  useEffect(() => {
    if (replyTo && inputRef.current) inputRef.current.focus();
  }, [replyTo]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const resetComposer = () => {
    setNewComment('');
    setReplyTo(null);
    setSelectedFiles([]);
    setEmojiOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!newComment.trim() && selectedFiles.length === 0) return;
    await onAddComment({
      text: newComment.trim(),
      parentId: replyTo?.id,
      files: selectedFiles,
    });
    resetComposer();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      resetComposer();
    }
  };

  const handleFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;

    setSelectedFiles((prev) => {
      const next = [...prev, ...files];
      return next.slice(0, 4);
    });
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
    if (fileInputRef.current && selectedFiles.length <= 1) {
      fileInputRef.current.value = '';
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewComment((prev) => `${prev}${emoji}`);
    setEmojiOpen(false);
    inputRef.current?.focus();
  };

  const renderComment = (comment: PostComment, depth = 0) => {
    // P0.4: read from the new identity shape only (displayName / handle).
    const authorName =
      comment.author?.displayName || comment.author?.handle || 'Neighbor';
    const authorInitial = authorName[0]?.toUpperCase() || '?';
    const isOwn = comment.user_id === currentUserId;
    const replies = repliesMap[comment.id] || [];
    const imageAttachments = (comment.attachments || []).filter((attachment) => isImageAttachment(attachment.mime_type));
    const fileAttachments = (comment.attachments || []).filter((attachment) => !isImageAttachment(attachment.mime_type));

    // Visual indentation capped at MAX_INDENT_DEPTH
    const indentLevel = Math.min(depth, MAX_INDENT_DEPTH);
    const marginClass = indentLevel > 0 ? `ml-8` : '';

    // Collapse/expand for threads with many replies
    const isExpanded = expandedThreads.has(comment.id);
    const visibleReplies = replies.length <= INITIAL_REPLIES_SHOWN || isExpanded
      ? replies
      : replies.slice(0, INITIAL_REPLIES_SHOWN);
    const hiddenCount = replies.length - INITIAL_REPLIES_SHOWN;

    return (
      <div key={comment.id} className={marginClass}>
        {/* Thread connector line for nested comments */}
        <div className={`flex gap-2.5 group py-2 ${depth > 0 ? 'border-l-2 border-app pl-3' : ''}`}>
          {/* P0.4: comment.author is always a serializer output now (handle / */}
          {/* displayName / avatarUrl). Legacy username / profile_picture_url */}
          {/* aliases are gone. */}
          {comment.author?.avatarUrl ? (
            <Image
              src={comment.author.avatarUrl}
              alt={authorName}
              className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5"
              width={28}
              height={28}
              sizes="28px"
              quality={75}
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-surface-muted text-app-muted flex items-center justify-center text-[10px] font-semibold flex-shrink-0 mt-0.5">
              {authorInitial}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="bg-surface-muted rounded-xl px-3 py-2 border border-app">
              {comment.author?.handle ? (
                <UserIdentityLink
                  userId={comment.author?.id || comment.user_id}
                  username={comment.author.handle}
                  displayName={authorName}
                  avatarUrl={comment.author?.avatarUrl || null}
                  city={comment.author?.locality?.city || null}
                  state={comment.author?.locality?.state || null}
                  textClassName="text-xs font-semibold text-app hover:underline"
                />
              ) : (
                <span className="text-xs font-semibold text-app">{authorName}</span>
              )}
              <p className="text-sm text-app leading-relaxed mt-0.5 whitespace-pre-wrap">
                {comment.comment}
              </p>

              {imageAttachments.length > 0 && (
                <div className={`mt-2 grid gap-2 ${imageAttachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {imageAttachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-xl border border-app bg-surface"
                    >
                      <FeedMediaImage
                        src={attachment.file_url}
                        alt={attachment.original_filename}
                        className={imageAttachments.length === 1
                          ? 'max-h-[26rem] w-full rounded-xl object-contain bg-surface'
                          : 'h-40 w-full object-cover'}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}

              {fileAttachments.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {fileAttachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-app bg-surface px-2.5 py-2 text-xs text-app hover-bg-app transition"
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary-50 text-primary-700">📎</span>
                      <span className="truncate">{attachment.original_filename}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 px-1">
              <span className="text-[10px] text-app-muted">{timeAgo(comment.created_at)}</span>
              {comment.is_edited && (
                <span className="text-[10px] text-app-muted italic">edited</span>
              )}
              <button
                onClick={() => onLikeComment?.(comment.id)}
                className={`flex items-center gap-1 text-[11px] font-semibold transition px-1 py-0.5 -mx-1 rounded-md ${
                  comment.userHasLiked ? 'text-red-500' : 'text-app-muted hover:text-red-400'
                }`}
              >
                <Heart className={`h-3.5 w-3.5 ${comment.userHasLiked ? 'fill-current' : ''}`} />
                {(comment.like_count || 0) > 0 && <span>{comment.like_count}</span>}
              </button>
              <button
                onClick={() => setReplyTo({ id: comment.id, name: authorName })}
                className="text-[10px] font-semibold text-app-muted hover:text-primary-600 transition"
              >
                Reply
              </button>
              {isOwn && (
                <button
                  onClick={() => void onDeleteComment(comment.id)}
                  className="text-[10px] font-semibold text-red-400 hover:text-red-500 transition"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Render visible replies recursively */}
        {visibleReplies.map((r) => renderComment(r, depth + 1))}

        {/* "View more replies" toggle */}
        {hiddenCount > 0 && !isExpanded && (
          <div className={indentLevel > 0 ? 'ml-8' : ''}>
            <button
              onClick={() => toggleExpanded(comment.id)}
              className="flex items-center gap-1.5 ml-3 py-1.5 text-[11px] font-semibold text-primary-600 hover:text-primary-700 transition"
            >
              <ChevronDown className="h-3 w-3" />
              View {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}
            </button>
          </div>
        )}

        {/* Collapse button when expanded */}
        {hiddenCount > 0 && isExpanded && (
          <div className={indentLevel > 0 ? 'ml-8' : ''}>
            <button
              onClick={() => toggleExpanded(comment.id)}
              className="flex items-center gap-1.5 ml-3 py-1.5 text-[11px] font-semibold text-app-muted hover:text-app transition"
            >
              <ChevronUp className="h-3 w-3" />
              Hide replies
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {comments.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-xs text-app-muted">No comments yet — start the conversation</p>
        </div>
      ) : (
        <div className="divide-y divide-app">
          {topLevel.map((c) => renderComment(c, 0))}
        </div>
      )}

      <div className="sticky bottom-0 bg-surface border-t border-app px-3 py-3 mt-2">
        {!canCompose ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            {composeDisabledMessage || 'You can read comments here, but commenting is disabled in this context.'}
          </div>
        ) : (
          <>
            {replyTo && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-app bg-surface-muted px-2.5 py-1.5 text-[10px] text-app-muted">
                <span>Replying to <strong>{replyTo.name}</strong></span>
                <button onClick={() => setReplyTo(null)} className="ml-auto text-app-muted hover:text-app">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {selectedFiles.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-app bg-surface-muted"
                  >
                    {/* unoptimized: local blob URL */}
                    {previewUrls[idx] ? (
                      <Image
                        src={previewUrls[idx] as string}
                        alt={file.name}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="h-full w-full animate-pulse bg-app-border-subtle" aria-hidden />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-app bg-surface-muted p-2">
              <textarea
                ref={inputRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={replyTo ? `Reply to ${replyTo.name}…` : 'Add a comment, emoji, or photo…'}
                className="min-h-[72px] w-full resize-none bg-transparent px-2 py-1 text-sm text-app outline-none placeholder:text-app-muted"
                disabled={isPosting}
                spellCheck
                autoCorrect="on"
                autoCapitalize="sentences"
              />

              <div className="flex items-center gap-2 px-1 pt-1">
                <div className="relative">
                  <button
                    ref={emojiButtonRef}
                    onClick={() => setEmojiOpen((open) => !open)}
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-app-muted hover-bg-app transition"
                    title="Add emoji"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  <EmojiPickerPopover
                    isOpen={emojiOpen}
                    onClose={() => setEmojiOpen(false)}
                    onSelect={handleEmojiSelect}
                    anchorRef={emojiButtonRef}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={selectedFiles.length >= 4}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-app-muted hover-bg-app transition disabled:opacity-40"
                  title="Attach image"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFilePick}
                />

                <span className="text-[11px] text-app-muted">
                  {selectedFiles.length > 0 ? `${selectedFiles.length}/4 images selected` : 'Ctrl/Cmd + Enter to send'}
                </span>

                <button
                  onClick={resetComposer}
                  type="button"
                  className="ml-auto rounded-xl px-3 py-2 text-xs font-medium text-app-muted hover-bg-app transition"
                >
                  Clear
                </button>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={(!newComment.trim() && selectedFiles.length === 0) || isPosting}
                  className="rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isPosting ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
