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
import { clearAuthSession, getAuthToken, onTokenChange, refreshAuthSession } from '@pantopus/api';
import { API_BASE_URL } from '@pantopus/utils';
import { SESSION_ENDED_NOTICE_KEY, hardNavigate } from '@/lib/session-refresh';

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

/**
 * The server revoked this browser's session (`auth:session_revoked`: signed out
 * from another device, Sign out everywhere, a password change, this device
 * removed) and dropped the socket. The frame is a hint: a refresh confirms it
 * (and the refused refresh clears the cookies the server no longer honors), so
 * the page leaves for sign-in now instead of on its next failed request.
 */
async function confirmRevokedSession(reason: unknown, reconnect: () => void): Promise<void> {
  const result = await refreshAuthSession({ trigger: 'session_revoked' });
  if (result.status === 'success') {
    reconnect();
    return;
  }
  // Unreachable, or this tab already signed out or switched accounts: the next request decides.
  if (result.status !== 'invalid') return;
  const kind = reason === 'password_change' || reason === 'password_reset' ? 'password' : 'revoked';
  try { window.sessionStorage.setItem(SESSION_ENDED_NOTICE_KEY, `${kind}:${Date.now()}`); } catch { /* sign-in still opens */ }
  await clearAuthSession();
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  hardNavigate(`/login?redirectTo=${encodeURIComponent(returnTo)}`);
}

// ── Provider ─────────────────────────────────────────────────

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [sessionRevision, setSessionRevision] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const socketTokenRef = useRef<string | null>(null);

  const syncToken = useCallback(() => {
    const next = getAuthToken();
    setAuthToken((prev) => (prev === next ? prev : next));
  }, []);

  const replaceSession = useCallback(() => {
    // Cookie-backed sessions can share the same '__session__' marker. Retire
    // the old socket immediately instead of waiting for a different token value.
    socketRef.current?.disconnect();
    socketRef.current = null;
    socketTokenRef.current = null;
    setSocket(null);
    setConnected(false);
    syncToken();
    setSessionRevision((revision) => revision + 1);
  }, [syncToken]);

  // Sync token on mount, tab visibility change, and cross-tab storage events
  useEffect(() => {
    syncToken(); // initial sync
    const unsubscribe = onTokenChange(replaceSession);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncToken();
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key?.includes('auth') || e.key?.includes('token') || e.key?.includes('session')) {
        replaceSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleStorage);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
    };
  }, [syncToken, replaceSession]);

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
      // Next redirects /socket.io/ to /socket.io before its rewrite runs, so
      // ask for /socket.io directly (the server accepts both).
      addTrailingSlash: false,
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
      if (socketRef.current !== nextSocket) return;
      console.log('[Socket] Connected:', nextSocket.id);
      setConnected(true);
    });

    nextSocket.on('disconnect', (reason) => {
      if (socketRef.current !== nextSocket) return;
      console.log('[Socket] Disconnected:', reason);
      setConnected(false);
    });

    nextSocket.on('connect_error', (err) => {
      if (socketRef.current !== nextSocket) return;
      console.warn('[Socket] Connection retry:', err.message);
      setConnected(false);
    });

    nextSocket.on('auth:session_revoked', (payload?: { reason?: string }) => {
      // A sign-out in this browser revokes its own session too; the tab that
      // signed out navigates and the other tabs retire on the storage event.
      if (socketRef.current !== nextSocket || payload?.reason === 'logout') return;
      void confirmRevokedSession(payload?.reason, replaceSession);
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
  }, [authToken, sessionRevision, replaceSession]);

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
