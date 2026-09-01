'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, Undo2, X } from 'lucide-react';

interface UndoToastProps {
  gigId: string;
  gigTitle: string;
  undoWindowMs: number;
  onUndo: (gigId: string) => Promise<void>;
  onExpire: () => void;
  onDismiss: () => void;
}

/**
 * Toast banner: "Task posted" + Undo (10s countdown).
 * Appears at the bottom of the screen after a magic task is posted.
 */
export default function UndoToast({
  gigId,
  gigTitle,
  undoWindowMs,
  onUndo,
  onExpire,
  onDismiss,
}: UndoToastProps) {
  const [remaining, setRemaining] = useState(Math.ceil(undoWindowMs / 1000));
  const [isUndoing, setIsUndoing] = useState(false);
  const [visible, setVisible] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          // Fade out then expire
          setTimeout(() => {
            setVisible(false);
            onExpire();
          }, 300);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onExpire, undoWindowMs]);

  const handleUndo = useCallback(async () => {
    if (isUndoing) return;
    setIsUndoing(true);
    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      await onUndo(gigId);
      setVisible(false);
    } catch {
      setIsUndoing(false);
      // Restart countdown if undo fails
      setRemaining(3);
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setVisible(false);
            onExpire();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [gigId, isUndoing, onUndo, onExpire]);

  if (!visible) return null;

  const progressPct = (remaining / Math.ceil(undoWindowMs / 1000)) * 100;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60]
        bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl
        px-5 py-3 flex items-center gap-3 min-w-[320px] max-w-[480px]
        animate-slide-up"
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Check icon */}
      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">Task posted</p>
        <p className="text-xs text-gray-400 truncate">{gigTitle}</p>
      </div>

      {/* Undo button */}
      <button
        onClick={handleUndo}
        disabled={isUndoing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
          bg-white/10 hover:bg-white/20 transition-colors
          text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed
          whitespace-nowrap"
      >
        <Undo2 className="w-4 h-4" />
        {isUndoing ? 'Undoing...' : `Undo (${remaining}s)`}
      </button>

      {/* Dismiss */}
      <button
        onClick={() => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setVisible(false);
          onDismiss();
        }}
        className="p-1 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
}
