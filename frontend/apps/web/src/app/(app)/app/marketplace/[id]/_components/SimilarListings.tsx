'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import ListingCard from '../../ListingCard';

type SimilarListingsProps = {
  listingId: string;
};

export default function SimilarListings({ listingId }: SimilarListingsProps) {
  const router = useRouter();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listings
      .getSimilarListings(listingId)
      .then(({ listings: items }) => {
        if (!cancelled) setListings(items || []);
      })
      .catch(() => {
        if (!cancelled) setListings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [listingId]);

  if (loading) {
    return (
      <div className="mb-6">
        <h3 className="text-sm font-bold text-app-text mb-3">Similar Items Nearby</h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-40 h-48 rounded-xl bg-app-surface-sunken animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (listings.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-app-text mb-3">Similar Items Nearby</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {listings.map((item) => (
          <div key={item.id} className="flex-shrink-0 w-40">
            <ListingCard
              item={item}
              onClick={() => router.push(`/app/marketplace/${item.id}`)}
              onSave={() => {}}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
