'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { ChatMessage as BaseChatMessage, User } from '@pantopus/types';
import { getDateKey, formatDateLabel } from '@pantopus/ui-utils';
import { useSocket, useSocketConnected } from './useSocket';
import { useSocketEvent, useSocketEmit } from './useSocket';
import { useChatTyping } from './useChatTyping';
import { chosenUsername } from '@pantopus/utils';
import { confirmStore } from '@/components/ui/confirm-store';
import { queryKeys } from '@/lib/query-keys';
import { activateChatStorage, deleteChatRecords, readChatRecord, writeChatRecords, type ChatDraftCommit } from '@/components/chat/chatStorage';
import type { ChatDraftConfig, ChatDraftContext } from '@/components/chat/chatDrafts';
import { enqueueChatSend, pendingChatMessage, removeChatSend, resumeChatOutbox, retryChatSend, startChatOutbox, subscribeChatOutbox, type PendingChatSend } from '@/components/chat/chatOutbox';

type ChatMessage = BaseChatMessage & { sync_version?: number; read_at?: string | null };

// Re-export shared helpers so existing consumers don't break
export { getDateKey, formatDateLabel };

// ── Helpers ─────────────────────────────────────────────────

/** Same total order as the API cursor, including sub-millisecond timestamps. */
function compareMessages(a: ChatMessage, b: ChatMessage): number {
  const time = messageTime(a) - messageTime(b);
  if (time) return time;
  const fraction = (m: ChatMessage) => (m.created_at?.match(/\.(\d+)/)?.[1] || '').padEnd(6, '0');
  return fraction(a).localeCompare(fraction(b)) || String(a.id).localeCompare(String(b.id));
}

function sortAsc(items: ChatMessage[]): ChatMessage[] {
  return [...items].sort(compareMessages);
}

function clientMessageId(message: ChatMessage): string | undefined {
  const id = (message as Record<string, any>).client_message_id || (message as Record<string, any>)._clientMessageId;
  return id ? `${message.room_id}:${message.user_id || message.sender_id || message.sender?.id}:${id}` : undefined;
}

function messageRevision(message: Partial<ChatMessage>): number {
  return Number((message as api.chat.ChatSyncMessage).sync_version) || 0;
}

function mergeMessageRecord(existing: ChatMessage | undefined, incoming: ChatMessage): ChatMessage {
  if (existing && messageRevision(existing) > messageRevision(incoming)) return existing;
  const merged = { ...existing, ...incoming } as ChatMessage;
  // Receipt state is monotonic even when an equal-version history row races a
  // newer peer acknowledgement (read state has its own participant cursor).
  if (existing?.read_at && (!incoming.read_at || Date.parse(existing.read_at) > Date.parse(incoming.read_at))) merged.read_at = existing.read_at;
  // Omitted reactions are a partial socket payload. An explicit [] is authoritative,
  // including when the last reaction was removed while this device was offline.
  if (incoming.reactions === undefined && existing?.reactions !== undefined) merged.reactions = existing.reactions;
  if (!(incoming as Record<string, any>)._optimistic && !(incoming as Record<string, any>)._failed) {
    Object.assign(merged, { _optimistic: false, _failed: false, _refused: false, _outbox: false, _queued: false, _error: undefined });
  }
  return merged;
}

/** Every source retires the same pending send, including history after a lost ACK. */
function mergeMessages(prev: ChatMessage[], next: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  const byClientId = new Map<string, string>();
  for (const message of [...prev, ...next]) {
    if (!message?.id) continue;
    const id = String(message.id);
    const clientId = clientMessageId(message);
    const pendingId = clientId ? byClientId.get(clientId) : undefined;
    const previous = byId.get(id) || (pendingId ? byId.get(pendingId) : undefined);
    // A late pending state must never replace a message already accepted by the server.
    if (previous && !(previous as Record<string, any>)._optimistic && !(previous as Record<string, any>)._failed
        && ((message as Record<string, any>)._optimistic || (message as Record<string, any>)._failed)) continue;
    if (pendingId && pendingId !== id) byId.delete(pendingId);
    byId.set(id, mergeMessageRecord(previous, message));
    if (clientId) byClientId.set(clientId, id);
  }
  return sortAsc(Array.from(byId.values()));
}

function insertMessageSorted(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  if (!incoming?.id) return messages;
  const clientId = clientMessageId(incoming);
  const existing = messages.find((m) => String(m.id) === String(incoming.id)
    || (clientId && clientMessageId(m) === clientId));
  const message = mergeMessageRecord(existing, incoming);
  const result = existing ? messages.filter((m) => String(m.id) !== String(incoming.id)
    && !(clientId && clientMessageId(m) === clientId)) : messages.slice();
  let lo = 0;
  let hi = result.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (compareMessages(result[mid], message) < 0) lo = mid + 1;
    else hi = mid;
  }
  result.splice(lo, 0, message);
  return result;
}

// In-memory visits remain instant; encrypted recent history also survives a
// reload. Both are account-scoped and retired on sign-out.

interface ConversationSnapshot {
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
  roomIds: string[];
  resolvedRoomId: string | null;
  peer: User | null;
  syncCursors?: api.chat.ChatSyncCursors;
  tombstones?: Record<string, number>;
}

function conversationCacheKey(roomId?: string, otherUserId?: string, topicId?: string | null, asBusinessUserId?: string, accountId?: string | null) {
  if (roomId) return queryKeys.chatMessages(`${accountId ?? 'loading'}:room:${roomId}:${asBusinessUserId ?? 'me'}`);
  if (otherUserId) return queryKeys.chatMessages(`${accountId ?? 'loading'}:person:${otherUserId}:${topicId ?? 'all'}:${asBusinessUserId ?? 'me'}`);
  return null;
}

const messageTime = (m: ChatMessage) => (m?.created_at ? new Date(m.created_at).getTime() : 0);
const isUnsent = (m: ChatMessage) => Boolean((m as Record<string, any>)._failed || (m as Record<string, any>)._optimistic);

interface MessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
  roomIds?: string[];
  sendRefusal?: { error?: string } | null;
  syncCursors?: api.chat.ChatSyncCursors;
}

type ChatMessageLike = Partial<ChatMessage> & {
  attachments?: unknown;
  type?: string;
  message?: string;
};

export function extractAttachments(msg: ChatMessageLike): Record<string, any>[] {
  const raw = msg?.attachments;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: unknown) => {
      if (typeof a === 'string') return { id: a, original_filename: 'Attachment', file_url: null, mime_type: '' };
      if (a && typeof a === 'object') return a as Record<string, any>;
      return null;
    })
    .filter((x): x is Record<string, any> => x != null);
}

// Chat people (message senders, room participants) arrive either as a legacy user
// row (name / username / profile_picture_url) or as the identity card the chat
// routes now send (displayName / handle / avatarUrl / href). Read both.
type ChatPerson = Record<string, any> | null | undefined;

export function chatPersonName(person: ChatPerson): string | undefined {
  if (!person) return undefined;
  return (person.displayName as string)
    || (person.name as string)
    || [person.first_name ?? person.firstName, person.last_name ?? person.lastName].filter(Boolean).join(' ')
    // A made-up username (user_…) is never shown as the person's name.
    || chosenUsername(person.username as string)
    || chosenUsername(person.handle as string)
    || undefined;
}

export function chatPersonHandle(person: ChatPerson): string | undefined {
  return (person?.username as string) || (person?.handle as string) || undefined;
}

export function chatPersonAvatar(person: ChatPerson): string | undefined {
  return (person?.profile_picture_url as string) || (person?.avatarUrl as string) || undefined;
}

export function chatPersonHref(person: ChatPerson): string | null {
  if (typeof person?.href === 'string' && person.href.startsWith('/')) return person.href;
  const handle = chatPersonHandle(person);
  return handle ? `/${handle}` : null;
}

export function resolveMessageType(msg: ChatMessageLike): string {
  const rawType = msg?.message_type || msg?.type || 'text';
  const metadata = msg?.metadata || {};
  if (rawType === 'text' && (metadata.listingId || metadata.listing_id)) return 'listing_offer';
  if (rawType === 'text' && (metadata.gigId || metadata.gig_id)) return 'gig_offer';
  return rawType;
}

/** Shown when a conversation has no room yet, so a share or send has nowhere to go. */
export const CONVERSATION_NOT_READY = "This conversation isn't ready yet. Try again in a moment.";

/** Why sharing a task or listing card failed: the server's reason when it sent one. */
export function shareFailureMessage(err: unknown): string {
  const message = err instanceof Error ? err.message.trim() : '';
  return message || "Couldn't share that. Try again.";
}

// ── Types ───────────────────────────────────────────────────

export interface UseChatMessagesOptions {
  /** Room-based mode (ChatRoomView) */
  roomId?: string;
  /** Person-based mode (ConversationView) */
  otherUserId?: string;
  /** Topic filter for person-based mode */
  topicId?: string | null;
  /** Open an authorized search match with a bounded surrounding window. */
  initialMessageId?: string;
  /** Business identity for room-based mode */
  asBusinessUserId?: string;
  /** Check if a sender id belongs to current user (room mode uses business identity) */
  isOwnMessage?: (senderId: string) => boolean;
  /** Current user ID (used for reaction reacted_by_me recalculation) */
  currentUserId?: string | null;
}

/** Why the first page of a conversation could not load (null when it did). */
export type ChatLoadFailure = 'forbidden' | 'notFound' | 'unavailable';

/** The message the next send replies to, as the composer's reply bar and the reply's quote show it. */
export interface ChatReplyTarget {
  messageId: string;
  roomId?: string;
  senderName: string;
  text: string;
}

export interface UseChatMessagesReturn {
  messages: ChatMessage[];
  loading: boolean;
  /** The first load failed, so the conversation is not shown at all. */
  loadFailure: ChatLoadFailure | null;
  /** Try the first load again after a failure. */
  retryLoad: () => void;
  error: string | null;
  setError: (e: string | null) => void;
  connected: boolean;
  typingPeerCount: number;
  onTypingChange: (active: boolean) => void;
  composerDraft: ChatDraftConfig;
  sending: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  contextAnchorId: string | null;
  resolvedRoomId: string | null;
  /** Populated in person-based mode after createDirectChat resolves (header / avatar). */
  directChatPeer: User | null;
  /** Person-based mode: why the conversation could not be started (null when it was). */
  directChatError: string | null;
  /**
   * Why this conversation takes no messages from you, as the server says it (a draft or closed business: code
   * NOT_PUBLISHED), or null. The composer shows this line instead of a field.
   */
  sendRefusal: string | null;
  sendMessage: (text: string, files?: File[], draft?: ChatDraftCommit) => Promise<void>;
  sendSharedMessage: (message: Pick<PendingChatSend, 'text' | 'metadata' | 'topicRequest'> & { messageType: 'gig_offer' | 'listing_offer' }) => Promise<void>;
  /** The message the next send replies to (the composer shows "Replying to …"), or null. */
  replyingTo: ChatReplyTarget | null;
  beginReply: (target: ChatReplyTarget) => void;
  cancelReply: () => void;
  canChangeMessage: (message: BaseChatMessage) => boolean;
  editingMessage: { messageId: string; text: string } | null;
  beginEdit: (message: BaseChatMessage) => void;
  cancelEdit: () => void;
  saveEdit: (text: string) => Promise<void>;
  deleteMessage: (message: BaseChatMessage) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  removePendingMessage: (messageId: string) => Promise<void>;
  loadOlder: () => Promise<void>;
  refresh: () => Promise<void>;
  onVisibleMessage: (messageId: string) => void;
  /** `reacted`: the state asked for; by default the opposite of the message's current state. */
  reactToMessage: (messageId: string, emoji: string, reacted?: boolean) => Promise<void>;
}

/** The server's own sentence for a failed send, when the client carried one. */
function sendFailureReason(err: unknown): string | null {
  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
}

/**
 * The reply a send can carry: the server refuses a whole send whose reply target isn't a sent message of that room,
 * so a reply to a message still sending, or to another room's message in a person view, goes without its quote.
 */
function replyTargetIn(messages: ChatMessage[], replyToId: string | null | undefined, roomId: string): string | undefined {
  if (!replyToId) return undefined;
  const original = messages.find((m) => String(m.id) === String(replyToId)) as Record<string, any> | undefined;
  if (!original || original._optimistic || original._failed) return undefined;
  return String(original.room_id || '') === String(roomId) ? String(original.id) : undefined;
}

// ── Hook ────────────────────────────────────────────────────

export function useChatMessages(opts: UseChatMessagesOptions): UseChatMessagesReturn {
  const { roomId, otherUserId, topicId, asBusinessUserId, currentUserId, initialMessageId } = opts;
  const isRoomMode = Boolean(roomId);

  const queryClient = useQueryClient();
  const cacheKey = useMemo(() => conversationCacheKey(roomId, otherUserId, topicId, asBusinessUserId, currentUserId), [roomId, otherUserId, topicId, asBusinessUserId, currentUserId]);
  const cacheKeyId = `${currentUserId ?? ''}:${cacheKey ? JSON.stringify(cacheKey) : ''}`;
  const scopeRef = useRef({ key: cacheKeyId, generation: 0 });
  if (scopeRef.current.key !== cacheKeyId) scopeRef.current = { key: cacheKeyId, generation: scopeRef.current.generation + 1 };
  const scopeGeneration = scopeRef.current.generation;
  const deniedScopeRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const isCurrentScope = useCallback(() => mountedRef.current && scopeRef.current.key === cacheKeyId && scopeRef.current.generation === scopeGeneration, [cacheKeyId, scopeGeneration]);
  const readSnapshot = useCallback(
    () => (cacheKey ? queryClient.getQueryData<ConversationSnapshot>(cacheKey) : undefined),
    [queryClient, cacheKey],
  );
  const [initialSnapshot] = useState(readSnapshot);
  // Which conversation the messages on screen belong to; only those are kept.
  const shownKeyRef = useRef<string | null>(initialSnapshot ? cacheKeyId : null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => initialSnapshot?.messages ?? []);
  const [loading, setLoading] = useState(() => !initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [loadFailure, setLoadFailure] = useState<ChatLoadFailure | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [contextAnchorId, setContextAnchorId] = useState<string | null>(null);
  const contextWindowRef = useRef(Boolean(initialMessageId));
  const contextReadyRef = useRef(!initialMessageId);
  const historyViewRef = useRef(0);
  const [hasMore, setHasMore] = useState(() => initialSnapshot?.hasMore ?? false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(() => roomId || initialSnapshot?.resolvedRoomId || null);
  const [directChatPeer, setDirectChatPeer] = useState<User | null>(() => initialSnapshot?.peer ?? null);
  const [directChatError, setDirectChatError] = useState<string | null>(null);
  const [conversationRoomIds, setConversationRoomIds] = useState<string[]>(() => initialSnapshot?.roomIds ?? []);
  const nextCursorRef = useRef<string | null>(initialSnapshot?.nextCursor ?? null);
  const syncCursorsRef = useRef<api.chat.ChatSyncCursors | undefined>(initialSnapshot?.syncCursors);
  const tombstonesRef = useRef(new Map<string, number>(Object.entries(initialSnapshot?.tombstones ?? {})));
  const [syncGeneration, setSyncGeneration] = useState(0);
  const completedRefreshRef = useRef(0);
  const [replyingTo, setReplyingTo] = useState<ChatReplyTarget | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ messageId: string; text: string } | null>(null);
  const editRequest = useRef(false);
  const deleteRequest = useRef(false);
  const deletionConfirmation = useRef<ReturnType<typeof confirmStore.getSnapshot>>(null);
  useEffect(() => {
    const retire = () => {
      setEditingMessage(null);
      if (deletionConfirmation.current && confirmStore.getSnapshot() === deletionConfirmation.current) confirmStore.close(false);
      deletionConfirmation.current = null;
    };
    retire();
    const unsubscribe = api.onTokenChange(retire);
    return () => { unsubscribe(); retire(); };
  }, [cacheKeyId]);
  const [sendRefusal, setSendRefusal] = useState<string | null>(null);
  // A reply, and a reason the conversation takes no messages, belong to the conversation they came from.
  useEffect(() => { setReplyingTo(null); setSendRefusal(null); }, [cacheKeyId]);

  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const socket = useSocket();
  const connected = useSocketConnected();
  const emit = useSocketEmit();

  // Refs for debounced markRead and room:join stabilization
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const prevConnectedRef = useRef(connected);
  const [roomJoinGeneration, setRoomJoinGeneration] = useState(0);

  // ── Fetch functions ─────────────────────────────────────

  const fetchMessages = useCallback(async (cursor?: { before?: string }): Promise<MessagePage> => {
    const params = { limit: 100, ...(!cursor?.before ? { sync: true } : {}), ...cursor, ...(asBusinessUserId ? { asBusinessUserId } : {}) };
    const result = isRoomMode && roomId
      ? await api.chat.getMessages(roomId, params)
      : otherUserId
        ? await api.chat.getConversationMessages(otherUserId, { ...params, ...(topicId ? { topicId } : {}) })
        : { messages: [], hasMore: false };
    return { ...result, nextCursor: result.nextCursor ?? null };
  }, [isRoomMode, roomId, otherUserId, topicId, asBusinessUserId]);

  const belongsToTopic = useCallback((message: ChatMessage) => !topicId || isRoomMode
    || String((message as Record<string, any>).topic_id || '') === String(topicId), [topicId, isRoomMode]);
  const survivesDeletion = useCallback((message: ChatMessage) => {
    const deletedAt = tombstonesRef.current.get(String(message.id));
    return deletedAt === undefined || messageRevision(message) > deletedAt;
  }, []);

  // Network reads have no side effects: stale responses cannot corrupt another
  // conversation's pagination, room subscriptions, or send permission.
  const applyPage = useCallback((page: MessagePage) => {
    if (!isCurrentScope()) return;
    nextCursorRef.current = page.nextCursor;
    setHasMore(page.hasMore);
    if ('sendRefusal' in page) setSendRefusal(page.sendRefusal?.error || null);
    if (page.roomIds) {
      const ids = Array.from(new Set(page.roomIds.map(String))).sort();
      setConversationRoomIds((previous) => previous.join(',') === ids.join(',') ? previous : ids);
    }
  }, [isCurrentScope]);

  useEffect(() => {
    if (isRoomMode || !otherUserId) {
      setConversationRoomIds([]);
    }
  }, [isRoomMode, otherUserId]);

  const visibleThroughRef = useRef<ChatMessage | null>(null);
  const readAcknowledgedRef = useRef<string | null>(null);
  const markRead = useCallback(async () => {
    if (!isCurrentScope() || !contextReadyRef.current || topicId || document.visibilityState !== 'visible') return;
    const through = visibleThroughRef.current;
    if (!through || isUnsent(through) || readAcknowledgedRef.current === through.id) return;
    try {
      const options = { throughMessageId: String(through.id), ...(asBusinessUserId ? { asBusinessUserId } : {}) };
      if (isRoomMode && roomId) await api.chat.markMessagesAsReadForIdentity(roomId, options);
      else if (otherUserId) await api.chat.markConversationAsRead(otherUserId, options);
      if (isCurrentScope()) readAcknowledgedRef.current = String(through.id);
    } catch {}
  }, [isRoomMode, roomId, otherUserId, asBusinessUserId, topicId, isCurrentScope]);

  const onVisibleMessage = useCallback((messageId: string) => {
    if (!isCurrentScope() || !contextReadyRef.current || topicId) return;
    const message = messagesRef.current.find((m) => String(m.id) === messageId);
    if (!message || isUnsent(message)) return;
    if (!visibleThroughRef.current || compareMessages(message, visibleThroughRef.current) > 0) visibleThroughRef.current = message;
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(() => {
      void markRead();
      markReadTimerRef.current = null;
    }, 250);
  }, [markRead, topicId, isCurrentScope]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    };
  }, [cacheKeyId]);

  // ── Initial load ────────────────────────────────────────

  const refreshInFlightRef = useRef<{ scope: number; promise: Promise<void> } | null>(null);
  // Socket edits/deletes/new sends that arrive during a history read win over its
  // older snapshot. Reset per scope; no message content is persisted here.
  const liveChangesRef = useRef(new Map<string, number>());
  const changeVersionRef = useRef(0);
  const reactionRequestsRef = useRef(new Map<string, Promise<void>>());
  const pendingReactionsRef = useRef(new Map<string, { intent: symbol; wanted: boolean; scope: number }>());
  const noteLiveChange = useCallback((id: string) => {
    liveChangesRef.current.set(String(id), ++changeVersionRef.current);
  }, []);

  const refresh = useCallback((): Promise<void> => {
    if (!isCurrentScope() || !currentUserId) return Promise.resolve();
    if (refreshInFlightRef.current?.scope === scopeGeneration) return refreshInFlightRef.current.promise;
    const historyView = historyViewRef.current;
    const current = () => isCurrentScope() && historyViewRef.current === historyView;
    const promise = (async () => {
      const fullRefresh = async () => {
        if (contextWindowRef.current && initialMessageId) {
          const page = await api.chat.getMessageContext({ roomId, otherUserId }, initialMessageId, { asBusinessUserId });
          if (!current()) return;
          setMessages((previous) => mergeMessages(previous.filter(isUnsent), page.messages.filter(survivesDeletion)));
          visibleThroughRef.current = null;
          readAcknowledgedRef.current = null;
          contextReadyRef.current = true;
          setContextAnchorId(page.anchorMessageId);
          applyPage(page);
          return;
        }
        const startedVersion = changeVersionRef.current;
        const loaded = messagesRef.current.filter((m) => !isUnsent(m));
        const oldest = loaded[0];
        let page = await fetchMessages();
        if (!current()) return;
        // Only the first page establishes an anchor. Its revision was captured
        // before the history query; older pages must never advance that anchor.
        const firstPageCursors = page.syncCursors;
        let refreshed = page.messages;
        const seenCursors = new Set<string>();
        while (oldest && page.hasMore && page.nextCursor
          && (!refreshed.length || compareMessages(refreshed[0], oldest) > 0)) {
          if (seenCursors.has(page.nextCursor)) throw new Error('Message history did not advance. Try again.');
          seenCursors.add(page.nextCursor);
          page = await fetchMessages({ before: page.nextCursor });
          if (!current()) return;
          refreshed = mergeMessages(page.messages, refreshed);
        }
        const changedAfterStart = (id: string) => (liveChangesRef.current.get(String(id)) || 0) > startedVersion;
        setMessages((previous) => mergeMessages(
          previous.filter((m) => isUnsent(m) || changedAfterStart(String(m.id))
            || (page.hasMore && refreshed[0] && compareMessages(m, refreshed[0]) < 0)),
          refreshed.filter((m) => !changedAfterStart(String(m.id)) && survivesDeletion(m)),
        ));
        syncCursorsRef.current = firstPageCursors;
        completedRefreshRef.current += 1;
        setSyncGeneration((value) => value + 1);
        applyPage(page);
      };
      if (!syncCursorsRef.current || (contextWindowRef.current && !contextReadyRef.current)) return fullRefresh();
      let cursor = syncCursorsRef.current;
      let until: api.chat.ChatSyncCursors | undefined;
      const changes: api.chat.ChatChanges['messages'] = [];
      const receipts: api.chat.ChatReadReceipt[] = [];
      let result: api.chat.ChatChanges;
      do {
        try {
          result = await api.chat.getMessageChanges({ roomId, otherUserId }, { cursor, until, asBusinessUserId });
        } catch (error) {
          const status = (error as { statusCode?: number })?.statusCode;
          if (status === 400 || status === 404) return fullRefresh();
          throw error;
        }
        if (!current()) return;
        if (result.resetRequired) return fullRefresh();
        changes.push(...result.messages);
        receipts.push(...result.readReceipts);
        if (result.hasMore && JSON.stringify(result.syncCursors) === JSON.stringify(cursor)) {
          throw new Error('Message recovery did not advance. Try again.');
        }
        cursor = result.syncCursors;
        until = result.untilCursors;
      } while (result.hasMore);
      for (const message of changes) {
        if ('deleted' in message && message.deleted) {
          tombstonesRef.current.set(String(message.id), Math.max(tombstonesRef.current.get(String(message.id)) ?? 0, Number(message.sync_version) || 0));
        }
      }
      const removedRooms = new Set(result.removedRoomIds);
      const fullMessages = changes.filter((message): message is api.chat.ChatSyncMessage => !('deleted' in message && message.deleted));
      setMessages((previous) => {
        const accepted = previous.filter((message) => !isUnsent(message));
        const oldest = accepted[0];
        const newest = accepted[accepted.length - 1];
        const known = new Set(previous.map((message) => String(message.id)));
        const changedTopics = new Set(fullMessages.filter((message) => !belongsToTopic(message)).map((message) => String(message.id)));
        let merged = mergeMessages(previous.filter((message) => survivesDeletion(message)
          && !removedRooms.has(message.room_id) && !changedTopics.has(String(message.id))),
        fullMessages.filter((message) => survivesDeletion(message) && belongsToTopic(message)
          && (known.has(String(message.id)) || (contextWindowRef.current
            ? oldest && newest && compareMessages(message, oldest) >= 0 && compareMessages(message, newest) <= 0
            : !oldest || !hasMore || compareMessages(message, oldest) >= 0))));
        if (otherUserId) for (const receipt of receipts) {
          if (receipt.userId !== otherUserId || !receipt.throughCreatedAt || !receipt.throughMessageId) continue;
          const boundary = { id: receipt.throughMessageId, created_at: receipt.throughCreatedAt } as ChatMessage;
          merged = merged.map((message) => !isUnsent(message) && message.room_id === receipt.roomId
            && (message.user_id || message.sender_id) === (asBusinessUserId || currentUserId)
            && compareMessages(message, boundary) <= 0
            ? mergeMessageRecord(message, { ...message, read_at: receipt.readAt }) : message);
        }
        return merged;
      });
      if (!isRoomMode) setConversationRoomIds(result.roomIds);
      // A failed intermediate page never commits a cursor or a partial batch.
      syncCursorsRef.current = cursor;
      completedRefreshRef.current += 1;
      setSyncGeneration((value) => value + 1);
    })().catch((error: unknown) => {
      const status = (error as { statusCode?: number })?.statusCode;
      if (current() && initialMessageId && status === 404) {
        setMessages([]);
        setError('This message is no longer available.');
      } else if (current() && (status === 403 || status === 404)) {
        deniedScopeRef.current = scopeGeneration;
        if (cacheKey) queryClient.removeQueries({ queryKey: cacheKey, exact: true });
        setMessages([]);
        setLoadFailure(status === 403 ? 'forbidden' : 'notFound');
        if (currentUserId) void activateChatStorage(currentUserId).then((saved) => deleteChatRecords(saved, [{ kind: 'history', key: cacheKeyId }])).catch(() => {});
      }
      throw error;
    }).finally(() => {
      if (refreshInFlightRef.current?.promise === promise) refreshInFlightRef.current = null;
    });
    refreshInFlightRef.current = { scope: scopeGeneration, promise };
    return promise;
  }, [scopeGeneration, fetchMessages, applyPage, isCurrentScope, cacheKey, cacheKeyId, currentUserId, queryClient, roomId, otherUserId, asBusinessUserId, isRoomMode, belongsToTopic, survivesDeletion, hasMore, initialMessageId]);

  // ── Tab/window foreground resume ──────────────────────────
  // When the tab becomes visible again, refresh messages to catch anything
  // missed while the tab was hidden (timers are throttled in background tabs).

  useEffect(() => {
    const key = roomId || otherUserId;
    if (!key) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [roomId, otherUserId, refresh]);

  // ── Resolve room for person-based mode ──────────────────

  useEffect(() => {
    if (!otherUserId || isRoomMode || !currentUserId) {
      setDirectChatPeer(null);
      return;
    }
    // A kept conversation shows its room and header at once while this re-checks.
    const kept = readSnapshot();
    setDirectChatPeer(kept?.peer ?? null);
    setResolvedRoomId(kept?.resolvedRoomId ?? null);
    setDirectChatError(null);
    let cancelled = false;
    (async () => {
      try {
        const result = await api.chat.createDirectChat(otherUserId, { asBusinessUserId });
        const rid = result?.roomId;
        if (!cancelled && rid) setResolvedRoomId(String(rid));
        if (!cancelled && result?.otherUser) setDirectChatPeer(result.otherUser as User);
      } catch (err) {
        if (!cancelled) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status !== 403 && status !== 404) return;
          deniedScopeRef.current = scopeRef.current.generation;
          setDirectChatPeer(null);
          setResolvedRoomId(null);
          // Say why, instead of letting a typed message vanish on Send (e.g. 403
          // "Unable to message this user" when the other person blocked you).
          const reason = sendFailureReason(err) || "We couldn't start this conversation. Try again later.";
          setDirectChatError(reason);
          setError(reason);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [otherUserId, isRoomMode, asBusinessUserId, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!roomId && !otherUserId) { setLoading(false); return; }
    if (!currentUserId) { setMessages([]); setLoading(true); return; }
    let cancelled = false;
    contextWindowRef.current = Boolean(initialMessageId);
    contextReadyRef.current = !initialMessageId;
    historyViewRef.current += 1;
    refreshInFlightRef.current = null;
    setContextAnchorId(null);
    let kept = loadAttempt === 0 ? readSnapshot() : undefined;
    const beforeRefresh = completedRefreshRef.current;
    const showKept = (snapshot?: ConversationSnapshot) => {
      if (snapshot && deniedScopeRef.current === scopeGeneration) return;
      const initial = mergeMessages(initialMessageId ? [] : snapshot?.messages ?? [], messagesRef.current.filter(isUnsent));
      setMessages(initial);
      messagesRef.current = initial;
      setHasMore(snapshot?.hasMore ?? false);
      nextCursorRef.current = snapshot?.nextCursor ?? null;
      syncCursorsRef.current = snapshot?.syncCursors;
      tombstonesRef.current = new Map(Object.entries(snapshot?.tombstones ?? {}));
      setLoading(Boolean(initialMessageId) || !snapshot);
      if (snapshot) {
        setConversationRoomIds(snapshot.roomIds);
        setResolvedRoomId(roomId || snapshot.resolvedRoomId);
        setDirectChatPeer(snapshot.peer);
        if (snapshot.resolvedRoomId) setDirectChatError(null);
      }
    };
    // A scope switch must not carry outgoing bubbles from another conversation.
    messagesRef.current = [];
    showKept(kept);
    setLoadingOlder(false);
    setSending(false);
    setError(null);
    setLoadFailure(null);
    shownKeyRef.current = cacheKeyId;
    liveChangesRef.current.clear();
    reactionRequestsRef.current.clear();
    pendingReactionsRef.current.clear();
    visibleThroughRef.current = null;
    readAcknowledgedRef.current = null;
    void (async () => {
      if (!kept && currentUserId && loadAttempt === 0) {
        try {
          await startChatOutbox(currentUserId);
          const saved = await activateChatStorage(currentUserId);
          const disk = await readChatRecord<ConversationSnapshot>(saved, 'history', cacheKeyId);
          if (cancelled || !isCurrentScope()) return;
          if (disk && Array.isArray(disk.messages) && completedRefreshRef.current === beforeRefresh) { kept = disk; showKept(disk); }
        } catch { /* The network remains usable when device storage is disabled. */ }
      }
      if (!cancelled && isCurrentScope()) await refresh();
    })().catch((e: unknown) => {
      if (cancelled || !isCurrentScope()) return;
      const status = (e as { statusCode?: number } | null)?.statusCode;
      if (initialMessageId && status === 404) {
        setMessages([]); setError('This message is no longer available.'); return;
      }
      if (initialMessageId && status !== 403) {
        setMessages([]); setError('Could not open this message. Check your connection and try again.'); return;
      }
      if (!kept || status === 403 || status === 404) {
        if (cacheKey) queryClient.removeQueries({ queryKey: cacheKey, exact: true });
        if (currentUserId && (status === 403 || status === 404)) {
          void activateChatStorage(currentUserId).then((saved) => deleteChatRecords(saved, [{ kind: 'history', key: cacheKeyId }])).catch(() => {});
        }
        shownKeyRef.current = null;
        setMessages((previous) => previous.filter(isUnsent));
        setLoadFailure(status === 403 ? 'forbidden' : status === 404 ? 'notFound' : 'unavailable');
      }
    }).finally(() => { if (!cancelled && isCurrentScope()) setLoading(false); });
    return () => { cancelled = true; };
  }, [cacheKeyId, loadAttempt, initialMessageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recent accepted history is encrypted on this device; pending originals
  // are retained separately until acceptance. Never persist received media.
  useEffect(() => {
    if (!cacheKey || loading || loadFailure || contextWindowRef.current || shownKeyRef.current !== cacheKeyId) return;
    const accepted = messages.filter((message) => !isUnsent(message));
    const snapshot = { messages: accepted, hasMore, nextCursor: nextCursorRef.current,
      roomIds: conversationRoomIds, resolvedRoomId, peer: directChatPeer,
      syncCursors: syncCursorsRef.current, tombstones: Object.fromEntries(tombstonesRef.current) };
    queryClient.setQueryData<ConversationSnapshot>(cacheKey, snapshot);
    if (!currentUserId) return;
    const timer = setTimeout(() => {
      const recent = accepted.slice(-100);
      const trimmed = accepted.length > recent.length;
      const saved = { ...snapshot, messages: recent, hasMore: hasMore || trimmed,
        nextCursor: trimmed ? `${recent[0].created_at}|${recent[0].id}` : snapshot.nextCursor };
      void activateChatStorage(currentUserId).then((scope) => {
        if (isCurrentScope()) return writeChatRecords(scope, [{ kind: 'history', key: cacheKeyId, value: saved }]);
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [queryClient, cacheKey, cacheKeyId, currentUserId, loading, loadFailure, messages, hasMore, conversationRoomIds, resolvedRoomId, directChatPeer, isCurrentScope, syncGeneration]);

  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);

  const refreshWithFeedback = useCallback(async () => {
    try {
      await refresh();
      if (isCurrentScope()) setError(null);
    } catch {
      if (isCurrentScope()) setError("Couldn't refresh messages. Check your connection and try again.");
    }
  }, [refresh, isCurrentScope]);

  // ── Socket.IO: join room + listen for new messages ──────

  const activeRoomIds = useMemo(() => {
    if (isRoomMode) return roomId ? [String(roomId)] : [];
    const ids = [
      ...(resolvedRoomId ? [String(resolvedRoomId)] : []),
      ...conversationRoomIds,
    ];
    return Array.from(new Set(ids.filter(Boolean)));
  }, [isRoomMode, roomId, resolvedRoomId, conversationRoomIds]);
  const typing = useChatTyping({ roomId: roomId || resolvedRoomId, roomIds: activeRoomIds,
    currentUserId, asBusinessUserId, scopeKey: cacheKeyId });

  // ── Connected transition handling ──────────────────────────
  // Track false→true and true→false transitions for reconnect/disconnect.

  useEffect(() => {
    const wasConnected = prevConnectedRef.current;
    prevConnectedRef.current = connected;

    if (!wasConnected && connected) {
      // ── Reconnect (false → true) ──
      // Clear joined rooms to force re-join (server may have changed instances)
      joinedRoomsRef.current.clear();
      void resumeChatOutbox();
      void refresh().catch(() => {});
    }

    if (wasConnected && !connected) {
      // ── Disconnect (true → false) ──
      joinedRoomsRef.current.clear();
    }
  }, [connected, refresh]);

  // When the room we're viewing changes, force re-join so we're definitely in the right room
  // (fixes mobile→web messages/reactions not arriving when web wasn't in room)
  const activeRoomIdsKey = activeRoomIds.slice().sort().join(',');
  useEffect(() => {
    joinedRoomsRef.current.clear();
    setRoomJoinGeneration((g) => g + 1);
  }, [activeRoomIdsKey]);

  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribe = subscribeChatOutbox((pending, accepted) => {
      if (!isCurrentScope()) return;
      const outgoing = pending.filter((message) => message.asBusinessUserId === asBusinessUserId
        && (isRoomMode ? message.roomId === roomId : message.otherUserId === otherUserId || activeRoomIds.includes(message.roomId)))
        .map((message) => pendingChatMessage(message, currentUserId)).filter(belongsToTopic);
      const incoming = accepted && activeRoomIds.includes(accepted.room_id) && belongsToTopic(accepted) && survivesDeletion(accepted) ? [accepted] : [];
      if (accepted) {
        noteLiveChange(String(accepted.id));
        if (otherUserId && accepted.topic_id && activeRoomIds.includes(accepted.room_id)) void queryClient.invalidateQueries({ queryKey: queryKeys.chatTopics(otherUserId) });
      }
      setMessages((previous) => mergeMessages(previous.filter((message) => !(message as ChatMessage & { _outbox?: boolean })._outbox), [...outgoing, ...incoming]));
    });
    void startChatOutbox(currentUserId).catch(() => {});
    return unsubscribe;
  }, [currentUserId, asBusinessUserId, isRoomMode, roomId, otherUserId, activeRoomIds, belongsToTopic, isCurrentScope, noteLiveChange, survivesDeletion, queryClient]);

  useEffect(() => {
    if (!socket || !connected || activeRoomIds.length === 0) return;
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const join = (activeRoomId: string) => {
      if (cancelled || !socket.connected || !isCurrentScope()) return;
      let answered = false;
      const startedVersion = changeVersionRef.current;
      const timeout = setTimeout(() => {
        timers.delete(timeout);
        if (!answered) { answered = true; join(activeRoomId); }
      }, 5000);
      timers.add(timeout);
      emit('room:join', { roomId: activeRoomId }, (response: { success?: boolean; messages?: ChatMessage[] }) => {
        if (answered) return;
        answered = true;
        clearTimeout(timeout);
        timers.delete(timeout);
        if (cancelled || !isCurrentScope()) return;
        if (response?.success) {
          joinedRoomsRef.current.add(activeRoomId);
          const backfill = (response.messages || []).filter((message) => belongsToTopic(message) && survivesDeletion(message)
            && (liveChangesRef.current.get(String(message.id)) || 0) <= startedVersion);
          const unseen = contextWindowRef.current ? [] : backfill.filter((message) => !messagesRef.current.some((existing) => String(existing.id) === String(message.id)));
          unseen.forEach((message) => noteLiveChange(String(message.id)));
          setMessages((previous) => mergeMessages(previous, unseen));
        }
      });
    };
    for (const id of activeRoomIds) if (!joinedRoomsRef.current.has(id)) join(id);
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [socket, connected, activeRoomIds, emit, roomJoinGeneration, belongsToTopic, isCurrentScope, noteLiveChange, survivesDeletion]);

  const handleIncomingMessage = useCallback((msg: ChatMessage) => {
    if (activeRoomIds.length === 0) return;
    const msgRoomId = msg?.room_id;
    if (!activeRoomIds.includes(String(msgRoomId))) return;
    if (!belongsToTopic(msg) || !survivesDeletion(msg) || !isCurrentScope()) return;
    if (contextWindowRef.current && !messagesRef.current.some((message) => message.id === msg.id)) return;
    noteLiveChange(String(msg.id));
    setMessages((previous) => insertMessageSorted(previous, msg));
  }, [activeRoomIds, belongsToTopic, isCurrentScope, noteLiveChange, survivesDeletion]);

  // Listen for incoming messages via socket (new + legacy event names)
  // ── Socket event handlers (extracted for stable identity + profiling) ──
  const handleMessageDeleted = useCallback((data: Record<string, any>) => {
    if (!data?.messageId || !isCurrentScope()) return;
    if (data.roomId && !activeRoomIds.includes(String(data.roomId))) return;
    const revision = Number(data.sync_version) || 0;
    const existing = messagesRef.current.find((message) => String(message.id) === String(data.messageId));
    if (existing && messageRevision(existing) > revision) return;
    tombstonesRef.current.set(String(data.messageId), Math.max(tombstonesRef.current.get(String(data.messageId)) ?? 0, revision));
    noteLiveChange(String(data.messageId));
    setMessages(prev => prev.filter(m => String(m.id) !== String(data.messageId)));
    setEditingMessage((current) => current?.messageId === String(data.messageId) ? null : current);
    setReplyingTo((current) => current?.messageId === String(data.messageId) ? null : current);
  }, [activeRoomIds, isCurrentScope, noteLiveChange]);

  const handleMessageEdited = useCallback((data: Record<string, any>) => {
    if (!data?.messageId || !data?.message || !isCurrentScope()) return;
    noteLiveChange(String(data.messageId));
    const updated = data.message as ChatMessage;
    setMessages(prev => prev.map(m =>
      String(m.id) === String(data.messageId)
        ? mergeMessageRecord(m, updated)
        : m
    ));
  }, [isCurrentScope, noteLiveChange]);

  type ReactionUpdatedPayload = {
    messageId: string;
    roomId?: string;
    sync_version?: number;
    reactions: Array<{
      reaction: string;
      count: number;
      users: Array<{ id: string; name: string }>;
      reacted_by_me: boolean;
    }>;
  };
  const handleReactionUpdated = useCallback((data: ReactionUpdatedPayload) => {
    if (!data?.messageId || !isCurrentScope()) return;
    if (data.roomId && !activeRoomIds.includes(String(data.roomId))) return;
    const existing = messagesRef.current.find((message) => String(message.id) === String(data.messageId));
    if (tombstonesRef.current.has(String(data.messageId))
      || (existing && data.sync_version !== undefined && messageRevision(existing) > data.sync_version)) return;
    noteLiveChange(String(data.messageId));
    // Recalculate reacted_by_me for the current user since the server
    // broadcasts the same payload to all users in the room.
    const adjustedReactions = (data.reactions || []).map(r => ({
      ...r,
      reacted_by_me: currentUserId ? r.users.some(u => u.id === currentUserId) : false,
    }));
    const hasMessage = messagesRef.current.some((message) => String(message?.id) === String(data.messageId));
    setMessages(prev => prev.map(m => {
      if (String(m.id) !== String(data.messageId)) {
        return m;
      }
      if (data.sync_version !== undefined && messageRevision(m) > data.sync_version) return m;
      return { ...m, reactions: adjustedReactions, ...(data.sync_version !== undefined ? { sync_version: data.sync_version } : {}) };
    }));
    if (!hasMessage) {
      void refresh().catch(() => {});
    }
  }, [currentUserId, activeRoomIds, refresh, isCurrentScope, noteLiveChange]);

  useSocketEvent('message:new', handleIncomingMessage);
  useSocketEvent('newMessage', handleIncomingMessage);
  useSocketEvent('message:deleted', handleMessageDeleted);
  useSocketEvent('message:edited', handleMessageEdited);
  useSocketEvent('message:reaction_updated', handleReactionUpdated);

  const handleMessagesRead = useCallback((data: { userId?: string; roomId?: string; readAt?: string; throughMessageId?: string }) => {
    // A group member reading is not a receipt from every recipient. Person
    // conversations only show Read when that particular peer acknowledges it.
    if (!otherUserId || data.userId !== otherUserId || !data.roomId || !data.readAt || !isCurrentScope()) return;
    const through = messagesRef.current.find((message) => message.id === data.throughMessageId);
    if (data.throughMessageId && !through) return;
    setMessages((previous) => previous.map((message) => {
      if (isUnsent(message) || message.room_id !== data.roomId
        || (message.user_id || message.sender_id) !== (asBusinessUserId || currentUserId)
        || (through ? compareMessages(message, through) > 0 : messageTime(message) > Date.parse(data.readAt!))) return message;
      noteLiveChange(String(message.id));
      return { ...message, read_at: data.readAt };
    }));
  }, [otherUserId, asBusinessUserId, currentUserId, isCurrentScope, noteLiveChange]);
  useSocketEvent('messages:read', handleMessagesRead);

  useEffect(() => {
    if (!socket) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = (payload: { topics?: string[] }) => {
      if (!payload?.topics?.some((topic) => topic === 'chats' || activeRoomIds.some((id) => topic === `chat:${id}`))) return;
      if (timer) clearTimeout(timer);
      // The revision endpoint also repairs unknown DB-only changes. A burst of
      // socket events needs one lightweight delta, never a history reload.
      timer = setTimeout(() => { if (document.visibilityState === 'visible') void refresh().catch(() => {}); }, 500);
    };
    socket.on('sync:changed', changed);
    return () => { socket.off('sync:changed', changed); if (timer) clearTimeout(timer); };
  }, [socket, activeRoomIds, refresh]);

  // Poll immediately when realtime is unavailable, then back off. Hidden tabs
  // wait for visibilitychange; one coalesced refresh runs at a time.
  useEffect(() => {
    if ((!roomId && !otherUserId) || connected) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let delay = 2000;
    const poll = async () => {
      if (cancelled) return;
      if (document.visibilityState === 'visible') {
        try { await refresh(); } catch {}
      }
      if (!cancelled) {
        timer = setTimeout(poll, delay + Math.random() * 500);
        delay = Math.min(15000, delay * 1.5);
      }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [roomId, otherUserId, connected, refresh]);

  const olderRequestRef = useRef<string | null>(null);
  const loadOlder = useCallback(async () => {
    if (!isCurrentScope() || olderRequestRef.current === cacheKeyId || !hasMore) return;
    const before = nextCursorRef.current;
    if (!before) return;
    const historyView = historyViewRef.current;
    olderRequestRef.current = cacheKeyId;
    setLoadingOlder(true);
    try {
      const page = await fetchMessages({ before });
      if (!isCurrentScope() || historyView !== historyViewRef.current) return;
      setMessages((previous) => mergeMessages(previous, page.messages.filter(survivesDeletion)));
      applyPage(page);
    } catch {
      if (isCurrentScope()) setError("Couldn't load earlier messages. Try again.");
    } finally {
      if (olderRequestRef.current === cacheKeyId) olderRequestRef.current = null;
      if (isCurrentScope()) setLoadingOlder(false);
    }
  }, [cacheKeyId, hasMore, fetchMessages, applyPage, isCurrentScope, survivesDeletion]);

  // Persist the original intent before returning control to the composer. The
  // account worker keeps sending after navigation and resumes after a reload.
  const sendMessage = useCallback(async (text: string, files?: File[], draft?: ChatDraftCommit) => {
    const targetRoomId = isRoomMode ? roomId : resolvedRoomId;
    if (!text.trim() && !files?.length) return;
    if (!targetRoomId || !currentUserId) throw new Error(directChatError || "This conversation isn't ready yet. Try again in a moment.");
    setSending(true);
    try {
      await enqueueChatSend(currentUserId, { clientMessageId: crypto.randomUUID(), roomId: targetRoomId,
        otherUserId, text: text.trim(), asBusinessUserId, topicId: topicId || undefined,
        replyToId: replyTargetIn(messagesRef.current, replyingTo?.messageId, targetRoomId)
          || (replyingTo?.roomId === targetRoomId ? replyingTo.messageId : undefined) }, files, draft);
      if (isCurrentScope()) { setReplyingTo(null); setError(null); }
    } finally { if (isCurrentScope()) setSending(false); }
  }, [isRoomMode, roomId, resolvedRoomId, currentUserId, directChatError, otherUserId, asBusinessUserId, topicId, replyingTo, isCurrentScope]);

  const sendSharedMessage = useCallback(async (message: Pick<PendingChatSend, 'text' | 'metadata' | 'topicRequest'> & { messageType: 'gig_offer' | 'listing_offer' }) => {
    const targetRoomId = isRoomMode ? roomId : resolvedRoomId;
    if (!isCurrentScope()) return;
    try {
      if (!targetRoomId || !currentUserId) throw new Error(directChatError || CONVERSATION_NOT_READY);
      await enqueueChatSend(currentUserId, { ...message, clientMessageId: crypto.randomUUID(), roomId: targetRoomId,
        otherUserId, asBusinessUserId, topicId: message.topicRequest ? undefined : topicId || undefined });
      if (isCurrentScope()) setError(null);
    } catch (error) {
      if (isCurrentScope()) setError(shareFailureMessage(error));
      throw error;
    }
  }, [isRoomMode, roomId, resolvedRoomId, currentUserId, directChatError, otherUserId, asBusinessUserId, topicId, isCurrentScope]);

  const beginReply = useCallback((target: ChatReplyTarget) => {
    setEditingMessage(null);
    setReplyingTo({ ...target, roomId: messagesRef.current.find((message) => message.id === target.messageId)?.room_id });
  }, []);
  const restoreDraftContext = useCallback(async (context: ChatDraftContext) => {
    if (!isCurrentScope()) return;
    setReplyingTo(context.reply);
    setEditingMessage(context.edit);
  }, [isCurrentScope]);
  const cancelReply = useCallback(() => setReplyingTo(null), []);
  const retryMessage = useCallback(async (messageId: string) => {
    try { await retryChatSend(messageId); }
    catch (error) { if (isCurrentScope()) setError(sendFailureReason(error)); }
  }, [isCurrentScope]);
  const removePendingMessage = useCallback(async (messageId: string) => {
    try { await removeChatSend(messageId); }
    catch (error) { if (isCurrentScope()) setError(sendFailureReason(error)); }
  }, [isCurrentScope]);

  const canChangeMessage = useCallback((message: BaseChatMessage) => {
    const actor = (message as BaseChatMessage & { actor_user_id?: string }).actor_user_id;
    const sender = message.user_id || message.sender_id || message.sender?.id;
    return isCurrentScope() && !isUnsent(message) && (actor ? actor === currentUserId : sender === currentUserId)
      && messagesRef.current.some((row) => row.id === message.id);
  }, [currentUserId, isCurrentScope]);
  const beginEdit = useCallback((message: BaseChatMessage) => {
    if (!canChangeMessage(message)) return;
    setEditingMessage({ messageId: message.id, text: message.message_text || message.message || message.content || '' });
  }, [canChangeMessage]);
  const cancelEdit = useCallback(() => setEditingMessage(null), []);
  const saveEdit = useCallback(async (text: string) => {
    const target = messagesRef.current.find((message) => message.id === editingMessage?.messageId);
    const messageId = editingMessage?.messageId;
    // An encrypted draft can refer to an older message outside the loaded
    // window. The existing edit endpoint validates ownership on explicit Save.
    if (!messageId || !isCurrentScope() || (target && !canChangeMessage(target))) throw new Error('This message is no longer available to edit.');
    if (editRequest.current) return;
    const value = text.trim();
    if (!value || value.length > 10000) throw new Error('Use between 1 and 10,000 characters.');
    const marker = api.authSessionMarker();
    editRequest.current = true;
    try {
      const result = await api.chat.editMessage(messageId, value);
      if (!isCurrentScope() || marker !== api.authSessionMarker()) return;
      if (survivesDeletion(result.message)) {
        noteLiveChange(messageId);
        setMessages((previous) => previous.map((message) => message.id === messageId ? mergeMessageRecord(message, result.message) : message));
      }
      setEditingMessage((current) => current?.messageId === messageId ? null : current);
      setError(null);
    } finally { editRequest.current = false; }
  }, [editingMessage, canChangeMessage, isCurrentScope, survivesDeletion, noteLiveChange]);
  const deleteMessage = useCallback(async (message: BaseChatMessage) => {
    if (!canChangeMessage(message) || deleteRequest.current) return;
    deleteRequest.current = true;
    const marker = api.authSessionMarker();
    try {
      const answer = confirmStore.open({ title: 'Delete this message?', description: 'This removes the message and its attachments for everyone in this chat.', confirmLabel: 'Delete', variant: 'destructive' });
      deletionConfirmation.current = confirmStore.getSnapshot();
      const yes = await answer;
      deletionConfirmation.current = null;
      if (!yes || !isCurrentScope() || marker !== api.authSessionMarker()) return;
      const result = await api.chat.deleteMessage(message.id);
      if (!isCurrentScope() || marker !== api.authSessionMarker()) return;
      handleMessageDeleted({ messageId: message.id, roomId: message.room_id, sync_version: result.sync_version ?? messageRevision(message) });
      setEditingMessage((current) => current?.messageId === message.id ? null : current);
      setReplyingTo((current) => current?.messageId === message.id ? null : current);
      setError(null);
    } catch (error) {
      if (isCurrentScope() && marker === api.authSessionMarker()) setError(sendFailureReason(error) || 'Could not delete this message. Try again.');
    } finally { deleteRequest.current = false; }
  }, [canChangeMessage, isCurrentScope, handleMessageDeleted]);

  // Keep taps in order per message. Socket ACKs and the REST fallback currently
  // have no revision, so they may only replace the state present at dispatch.
  type ReactResult = { reactions?: Array<{ reaction: string; count: number; users: Array<{ id: string; name: string }>; reacted_by_me: boolean }> };
  const reactToMessage = useCallback(async (messageId: string, emoji: string, reacted?: boolean): Promise<void> => {
    const message = messagesRef.current.find((row) => String(row.id) === String(messageId));
    if ((!message && reacted === undefined) || (message && isUnsent(message)) || !isCurrentScope()) return;
    const marker = api.authSessionMarker();
    const current = () => isCurrentScope() && marker === api.authSessionMarker();
    const requestKey = `${scopeGeneration}:${marker}:${messageId}`;
    const key = `${requestKey}:${emoji}`;
    const pending = pendingReactionsRef.current.get(key);
    const alreadyReacted = pending?.scope === scopeGeneration ? pending.wanted
      : (message?.reactions || []).some((reaction) => reaction.reaction === emoji && reaction.reacted_by_me);
    const wanted = reacted ?? !alreadyReacted;
    const intent = Symbol();
    pendingReactionsRef.current.set(key, { intent, wanted, scope: scopeGeneration });
    const previous = reactionRequestsRef.current.get(requestKey) ?? Promise.resolve();
    const request = previous.catch(() => {}).then(async () => {
      if (!current() || tombstonesRef.current.has(messageId)) return;
      const atDispatch = messagesRef.current.find((row) => String(row.id) === String(messageId));
      if (!atDispatch && reacted === undefined) return;
      const startedVersion = liveChangesRef.current.get(messageId) || 0;
      const startedRevision = atDispatch ? messageRevision(atDispatch) : 0;
      try {
        let result: ReactResult;
        if (socket?.connected) {
          try {
            result = await new Promise<ReactResult>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Reaction request timed out')), 5000);
              socket.emit('message:react', { messageId, reaction: emoji, reacted: wanted }, (response: ReactResult & { error?: string }) => {
                clearTimeout(timeout);
                if (!response || response.error) reject(new Error(response?.error || 'Reaction response missing'));
                else resolve(response);
              });
            });
          } catch {
            if (!current()) return;
            // Explicit desired state makes a lost ACK safe to retry.
            result = await api.chat.reactToMessage(messageId, emoji, wanted);
          }
        } else result = await api.chat.reactToMessage(messageId, emoji, wanted);
        if (!current()) return;
        if ((liveChangesRef.current.get(messageId) || 0) === startedVersion) {
          const reactions = (result.reactions || []).map((reaction) => ({ ...reaction,
            reacted_by_me: currentUserId ? reaction.users.some((user) => user.id === currentUserId) : false }));
          setMessages((rows) => rows.map((row) => String(row.id) === String(messageId)
            && messageRevision(row) === startedRevision ? { ...row, reactions } : row));
          noteLiveChange(messageId);
        }
        setError(null);
      } catch {
        if (current()) setError("Couldn't update this reaction. Check your connection and try again.");
      }
    }).finally(() => {
      if (pendingReactionsRef.current.get(key)?.intent === intent) pendingReactionsRef.current.delete(key);
      if (reactionRequestsRef.current.get(requestKey) === request) reactionRequestsRef.current.delete(requestKey);
    });
    reactionRequestsRef.current.set(requestKey, request);
    await request;
  }, [socket, currentUserId, scopeGeneration, isCurrentScope, noteLiveChange]);

  return {
    messages,
    loading,
    loadFailure,
    retryLoad,
    error,
    setError,
    connected,
    typingPeerCount: typing.peerCount,
    onTypingChange: typing.onTypingChange,
    composerDraft: { actorId: currentUserId, key: cacheKeyId, ready: !loading && !loadFailure && !directChatError, restoreContext: restoreDraftContext },
    sending,
    hasMore,
    loadingOlder,
    contextAnchorId,
    resolvedRoomId,
    directChatPeer,
    directChatError,
    sendRefusal,
    sendMessage,
    sendSharedMessage,
    replyingTo,
    beginReply,
    cancelReply,
    editingMessage,
    canChangeMessage,
    beginEdit,
    cancelEdit,
    saveEdit,
    deleteMessage,
    retryMessage,
    removePendingMessage,
    loadOlder,
    refresh: refreshWithFeedback,
    onVisibleMessage,
    reactToMessage,
  };
}
