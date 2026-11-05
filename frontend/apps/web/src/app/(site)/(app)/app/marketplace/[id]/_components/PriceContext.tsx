'use client';

import { useState, useEffect } from 'react';
import * as api from '@pantopus/api';

type PriceContextProps = {
  category?: string;
  condition?: string;
  listingType?: string;
  latitude?: number;
  longitude?: number;
  currentPrice?: number;
  isFree?: boolean;
};

export default function PriceContext({ category, condition, listingType, latitude, longitude, currentPrice, isFree }: PriceContextProps) {
  const [suggestion, setSuggestion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const comparableType = !listingType || ['sell_item', 'vehicle_sale'].includes(listingType);

  useEffect(() => {
    if (isFree || !category || !comparableType) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setSuggestion(null);
    api.listings
      .getPriceSuggestion({ category, condition, lat: latitude, lng: longitude })
      .then(({ suggestion: s }) => {
        if (!cancelled) setSuggestion(s);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [category, condition, latitude, longitude, isFree, comparableType]);

  if (isFree || !category || !comparableType) return null;

  if (loading) {
    return (
      <div className="mb-4">
        <div className="w-2/5 h-3 rounded bg-app-surface-sunken animate-pulse" />
      </div>
    );
  }

  if (!suggestion) return <p className="mb-4 text-xs text-app-text-muted">Not enough local comparisons for a price suggestion.</p>;

  const isBelow = currentPrice != null && currentPrice < suggestion.low;
  const isAbove = currentPrice != null && currentPrice > suggestion.high;

  return (
    <div className="mb-4">
      <div className="flex items-center flex-wrap gap-2">
        <span className="text-xs text-app-text-secondary">
          Local category range: ${suggestion.low}&ndash;${suggestion.high}
        </span>
        {isBelow && (
          <span className="text-[11px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
            Below average
          </span>
        )}
        {isAbove && (
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
            Above average
          </span>
        )}
      </div>
      <p className="text-[11px] text-app-text-muted mt-0.5">
        {suggestion.basis}
      </p>
    </div>
  );
}
