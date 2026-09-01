'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import type { GigListItem } from '@pantopus/types';
import { getStatusColor } from '@pantopus/ui-utils';

interface GigPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectGig: (gig: {
    id: string;
    title: string;
    category: string | null;
    price: number | null;
    status: string;
  }) => void;
}

export default function GigPickerModal({ open, onClose, onSelectGig }: GigPickerModalProps) {
  const [query, setQuery] = useState('');
  const [myGigs, setMyGigs] = useState<GigListItem[]>([]);
  const [searchResults, setSearchResults] = useState<GigListItem[]>([]);
  const [loadingMyGigs, setLoadingMyGigs] = useState(true);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingMyGigs(true);
    setQuery('');
    setSearchResults([]);
    api.gigs
      .getMyGigs({ limit: 50 })
      .then((res: Record<string, any>) => setMyGigs((res?.gigs || res?.data || []) as GigListItem[]))
      .catch(() => setMyGigs([]))
      .finally(() => setLoadingMyGigs(false));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim() || text.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.gigs.searchGigs(text.trim());
        setSearchResults((res?.gigs || []) as GigListItem[]);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
  }, []);

  const handleSelect = (gig: GigListItem) => {
    onSelectGig({
      id: gig.id,
      title: gig.title || 'Untitled Task',
      category: gig.category || null,
      price: gig.price ?? gig.budget ?? null,
      status: gig.status || 'open',
    });
  };

  const displayList = query.trim().length >= 2 ? searchResults : myGigs;
  const isLoading = query.trim().length >= 2 ? searching : loadingMyGigs;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app">
          <h2 className="text-lg font-semibold text-app">Share a Task</h2>
          <button onClick={onClose} className="text-app-muted hover:text-app-text-strong p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface-muted border-0 rounded-xl text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {query && (
              <button onClick={() => { setQuery(''); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-text-secondary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Label */}
        <div className="px-5 pb-2">
          <span className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider">
            {query.trim().length >= 2 ? 'Search Results' : 'Your Tasks'}
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-sm text-app-muted">Loading...</div>
            </div>
          ) : displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-app-muted">
              <span className="text-3xl mb-2">💼</span>
              <span className="text-sm">{query.trim().length >= 2 ? 'No tasks found' : 'No tasks yet'}</span>
            </div>
          ) : (
            displayList.map(gig => {
              const title = gig.title || 'Untitled Task';
              const price = gig.price ?? gig.budget ?? null;
              const status = gig.status || 'open';
              return (
                <button
                  key={gig.id}
                  onClick={() => handleSelect(gig)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover-bg-app transition-colors text-left border-b border-app last:border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-app truncate">{title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {gig.category && <span className="text-xs text-app-text-secondary">{gig.category}</span>}
                      <span className="text-xs font-medium capitalize" style={{ color: getStatusColor(status) }}>
                        {status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-primary-600 flex-shrink-0">
                    {price != null ? `$${Number(price).toFixed(0)}` : 'Flexible'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
