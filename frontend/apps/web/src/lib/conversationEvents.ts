// Live inbox updates for the signed-in account (its socket's new-message events),
// kept apart from lib/conversations.ts so the app shell can listen on every page
// without loading the inbox's reads and its encrypted copy (chatStorage).
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authSessionMarker } from '@pantopus/api/client';
import type { UnifiedConversationItem } from '@pantopus/types';
import { queryKeys } from '@/lib/query-keys';
import { useSocket } from '@/hooks/useSocket';
import type { ConversationsReply } from '@/lib/conversation-storage';
import { compareConversationTime } from '@/lib/conversationOrder';

type InboxMessage = { id?: string; room_id?: string; message?: string; message_text?: string;
  created_at?: string; user_id?: string; sender_id?: string; sender?: { id?: string }; preview?: string; unread_for?: number };

export function keptConversationRows(reply?: ConversationsReply): UnifiedConversationItem[] {
  return [...(reply?.conversations || []),
    ...(reply?.keptTail?.generation === reply?.refreshId ? reply?.keptTail?.rows || [] : [])];
}

/** The account keeps listening while mini/full views are closed. Events only
 * update known room memberships; unknown rooms need a fresh authorized inbox. */
export function useConversationEvents(accountId?: string | null) {
  const client = useQueryClient();
  const socket = useSocket();
  useEffect(() => {
    if (!socket || !accountId) return;
    const marker = authSessionMarker();
    const seen = new Set<string>();
    let connection = socket.id;
    let lastReload = 0;
    const current = () => marker === authSessionMarker()
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
