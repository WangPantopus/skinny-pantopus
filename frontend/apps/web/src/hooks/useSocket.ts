import { useEffect, useCallback } from 'react';
import { useSocket as useSocketCtx } from '@/contexts/SocketContext';

export { useSocket, useSocketConnected } from '@/contexts/SocketContext';

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
