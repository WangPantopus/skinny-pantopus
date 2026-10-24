import { useEffect, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { ChatMessage } from '@pantopus/types';
import { useSocket as useSocketCtx } from '@/contexts/SocketContext';

export { useSocket, useSocketConnected } from '@/contexts/SocketContext';

type RoomJoinResponse = { success?: boolean; messages?: ChatMessage[]; subscriptionId?: string;
  code?: string; retryable?: boolean; retryAfterMs?: number };
export interface SocketRoomLease { join: () => Promise<RoomJoinResponse | undefined>; release: () => void }
type RoomSubscription = { connection: string | undefined; owners: Set<symbol>; retired: boolean; joined: boolean;
  subscriptionId?: string; pending?: Promise<RoomJoinResponse | undefined> };
const roomSubscriptions = new WeakMap<Socket, Map<string, RoomSubscription>>();

/** Mini chat, inquiry drawers and full conversations can share one socket.
 * Only their last consumer may release a room, including a pending join. */
export function retainSocketRoom(socket: Socket, roomId: string): SocketRoomLease {
  let rooms = roomSubscriptions.get(socket);
  if (!rooms) { rooms = new Map(); roomSubscriptions.set(socket, rooms); }
  let existing = rooms.get(roomId);
  if (!existing || existing.connection !== socket.id || existing.retired) {
    existing = { connection: socket.id, owners: new Set(), retired: false, joined: false };
    rooms.set(roomId, existing);
  }
  const entry = existing;
  const owner = Symbol(roomId);
  entry.owners.add(owner);
  const current = () => !entry.retired && socket.connected && socket.id === entry.connection;
  const leave = (subscriptionId?: string) => {
    // Never queue a leave for a later connection or send an unqualified leave
    // that could remove a newer attempt after a navigation/timeout race.
    if (subscriptionId && socket.connected && socket.id === entry.connection) {
      socket.emit('room:leave', { roomId, subscriptionId });
    }
  };
  return {
    join: () => {
      if (!current() || !entry.owners.has(owner)) return Promise.resolve(undefined);
      // A new consumer loads its own canonical REST history. Replaying an old
      // successful ACK here could resurrect messages deleted since that join.
      if (entry.joined) return Promise.resolve({ success: true });
      if (entry.pending) return entry.pending;
      const subscriptionId = crypto.randomUUID();
      entry.subscriptionId = subscriptionId;
      const pending = new Promise<RoomJoinResponse | undefined>((resolve) => {
        socket.timeout(10_000).emit('room:join', { roomId, subscriptionId },
          (error: Error | null, result: RoomJoinResponse) => resolve(error ? undefined : result));
      }).then((result) => {
        if (!current() || !entry.owners.size) { leave(subscriptionId); return undefined; }
        if (result?.success && (!result.subscriptionId || result.subscriptionId === subscriptionId)) {
          entry.joined = true;
          return result;
        }
        leave(subscriptionId);
        if (entry.subscriptionId === subscriptionId) entry.subscriptionId = undefined;
        return result?.success ? undefined : result;
      }).finally(() => { if (entry.pending === pending) entry.pending = undefined; });
      entry.pending = pending;
      return pending;
    },
    release: () => {
      if (!entry.owners.delete(owner) || entry.owners.size) return;
      entry.retired = true;
      leave(entry.subscriptionId);
      if (rooms.get(roomId) === entry) rooms.delete(roomId);
    },
  };
}

/**
 * Subscribe to a Socket.IO event with automatic cleanup.
 * The handler is called whenever the event fires while the component is mounted.
 */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (data: T) => void,
) {
  const socket = useSocketCtx();

  // Stable reference to avoid re-subscribing on every render
  const stableHandler = useCallback(handler, [handler]);

  useEffect(() => {
    if (!socket) return;
    socket.on(event, stableHandler);
    return () => {
      socket.off(event, stableHandler);
    };
  }, [socket, event, stableHandler]);
}

/**
 * Emit a Socket.IO event. Returns a stable emit function.
 */
export function useSocketEmit() {
  const socket = useSocketCtx();
  return useCallback(
    (event: string, ...args: unknown[]) => {
      if (!socket?.connected) {
        console.warn('[Socket] Cannot emit — not connected');
        return;
      }
      socket.emit(event, ...args);
    },
    [socket],
  );
}
