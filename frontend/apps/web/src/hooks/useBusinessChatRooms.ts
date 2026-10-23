'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { EVERYTHING, RECONNECTED, onSyncTopic } from '@/lib/syncSignals';

type Reply = Awaited<ReturnType<typeof api.chat.getBusinessChatRooms>>;
export type BusinessChatRoom = Reply['rooms'][number] & { other_participant_name?: string | null;
  other_participant_username?: string | null; other_participant_identity?: { avatarUrl?: string | null } | null;
  last_message_preview?: string | null; last_message_at?: string | null };
type State = { key: string; rooms: BusinessChatRoom[]; total: number; totalUnread: number;
  nextCursor: string | null; loading: boolean; loadingMore: boolean; error: string | null;
  failure: 'forbidden' | 'failed' | null };
const empty = (key: string): State => ({ key, rooms: [], total: 0, totalUnread: 0, nextCursor: null,
  loading: true, loadingMore: false, error: null, failure: null });

/** Shared by the existing business inbox surfaces. A refresh replaces the
 * complete loaded window, so revoked or reordered pages cannot linger. */
export function useBusinessChatRooms(businessId: string, enabled = true) {
  const key = JSON.stringify([businessId, api.authSessionMarker()]);
  const scope = useRef({ key, generation: 0, more: false });
  if (scope.current.key !== key) scope.current = { key, generation: scope.current.generation + 1, more: false };
  const [state, setState] = useState<State>(() => empty(key));
  const visible = state.key === key ? state : empty(key);
  const latest = useRef(visible);
  latest.current = visible;
  const load = useCallback(async (more = false) => {
    if (!businessId || !enabled) return;
    const marker = api.authSessionMarker();
    const current = scope.current;
    const before = more ? latest.current.nextCursor : null;
    if (more && (!before || current.more || latest.current.loading)) return;
    if (more) current.more = true;
    else { current.generation++; current.more = false; }
    const generation = current.generation;
    const alive = () => scope.current === current && current.generation === generation && marker === api.authSessionMarker();
    setState((previous) => ({ ...(previous.key === key ? previous : empty(key)), loading: !more && (previous.key !== key || previous.rooms.length === 0),
      loadingMore: more, error: null, failure: null }));
    try {
      const result = await api.chat.getBusinessChatRooms(businessId, { limit: 50, ...(before ? { before } : {}) });
      if (!alive()) return;
      if (!Array.isArray(result.rooms)) throw new Error('The inbox response was incomplete. Try again.');
      if (result.hasMore && (!result.nextCursor || result.nextCursor === before)) throw new Error('The inbox did not advance. Refresh and try again.');
      setState((previous) => ({ key,
        rooms: more ? [...new Map([...previous.rooms, ...result.rooms].map((room) => [room.id, room])).values()] : result.rooms,
        total: result.total, totalUnread: result.totalUnread,
        nextCursor: result.hasMore ? result.nextCursor ?? null : null,
        loading: false, loadingMore: false, error: null, failure: null }));
    } catch (error: unknown) {
      if (!alive()) return;
      const forbidden = (error as { statusCode?: number })?.statusCode === 403;
      setState((previous) => ({ ...(forbidden ? empty(key) : previous), loading: false, loadingMore: false,
        failure: forbidden ? 'forbidden' : previous.rooms.length ? null : 'failed', error: error instanceof Error ? error.message : 'Could not load business messages. Try again.' }));
    } finally { if (alive()) current.more = false; }
  }, [businessId, enabled, key]);
  const refresh = useCallback(() => load(), [load]);
  const loadMore = useCallback(() => load(true), [load]);
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (!navigator.onLine || document.visibilityState !== 'visible' || timer) return;
      timer = setTimeout(() => { timer = undefined; void refresh(); }, 500);
    };
    const unsubscribe = onSyncTopic((topic) => {
      if (topic === 'chats' || topic === RECONNECTED || topic === EVERYTHING) schedule();
    });
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('online', schedule);
    return () => { scope.current.generation++; if (timer) clearTimeout(timer); unsubscribe();
      document.removeEventListener('visibilitychange', schedule); window.removeEventListener('online', schedule); };
  }, [enabled, refresh]);
  return { ...visible, hasMore: Boolean(visible.nextCursor), refresh, loadMore };
}
