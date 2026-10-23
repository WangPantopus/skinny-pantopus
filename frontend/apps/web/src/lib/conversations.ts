// ============================================================
// The Messages list: one cache entry for GET /api/chat/unified-conversations,
// shared by the Messages page, the floating chat widget and the sidebar's
// hover warm-up. Fresh for 30 seconds (Instant Screens contract §4,
// "Messages list"); live events update it in place.
// ============================================================

import * as api from '@pantopus/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, type QueryFunctionContext } from '@tanstack/react-query';
import type { UnifiedConversationItem } from '@pantopus/types';
import { queryKeys } from '@/lib/query-keys';
import { useSocket } from '@/hooks/useSocket';

type ConversationTail = { generation?: string; rows: UnifiedConversationItem[]; nextCursor: string | null; hasMore: boolean };
export type ConversationsReply = Awaited<ReturnType<typeof api.chat.getUnifiedConversations>> & { refreshId?: string; keptTail?: ConversationTail };

export const CONVERSATIONS_LIMIT = 50;
export const CONVERSATIONS_FRESH_MS = 30 * 1000;

export function conversationsQuery(search = '') {
  const q = search.trim();
  return {
    queryKey: q ? [...queryKeys.conversations(), 'search', q] : queryKeys.conversations(),
    queryFn: async ({ client, queryKey, signal }: QueryFunctionContext): Promise<ConversationsReply> => {
      const marker = api.authSessionMarker();
      const previous = client.getQueryData<ConversationsReply>(queryKey);
      const previousTail = previous?.keptTail?.generation === previous?.refreshId ? previous?.keptTail?.rows : [];
      const pageCount = Math.max(1, Math.ceil(((previous?.conversations?.length || 0) + (previousTail?.length || 0)) / CONVERSATIONS_LIMIT));
      const current = () => {
        if (signal.aborted || marker !== api.authSessionMarker()) throw new DOMException('Inbox request cancelled', 'AbortError');
      };
      current();
      const first = await api.chat.getUnifiedConversations({ limit: CONVERSATIONS_LIMIT, ...(q ? { q } : {}) });
      current();
      let page = first;
      const tail: UnifiedConversationItem[] = [];
      const cursors = new Set<string>();
      for (let index = 1; index < pageCount && page.hasMore; index++) {
        const before = page.nextCursor;
        if (!before || cursors.has(before)) throw new Error('The inbox did not advance. Refresh and try again.');
        cursors.add(before);
        page = await api.chat.getUnifiedConversations({ limit: CONVERSATIONS_LIMIT, before, ...(q ? { q } : {}) });
        current();
        tail.push(...page.conversations);
      }
      if (page.hasMore && (!page.nextCursor || cursors.has(page.nextCursor))) {
        throw new Error('The inbox did not advance. Refresh and try again.');
      }
      const refreshId = crypto.randomUUID();
      const rows = preserveNewerPreviews([...first.conversations, ...tail], client.getQueryData<ConversationsReply>(queryKey), previous)
        .sort((a, b) => compareConversationTime(b.last_message_at, a.last_message_at));
      return { ...first, conversations: rows.slice(0, first.conversations.length), refreshId,
        ...(pageCount > 1 ? { keptTail: { generation: refreshId, rows: rows.slice(first.conversations.length),
          nextCursor: page.nextCursor, hasMore: page.hasMore } } : {}) };
    },
    staleTime: CONVERSATIONS_FRESH_MS,
  };
}

export function conversationKey(conversation: UnifiedConversationItem): string {
  return conversation._type === 'room' ? `room:${conversation.id}` : `person:${conversation.other_participant_id}`;
}

export function compareConversationTime(a?: string | null, b?: string | null): number {
  const milliseconds = Date.parse(a || '1970-01-01') - Date.parse(b || '1970-01-01');
  if (milliseconds) return milliseconds;
  const fraction = (value?: string | null) => (value?.match(/\.(\d+)/)?.[1] || '').padEnd(6, '0');
  return fraction(a).localeCompare(fraction(b));
}

type InboxMessage = { id?: string; room_id?: string; message?: string; message_text?: string;
  created_at?: string; user_id?: string; sender_id?: string; sender?: { id?: string }; preview?: string; unread_for?: number };

function keptConversationRows(reply?: ConversationsReply): UnifiedConversationItem[] {
  return [...(reply?.conversations || []),
    ...(reply?.keptTail?.generation === reply?.refreshId ? reply?.keptTail?.rows || [] : [])];
}

/** A newer event may beat an older HTTP snapshot, but it cannot authorize a
 * row or room omitted by that snapshot. Fresh equal-time read state wins. */
function preserveNewerPreviews(rows: UnifiedConversationItem[], saved: ConversationsReply | undefined, started: ConversationsReply | undefined): UnifiedConversationItem[] {
  const initial = new Map(keptConversationRows(started).map((row) => [conversationKey(row), row]));
  const kept = new Map(keptConversationRows(saved).map((row) => [conversationKey(row), row]));
  return rows.map((row) => {
    const prior = kept.get(conversationKey(row));
    const before = initial.get(conversationKey(row));
    // Only a newer message received during this request can beat its reply.
    // Otherwise a deleted latest message would keep its old preview forever.
    if (!prior || !before || compareConversationTime(prior.last_message_at, before.last_message_at) <= 0
      || compareConversationTime(prior.last_message_at, row.last_message_at) <= 0
      || (row._type === 'conversation' && (prior._type !== 'conversation'
        || !prior.room_ids.every((id) => row.room_ids.includes(id))))) return row;
    return { ...row, last_message_at: prior.last_message_at, last_message_preview: prior.last_message_preview,
      total_unread: prior.total_unread };
  });
}

/** The account keeps listening while mini/full views are closed. Events only
 * update known room memberships; unknown rooms need a fresh authorized inbox. */
export function useConversationEvents(accountId?: string | null) {
  const client = useQueryClient();
  const socket = useSocket();
  useEffect(() => {
    if (!socket || !accountId) return;
    const marker = api.authSessionMarker();
    const seen = new Set<string>();
    let connection = socket.id;
    let lastReload = 0;
    const current = () => marker === api.authSessionMarker()
      && client.getQueryData<{ id?: string }>(queryKeys.me())?.id === accountId;
    const connected = () => { if (current()) connection = socket.id; };
    const changed = (message: InboxMessage) => {
      if (!current() || !socket.connected || socket.id !== connection || !message?.id || !message.room_id
        || !message.created_at || !Number.isFinite(Date.parse(message.created_at)) || seen.has(message.id)) return;
      seen.add(message.id);
      if (seen.size > 1000) seen.delete(seen.values().next().value!);
      const room = message.room_id;
      const timestamp = message.created_at;
      const own = (message.user_id || message.sender_id || message.sender?.id) === accountId;
      let unknown = false;
      client.setQueriesData<ConversationsReply>({ queryKey: queryKeys.conversations() }, (previous) => {
        if (!previous || !current()) return previous;
        const rows = keptConversationRows(previous);
        const index = rows.findIndex((row) => row._type === 'room' ? row.id === room : row.room_ids.includes(room));
        if (index < 0) { unknown = true; return previous; }
        const row = rows[index];
        // A duplicate delivered after an HTTP refresh or an older event must
        // not re-increment a count already included in the server snapshot.
        if (row.last_message_at && compareConversationTime(timestamp, row.last_message_at) <= 0) return previous;
        rows[index] = { ...row, last_message_at: timestamp,
          last_message_preview: (message.preview || message.message_text || message.message || '[Attachment]').substring(0, 100),
          total_unread: typeof message.unread_for === 'number' ? message.unread_for : Number(row.total_unread || 0) + (own ? 0 : 1) };
        rows.sort((a, b) => compareConversationTime(b.last_message_at, a.last_message_at));
        const headCount = previous.conversations.length;
        const tail = previous.keptTail?.generation === previous.refreshId ? previous.keptTail : null;
        // Aggregate badges/counts remain server-driven; this is one known row.
        return { ...previous, conversations: rows.slice(0, headCount),
          ...(tail ? { keptTail: { ...tail, rows: rows.slice(headCount) } } : {}) };
      });
      if (unknown && Date.now() - lastReload >= 10000) {
        lastReload = Date.now();
        void client.invalidateQueries({ queryKey: queryKeys.conversations(),
          refetchType: navigator.onLine && document.visibilityState === 'visible' ? 'active' : 'none' });
      }
    };
    socket.on('connect', connected);
    socket.on('message:new', changed); socket.on('newMessage', changed);
    return () => { socket.off('connect', connected); socket.off('message:new', changed); socket.off('newMessage', changed); };
  }, [accountId, client, socket]);
}

/** Refresh the previously loaded depth with authorized cursor pages before
 * replacing it atomically. No unvalidated cached tail survives the refresh. */
export function useConversationPages(search = '') {
  const q = search.trim();
  const client = useQueryClient();
  const query = useQuery(conversationsQuery(q));
  const head = query.data;
  const generation = head?.refreshId;
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const scope = `${q}:${generation || ''}`;
  const current = useRef(scope);
  current.current = scope;
  const request = useRef(0);
  const inFlight = useRef(false);
  const validTail = head?.keptTail?.generation === generation ? head?.keptTail : null;
  useEffect(() => {
    request.current += 1; inFlight.current = false;
    setLoadingMore(false); setMoreError(null);
    return () => { request.current += 1; };
  }, [scope]);
  const conversations = useMemo(() => {
    const seen = new Set<string>();
    return [...(head?.conversations || []), ...(validTail?.rows || [])].filter((conversation) => {
      const key = conversationKey(conversation);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }, [head?.conversations, validTail]);
  const nextCursor = validTail ? validTail.nextCursor : head?.nextCursor;
  const hasMore = validTail ? validTail.hasMore : Boolean(head?.hasMore);
  const loadMore = useCallback(async () => {
    const revalidating = () => client.getQueryState(conversationsQuery(q).queryKey)?.fetchStatus === 'fetching';
    if (!nextCursor || !hasMore || inFlight.current || revalidating()) return;
    const ownRequest = ++request.current;
    const marker = api.authSessionMarker();
    const started = client.getQueryData<ConversationsReply>(conversationsQuery(q).queryKey);
    inFlight.current = true; setLoadingMore(true); setMoreError(null);
    try {
      const page = await api.chat.getUnifiedConversations({ limit: CONVERSATIONS_LIMIT, before: nextCursor, ...(q ? { q } : {}) });
      if (ownRequest !== request.current || current.current !== scope || marker !== api.authSessionMarker() || revalidating()) return;
      client.setQueryData<ConversationsReply>(conversationsQuery(q).queryKey, (previous) => previous && previous.refreshId === generation ? ({ ...previous,
        keptTail: { generation, rows: [...(previous.keptTail && previous.keptTail.generation === generation ? previous.keptTail.rows : []), ...preserveNewerPreviews(page.conversations, previous, started)],
          nextCursor: page.nextCursor, hasMore: page.hasMore } }) : previous);
    } catch (error) {
      if (ownRequest === request.current && current.current === scope && marker === api.authSessionMarker()) {
        setMoreError(error instanceof Error ? error.message : 'Could not load more conversations.');
      }
    } finally {
      if (ownRequest === request.current) { inFlight.current = false; setLoadingMore(false); }
    }
  }, [nextCursor, hasMore, generation, scope, q, client]);
  return { query, conversations, hasMore, loadMore, loadingMore, moreError };
}
