'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { ChatMessage, User } from '@pantopus/types';
import { getDateKey, formatDateLabel } from '@pantopus/ui-utils';
import { useSocket, useSocketConnected } from './useSocket';
import { useSocketEvent, useSocketEmit } from './useSocket';

// Re-export shared helpers so existing consumers don't break
export { getDateKey, formatDateLabel };

// ── Helpers ─────────────────────────────────────────────────

function sortAsc(items: ChatMessage[]): ChatMessage[] {
  return [...items].sort((a, b) => {
    const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
}

function mergeMessageRecord(existing: ChatMessage | undefined, incoming: ChatMessage): ChatMessage {
  if (!existing) return incoming;

  const existingWithReactions = existing as unknown as { reactions?: unknown[] };
  const incomingWithReactions = incoming as unknown as { reactions?: unknown[] };
  const merged = { ...existing, ...incoming } as ChatMessage;
  if (incomingWithReactions.reactions === undefined && existingWithReactions.reactions !== undefined) {
    (merged as unknown as { reactions?: unknown }).reactions = existingWithReactions.reactions;
  } else if (
    Array.isArray(incomingWithReactions.reactions) &&
    incomingWithReactions.reactions.length === 0 &&
    Array.isArray(existingWithReactions.reactions) &&
    existingWithReactions.reactions.length > 0
  ) {
    (merged as unknown as { reactions?: unknown }).reactions = existingWithReactions.reactions;
  }
  return merged;
}

function mergeMessages(prev: ChatMessage[], next: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of prev) if (m?.id) map.set(String(m.id), m);
  for (const m of next) {
    if (!m?.id) continue;
    const key = String(m.id);
    map.set(key, mergeMessageRecord(map.get(key), m));
  }
  return sortAsc(Array.from(map.values()));
}

// Binary-insert a single message into a sorted-ascending array.
// - If id exists, merges reactions via mergeMessageRecord in place.
// - Fast path: newest message → O(1) append.
// - Otherwise binary-searches insertion point by created_at → O(log n).
// Used for single-message socket events; mergeMessages() is still used
// for batch operations (initial load, backfill, poll, older fetch).
function insertMessageSorted(messages: ChatMessage[], newMsg: ChatMessage): ChatMessage[] {
  if (!newMsg?.id) return messages;
  const newIdStr = String(newMsg.id);

  // If the id already exists, merge (preserves reactions) in place.
  const existingIdx = messages.findIndex((m) => String(m?.id) === newIdStr);
  if (existingIdx !== -1) {
    const result = messages.slice();
    result[existingIdx] = mergeMessageRecord(messages[existingIdx], newMsg);
    return result;
  }

  const newTime = newMsg?.created_at ? new Date(newMsg.created_at).getTime() : 0;
  const n = messages.length;
  if (n === 0) return [newMsg];

  const lastTime = messages[n - 1]?.created_at ? new Date(messages[n - 1].created_at).getTime() : 0;
  if (newTime >= lastTime) {
    // Fast path: newest message — simple append.
    return [...messages, newMsg];
  }

  // Binary search for insertion index.
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const midTime = messages[mid]?.created_at ? new Date(messages[mid].created_at).getTime() : 0;
    if (midTime < newTime) lo = mid + 1;
    else hi = mid;
  }

  const result = messages.slice();
  result.splice(lo, 0, newMsg);
  return result;
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

export function resolveMessageType(msg: ChatMessageLike): string {
  const rawType = msg?.message_type || msg?.type || 'text';
  const metadata = msg?.metadata || {};
  if (rawType === 'text' && (metadata.listingId || metadata.listing_id)) return 'listing_offer';
  if (rawType === 'text' && (metadata.gigId || metadata.gig_id)) return 'gig_offer';
  return rawType;
}

// ── Types ───────────────────────────────────────────────────

export interface UseChatMessagesOptions {
  /** Room-based mode (ChatRoomView) */
  roomId?: string;
  /** Person-based mode (ConversationView) */
  otherUserId?: string;
  /** Topic filter for person-based mode */
  topicId?: string | null;
  /** Business identity for room-based mode */
  asBusinessUserId?: string;
  /** Check if a sender id belongs to current user (room mode uses business identity) */
  isOwnMessage?: (senderId: string) => boolean;
  /** Current user ID (used for reaction reacted_by_me recalculation) */
  currentUserId?: string | null;
}

export interface UseChatMessagesReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  setError: (e: string | null) => void;
  connected: boolean;
  sending: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  resolvedRoomId: string | null;
  /** Populated in person-based mode after createDirectChat resolves (header / avatar). */
  directChatPeer: User | null;
  sendMessage: (text: string, files?: File[]) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  loadOlder: () => Promise<void>;
  refresh: () => Promise<void>;
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;
}

// ── Hook ────────────────────────────────────────────────────

export function useChatMessages(opts: UseChatMessagesOptions): UseChatMessagesReturn {
  const { roomId, otherUserId, topicId, asBusinessUserId, currentUserId } = opts;
  const isRoomMode = Boolean(roomId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [resolvedRoomId, setResolvedRoomId] = useState<string | null>(roomId || null);
  const [directChatPeer, setDirectChatPeer] = useState<User | null>(null);
  const [conversationRoomIds, setConversationRoomIds] = useState<string[]>([]);
  const nextCursorRef = useRef<string | null>(null);

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
  // Incremented on reconnect; stale poll responses with an older generation are discarded
  const pollGenerationRef = useRef(0);

  // ── Fetch functions ─────────────────────────────────────

  const fetchMessages = useCallback(async (cursor?: { before?: string; after?: string }): Promise<ChatMessage[]> => {
    try {
      const before = cursor?.before;
      const after = cursor?.after;
      if (isRoomMode && roomId) {
        const resp = await (api.chat as Record<string, any> & typeof api.chat).getMessages?.(roomId, {
          limit: 100,
          ...(before ? { before } : {}),
          ...(after ? { after } : {}),
          ...(asBusinessUserId ? { asBusinessUserId } : {}),
        }) as Record<string, any> | undefined;
        if (resp?.nextCursor !== undefined) nextCursorRef.current = (resp.nextCursor as string | null);
        return (resp?.messages as ChatMessage[]) || [];
      } else if (otherUserId) {
        const params: Record<string, any> = { limit: 100 };
        if (before) params.before = before;
        if (after) params.after = after;
        if (topicId) params.topicId = topicId;
        const result = await api.chat.getConversationMessages(otherUserId, params as Parameters<typeof api.chat.getConversationMessages>[1]) as Record<string, any>;
        if (result?.nextCursor !== undefined) nextCursorRef.current = (result.nextCursor as string | null);
        const rawRoomIds = Array.isArray(result?.roomIds) ? (result.roomIds as unknown[]) : [];
        const nextRoomIds = Array.from(new Set(rawRoomIds.map((id) => String(id)).filter(Boolean))).sort();
        setConversationRoomIds((prev) => (
          prev.length === nextRoomIds.length && prev.every((id, i) => id === nextRoomIds[i])
            ? prev
            : nextRoomIds
        ));
        return (result?.messages as ChatMessage[]) || [];
      }
      return [];
    } catch {
      return [];
    }
  }, [isRoomMode, roomId, otherUserId, topicId, asBusinessUserId]);

  useEffect(() => {
    if (isRoomMode || !otherUserId) {
      setConversationRoomIds([]);
    }
  }, [isRoomMode, otherUserId]);

  const markRead = useCallback(async () => {
    try {
      if (isRoomMode && roomId) {
        if (asBusinessUserId && (api.chat as Record<string, any>).markMessagesAsReadForIdentity) {
          await ((api.chat as Record<string, any>).markMessagesAsReadForIdentity as (roomId: string, opts: Record<string, any>) => Promise<void>)(roomId, { asBusinessUserId });
        } else {
          await ((api.chat as Record<string, any>).markMessagesAsRead as ((roomId: string) => Promise<void>) | undefined)?.(roomId);
        }
      } else if (otherUserId) {
        await api.chat.markConversationAsRead(otherUserId);
      }
    } catch {}
  }, [isRoomMode, roomId, otherUserId, asBusinessUserId]);

  // Debounced wrapper: collapses rapid markRead calls into one trailing call
  const debouncedMarkRead = useCallback(() => {
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(() => {
      markRead();
      markReadTimerRef.current = null;
    }, 2000);
  }, [markRead]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    };
  }, []);

  // ── Initial load ────────────────────────────────────────

  const refresh = useCallback(async () => {
    const msgs = await fetchMessages();
    setMessages(prev => mergeMessages(prev, msgs));
    setHasMore(msgs.length >= 100);
    await markRead();
  }, [fetchMessages, markRead]);

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
    if (!otherUserId || isRoomMode) {
      setDirectChatPeer(null);
      return;
    }
    setDirectChatPeer(null);
    let cancelled = false;
    (async () => {
      try {
        const result = await api.chat.createDirectChat(otherUserId);
        const rid = result?.roomId;
        if (!cancelled && rid) setResolvedRoomId(String(rid));
        if (!cancelled && result?.otherUser) setDirectChatPeer(result.otherUser as User);
      } catch {
        if (!cancelled) setDirectChatPeer(null);
      }
    })();
    return () => { cancelled = true; };
  }, [otherUserId, isRoomMode]);

  useEffect(() => {
    const key = roomId || otherUserId;
    if (!key) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const msgs = await fetchMessages();
        if (!cancelled) {
          setMessages(sortAsc(msgs));
          setHasMore(msgs.length >= 100);
          await markRead();
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load messages');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId, otherUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refetch on topic change (person-based mode) ─────────

  useEffect(() => {
    if (isRoomMode || loading || !otherUserId) return;
    let cancelled = false;
    (async () => {
      const msgs = await fetchMessages();
      if (!cancelled) {
        setMessages(sortAsc(msgs));
        setHasMore(msgs.length >= 100);
      }
    })();
    return () => { cancelled = true; };
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket.IO: join room + listen for new messages ──────

  const activeRoomIds = useMemo(() => {
    if (isRoomMode) return roomId ? [String(roomId)] : [];
    const ids = [
      ...(resolvedRoomId ? [String(resolvedRoomId)] : []),
      ...conversationRoomIds,
    ];
    return Array.from(new Set(ids.filter(Boolean)));
  }, [isRoomMode, roomId, resolvedRoomId, conversationRoomIds]);

  // ── Connected transition handling ──────────────────────────
  // Track false→true and true→false transitions for reconnect/disconnect.

  useEffect(() => {
    const wasConnected = prevConnectedRef.current;
    prevConnectedRef.current = connected;

    if (!wasConnected && connected) {
      // ── Reconnect (false → true) ──
      // Invalidate any in-flight poll responses so they don't overwrite fresh data
      pollGenerationRef.current += 1;
      // Clear joined rooms to force re-join (server may have changed instances)
      joinedRoomsRef.current.clear();
    }

    if (wasConnected && !connected) {
      // ── Disconnect (true → false) ──
      joinedRoomsRef.current.clear();
    }
  }, [connected]);

  // When the room we're viewing changes, force re-join so we're definitely in the right room
  // (fixes mobile→web messages/reactions not arriving when web wasn't in room)
  const activeRoomIdsKey = activeRoomIds.slice().sort().join(',');
  useEffect(() => {
    joinedRoomsRef.current.clear();
    setRoomJoinGeneration((g) => g + 1);
  }, [activeRoomIdsKey]);

  useEffect(() => {
    if (!socket || !connected || activeRoomIds.length === 0) return;
    // Join each active room (we may have just cleared joinedRoomsRef when room changed)
    for (const activeRoomId of activeRoomIds) {
      if (joinedRoomsRef.current.has(activeRoomId)) continue;
      emit('room:join', { roomId: activeRoomId }, (response: { success?: boolean; messages?: ChatMessage[] }) => {
        if (response?.success) {
          joinedRoomsRef.current.add(activeRoomId);
          // Merge any backfill messages returned by the server (reconnect recovery)
          const backfill = response.messages;
          if (Array.isArray(backfill) && backfill.length > 0) {
            setMessages(prev => mergeMessages(prev, backfill));
          }
        }
      });
    }
  }, [socket, connected, activeRoomIds, emit, roomJoinGeneration]);

  const handleIncomingMessage = useCallback((msg: ChatMessage) => {
    if (activeRoomIds.length === 0) return;
    const msgRoomId = msg?.room_id;
    if (!activeRoomIds.includes(String(msgRoomId))) return;
    setMessages(prev => {
      // Skip if already have this message (dedup)
      if (prev.some(m => String(m.id) === String(msg.id) && !(m as Record<string, any>)._optimistic)) return prev;
      // Replace any optimistic message matching by client_message_id
      const msgClientId = (msg as Record<string, any>).client_message_id;
      const filtered = msgClientId
        ? prev.filter(m => (m as Record<string, any>)._clientMessageId !== msgClientId && m.id !== msgClientId)
        : prev;
      // Binary insert: O(log n) insertion (vs O(n log n) via full sort).
      return insertMessageSorted(filtered, msg);
    });
    // Schedule debounced markRead instead of calling on every message
    debouncedMarkRead();
  }, [activeRoomIds, debouncedMarkRead]);

  // Listen for incoming messages via socket (new + legacy event names)
  // ── Socket event handlers (extracted for stable identity + profiling) ──
  const handleMessageDeleted = useCallback((data: Record<string, any>) => {
    if (!data?.messageId) return;
    setMessages(prev => prev.filter(m => String(m.id) !== String(data.messageId)));
  }, []);

  const handleMessageEdited = useCallback((data: Record<string, any>) => {
    if (!data?.messageId || !data?.message) return;
    const updated = data.message as ChatMessage;
    setMessages(prev => prev.map(m =>
      String(m.id) === String(data.messageId)
        ? { ...m, ...updated }
        : m
    ));
  }, []);

  type ReactionUpdatedPayload = {
    messageId: string;
    reactions: Array<{
      reaction: string;
      count: number;
      users: Array<{ id: string; name: string }>;
      reacted_by_me: boolean;
    }>;
  };
  const handleReactionUpdated = useCallback((data: ReactionUpdatedPayload) => {
    if (!data?.messageId) return;
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
      return { ...m, reactions: adjustedReactions };
    }));
    if (!hasMessage) {
      void refresh().catch(() => {});
    }
  }, [currentUserId, refresh]);

  useSocketEvent('message:new', handleIncomingMessage);
  useSocketEvent('newMessage', handleIncomingMessage);
  useSocketEvent('message:deleted', handleMessageDeleted);
  useSocketEvent('message:edited', handleMessageEdited);
  useSocketEvent('message:reaction_updated', handleReactionUpdated);

  // ── Degraded fallback polling (only when socket is disconnected) ──
  // When socket is down, poll at 30s as a degraded experience.
  // Socket handles primary real-time delivery; reconnect gap-fill is
  // handled by room:join backfill + the visibility-change handler above.

  useEffect(() => {
    const key = roomId || otherUserId;
    if (!key || connected) return;
    const gen = pollGenerationRef.current;
    const t = setInterval(async () => {
      try {
        const msgs = await fetchMessages();
        if (pollGenerationRef.current !== gen) return;
        setMessages(prev => mergeMessages(prev, msgs));
      } catch {}
    }, 30_000);
    return () => clearInterval(t);
  }, [roomId, otherUserId, connected, fetchMessages]);

  // ── Load older messages ─────────────────────────────────

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || messagesRef.current.length === 0) return;
    setLoadingOlder(true);
    try {
      // Prefer composite cursor for stable pagination; fall back to timestamp
      const cursor = nextCursorRef.current;
      const oldest = messagesRef.current[0];
      const before = cursor || oldest?.created_at;
      if (!before) return;
      const older = await fetchMessages({ before });
      setMessages(prev => mergeMessages(older, prev));
      setHasMore(older.length >= 100);
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMore, fetchMessages]);

  // ── Send message (useMutation with optimistic + mark-failed rollback) ──

  const sendMessageMutation = useMutation({
    mutationFn: async (vars: { text: string; files?: File[]; targetRoomId: string; clientMessageId: string }) => {
      const { text, files, targetRoomId, clientMessageId } = vars;
      const trimmed = text.trim();
      const hasFiles = (files?.length || 0) > 0;

      let uploadedFiles: Record<string, any>[] = [];
      if (hasFiles && files) {
        const uploadRes = await ((api.upload as Record<string, any>).uploadChatMedia as (roomId: string, files: File[]) => Promise<Record<string, any>>)(targetRoomId, files);
        uploadedFiles = (uploadRes?.media as Record<string, any>[]) || [];
      }

      const fileIds = uploadedFiles.map((f: Record<string, any>) => f.id).filter(Boolean);
      const messageType = fileIds.length > 0
        ? (uploadedFiles.length === 1 && String(uploadedFiles[0]?.mime_type || '').startsWith('image/') ? 'image' : 'file')
        : 'text';

      return api.chat.sendMessage({
        roomId: targetRoomId,
        messageText: trimmed || undefined,
        messageType: messageType as 'text' | 'image' | 'video' | 'file' | 'audio' | 'location' | 'gig_offer' | 'listing_offer',
        ...(fileIds.length > 0 ? { fileIds } : {}),
        ...(asBusinessUserId ? { asBusinessUserId } : {}),
        clientMessageId,
      });
    },
    onMutate: (vars) => {
      const { text, files, clientMessageId } = vars;
      const trimmed = text.trim();
      const hasFiles = (files?.length || 0) > 0;
      setSending(true);
      // Optimistic rendering for text-only messages
      if (trimmed && !hasFiles) {
        setMessages(prev => [
          ...prev,
          {
            id: clientMessageId,
            room_id: vars.targetRoomId,
            sender_id: currentUserId || 'self',
            user_id: currentUserId || 'self',
            sender: { id: currentUserId || 'self', username: '', name: '', profile_picture_url: '' },
            message_text: trimmed,
            message_type: 'text',
            created_at: new Date().toISOString(),
            attachments: [],
            metadata: {},
            is_edited: false,
            is_deleted: false,
            _optimistic: true,
            _clientMessageId: clientMessageId,
          },
        ]);
      }
    },
    onSuccess: async (sendResult, vars) => {
      const { clientMessageId } = vars;
      const deliveredMessage = sendResult?.message as ChatMessage | undefined;
      if (deliveredMessage?.id) {
        setMessages((prev) => {
          // Remove optimistic message matching this clientMessageId
          const withoutOptimistic = prev.filter((m) => m.id !== clientMessageId && (m as Record<string, any>)._clientMessageId !== clientMessageId);
          if (withoutOptimistic.some((m) => String(m.id) === String(deliveredMessage.id))) {
            return withoutOptimistic;
          }
          return mergeMessages(withoutOptimistic, [deliveredMessage]);
        });
      } else {
        await refresh();
      }
    },
    onError: (_err, vars) => {
      // Mark optimistic message as failed instead of removing it
      const { clientMessageId } = vars;
      setMessages(prev => prev.map(m =>
        m.id === clientMessageId ? { ...m, _failed: true, _optimistic: false } : m
      ));
    },
    onSettled: () => {
      setSending(false);
    },
  });

  const sendMessage = useCallback(async (text: string, files?: File[]) => {
    const trimmed = text.trim();
    const hasFiles = (files?.length || 0) > 0;
    const targetRoomId = isRoomMode ? roomId : resolvedRoomId;
    if ((!trimmed && !hasFiles) || sending || !targetRoomId) return;

    // Generate a client-side message ID for idempotent sends and optimistic rendering
    const clientMessageId = crypto.randomUUID();

    // mutateAsync preserves the throw-on-error contract for callers
    await sendMessageMutation.mutateAsync({ text, files, targetRoomId, clientMessageId });
  }, [isRoomMode, roomId, resolvedRoomId, sending, sendMessageMutation]);

  // ── Retry failed message ────────────────────────────

  const retryMessage = useCallback(async (messageId: string) => {
    const failedMsg = messagesRef.current.find(m => m.id === messageId && (m as Record<string, any>)._failed);
    if (!failedMsg) return;

    const targetRoomId = isRoomMode ? roomId : resolvedRoomId;
    if (!targetRoomId) return;

    const clientMessageId = ((failedMsg as Record<string, any>)._clientMessageId as string) || messageId;
    const msgText = failedMsg.message_text || failedMsg.message || '';

    // Mark as sending again
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, _failed: false, _optimistic: true } : m
    ));

    try {
      const sendResult = await api.chat.sendMessage({
        roomId: targetRoomId,
        messageText: msgText || undefined,
        messageType: 'text',
        ...(asBusinessUserId ? { asBusinessUserId } : {}),
        clientMessageId,
      });

      const delivered = sendResult?.message as ChatMessage | undefined;
      if (delivered?.id) {
        setMessages(prev => {
          const withoutOptimistic = prev.filter(m => m.id !== messageId && (m as Record<string, any>)._clientMessageId !== clientMessageId);
          if (withoutOptimistic.some(m => String(m.id) === String(delivered.id))) return withoutOptimistic;
          return mergeMessages(withoutOptimistic, [delivered]);
        });
      } else {
        await refresh();
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, _failed: true, _optimistic: false } : m
      ));
    }
  }, [isRoomMode, roomId, resolvedRoomId, asBusinessUserId, refresh]);

  // ── React to message ────────────────────────────────

  // ── React to message (useMutation — swallows errors per original) ──
  type ReactResult = { reactions?: Array<{ reaction: string; count: number; users: Array<{ id: string; name: string }>; reacted_by_me: boolean }> };
  const reactMutation = useMutation<ReactResult, Error, { messageId: string; emoji: string }>({
    mutationFn: async ({ messageId, emoji }) => {
      if (socket?.connected) {
        return new Promise<ReactResult>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Reaction request timed out')), 5000);
          socket.emit('message:react', { messageId, reaction: emoji }, (response: { error?: string; reactions?: ReactResult['reactions'] }) => {
            clearTimeout(timeout);
            if (response?.error) {
              reject(new Error(String(response.error)));
              return;
            }
            resolve(response);
          });
        });
      }
      return api.chat.reactToMessage(messageId, emoji);
    },
    onSuccess: (result, vars) => {
      const reactions = (result?.reactions || []).map((reaction) => ({
        ...reaction,
        reacted_by_me: currentUserId ? reaction.users.some((user) => user.id === currentUserId) : false,
      }));
      setMessages(prev => prev.map(m =>
        String(m.id) === String(vars.messageId)
          ? { ...m, reactions }
          : m
      ));
    },
    // onError: swallow (original behavior)
  });

  const reactToMessage = useCallback(async (messageId: string, emoji: string): Promise<void> => {
    try {
      await reactMutation.mutateAsync({ messageId, emoji });
    } catch {
      // Swallow errors to preserve original behavior
    }
  }, [reactMutation]);

  return {
    messages,
    loading,
    error,
    setError,
    connected,
    sending,
    hasMore,
    loadingOlder,
    resolvedRoomId,
    directChatPeer,
    sendMessage,
    retryMessage,
    loadOlder,
    refresh,
    reactToMessage,
  };
}
