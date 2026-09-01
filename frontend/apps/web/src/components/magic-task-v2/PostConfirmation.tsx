'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { MagicPostResponse } from '@pantopus/types';
import { CheckCircle, Loader2 } from 'lucide-react';

const UNDO_WINDOW_MS = 10_000;
const AUTO_CLOSE_MS = 5_000;

interface PostConfirmationProps {
  result: MagicPostResponse;
  onClose: () => void;
  onUndo: () => void;
}

export default function PostConfirmation({ result, onClose, onUndo }: PostConfirmationProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<'countdown' | 'notifying' | 'done'>('countdown');
  const [undoing, setUndoing] = useState(false);
  const [countdown, setCountdown] = useState(Math.ceil(UNDO_WINDOW_MS / 1000));
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, UNDO_WINDOW_MS - elapsed);
      setCountdown(Math.ceil(remaining / 1000));
      setProgress((remaining / UNDO_WINDOW_MS) * 100);

      if (remaining <= 0) {
        clearInterval(interval);
        setPhase('notifying');
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Auto-close after notifying phase
  useEffect(() => {
    if (phase !== 'notifying') return;
    autoCloseRef.current = setTimeout(() => {
      setPhase('done');
      onClose();
    }, AUTO_CLOSE_MS);
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [phase, onClose]);

  const handleUndo = async () => {
    if (undoing) return;
    setUndoing(true);
    try {
      await api.magicTask.undoTask(result.gig.id);
      onUndo();
    } catch {
      // Window likely expired, proceed to view
      router.push(`/app/gigs/${result.gig.id}`);
      onClose();
    }
  };

  const handleViewTask = () => {
    router.push(`/app/gigs/${result.gig.id}`);
    onClose();
  };

  return (
    <div className="confirmation">
      <div className="confirmation-content">
        <div className="success-icon">
          <CheckCircle size={48} />
        </div>

        <h2 className="success-title">
          {phase === 'countdown' ? 'Task posted!' : 'Top matches being notified'}
        </h2>

        <p className="success-subtitle">{result.gig.title}</p>

        {phase === 'countdown' && (
          <>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>

            <button
              className="undo-btn"
              onClick={handleUndo}
              disabled={undoing}
            >
              {undoing ? (
                <><Loader2 size={14} className="spinner" /> Undoing...</>
              ) : (
                `Undo (${countdown}s)`
              )}
            </button>
          </>
        )}

        <button className="view-btn" onClick={handleViewTask}>
          View Task
        </button>
      </div>

      <style jsx>{`
        .confirmation {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 40px;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .confirmation-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          max-width: 360px;
          text-align: center;
        }
        .success-icon {
          color: #22c55e;
          animation: pop 0.4s ease;
        }
        @keyframes pop {
          0% { transform: scale(0); }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        .success-title {
          font-size: 22px;
          font-weight: 700;
          color: rgb(var(--app-text));
          margin: 0;
        }
        .success-subtitle {
          font-size: 15px;
          color: rgb(var(--app-text-secondary));
          margin: 0;
        }
        .progress-track {
          width: 100%;
          height: 4px;
          background: rgb(var(--app-surface-sunken));
          border-radius: 2px;
          overflow: hidden;
          margin-top: 8px;
        }
        .progress-bar {
          height: 100%;
          background: var(--color-primary-600);
          border-radius: 2px;
          transition: width 0.1s linear;
        }
        .undo-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 500;
          color: var(--color-primary-600);
          background: transparent;
          border: 1px solid rgb(var(--app-border));
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .undo-btn:hover:not(:disabled) {
          background: rgb(var(--app-surface-raised));
        }
        .undo-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        @media (prefers-color-scheme: dark) {
          .undo-btn {
            color: var(--color-primary-300);
          }
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .view-btn {
          padding: 12px 32px;
          font-size: 15px;
          font-weight: 600;
          color: #ffffff;
          background: var(--color-primary-600);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .view-btn:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}
