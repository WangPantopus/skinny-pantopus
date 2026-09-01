'use client';

import { useCallback } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  onChange?: (value: number) => void;
  maxStars?: number;
  size?: number;
  readonly?: boolean;
  /** Optional label rendered after the stars row */
  valueLabel?: string;
}

export default function StarRating({
  rating,
  onChange,
  maxStars = 5,
  size = 24,
  readonly = false,
  valueLabel,
}: StarRatingProps) {
  const handleClick = useCallback(
    (n: number) => {
      if (!readonly && onChange) onChange(n);
    },
    [readonly, onChange],
  );

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxStars }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => handleClick(n)}
          disabled={readonly}
          className={`p-0.5 rounded transition-colors ${
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          }`}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            size={size}
            className={
              rating >= n
                ? 'fill-amber-400 text-amber-400'
                : 'fill-gray-200 text-gray-300'
            }
          />
        </button>
      ))}
      {valueLabel !== undefined && (
        <span className="ml-2 text-sm text-app-text-muted">{valueLabel}</span>
      )}
    </div>
  );
}
