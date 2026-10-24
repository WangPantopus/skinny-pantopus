'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ChatAttachmentMenu from './ChatAttachmentMenu';
import EmojiPickerPopover, { preloadEmojiPicker } from './EmojiPickerPopover';
import type { ChatReplyQuote } from './ChatMessageBubble';
import { chatDraftCommit, chatDraftSignature, loadChatDraft, saveChatDraft,
  type ChatComposerDraft, type ChatDraftConfig, type ChatDraftSnapshot } from './chatDrafts';
import type { ChatDraftCommit } from './chatStorage';

type AttachAction = 'photos' | 'documents' | 'gig' | 'listing';

interface ChatInputProps {
  onSend: (text: string, files?: File[], draft?: ChatDraftCommit) => Promise<void>;
  draft?: ChatDraftConfig;
  sending: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Called when the user picks "Share a Task" or "Share a Listing" from the attachment menu */
  onAttachAction?: (action: 'gig' | 'listing') => void;
  /** Compact mode for mini chat widget — removes max-width and reduces padding */
  compact?: boolean;
  /** The message the next send replies to, shown above the field ("Replying to …"). */
  replyingTo?: (ChatReplyQuote & { messageId?: string; roomId?: string; roomHref?: string }) | null;
  onCancelReply?: () => void;
  editingMessage?: { messageId: string; text: string } | null;
  onCancelEdit?: () => void;
  onSaveEdit?: (text: string) => Promise<void>;
  typingPeerCount?: number;
  onTypingChange?: (active: boolean) => void;
  /** Why the conversation takes no messages (the server's sentence): shown in place of the composer. */
  lockedNote?: string | null;
}

export default function ChatInput({ onSend, draft, sending, disabled = false, placeholder = 'Type a message…', onAttachAction, compact = false, replyingTo = null, onCancelReply, editingMessage = null, onCancelEdit, onSaveEdit, typingPeerCount = 0, onTypingChange, lockedNote = null }: ChatInputProps) {
  const [text, setText] = useState('');
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const editRequestRef = useRef(false);
  const activeEditRef = useRef(editingMessage?.messageId);
  activeEditRef.current = editingMessage?.messageId;
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const retainingRef = useRef(false);
  const [draftReady, setDraftReady] = useState(!draft);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftWake, setDraftWake] = useState(0);
  const draftLoaded = useRef(!draft);
  const draftConfig = useRef(draft);
  draftConfig.current = draft;
  const draftWriter = useRef<{ snapshot: ChatDraftSnapshot | null; promise: Promise<unknown>; version: number; signature?: string }>({ snapshot: null, promise: Promise.resolve(), version: 0 });
  const draftLive = useRef<ChatComposerDraft>({ text: '', editText: '', files: [], reply: null, edit: null });
  draftLive.current = { text, editText, files: selectedFiles,
    reply: replyingTo?.messageId ? { ...replyingTo, messageId: replyingTo.messageId } : null,
    edit: editingMessage ? { ...editingMessage, text: editText } : null };
  const retainDraft = useCallback(async (force = false, state = draftLive.current) => {
    const writer = draftWriter.current;
    if (!draftLoaded.current || !writer.snapshot || (retainingRef.current && !force)) return undefined;
    const signature = chatDraftSignature(state);
    const version = ++writer.version;
    const operation = writer.promise.catch(() => {}).then(async () => {
      if ((!force && version !== writer.version) || !writer.snapshot || writer.signature === signature) return;
      if (mountedRef.current) setDraftSaving(true);
      writer.snapshot = await saveChatDraft(writer.snapshot, state);
      writer.signature = signature;
      if (mountedRef.current) setDraftError(null);
    }).finally(() => { if (mountedRef.current && version === writer.version) setDraftSaving(false); });
    writer.promise = operation;
    await operation;
    return chatDraftCommit(writer.snapshot);
  }, []);
  useEffect(() => {
    if (!draft?.actorId || !draft.ready || draftLoaded.current) return;
    let cancelled = false;
    void loadChatDraft(draft.actorId, draft.key).then(async ({ snapshot, draft: saved }) => {
      if (cancelled) return;
      draftWriter.current.snapshot = snapshot;
      draftWriter.current.signature = chatDraftSignature(saved ?? { text: '', editText: '', files: [], reply: null, edit: null });
      if (saved) {
        setText(saved.text); setSelectedFiles(saved.files); setEditText(saved.editText);
        await draftConfig.current?.restoreContext({ reply: saved.reply, edit: saved.edit ? { ...saved.edit, text: saved.editText } : null });
      }
      if (!cancelled) { draftLoaded.current = true; setDraftReady(true); }
    }).catch((error: unknown) => {
      if (!cancelled) { setDraftError(error instanceof Error ? error.message : 'Draft recovery is unavailable. Reopen this conversation to try again.'); }
    });
    return () => { cancelled = true; };
  }, [draft?.actorId, draft?.key, draft?.ready]);
  useEffect(() => {
    if (!draftReady) return;
    void retainDraft().catch((error: unknown) => {
      if (mountedRef.current) setDraftError(error instanceof Error ? error.message : 'This draft could not be saved on this device. Keep this page open.');
    });
  }, [text, editText, selectedFiles, replyingTo, editingMessage, draftReady, draftWake, retainDraft]);
  const inputDisabled = disabled || !draftReady;
  useEffect(() => {
    if (disabled || lockedNote || editingMessage) onTypingChange?.(false);
    return () => onTypingChange?.(false);
  }, [disabled, lockedNote, editingMessage, onTypingChange]);

  useEffect(() => {
    setEditText(editingMessage?.text || '');
    setError(null);
    if (editingMessage) inputRef.current?.focus();
  }, [editingMessage]);
  // The emoji picker is not in the page bundle: fetch it once the conversation
  // has opened and the page is idle, so the first tap on the emoji button opens
  // it at once. Its ~550 KB parse must not land in the conversation's first
  // paint, and a picker loaded on demand applies its first pick a moment late.
  useEffect(() => {
    let idle: number | undefined;
    const timer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(preloadEmojiPicker, { timeout: 4000 });
      else preloadEmojiPicker();
    }, 800);
    return () => { window.clearTimeout(timer); if (idle !== undefined) window.cancelIdleCallback(idle); };
  }, []);
  const visibleText = editingMessage ? editText : text;
  const setVisibleText = editingMessage ? setEditText : setText;
  const saveEdit = async () => {
    if (!editingMessage || !onSaveEdit || !editText.trim() || editRequestRef.current) return;
    const messageId = editingMessage.messageId;
    editRequestRef.current = true; setSavingEdit(true); setError(null);
    try { await onSaveEdit(editText); }
    catch (error) { if (mountedRef.current && activeEditRef.current === messageId) setError(error instanceof Error ? error.message : 'Could not save changes. Try again.'); }
    finally { editRequestRef.current = false; if (mountedRef.current) setSavingEdit(false); }
  };

  // Starting a reply puts the cursor in the field.
  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  const handleSend = async () => {
    if (editingMessage) { await saveEdit(); return; }
    const trimmed = text.trim();
    const hasFiles = selectedFiles.length > 0;
    if ((!trimmed && !hasFiles) || retainingRef.current || sending || inputDisabled) return;
    retainingRef.current = true;
    onTypingChange?.(false);

    const savedText = trimmed;
    const savedFiles = [...selectedFiles];
    const savedDraft = draftLive.current;
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
      const committedDraft = await retainDraft(true, savedDraft);
      await onSend(savedText, savedFiles.length > 0 ? savedFiles : undefined, committedDraft);
      if (draftWriter.current.snapshot) draftWriter.current.snapshot = { ...draftWriter.current.snapshot, saved: null };
      draftWriter.current.signature = undefined;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Failed to send';
      setError(errMsg);
      setText((current) => current ? `${savedText} ${current}`.trim() : savedText);
      setSelectedFiles((current) => [...savedFiles, ...current]);
    } finally { retainingRef.current = false; if (mountedRef.current) setDraftWake((value) => value + 1); }
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
        {typingPeerCount > 0 && <p role="status" className="mb-1 text-xs text-app-muted">{typingPeerCount > 1 ? 'People are typing…' : 'Typing…'}</p>}
        {draftSaving && <p role="status" className="mb-1 text-xs text-app-muted">Saving draft…</p>}
        {(error || draftError) && (
          <div className="mb-2 text-xs text-red-600">{error || draftError}</div>
        )}
        {replyingTo && !editingMessage && !disabled && (
          <div className="mb-2 flex items-start gap-2 rounded border-l-[3px] border-primary-500 bg-primary-500/[0.08] px-2 py-1 text-xs">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-primary-600">Replying to {replyingTo.senderName}</div>
              <div className="line-clamp-1 text-app-muted">{replyingTo.text}</div>
              {replyingTo.roomHref && <Link href={replyingTo.roomHref} className="underline">Open original conversation</Link>}
            </div>
            <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="text-app-text-secondary hover:text-app">
              ×
            </button>
          </div>
        )}
        {editingMessage && (
          <div className="mb-2 flex items-center gap-2 rounded border-l-[3px] border-primary-500 bg-primary-500/[0.08] px-2 py-1 text-xs">
            <div className="min-w-0 flex-1 font-semibold text-primary-600">Editing message</div>
            <button type="button" disabled={savingEdit} onClick={onCancelEdit} aria-label="Cancel edit" className="text-app-text-secondary hover:text-app disabled:opacity-50">×</button>
          </div>
        )}
        {selectedFiles.length > 0 && !editingMessage && (
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
          <ChatAttachmentMenu onAction={handleAttachAction} disabled={sending || inputDisabled || Boolean(editingMessage)} />
          <div className="relative">
            <button
              ref={emojiBtnRef}
              type="button"
              onPointerEnter={preloadEmojiPicker}
              onFocus={preloadEmojiPicker}
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
                setVisibleText(prev => prev + emoji);
                setShowEmoji(false);
                inputRef.current?.focus();
              }}
              anchorRef={emojiBtnRef}
            />
          </div>
          <input
            ref={inputRef}
            value={visibleText}
            onChange={e => { setVisibleText(e.target.value); onTypingChange?.(!editingMessage && Boolean(e.target.value.trim())); }}
            onFocus={() => onTypingChange?.(!editingMessage && Boolean(visibleText.trim()))}
            onBlur={() => onTypingChange?.(false)}
            maxLength={editingMessage ? 10000 : undefined}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              } else if (e.key === 'Escape' && editingMessage && !savingEdit) {
                onCancelEdit?.();
              } else if (e.key === 'Escape' && replyingTo) {
                onCancelReply?.();
              }
            }}
            placeholder={placeholder}
            disabled={inputDisabled || savingEdit}
            className="flex-1 px-4 py-2.5 border border-app-border-strong rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-surface text-app disabled:bg-surface-muted disabled:text-app-muted"
          />
          <button
            onClick={handleSend}
            onMouseDown={e => e.preventDefault()}
            aria-label={editingMessage ? 'Save changes' : 'Send message'}
            disabled={sending || inputDisabled || savingEdit || (editingMessage ? !editText.trim() : (!text.trim() && selectedFiles.length === 0))}
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
