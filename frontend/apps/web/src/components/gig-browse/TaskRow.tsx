'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { GigListItem } from '@pantopus/types';
import { formatTimeAgo, formatPrice, formatDistance } from '@pantopus/ui-utils';

function getImageUrl(gig: GigListItem): string | null {
  if (gig.first_image) return gig.first_image;
  if (gig.attachments?.[0]) return gig.attachments[0];
  return null;
}

// ─── Helpers ──────────────────────────────────────────────

/** True when the gig's deadline is today or tomorrow */
function isDeadlineSoon(gig: GigListItem): boolean {
  if (!gig.deadline) return false;
  const deadline = new Date(gig.deadline);
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  return deadline < tomorrow;
}

/** True when the gig was posted within the last 2 hours */
function isNew(gig: GigListItem): boolean {
  if (!gig.created_at) return false;
  const posted = new Date(gig.created_at).getTime();
  return Date.now() - posted < 2 * 60 * 60 * 1000;
}

// ─── Component ────────────────────────────────────────────

interface TaskRowProps {
  gig: GigListItem;
  onDismiss?: (gigId: string, category: string) => void;
  /** True when the corresponding map pin is selected */
  highlighted?: boolean;
  /** Called on mouse enter/leave for map pin highlighting */
  onHover?: (gigId: string | null) => void;
}

export default React.memo(function TaskRow({ gig, onDismiss, highlighted, onHover }: TaskRowProps) {
  const urgent = gig.is_urgent || isDeadlineSoon(gig);
  const fresh = isNew(gig);

  const price = formatPrice(Number(gig.price) || 0);
  const distance = formatDistance(gig.distance_meters ?? undefined);
  const timeAgo = gig.created_at ? formatTimeAgo(gig.created_at, 'full') : '';
  const imageUrl = getImageUrl(gig);
  const [imgError, setImgError] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(false);
      setDismissing(true);
      setTimeout(() => onDismiss?.(gig.id, gig.category || ''), 300);
    },
    [gig.id, gig.category, onDismiss]
  );

  const toggleMenu = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((v) => !v);
  }, []);

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setMenuOpen(false);
    }
  }, []);

  return (
    <div
      className={`relative group/row ${dismissing ? 'motion-safe:animate-slide-out overflow-hidden' : ''} ${highlighted ? 'motion-safe:animate-highlight-flash' : ''}`}
      data-gig-id={gig.id}
      onMouseEnter={() => onHover?.(gig.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Link
        href={`/app/gigs/${gig.id}`}
        aria-label={`View task: ${gig.title}, ${price}`}
        className={`
          flex items-center gap-3 px-4 py-3
          border-b border-app-border-subtle
          hover:bg-app-hover transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset
          ${urgent ? 'border-l-[3px] border-l-amber-400' : 'border-l-[3px] border-l-transparent'}
          ${highlighted ? 'bg-primary-50 dark:bg-primary-950/30 ring-1 ring-inset ring-primary-200 dark:ring-primary-800' : ''}
        `}
      >
        {/* Text content */}
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          {/* Line 1: Title + Price */}
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-app-text truncate">{gig.title}</h3>
              {fresh && (
                <span
                  className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                  aria-label="Recently posted"
                >
                  NEW
                </span>
              )}
            </div>
            <span className="shrink-0 text-sm font-bold text-green-600 dark:text-green-400">
              {price}
            </span>
          </div>

          {/* Line 2: Category + Distance + Time */}
          <div className="flex items-center gap-2 text-xs text-app-text-secondary">
            {gig.category && (
              <span className="inline-flex items-center bg-app-surface-sunken text-app-text-secondary px-1.5 py-0.5 rounded text-[11px] font-medium">
                {gig.category}
              </span>
            )}
            {distance && (
              <>
                <span className="text-app-text-muted">·</span>
                <span>{distance}</span>
              </>
            )}
            {timeAgo && (
              <>
                <span className="text-app-text-muted">·</span>
                <span>{timeAgo}</span>
              </>
            )}
            {gig.is_urgent && (
              <>
                <span className="text-app-text-muted" aria-hidden="true">
                  ·
                </span>
                <span
                  className="font-semibold text-amber-600 dark:text-amber-400"
                  aria-label="Urgent task"
                >
                  ASAP
                </span>
              </>
            )}
          </div>

          {/* Line 3: Description */}
          {gig.description && (
            <p className="text-xs text-app-text-muted truncate leading-relaxed">
              {gig.description}
            </p>
          )}
        </div>

        {/* Thumbnail */}
        {imageUrl && !imgError && (
          <Image
            src={imageUrl}
            alt=""
            width={48}
            height={48}
            className="shrink-0 rounded-lg object-cover w-12 h-12 sm:w-12 sm:h-12 max-sm:w-10 max-sm:h-10"
            onError={() => setImgError(true)}
            sizes="48px"
            quality={75}
          />
        )}
      </Link>

      {/* More menu button — visible on hover */}
      {onDismiss && (
        <div ref={menuRef} className="absolute top-2 right-2" onKeyDown={handleMenuKeyDown}>
          <button
            onClick={toggleMenu}
            className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 transition-opacity p-1 rounded hover:bg-app-surface-sunken text-app-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={`More actions for ${gig.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 bg-app-surface border border-app-border rounded-lg shadow-lg py-1 z-20 min-w-[160px]"
              role="menu"
            >
              <button
                onClick={handleDismiss}
                className="w-full text-left px-3 py-2 text-sm text-app-text hover:bg-app-hover transition-colors focus-visible:outline-none focus-visible:bg-app-hover"
                role="menuitem"
              >
                Not Interested
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
