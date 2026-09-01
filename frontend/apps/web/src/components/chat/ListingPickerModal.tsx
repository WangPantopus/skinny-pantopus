'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import type { Listing } from '@pantopus/types';

interface ListingPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectListing: (listing: {
    id: string;
    title: string;
    category: string | null;
    price: number | null;
    condition: string | null;
    status: string;
    imageUrl: string | null;
    isFree: boolean;
  }) => void;
  otherUserId?: string | null;
}

export default function ListingPickerModal({ open, onClose, onSelectListing, otherUserId }: ListingPickerModalProps) {
  const [activeTab, setActiveTab] = useState<'mine' | 'theirs'>('mine');
  const [query, setQuery] = useState('');
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [theirListings, setTheirListings] = useState<Listing[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [loadingTheirs, setLoadingTheirs] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Listing[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSearchResults([]);
    setActiveTab('mine');
    setLoadingMine(true);
    api.listings.getMyListings({ limit: 50 })
      .then((res: Record<string, any>) => setMyListings((res?.listings || []) as Listing[]))
      .catch(() => setMyListings([]))
      .finally(() => setLoadingMine(false));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    if (!open || !otherUserId) { setTheirListings([]); setLoadingTheirs(false); return; }
    setLoadingTheirs(true);
    api.listings.getUserListings(otherUserId, { limit: 50 })
      .then((res: Record<string, any>) => setTheirListings((res?.listings || []) as Listing[]))
      .catch(() => setTheirListings([]))
      .finally(() => setLoadingTheirs(false));
  }, [open, otherUserId]);

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
        const res = await api.listings.searchListings({ q: text.trim(), limit: 30 });
        setSearchResults(res?.listings || []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
  }, []);

  const handleSelect = (listing: Listing) => {
    onSelectListing({
      id: listing.id,
      title: listing.title || 'Untitled Listing',
      category: listing.category || null,
      price: listing.price ?? null,
      condition: listing.condition || null,
      status: listing.status || 'active',
      imageUrl: listing.media_urls?.[0] || null,
      isFree: !!listing.is_free,
    });
  };

  const isSearchMode = query.trim().length >= 2;
  const currentList = isSearchMode ? searchResults : activeTab === 'mine' ? myListings : theirListings;
  const isLoading = isSearchMode ? searching : activeTab === 'mine' ? loadingMine : loadingTheirs;

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
          <h2 className="text-lg font-semibold text-app">Share a Listing</h2>
          <button onClick={onClose} className="text-app-muted hover:text-app-text-strong p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-2 px-5 pt-3 pb-1">
          <button
            onClick={() => { setActiveTab('mine'); setQuery(''); setSearchResults([]); }}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${activeTab === 'mine' ? 'bg-primary-600 text-white' : 'bg-surface-muted text-app-text-secondary hover-bg-app'}`}
          >
            My Listings
          </button>
          {otherUserId && (
            <button
              onClick={() => { setActiveTab('theirs'); setQuery(''); setSearchResults([]); }}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${activeTab === 'theirs' ? 'bg-primary-600 text-white' : 'bg-surface-muted text-app-text-secondary hover-bg-app'}`}
            >
              Their Listings
            </button>
          )}
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
              placeholder="Search listings..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface-muted border-0 rounded-xl text-sm text-app focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {query && (
              <button onClick={() => { setQuery(''); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted hover:text-app">
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
            {isSearchMode ? 'Search Results' : activeTab === 'mine' ? 'Your Listings' : 'Their Listings'}
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-sm text-app-muted">Loading...</div>
            </div>
          ) : currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-app-muted">
              <span className="text-3xl mb-2">🏷️</span>
              <span className="text-sm">
                {isSearchMode ? 'No listings found' : activeTab === 'mine' ? 'You have no listings' : 'No listings from this user'}
              </span>
            </div>
          ) : (
            currentList.map(listing => {
              const title = listing.title || 'Untitled Listing';
              const imageUrl = listing.media_urls?.[0] || null;
              const price = listing.is_free ? 'Free' : listing.price != null ? `$${Number(listing.price).toFixed(0)}` : 'Make Offer';
              const condition = listing.condition?.replace(/_/g, ' ') || '';
              return (
                <button
                  key={listing.id}
                  onClick={() => handleSelect(listing)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover-bg-app transition-colors text-left border-b border-app last:border-0"
                >
                  {imageUrl ? (
                    <Image src={imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-surface-muted" width={48} height={48} sizes="48px" quality={75} />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-surface-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">🏷️</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-app truncate">{title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {listing.category && <span className="text-xs text-app-text-secondary capitalize">{listing.category.replace(/_/g, ' ')}</span>}
                      {condition && <span className="text-xs text-app-muted capitalize">{condition}</span>}
                    </div>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${listing.is_free ? 'text-green-600' : 'text-primary-600'}`}>
                    {price}
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
