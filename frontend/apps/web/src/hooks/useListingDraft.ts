'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const DRAFT_KEY = 'pantopus_listing_draft';
const DEBOUNCE_MS = 500;

export interface ListingDraftData {
  images?: string[];
  title?: string;
  description?: string;
  price?: string;
  category?: string;
  condition?: string;
  listingType?: string;
  isFree?: boolean;
  isNegotiable?: boolean;
  tags?: string[];
  meetupPreference?: string;
  deliveryAvailable?: boolean;
  latitude?: number;
  longitude?: number;
  locationAddress?: string;
  isAddressAttached?: boolean;
  openToTrades?: boolean;
  // AI-suggested values
  aiSuggestedTitle?: string;
  aiSuggestedPrice?: number;
  aiConfidence?: number;
}

export function useListingDraft() {
  const [draft, setDraft] = useState<ListingDraftData | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ListingDraftData;
        setDraft(parsed);
        setHasDraft(true);
      }
    } catch {
      // Corrupt data — ignore
    }
  }, []);

  // Cleanup pending timer on unmount
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const saveDraft = useCallback((data: ListingDraftData) => {
    // Update state immediately
    setDraft(data);
    setHasDraft(true);

    // Debounce the localStorage write
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      } catch {
        // Storage full or unavailable — ignore
      }
    }, DEBOUNCE_MS);
  }, []);

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDraft(null);
    setHasDraft(false);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }, []);

  const restoreDraft = useCallback((): ListingDraftData | null => {
    return draft;
  }, [draft]);

  return { draft, hasDraft, saveDraft, clearDraft, restoreDraft };
}
