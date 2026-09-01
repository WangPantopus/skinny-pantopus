'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { Check, Info, AlertTriangle, X } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

type ToastType = 'success' | 'info' | 'warning' | 'error';

type Toast = {
  id: number;
  type: ToastType;
  message: string;
  onRetry?: () => void;
};

type ToastContextValue = {
  addToast: (type: ToastType, message: string, onRetry?: () => void) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

// ── Styles ───────────────────────────────────────────────────

const typeStyles: Record<ToastType, { bg: string; icon: ReactNode }> = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    icon: <Check className="w-4 h-4" />,
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    icon: <Info className="w-4 h-4" />,
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    icon: <X className="w-4 h-4" />,
  },
};

// ── Toast item ───────────────────────────────────────────────

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const style = typeStyles[toast.type];
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="alert"
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border shadow-lg max-w-sm ${style.bg}`}
    >
      <span className="flex-shrink-0 font-bold text-sm">{style.icon}</span>
      <p className="flex-1 text-sm min-w-0">{toast.message}</p>
      {toast.type === 'error' && toast.onRetry && (
        <button
          type="button"
          onClick={toast.onRetry}
          className="flex-shrink-0 text-xs font-semibold underline hover:no-underline"
        >
          Retry
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-0.5 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss notification"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Provider + container ─────────────────────────────────────

export function MailboxToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (type: ToastType, message: string, onRetry?: () => void) => {
      const id = ++nextId;
      setToasts((prev) => [...prev.slice(-4), { id, type, message, onRetry }]);
    },
    [],
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container — fixed bottom right */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────

export function useMailboxToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useMailboxToast must be used within a MailboxToastProvider');
  }
  return ctx;
}
