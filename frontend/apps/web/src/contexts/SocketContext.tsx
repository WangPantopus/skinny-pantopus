'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAuthToken } from '@pantopus/api';
import { API_BASE_URL } from '@pantopus/utils';

// ── Context ──────────────────────────────────────────────────

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
});

/** Where Socket.IO should connect from the browser. */
function getSocketBaseUrl(): string {
  if (typeof window === 'undefined') return API_BASE_URL;
  const host = window.location.hostname;
  const isLocalDevHost =
    host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  // Local Next dev: rewrites do not reliably proxy WebSocket upgrades to an external
  // backend — connect straight to NEXT_PUBLIC_API_URL (same as before).
  // Production: same origin as the page so httpOnly `pantopus_access` is sent on the handshake.
  if (isLocalDevHost) return API_BASE_URL;
  return window.location.origin;
}

// ── Provider ─────────────────────────────────────────────────

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const socketTokenRef = useRef<string | null>(null);

  const syncToken = useCallback(() => {
    const next = getAuthToken();
    setAuthToken((prev) => (prev === next ? prev : next));
  }, []);

  // Sync token on mount, tab visibility change, and cross-tab storage events
  useEffect(() => {
    syncToken(); // initial sync

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncToken();
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key?.includes('auth') || e.key?.includes('token') || e.key?.includes('session')) {
        syncToken();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleStorage);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
    };
  }, [syncToken]);

  useEffect(() => {
    if (!authToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      socketTokenRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    if (socketRef.current && socketTokenRef.current === authToken) {
      return;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const nextSocket = io(getSocketBaseUrl(), {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      tryAllTransports: true,
      withCredentials: true, // Send cookies for httpOnly cookie auth fallback
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
    });

    socketRef.current = nextSocket;
    socketTokenRef.current = authToken;
    setSocket(nextSocket);

    nextSocket.on('connect', () => {
      console.log('[Socket] Connected:', nextSocket.id);
      setConnected(true);
    });

    nextSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
    });

    nextSocket.on('connect_error', (err) => {
      console.warn('[Socket] Connection retry:', err.message);
      setConnected(false);
    });

    return () => {
      nextSocket.disconnect();
      if (socketRef.current === nextSocket) {
        socketRef.current = null;
        socketTokenRef.current = null;
        setSocket(null);
      }
      socketRef.current = null;
      setConnected(false);
    };
  }, [authToken]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

// ── Hooks ────────────────────────────────────────────────────

export function useSocket(): Socket | null {
  return useContext(SocketContext).socket;
}

export function useSocketConnected(): boolean {
  return useContext(SocketContext).connected;
}
