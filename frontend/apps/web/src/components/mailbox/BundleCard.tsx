'use client';

import { useRef, useEffect } from 'react';
import type { BundleItem, MailWrapper } from '@/types/mailbox';
import TrustBadge from './TrustBadge';
import UrgencyIndicator from './UrgencyIndicator';

type BundleCardProps = {
  bundle: BundleItem;
  isExpanded: boolean;
  onToggle: () => void;
  onFileAll: (folderId: string) => void;
  onItemClick?: (item: MailWrapper) => void;
  loading?: boolean;
};

export default function BundleCard({
  bundle,
  isExpanded,
  onToggle,
  onFileAll,
  onItemClick,
  loading = false,
}: BundleCardProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Smooth height animation
  useEffect(() => {
    const el = contentRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;

    if (isExpanded) {
      el.style.maxHeight = `${inner.scrollHeight}px`;
    } else {
      el.style.maxHeight = '0px';
    }
  }, [isExpanded, bundle.items.length]);

  return (
    <div className="relative mt-2">
      {/* Stacked card shadow — 3 cards */}
      <div className="absolute -top-2 left-4 right-4 h-2 rounded-t border border-b-0 border-app-border bg-app-surface-sunken" />
      <div className="absolute -top-1 left-2 right-2 h-1.5 rounded-t border border-b-0 border-app-border bg-app-surface-raised" />

      {/* Main card */}
      <div className="relative border border-app-border rounded-lg overflow-hidden bg-app-surface">
        {/* Header */}
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-app-hover dark:hover:bg-gray-800 transition-colors text-left min-h-[44px]"
        >
          <svg
            className={`w-4 h-4 text-app-text-muted flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-app-text truncate">
              {bundle.bundle_label}
            </p>
            <p className="text-xs text-app-text-secondary mt-0.5">
              {bundle.bundle_type.replace(/_/g, ' ')}
            </p>
          </div>

          {/* Item count badge */}
          <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-app-surface-sunken text-xs font-semibold text-app-text-secondary">
            {bundle.item_count}
          </span>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onFileAll(bundle.bundle_id); }}
            disabled={loading}
            className="flex-shrink-0 px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
          >
            File all
          </button>
        </button>

        {/* Expandable items with smooth animation */}
        <div
          ref={contentRef}
          className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
          style={{ maxHeight: isExpanded ? undefined : '0px' }}
        >
          <div ref={innerRef}>
            {bundle.items.length > 0 && (
              <div className="border-t border-app-border-subtle">
                {bundle.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItemClick?.(item)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 pl-10 border-b last:border-b-0 border-app-border-subtle hover:bg-app-hover dark:hover:bg-gray-800 transition-colors text-left min-h-[44px]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-app-text truncate">
                        {item.outside_title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-app-text-secondary truncate">{item.sender_display}</span>
                        <TrustBadge trust={item.sender_trust} size="sm" />
                      </div>
                    </div>
                    <UrgencyIndicator urgency={item.urgency} compact />
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="px-4 py-3 text-center border-t border-app-border-subtle">
                <div className="inline-block w-4 h-4 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
