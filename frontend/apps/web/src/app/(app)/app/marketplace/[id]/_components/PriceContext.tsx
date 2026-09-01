'use client';

import { useState, useEffect } from 'react';
import * as api from '@pantopus/api';

type PriceContextProps = {
  category?: string;
  latitude?: number;
  longitude?: number;
  currentPrice?: number;
  isFree?: boolean;
};

export default function PriceContext({ category, latitude, longitude, currentPrice, isFree }: PriceContextProps) {
  const [suggestion, setSuggestion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFree || !category) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.listings
      .getPriceSuggestion({ category, lat: latitude, lng: longitude })
      .then(({ suggestion: s }) => {
        if (!cancelled) setSuggestion(s);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [category, latitude, longitude, isFree]);

  if (isFree || !category) return null;

  if (loading) {
    return (
      <div className="mb-4">
        <div className="w-2/5 h-3 rounded bg-app-surface-sunken animate-pulse" />
      </div>
    );
  }

  if (!suggestion) return null;

  const isBelow = currentPrice != null && currentPrice < suggestion.low;
  const isAbove = currentPrice != null && currentPrice > suggestion.high;

  return (
    <div className="mb-4">
      <div className="flex items-center flex-wrap gap-2">
        <span className="text-xs text-app-text-secondary">
          Similar items nearby: ${suggestion.low}&ndash;${suggestion.high}
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
        Based on {suggestion.comparable_count} items
      </p>
    </div>
  );
}
