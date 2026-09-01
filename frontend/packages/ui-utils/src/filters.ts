// ============================================================
// GIG FILTER / SORT UTILITIES
// Kept for backward compatibility — flag for eventual API migration
// ============================================================

import { getGigPrice } from './price';

export type PriceFilterKey = 'all' | 'under_50' | '50_to_150' | 'over_150';

export type SortKey = 'newest' | 'oldest' | 'price_high' | 'price_low' | 'distance' | 'best_match' | 'urgency' | 'quick';

/** Check whether a gig falls within a price filter bucket. */
export function matchesPriceFilter(
  gig: { price?: number | null; budget?: number | null; bid_amount?: number | null },
  priceFilter: PriceFilterKey,
): boolean {
  const price = getGigPrice(gig);
  if (priceFilter === 'under_50') return price > 0 && price < 50;
  if (priceFilter === '50_to_150') return price >= 50 && price <= 150;
  if (priceFilter === 'over_150') return price > 150;
  return true; // 'all'
}

/** Check whether a gig matches the selected category and search query. */
export function gigMatchesFilters(
  gig: { title?: string; description?: string; category?: string },
  selectedCategory: string,
  query: string,
): boolean {
  if (selectedCategory !== 'All' && gig.category !== selectedCategory) return false;
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    String(gig.title || '').toLowerCase().includes(q) ||
    String(gig.description || '').toLowerCase().includes(q) ||
    String(gig.category || '').toLowerCase().includes(q)
  );
}

/** Sort an array of gigs by the given sort key. Returns a new array. */
export function sortGigs<T extends { price?: number | null; budget?: number | null; bid_amount?: number | null; created_at?: string | null }>(
  items: T[],
  sortOption: SortKey,
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sortOption === 'price_high') return getGigPrice(b) - getGigPrice(a);
    if (sortOption === 'price_low') return getGigPrice(a) - getGigPrice(b);
    const aTs = new Date(a?.created_at || 0).getTime();
    const bTs = new Date(b?.created_at || 0).getTime();
    if (sortOption === 'oldest') return aTs - bTs;
    return bTs - aTs; // 'newest'
  });
  return copy;
}
