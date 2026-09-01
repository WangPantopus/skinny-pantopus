'use client';

import { useEffect, useState, useRef } from 'react';
import * as api from '@pantopus/api';
import ConversationView from '@/components/chat/ConversationView';

/**
 * InquiryChatDrawer — slide-over panel to contact a business
 * without navigating away from the current page.
 *
 * Flow: resolve business_user_id → open ConversationView inline.
 */
export default function InquiryChatDrawer({
  businessUserId,
  businessName,
  onClose,
}: {
  businessUserId: string;
  businessName?: string;
  onClose: () => void;
}) {
  const [resolving, setResolving] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const headingId = `chat-drawer-heading-${businessUserId}`;

  // Verify the business user exists (also warms up the room creation)
  useEffect(() => {
    (async () => {
      try {
        await api.chat.createDirectChat(businessUserId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to start chat';
        setError(message);
      } finally {
        setResolving(false);
      }
    })();
  }, [businessUserId]);

  // Escape key to close + focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Simple focus trap
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // Focus the drawer on mount
    drawerRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1000] bg-black/30 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="fixed top-0 right-0 bottom-0 z-[1001] w-full max-w-md bg-surface shadow-2xl flex flex-col animate-slide-in-right outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-app">
          <div className="min-w-0">
            <h2 id={headingId} className="text-sm font-semibold text-app truncate">
              {businessName ? `Message ${businessName}` : 'Message'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-app-hover rounded-lg transition"
            aria-label="Close chat"
          >
            <svg className="w-5 h-5 text-app-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {resolving && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          )}

          {error && (
            <div className="p-6 text-center">
              <p className="text-sm text-red-600 mb-3">{error}</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => {
                    setError(null);
                    setResolving(true);
                    api.chat.createDirectChat(businessUserId)
                      .then(() => setResolving(false))
                      .catch((err: unknown) => {
                        const msg = err instanceof Error ? err.message : 'Unable to start chat';
                        setError(msg);
                        setResolving(false);
                      });
                  }}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-800"
                >
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="text-xs font-semibold text-app-secondary hover:text-app"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {!resolving && !error && (
            <ConversationView
              otherUserId={businessUserId}
              returnTo=""
            />
          )}
        </div>
      </div>
    </>
  );
}
