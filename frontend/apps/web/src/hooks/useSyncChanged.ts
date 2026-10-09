'use client';

// Live updates (Instant Screens contract §8). The server's `sync:changed`
// socket event names the topics that changed for this person
// ({ topics, at }; no content, no names). Each topic marks the matching kept
// entries out of date: a screen showing one refreshes at once, the rest on
// their next visit. After the socket reconnects, Household, Messages and
// Notifications entries are marked (signals may have been missed), and coming
// back to the browser tab after 15 minutes marks everything. Screens that keep
// their own state (the Home dashboard) hear the same topics via
// lib/syncSignals.ts. Called once, in the app shell.

import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useSocket } from '@/contexts/SocketContext';
import { queryKeys } from '@/lib/query-keys';
import { EVERYTHING, RECONNECTED, emitSyncTopics } from '@/lib/syncSignals';

const AWAY_MS = 15 * 60 * 1000;

function mark(client: QueryClient, queryKey: readonly unknown[]): void {
  void client.invalidateQueries({ queryKey });
}

/** Marks what one topic covers. Unknown topics (and `mail`, dormant while Mailbox is off) are ignored. */
export function markTopic(client: QueryClient, topic: string): void {
  const split = topic.indexOf(':');
  const kind = split < 0 ? topic : topic.slice(0, split);
  const id = split < 0 ? '' : topic.slice(split + 1);
  switch (kind) {
    case 'profile': // profile:me: your profile, notification preferences and privacy settings
      mark(client, queryKeys.me());
      break;
    case 'homes':
      mark(client, queryKeys.placePrimaryHome());
      mark(client, queryKeys.placeMyHomes());
      mark(client, queryKeys.hub());
      break;
    case 'home': // its dashboard copy and summary cards
      if (id) mark(client, queryKeys.homeDashboard(id));
      break;
    case 'place': // that home's Place sections
      if (id) void client.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'place' && query.queryKey.includes(id) });
      break;
    case 'today':
      mark(client, queryKeys.hubToday());
      mark(client, ['place', 'intelligence']);
      break;
    case 'chats':
      mark(client, queryKeys.conversations());
      break;
    case 'chat':
      if (id) { mark(client, queryKeys.chatMessages(id)); mark(client, ['chat', 'room', id]); }
      break;
    case 'notifications':
      mark(client, queryKeys.notifications());
      break;
    case 'post':
      if (id) { mark(client, queryKeys.postDetail(id)); mark(client, queryKeys.postComments(id)); }
      break;
    case 'supporttrain':
      if (id) { mark(client, queryKeys.supportTrain(id)); mark(client, queryKeys.supportTrainLists()); }
      break;
    default:
      break;
  }
}

export function useSyncChanged(): void {
  const client = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const changed = (payload: { topics?: unknown } | null) => {
      const topics = Array.isArray(payload?.topics) ? payload.topics.filter((t): t is string => typeof t === 'string') : [];
      topics.forEach((topic) => markTopic(client, topic));
      emitSyncTopics(topics);
    };
    // A reconnect may have missed signals: Household, Messages and Notifications are marked.
    let connectedBefore = socket.connected;
    const connected = () => {
      if (connectedBefore) {
        mark(client, ['homes']);
        mark(client, queryKeys.placePrimaryHome());
        mark(client, queryKeys.placeMyHomes());
        mark(client, queryKeys.conversations());
        mark(client, ['chat']);
        mark(client, queryKeys.notifications());
        emitSyncTopics([RECONNECTED]);
      }
      connectedBefore = true;
    };
    socket.on('sync:changed', changed);
    socket.on('connect', connected);
    return () => { socket.off('sync:changed', changed); socket.off('connect', connected); };
  }, [socket, client]);

  useEffect(() => {
    let hiddenAt: number | null = null;
    const visibility = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (hiddenAt !== null && Date.now() - hiddenAt >= AWAY_MS) {
        void client.invalidateQueries();
        emitSyncTopics([EVERYTHING]);
      }
      hiddenAt = null;
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [client]);
}
