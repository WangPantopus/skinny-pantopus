'use client';

/**
 * EndorsementButton — "Endorse" CTA for a business profile.
 *
 * Behavior:
 *   1. On load, fetches the categories the current user has already endorsed.
 *   2. Shows a dropdown of the business's categories.
 *   3. Toggling a category calls endorseBusiness / retractEndorsement.
 *   4. Requires auth — redirects to /login if not logged in.
 *
 * Visual:
 *   - Collapsed: a single "👍 Endorse" button (or "👍 Endorsed (N)" if any)
 *   - Expanded: category checklist popover
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { CATEGORY_MAP } from '@/components/discover/constants';

interface EndorsementButtonProps {
  /** The business user id to endorse */
  businessId: string;
  /** The business's declared categories */
  categories: string[];
  /** Compact mode — smaller text, for inline use in cards */
  compact?: boolean;
  /** Called after any endorsement change with the new count */
  onCountChange?: (count: number) => void;
  /** If true, the current user owns this business (hide the button) */
  isOwner?: boolean;
}

export default function EndorsementButton({
  businessId,
  categories,
  compact = false,
  onCountChange,
  isOwner = false,
}: EndorsementButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [endorsedCategories, setEndorsedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Load current user's endorsements for this business
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.businesses.getMyEndorsements(businessId);
        if (!cancelled) setEndorsedCategories(res.endorsed_categories || []);
      } catch {
        // API may 404 if endorsements not implemented yet — graceful fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [businessId]);

  // Close on outside click or touch
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [open]);

  const toggleCategory = useCallback(async (category: string) => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }

    const isEndorsed = endorsedCategories.includes(category);
    setToggling(category);

    // Optimistic update
    const prev = endorsedCategories;
    const next = isEndorsed
      ? prev.filter((c) => c !== category)
      : [...prev, category];
    setEndorsedCategories(next);

    try {
      if (isEndorsed) {
        await api.businesses.retractEndorsement(businessId, category);
      } else {
        await api.businesses.endorseBusiness(businessId, { category });
      }
      onCountChange?.(next.length);
    } catch {
      // Revert on error
      setEndorsedCategories(prev);
    } finally {
      setToggling(null);
    }
  }, [businessId, endorsedCategories, onCountChange, router]);

  // Don't show if the user owns this business or no categories
  if (isOwner || categories.length === 0) return null;

  const count = endorsedCategories.length;
  const isEndorsed = count > 0;

  return (
    <div className="relative" ref={popRef}>
      {/* Trigger button */}
      <button
        onClick={() => {
          const token = getAuthToken();
          if (!token) {
            router.push('/login');
            return;
          }
          setOpen((o) => !o);
        }}
        disabled={loading}
        aria-expanded={open}
        aria-haspopup="true"
        className={`
          inline-flex items-center gap-1.5 font-semibold transition rounded-lg border
          ${compact ? 'text-[11px] px-2.5 py-1' : 'text-xs px-3 py-1.5'}
          ${isEndorsed
            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
            : 'bg-app-surface text-app-text-secondary border-app-border hover:bg-app-hover'
          }
          disabled:opacity-50
        `}
      >
        <span aria-hidden="true">👍</span>
        {loading
          ? '…'
          : isEndorsed
            ? `Endorsed (${count})`
            : 'Endorse'}
      </button>

      {/* Category popover */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-app-surface rounded-xl shadow-xl border border-app-border py-2 min-w-[200px] animate-fade-in" role="menu">
          <div className="px-3 pb-1.5 border-b border-app-border-subtle">
            <p className="text-[11px] font-semibold text-app-text-secondary uppercase tracking-wider">
              Endorse for…
            </p>
          </div>
          <div className="py-1 max-h-52 overflow-y-auto">
            {categories.map((cat) => {
              const isChecked = endorsedCategories.includes(cat);
              const isTogglingThis = toggling === cat;
              const label = CATEGORY_MAP[cat] || cat;

              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  disabled={isTogglingThis}
                  role="menuitemcheckbox"
                  aria-checked={isChecked}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition
                    ${isChecked ? 'text-emerald-700 bg-emerald-50/50' : 'text-app-text-strong hover:bg-app-hover'}
                    disabled:opacity-50
                  `}
                >
                  <span className={`
                    w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition
                    ${isChecked
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-app-border bg-app-surface'
                    }
                  `}>
                    {isChecked && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">{label}</span>
                  {isTogglingThis && (
                    <div className="ml-auto w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </button>
              );
            })}
          </div>
          {endorsedCategories.length > 0 && (
            <div className="px-3 pt-1.5 border-t border-app-border-subtle">
              <p className="text-[10px] text-app-text-muted">
                Your endorsements help neighbors discover trusted providers
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
