'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './useSocket';

/** Ephemeral room-scoped hints. Never persist them or queue them while offline. */
export function useChatTyping({ roomId, roomIds, currentUserId, asBusinessUserId, scopeKey }: {
  roomId?: string | null; roomIds: string[]; currentUserId?: string | null;
  asBusinessUserId?: string; scopeKey: string;
}) {
  const socket = useSocket();
  const [peerCount, setPeerCount] = useState(0);
  const update = useRef<(active: boolean) => void>(() => {});
  const roomKey = [...roomIds].sort().join(',');

  useEffect(() => {
    setPeerCount(0);
    if (!socket || !currentUserId) return;
    const rooms = new Set(roomKey.split(',').filter(Boolean));
    const peers = new Map<string, ReturnType<typeof setTimeout>>();
    let pulse: ReturnType<typeof setInterval> | undefined;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let outgoing = false;
    const visible = () => document.visibilityState === 'visible' && navigator.onLine;
    const stop = () => {
      clearInterval(pulse); clearTimeout(idle); pulse = undefined; idle = undefined;
      if (outgoing && socket.connected && roomId) socket.emit('typing:stop', { roomId });
      outgoing = false;
    };
    update.current = (active) => {
      if (!active || !roomId || asBusinessUserId || !socket.connected || !visible()) { stop(); return; }
      clearTimeout(idle);
      idle = setTimeout(stop, 4500);
      if (outgoing) return;
      outgoing = true;
      socket.emit('typing:start', { roomId });
      pulse = setInterval(() => {
        if (!socket.connected || !visible()) { stop(); return; }
        socket.emit('typing:start', { roomId });
      }, 3000);
    };
    const clearPeers = () => { peers.forEach(clearTimeout); peers.clear(); setPeerCount(0); };
    const eventKey = (event: { userId?: unknown; roomId?: unknown } | null) => {
      if (!visible() || typeof event?.roomId !== 'string' || !rooms.has(event.roomId)
        || typeof event.userId !== 'string' || event.userId === currentUserId || event.userId === asBusinessUserId) return null;
      return `${event.roomId}:${event.userId}`;
    };
    const started = (event: { userId?: unknown; roomId?: unknown } | null) => {
      const key = eventKey(event); if (!key) return;
      clearTimeout(peers.get(key));
      peers.set(key, setTimeout(() => { peers.delete(key); setPeerCount(peers.size); }, 5000));
      setPeerCount(peers.size);
    };
    const stopped = (event: { userId?: unknown; roomId?: unknown } | null) => {
      const key = eventKey(event); if (!key) return;
      clearTimeout(peers.get(key)); peers.delete(key); setPeerCount(peers.size);
    };
    const disconnected = () => { stop(); clearPeers(); };
    const visibility = () => { if (!visible()) disconnected(); };
    socket.on('typing:user', started); socket.on('typing:stopped', stopped); socket.on('disconnect', disconnected);
    window.addEventListener('blur', stop); window.addEventListener('offline', disconnected);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stop(); peers.forEach(clearTimeout); update.current = () => {};
      socket.off('typing:user', started); socket.off('typing:stopped', stopped); socket.off('disconnect', disconnected);
      window.removeEventListener('blur', stop); window.removeEventListener('offline', disconnected);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [socket, roomId, roomKey, currentUserId, asBusinessUserId, scopeKey]);

  return { peerCount, onTypingChange: useCallback((active: boolean) => update.current(active), []) };
}
