'use client';

import { useEffect, useRef } from 'react';

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

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Trap focus inside panel when open
  useEffect(() => {
    if (open) {
      // Small delay to let the panel animate in
      const timer = setTimeout(() => {
        panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
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
    </>
  );
}
