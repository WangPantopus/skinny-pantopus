'use client';

import { Search, Camera } from 'lucide-react';
import Image from 'next/image';
import { CONDITION_LABELS, LAYER_COLORS, formatDistance } from './constants';
import type { ListingListItem } from '@pantopus/types';

interface CarouselProps {
  listings: ListingListItem[];
  onCardClick: (id: string) => void;
  onSave: (id: string) => void;
  loading: boolean;
}

export default function MarketplaceCarousel({ listings, onCardClick, onSave, loading }: CarouselProps) {
  if (loading) {
    return (
      <div className="absolute bottom-4 left-0 right-0 z-20 px-4 pointer-events-none">
        <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-hide pointer-events-auto">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-shrink-0 w-52 snap-start bg-app-surface/90 backdrop-blur rounded-xl shadow-md border border-app-border p-3 animate-pulse">
              <div className="w-full h-24 bg-app-surface-sunken rounded-lg mb-2" />
              <div className="h-3 bg-app-surface-sunken rounded w-3/4 mb-1.5" />
              <div className="h-3 bg-app-surface-sunken rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (listings.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-0 right-0 z-20 px-4 pointer-events-none">
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-hide pointer-events-auto">
        {listings.map((item) => {
          const thumb = item.media_urls?.[0];
          const layerColor = LAYER_COLORS[item.layer] || LAYER_COLORS.goods;
          const distLabel = formatDistance(item.distance_meters);

          return (
            <div
              key={item.id}
              className="flex-shrink-0 w-52 snap-start bg-app-surface/95 backdrop-blur rounded-xl shadow-md border border-app-border overflow-hidden cursor-pointer hover:shadow-lg transition group"
              onClick={() => onCardClick(item.id)}
            >
              {/* Thumbnail */}
              <div className="relative h-24 bg-app-surface-sunken">
                {thumb ? (
                  <Image src={thumb} alt={item.title} width={208} height={96} sizes="208px" quality={75} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    {item.is_wanted ? <Search className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                  </div>
                )}

                {/* Price badge */}
                <div className="absolute bottom-1.5 left-1.5">
                  {item.is_wanted && item.budget_max ? (
                    <span className="px-1.5 py-0.5 bg-amber-600/90 text-white text-[10px] font-bold rounded">
                      Budget: ${Number(item.budget_max).toFixed(0)}
                    </span>
                  ) : item.is_free ? (
                    <span className="px-1.5 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded">FREE</span>
                  ) : item.price != null ? (
                    <span className="px-1.5 py-0.5 bg-gray-900/80 text-white text-[10px] font-bold rounded">
                      ${Number(item.price).toFixed(0)}
                    </span>
                  ) : null}
                </div>

                {/* Trust badge */}
                {item.is_address_attached && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center" title="Verified Neighbor">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}

                {/* Layer dot */}
                {item.layer && item.layer !== 'goods' && (
                  <span
                    className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full border border-white"
                    style={{ backgroundColor: layerColor }}
                  />
                )}

                {/* Save */}
                <button
                  onClick={(e) => { e.stopPropagation(); onSave(item.id); }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-app-surface/80 hover:bg-app-surface flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                >
                  {item.userHasSaved ? (
                    <svg className="w-3 h-3 text-primary-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 text-app-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Info */}
              <div className="p-2">
                <h4 className="text-xs font-semibold text-app-text truncate">{item.title}</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {item.condition && (
                    <span className="text-[10px] text-app-text-secondary">
                      {CONDITION_LABELS[item.condition] || item.condition}
                    </span>
                  )}
                  {distLabel && (
                    <span className="text-[10px] text-app-text-muted">{distLabel}</span>
                  )}
                </div>
                {item.context_tags?.[0] && (
                  <span className="inline-block px-1 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-medium rounded mt-0.5">
                    {item.context_tags[0]}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
