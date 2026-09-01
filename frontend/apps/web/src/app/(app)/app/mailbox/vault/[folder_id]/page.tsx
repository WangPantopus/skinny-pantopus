'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { MailItemV2, MailAction, VaultFolder, AutoFileRule } from '@/types/mailbox';
import {
  useVaultFolders,
  useVaultFolderItems,
  useItemDetail,
  useMarkItemOpened,
} from '@/lib/mailbox-queries';
import { MailItemCard, MailItemDetail } from '@/components/mailbox';

// ── Main component ───────────────────────────────────────────

export default function VaultFolderPage() {
  const router = useRouter();
  const params = useParams<{ folder_id: string }>();
  const folderId = params.folder_id;

  // ── Folder meta ───────────────────────────────────────────
  const { data: allFolders } = useVaultFolders();
  const folder = allFolders?.find((f: VaultFolder) => f.id === folderId);

  // ── Folder items (paginated) ──────────────────────────────
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<MailItemV2[]>([]);
  const { data, isLoading } = useVaultFolderItems(folderId, { page, limit: 20 });

  useEffect(() => {
    if (!data) return;
    setAllItems(prev => page === 1 ? data.items : [...prev, ...data.items]);
  }, [data, page]);

  // Reset when folder changes
  useEffect(() => {
    setPage(1);
    setAllItems([]);
    setSelectedItemId(null);
  }, [folderId]);

  // ── Infinite scroll ───────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && data?.has_more && !isLoading) {
          setPage(p => p + 1);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [data?.has_more, isLoading]);

  // ── Selected item ─────────────────────────────────────────
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const { data: selectedDetail } = useItemDetail(selectedItemId || '', {
    enabled: !!selectedItemId,
  });
  const markOpened = useMarkItemOpened();

  const handleItemClick = useCallback((item: MailItemV2) => {
    setSelectedItemId(item.id);
    if (!item.opened_at) {
      markOpened.mutate(item.id);
    }
  }, [markOpened]);

  // ── Auto-filing rules (read-only) ────────────────────────
  const [showRules, setShowRules] = useState(false);
  const rules = folder?.auto_file_rules ?? [];

  // ── Action handler for detail view ────────────────────────
  const handleAction = useCallback((_action: MailAction) => {
    // Placeholder — actions handled in future
  }, []);

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── List panel ───────────────────────────────────── */}
      <div
        className={`flex flex-col h-full flex-shrink-0 border-r border-app-border bg-app-surface ${
          selectedItemId ? 'hidden md:flex md:w-[360px]' : 'w-full md:w-[360px]'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-app-border-subtle flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/app/mailbox/vault')}
              className="p-1 text-app-text-secondary hover:text-app-text-strong dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-xl">{folder?.icon || '📁'}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-app-text truncate">
                {folder?.label || 'Folder'}
              </h1>
              <p className="text-xs text-app-text-secondary">
                {data?.total ?? 0} item{(data?.total ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Auto-filing rules (expandable, read-only) */}
          {rules.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowRules(!showRules)}
                className="flex items-center gap-1 text-[10px] text-app-text-muted hover:text-app-text-secondary transition-colors"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${showRules ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Auto-filing rules ({rules.length})
              </button>
              {showRules && (
                <div className="mt-1.5 space-y-1 pl-4">
                  {rules.map((rule: AutoFileRule, i: number) => (
                    <p key={i} className="text-[10px] text-app-text-muted">
                      <span className="font-medium text-app-text-secondary">{rule.field}</span>
                      {' '}{rule.operator}{' '}
                      <span className="text-app-text-secondary">&ldquo;{rule.value}&rdquo;</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && page === 1 ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 py-3 px-2">
                  <div className="w-8 h-8 rounded-full bg-app-surface-sunken animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 bg-app-surface-sunken rounded animate-pulse" />
                    <div className="h-3 w-40 bg-app-surface-sunken rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : allItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
              </svg>
              <p className="text-sm text-app-text-secondary">This folder is empty</p>
            </div>
          ) : (
            <>
              {allItems.map((item) => (
                <MailItemCard
                  key={item.id}
                  item={item}
                  isSelected={selectedItemId === item.id}
                  onClick={() => handleItemClick(item)}
                />
              ))}
              <div ref={sentinelRef} className="h-4" />
              {isLoading && page > 1 && (
                <div className="py-4 text-center">
                  <div className="inline-block w-5 h-5 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Detail panel ─────────────────────────────────── */}
      <div
        className={`flex-1 min-w-0 overflow-hidden ${
          selectedItemId ? '' : 'hidden md:block'
        }`}
      >
        {selectedDetail ? (
          <div className="h-full flex flex-col">
            {/* Mobile back */}
            <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b border-app-border-subtle flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedItemId(null)}
                className="p-1 text-app-text-secondary hover:text-app-text-strong"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm text-app-text-secondary">Back to folder</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <MailItemDetail detail={selectedDetail} onAction={handleAction} />
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
              </svg>
              <p className="text-sm text-app-text-secondary">Select an item to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
