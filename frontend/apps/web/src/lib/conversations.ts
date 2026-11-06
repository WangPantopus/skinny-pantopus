// ============================================================
// The Messages list: one cache entry for GET /api/chat/unified-conversations,
// shared by the Messages page, the floating chat widget and the sidebar's
// hover warm-up. Fresh for 30 seconds (Instant Screens contract §4,
// "Messages list"); live events update it in place.
// ============================================================

import * as api from '@pantopus/api';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, type QueryFunctionContext } from '@tanstack/react-query';
import type { UnifiedConversationItem } from '@pantopus/types';
import { queryKeys } from '@/lib/query-keys';
import { fetchMe } from '@/lib/me';
import { activateChatStorage, deleteChatRecords, readCachedChatAccountId, readChatHistoryFence,
  readChatRecord, type HistoryFence } from '@/components/chat/chatStorage';
import { chatRetirementsSeen } from '@/components/chat/chatSession';

import { CONVERSATIONS_LIMIT, INBOX_KEY, retainInbox as saveInbox, type ConversationsReply, type SavedInbox } from '@/lib/conversation-storage';
import { compareConversationTime } from '@/lib/conversationOrder';
export { CONVERSATIONS_LIMIT, type ConversationsReply } from '@/lib/conversation-storage';
export { compareConversationTime } from '@/lib/conversationOrder';
import { keptConversationRows } from '@/lib/conversationEvents';
// The app shell keeps the inbox live from its own module, without this one's storage.
export { useConversationEvents } from '@/lib/conversationEvents';

export const CONVERSATIONS_FRESH_MS = 30 * 1000;

// The access fence as read while the app booted, for the first inbox request only:
// read as soon as the store opens, so a cold inbox request need not wait.
let bootFence: { marker: string; retirements: number; at: number; read: Promise<HistoryFence | null | undefined> } | undefined;
const BOOT_FENCE_MS = 10_000;
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined' && api.getAuthToken()) {
  bootFence = { marker: api.authSessionMarker(), retirements: chatRetirementsSeen(), at: performance.now(),
    read: readChatHistoryFence().catch(() => undefined) };
}

/** Capture before an inbox request, even before its profile query completes.
 * The first request may take the read made while the app booted, if it is in
 * the same session, soon after, and no retirement was seen since. Within a
 * session the fence only advances, so an earlier read can stop a raced
 * response from being retained, never let one through. */
async function captureChatHistoryFence(marker: string): Promise<HistoryFence | null> {
  const boot = bootFence;
  bootFence = undefined;
  if (boot && boot.marker === marker && boot.retirements === chatRetirementsSeen() && performance.now() - boot.at < BOOT_FENCE_MS) {
    const fence = await boot.read;
    if (fence !== undefined && boot.retirements === chatRetirementsSeen()) return fence;
  }
  return await readChatHistoryFence();
}

/** The boot read, while no inbox request has taken it. */
export const inboxBootFence = () => bootFence;

export async function retainInbox(reply: ConversationsReply, accountId: string | undefined, marker: string,
  fence: HistoryFence | null | undefined, current?: () => boolean) {
  if (fence === undefined) return;
  const actor = accountId || await readCachedChatAccountId() || (await fetchMe()).id;
  await saveInbox(reply, actor, marker, fence, current);
}

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
      // Read the bounded fence before the request. Adopting a fence afterwards
      // could retain a response which raced a room/account access change.
      const fence = q ? undefined : await captureChatHistoryFence(marker).catch(() => undefined);
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
      const reply = { ...first, conversations: rows.slice(0, first.conversations.length), refreshId,
        ...(pageCount > 1 ? { keptTail: { generation: refreshId, rows: rows.slice(first.conversations.length),
          nextCursor: page.nextCursor, hasMore: page.hasMore } } : {}) };
      if (!q) void retainInbox(reply, client.getQueryData<{ id?: string }>(queryKeys.me())?.id, marker, fence).catch(() => {});
      return reply;
    },
    staleTime: CONVERSATIONS_FRESH_MS,
  };
}

export function conversationKey(conversation: UnifiedConversationItem): string {
  return conversation._type === 'room' ? `room:${conversation.id}` : `person:${conversation.other_participant_id}`;
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

/** Refresh the previously loaded depth with authorized cursor pages before
 * replacing it atomically. No unvalidated cached tail survives the refresh. */
export function useConversationPages(search = '') {
  const q = search.trim();
  const client = useQueryClient();
  const query = useQuery(conversationsQuery(q));
  const [restored, setRestored] = useState(false);
  const status = (query.error as { statusCode?: number; status?: number } | null)?.statusCode
    ?? (query.error as { status?: number } | null)?.status;
  useEffect(() => {
    if (q || (status !== 401 && status !== 403 && status !== 404)) return;
    const marker = api.authSessionMarker();
    void (async () => {
      const actor = await readCachedChatAccountId();
      if (!actor || marker !== api.authSessionMarker()) return;
      const scope = await activateChatStorage(actor);
      if (marker === api.authSessionMarker()) await deleteChatRecords(scope, [{ kind: 'history', key: INBOX_KEY }]);
    })().catch(() => {});
  }, [q, status]);
  // Start the inbox read and the saved-inbox restore at commit. From effects
  // they would wait for the first paint, which on a cold load is the whole app
  // shell's, and each begins with a storage read.
  useLayoutEffect(() => { void client.prefetchQuery(conversationsQuery(q)); }, [client, q]);
  useLayoutEffect(() => {
    if (q) { setRestored(true); return; }
    let cancelled = false;
    const marker = api.authSessionMarker();
    setRestored(false);
    void (async () => {
      const actor = await readCachedChatAccountId();
      if (!actor || cancelled || marker !== api.authSessionMarker()) return;
      const scope = await activateChatStorage(actor);
      const saved = await readChatRecord<SavedInbox>(scope, 'history', INBOX_KEY);
      if (cancelled || marker !== api.authSessionMarker() || !saved?.inbox || !Array.isArray(saved.inbox.conversations)) return;
      const state = client.getQueryState(conversationsQuery().queryKey);
      const status = (state?.error as { statusCode?: number } | null)?.statusCode;
      if (status === 401 || status === 403 || status === 404) {
        await deleteChatRecords(scope, [{ kind: 'history', key: INBOX_KEY }]); return;
      }
      if (!state?.data) client.setQueryData(conversationsQuery().queryKey, saved.inbox, { updatedAt: 0 });
    })().catch(() => {}).finally(() => { if (!cancelled) setRestored(true); });
    return () => { cancelled = true; };
  }, [client, q]);
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
  return { query, conversations, hasMore, loadMore, loadingMore, moreError, restored };
}
