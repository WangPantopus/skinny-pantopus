'use client';

import { useEffect, useState } from 'react';

interface NewListingsBannerProps {
  count: number;
  onTap: () => void;
  onDismiss: () => void;
}

export default function NewListingsBanner({ count, onTap, onDismiss }: NewListingsBannerProps) {
  const [visible, setVisible] = useState(false);

  // Slide-in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (count <= 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 py-2 transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'
      }`}
    >
      <button
        onClick={onTap}
        aria-label={`Load ${count} new listing${count !== 1 ? 's' : ''}`}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-full shadow-md hover:bg-primary-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
      >
        <span>
          {count} new listing{count !== 1 ? 's' : ''} posted
        </span>
        <span className="opacity-75">&mdash; Tap to refresh</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="p-1 text-primary-300 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:rounded"
        aria-label="Dismiss new listings notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
