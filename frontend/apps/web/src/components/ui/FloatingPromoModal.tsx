'use client';

// ============================================================
// FLOATING PROMO MODAL
// A promotional overlay inspired by Uber's floating modals.
// Supports two variants:
//   - "bottom-sheet": slides up from the bottom (default)
//   - "center": fades/scales into center of screen
//
// Usage:
//   1. Mount <FloatingPromoModal /> once in your root layout.
//   2. Call promoModalStore.show({ ... }) from anywhere.
// ============================================================

import { useEffect, useState, useSyncExternalStore, useCallback } from 'react';
import { promoModalStore } from './promo-modal-store';
import type { PromoConfig } from './promo-modal-store';

export default function FloatingPromoModal() {
  const promo = useSyncExternalStore(
    promoModalStore.subscribe,
    promoModalStore.getSnapshot,
    () => null, // server snapshot
  );

  if (!promo) return null;
  return <PromoOverlay promo={promo} />;
}

// ─── Inner overlay (unmounts cleanly on dismiss) ────────────

function PromoOverlay({ promo }: { promo: PromoConfig }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const variant = promo.variant ?? 'bottom-sheet';

  // Animate in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const animateOut = useCallback((cb: () => void) => {
    setExiting(true);
    setTimeout(cb, 250);
  }, []);

  const handleDismiss = useCallback(() => {
    animateOut(() => promoModalStore.dismiss());
  }, [animateOut]);

  const handleAction = useCallback(() => {
    animateOut(() => promoModalStore.action());
  }, [animateOut]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleDismiss]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const isBottomSheet = variant === 'bottom-sheet';
  const animIn = visible && !exiting;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-250
          ${animIn ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleDismiss}
      />

      {/* Modal card */}
      <div
        className={`relative w-full transition-all duration-250 ease-out
          ${isBottomSheet
            ? `sm:max-w-md sm:rounded-2xl rounded-t-2xl ${animIn ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`
            : `max-w-md mx-4 rounded-2xl ${animIn ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`
          }
          bg-app-surface shadow-2xl border border-app-border-subtle overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero image area */}
        {promo.imageUrl && (
          <div className={`relative w-full h-48 sm:h-56 ${promo.heroBg ?? 'bg-primary-100'}`}>
            <img
              src={promo.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Close button on image */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-6 pt-5 pb-6">
          {/* Close button (when no image) */}
          {!promo.imageUrl && (
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-1.5 text-app-text-muted hover:text-app-text hover:bg-app-hover rounded-lg transition"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {promo.badge && (
            <span className="inline-block text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">
              {promo.badge}
            </span>
          )}

          <h2 className="text-xl font-bold text-app-text-strong leading-tight">
            {promo.title}
          </h2>

          <p className="mt-2 text-sm text-app-text-secondary leading-relaxed">
            {promo.body}
          </p>

          {/* CTA button */}
          <button
            onClick={handleAction}
            className="mt-5 w-full py-3 px-4 bg-app-text-strong text-app-surface rounded-xl font-semibold text-base hover:opacity-90 transition"
          >
            {promo.ctaLabel}
          </button>

          {/* Dismiss link */}
          <button
            onClick={handleDismiss}
            className="mt-2 w-full py-2 text-sm text-app-text-muted hover:text-app-text-secondary transition text-center"
          >
            {promo.dismissLabel ?? 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
