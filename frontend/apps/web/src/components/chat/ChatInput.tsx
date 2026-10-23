'use client';

import { useEffect, useRef, useState } from 'react';
import ChatAttachmentMenu from './ChatAttachmentMenu';
import EmojiPickerPopover from './EmojiPickerPopover';
import type { ChatReplyQuote } from './ChatMessageBubble';

type AttachAction = 'photos' | 'documents' | 'gig' | 'listing';

interface ChatInputProps {
  onSend: (text: string, files?: File[]) => Promise<void>;
  sending: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Called when the user picks "Share a Task" or "Share a Listing" from the attachment menu */
  onAttachAction?: (action: 'gig' | 'listing') => void;
  /** Compact mode for mini chat widget — removes max-width and reduces padding */
  compact?: boolean;
  /** The message the next send replies to, shown above the field ("Replying to …"). */
  replyingTo?: ChatReplyQuote | null;
  onCancelReply?: () => void;
  /** Why the conversation takes no messages (the server's sentence): shown in place of the composer. */
  lockedNote?: string | null;
}

export default function ChatInput({ onSend, sending, disabled = false, placeholder = 'Type a message…', onAttachAction, compact = false, replyingTo = null, onCancelReply, lockedNote = null }: ChatInputProps) {
  const [text, setText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);

  // Starting a reply puts the cursor in the field.
  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  const handleSend = async () => {
    const trimmed = text.trim();
    const hasFiles = selectedFiles.length > 0;
    if ((!trimmed && !hasFiles) || sending || disabled) return;

    const savedText = trimmed;
    const savedFiles = [...selectedFiles];
    setText('');
    setSelectedFiles([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Re-focus after React's batched re-render completes.
    // Using requestAnimationFrame ensures the DOM has updated.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    try {
      await onSend(savedText, savedFiles.length > 0 ? savedFiles : undefined);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Failed to send';
      setError(errMsg);
      setText(savedText);
      setSelectedFiles(savedFiles);
    }
  };

  const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []) as File[];
    if (incoming.length === 0) return;
    const valid = incoming.filter(file => {
      const limit = file.type.startsWith('video/') ? 100 : file.type.startsWith('image/') ? 10 : 25;
      return file.size > 0 && file.size <= limit * 1024 * 1024;
    });
    setError(valid.length !== incoming.length ? 'Some files could not be added. Images: 10 MB, videos: 100 MB, documents: 25 MB maximum; empty files are not supported.' : null);
    setSelectedFiles(prev => [...prev, ...valid].slice(0, 5));
    e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAttachAction = (action: AttachAction) => {
    if (action === 'photos') {
      // Open file picker for images/videos
      if (fileInputRef.current) {
        fileInputRef.current.accept = 'image/*,video/*';
        fileInputRef.current.click();
      }
    } else if (action === 'documents') {
      // Open file picker for any file type
      if (fileInputRef.current) {
        fileInputRef.current.accept = '';
        fileInputRef.current.click();
      }
    } else if (action === 'gig' || action === 'listing') {
      onAttachAction?.(action);
    }
  };

  if (lockedNote) {
    return (
      <footer className="bg-surface border-t border-app shrink-0">
        <div className={compact ? 'px-2 py-2' : 'max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3'}>
          <p role="status" className="text-center text-sm text-app-text-secondary">{lockedNote}</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-surface border-t border-app shrink-0">
      <div className={compact ? 'px-2 py-2' : 'max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3'}>
        {error && (
          <div className="mb-2 text-xs text-red-600">{error}</div>
        )}
        {replyingTo && !disabled && (
          <div className="mb-2 flex items-start gap-2 rounded border-l-[3px] border-primary-500 bg-primary-500/[0.08] px-2 py-1 text-xs">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-primary-600">Replying to {replyingTo.senderName}</div>
              <div className="line-clamp-1 text-app-muted">{replyingTo.text}</div>
            </div>
            <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="text-app-text-secondary hover:text-app">
              ×
            </button>
          </div>
        )}
        {selectedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selectedFiles.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="inline-flex items-center gap-2 rounded-full bg-surface-muted border border-app px-3 py-1 text-xs text-app-text-strong"
              >
                {f.name}
                <button type="button" onClick={() => removeFile(i)} className="text-app-text-secondary hover:text-app">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handlePickFiles} />
        <div className="flex gap-2 items-end">
          <ChatAttachmentMenu onAction={handleAttachAction} disabled={sending || disabled} />
          <div className="relative">
            <button
              ref={emojiBtnRef}
              type="button"
              onClick={() => setShowEmoji(prev => !prev)}
              className="p-2 text-app-text-secondary hover:text-app-text rounded-full hover:bg-surface-muted transition-colors"
              title="Emoji"
            >
              <span className="text-xl">😊</span>
            </button>
            <EmojiPickerPopover
              isOpen={showEmoji}
              onClose={() => setShowEmoji(false)}
              onSelect={(emoji) => {
                setText(prev => prev + emoji);
                setShowEmoji(false);
                inputRef.current?.focus();
              }}
              anchorRef={emojiBtnRef}
            />
          </div>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              } else if (e.key === 'Escape' && replyingTo) {
                onCancelReply?.();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 px-4 py-2.5 border border-app-border-strong rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-surface text-app disabled:bg-surface-muted disabled:text-app-muted"
          />
          <button
            onClick={handleSend}
            onMouseDown={e => e.preventDefault()}
            aria-label="Send message"
            disabled={sending || disabled || (!text.trim() && selectedFiles.length === 0)}
            className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  );
}
