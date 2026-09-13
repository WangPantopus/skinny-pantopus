'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * SlidePanel — slides in from the right.
 * Used for add/edit forms in the Home Dashboard.
 */
export default function SlidePanel({
  open,
  onClose,
  title,
  subtitle,
  width = 'max-w-md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Keep keyboard navigation inside the visible modal and return focus on close.
  useEffect(() => {
    if (!open || !mounted) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]'
    ) || []).filter(element => element.getClientRects().length > 0);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); }
      if (e.key === 'Tab') {
        const items = controls(); const first = items[0]; const last = items[items.length - 1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !panelRef.current?.contains(document.activeElement))) {
          e.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    const timer = setTimeout(() => controls()[0]?.focus(), 200);
    return () => {
      clearTimeout(timer); document.removeEventListener('keydown', handler);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open, mounted]);

  if (!mounted || !open) return null;
  // The app shell creates a stacking context below its fixed header. A body
  // portal keeps the modal's close button and backdrop above that header.
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
        className={`fixed top-0 right-0 bottom-0 z-[61] w-full ${width} bg-app-surface shadow-2xl transform transition-transform duration-250 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-app-surface z-10 px-6 py-4 border-b border-app-border-subtle flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-app-text">{title}</h2>
            {subtitle && (
              <p className="text-xs text-app-text-secondary mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            aria-label="Close panel"
            onClick={onClose}
            className="p-2 hover:bg-app-hover rounded-lg transition text-app-text-secondary hover:text-app-text-strong"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-65px)] px-6 py-5">
          {children}
        </div>
      </aside>
    </>, document.body
  );
}
