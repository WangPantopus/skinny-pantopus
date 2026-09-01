'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { VaultFolder, VaultSearchResult } from '@/types/mailbox';
import {
  useVaultFolders,
  useVaultSearch,
  useCreateVaultFolder,
} from '@/lib/mailbox-queries';
import { VaultFolderCard } from '@/components/mailbox';

// ── Helpers ──────────────────────────────────────────────────

const DRAWER_ORDER = ['personal', 'home', 'business', 'earn'] as const;
const DRAWER_LABELS: Record<string, string> = {
  personal: 'Personal',
  home: 'Home',
  business: 'Business',
  earn: 'Earn',
};

function groupByDrawer(folders: VaultFolder[]): Record<string, VaultFolder[]> {
  const groups: Record<string, VaultFolder[]> = {};
  for (const f of folders) {
    const d = f.drawer || 'personal';
    if (!groups[d]) groups[d] = [];
    groups[d].push(f);
  }
  // Sort within each drawer by sort_order
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.sort_order - b.sort_order);
  }
  return groups;
}

/** Highlight search matches in text */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(re);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        re.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ── Main component ───────────────────────────────────────────

export default function VaultPage() {
  const router = useRouter();

  // ── Folder data ───────────────────────────────────────────
  const { data: folders, isLoading: foldersLoading } = useVaultFolders();
  const grouped = folders ? groupByDrawer(folders) : {};

  // ── Search ────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const { data: searchResults, isLoading: searchLoading } = useVaultSearch(debouncedQuery);
  const isSearching = debouncedQuery.length >= 2;

  // ── Create folder ─────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('📁');
  const [newColor, setNewColor] = useState('#6B7280');
  const [newDrawer, setNewDrawer] = useState<'personal' | 'home' | 'business' | 'earn'>('personal');
  const createFolder = useCreateVaultFolder();

  const handleCreateFolder = useCallback(() => {
    if (!newLabel.trim()) return;
    createFolder.mutate(
      { label: newLabel.trim(), icon: newIcon, color: newColor, drawer: newDrawer },
      {
        onSuccess: () => {
          setShowCreate(false);
          setNewLabel('');
          setNewIcon('📁');
          setNewColor('#6B7280');
        },
      },
    );
  }, [createFolder, newLabel, newIcon, newColor, newDrawer]);

  // ── Loading state ─────────────────────────────────────────
  if (foldersLoading) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="h-6 w-24 bg-app-surface-sunken rounded animate-pulse mb-6" />
        <div className="h-10 w-full bg-app-surface-sunken rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 bg-app-surface-sunken rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-app-text">Vault</h1>
        </div>

        {/* Search bar */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vault... ($87, March 2025, electricity)"
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text-secondary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Search results ──────────────────────────────────── */}
      {isSearching ? (
        <div className="px-6 pb-6">
          {searchLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 border border-app-border rounded-lg">
                  <div className="h-3 w-32 bg-app-surface-sunken rounded animate-pulse mb-2" />
                  <div className="h-3 w-full bg-app-surface-sunken rounded animate-pulse mb-1" />
                  <div className="h-3 w-2/3 bg-app-surface-sunken rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : !searchResults || searchResults.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm text-app-text-secondary">No results for &ldquo;{debouncedQuery}&rdquo;</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-app-text-muted mb-3">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{debouncedQuery}&rdquo;
              </p>
              {searchResults.map((result: VaultSearchResult) => (
                <SearchResultRow
                  key={result.id}
                  result={result}
                  query={debouncedQuery}
                  onClick={() => {
                    // Navigate to the item's drawer detail
                    const drawer = result.drawer || 'personal';
                    router.push(`/app/mailbox/${drawer}/${result.id}`);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Folder grid by drawer ─────────────────────────── */
        <div className="px-6 pb-6 space-y-6">
          {DRAWER_ORDER.map((drawerKey) => {
            const drawerFolders = grouped[drawerKey];
            if (!drawerFolders || drawerFolders.length === 0) return null;
            return (
              <div key={drawerKey}>
                <h2 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-3">
                  {DRAWER_LABELS[drawerKey]}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {drawerFolders.map((folder) => (
                    <VaultFolderCard
                      key={folder.id}
                      folder={folder}
                      onClick={() => router.push(`/app/mailbox/vault/${folder.id}`)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Empty vault state */}
          {(!folders || folders.length === 0) && (
            <div className="text-center py-16">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
              </svg>
              <p className="text-sm font-medium text-app-text-secondary dark:text-app-text-muted mb-1">Your vault is empty</p>
              <p className="text-xs text-app-text-muted">File mail items to vault folders to keep them organized</p>
            </div>
          )}

          {/* Create folder button */}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-3 w-full border-2 border-dashed border-app-border rounded-lg text-sm text-app-text-secondary hover:text-app-text-strong dark:hover:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create folder
          </button>
        </div>
      )}

      {/* ── Create folder modal ─────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm mx-4 bg-app-surface rounded-xl shadow-2xl border border-app-border p-5">
            <h3 className="text-sm font-semibold text-app-text mb-4">New Vault Folder</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-app-text-secondary mb-1 block">Name</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Taxes"
                  autoFocus
                  className="w-full text-sm px-3 py-2 border border-app-border rounded-md bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-app-text-secondary mb-1 block">Icon</label>
                  <input
                    type="text"
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-app-border rounded-md bg-app-surface text-center text-lg"
                    maxLength={2}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-app-text-secondary mb-1 block">Color</label>
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-full h-[38px] border border-app-border rounded-md cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-app-text-secondary mb-1 block">Drawer</label>
                <select
                  value={newDrawer}
                  onChange={(e) => setNewDrawer(e.target.value as typeof newDrawer)}
                  className="w-full text-sm px-3 py-2 border border-app-border rounded-md bg-app-surface text-app-text"
                >
                  {DRAWER_ORDER.map((d) => (
                    <option key={d} value={d}>{DRAWER_LABELS[d]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                disabled={!newLabel.trim() || createFolder.isPending}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  !newLabel.trim() || createFolder.isPending
                    ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {createFolder.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Search result row ────────────────────────────────────────

function SearchResultRow({
  result,
  query,
  onClick,
}: {
  result: VaultSearchResult;
  query: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-app-border hover:bg-app-hover dark:hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-app-text truncate">
          {highlightMatch(result.sender_display || 'Unknown sender', query)}
        </span>
        <span className="text-[10px] text-app-text-muted flex-shrink-0">
          {new Date(result.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Match excerpt with highlighting */}
      <p className="text-xs text-app-text-secondary dark:text-app-text-muted line-clamp-2">
        {highlightMatch(result._matchExcerpt || result.preview_text || '', query)}
      </p>

      {/* Match field + folder label */}
      <div className="flex items-center gap-2 mt-1.5">
        {result._matchField && (
          <span className="text-[10px] px-1.5 py-0.5 bg-app-surface-sunken text-app-text-secondary rounded">
            {result._matchField}
          </span>
        )}
      </div>
    </button>
  );
}
