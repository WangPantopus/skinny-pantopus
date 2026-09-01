'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Bookmark, Gift, Package, Laptop, BedDouble, Shirt, Leaf, Baby, Trophy, Hammer, Car, BookOpen, MapPin, Globe, ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { CONDITION_LABELS, LAYER_COLORS, formatTimeAgo, formatDistance, formatExpiration } from './constants';
import type { Listing } from '@pantopus/api';

// ── Category icon map for no-image placeholder ──
const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  furniture: BedDouble,
  electronics: Laptop,
  clothing: Shirt,
  home_garden: Leaf,
  kids_baby: Baby,
  sports_outdoors: Trophy,
  tools: Hammer,
  vehicles: Car,
  books_media: BookOpen,
  collectibles: Package,
  appliances: Package,
  free_stuff: Gift,
  other: Package,
};

// ── Category gradient colors ──
const CATEGORY_GRADIENT: Record<string, string> = {
  furniture: 'from-amber-500 to-orange-600',
  electronics: 'from-blue-500 to-indigo-600',
  clothing: 'from-pink-500 to-rose-600',
  home_garden: 'from-green-500 to-emerald-600',
  kids_baby: 'from-sky-400 to-blue-500',
  sports_outdoors: 'from-orange-500 to-red-500',
  tools: 'from-gray-500 to-gray-700',
  vehicles: 'from-red-500 to-rose-700',
  books_media: 'from-teal-500 to-cyan-600',
  collectibles: 'from-indigo-400 to-purple-500',
  appliances: 'from-slate-400 to-gray-600',
  free_stuff: 'from-green-400 to-emerald-500',
  other: 'from-purple-500 to-violet-600',
};

interface ListingCardProps {
  item: Listing;
  onSave: () => void;
  onClick: () => void;
}

export default React.memo(function ListingCard({ item, onSave, onClick }: ListingCardProps) {
  const coverUrl = item.media_urls?.[0];
  const layerColor = LAYER_COLORS[item.layer] || LAYER_COLORS.goods;
  const expLabel = formatExpiration(item.expires_at);
  const distLabel = formatDistance(item.distance_meters);
  const [saveAnimating, setSaveAnimating] = useState(false);
  // P0.4 audit follow-up: marketplace listings flow through
  // serializeUserAsLocalIdentity, which after the helper deletion exposes
  // displayName / handle / avatarUrl only. Read those first; legacy fields
  // (now optional in ListingCreator) stay as a fallback during rollout.
  const creatorDisplayName =
    item.creator?.displayName
    || item.creator?.handle
    || item.creator?.first_name
    || item.creator?.name
    || item.creator?.username
    || 'Seller';
  const creatorAvatarUrl =
    item.creator?.avatarUrl
    || item.creator?.profile_picture_url
    || null;
  const creatorHandle =
    item.creator?.handle
    || item.creator?.username
    || null;

  const CategoryIconComponent = CATEGORY_ICON_MAP[item.category] || Package;
  const gradient = CATEGORY_GRADIENT[item.category] || 'from-purple-500 to-violet-600';

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaveAnimating(true);
    setTimeout(() => setSaveAnimating(false), 300);
    onSave();
  };

  return (
    <article
      aria-label={item.title}
      className="bg-app-surface rounded-xl border border-app-border overflow-hidden cursor-pointer group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-app-surface-sunken overflow-hidden">
        {coverUrl ? (
          <Image src={coverUrl} alt={item.title} width={400} height={300} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" quality={80} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          /* ── Category-colored placeholder ── */
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center px-3`}>
            <CategoryIconComponent className="w-10 h-10 text-white/80" />
            <p className="text-white/90 text-xs font-semibold mt-2 text-center line-clamp-2 leading-tight">
              {item.title}
            </p>
          </div>
        )}

        {/* ── FREE badge — dominant, top-center ── */}
        {item.is_free && !item.is_wanted && (
          <span className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-white text-sm font-bold rounded-lg shadow-md uppercase tracking-wide">
            FREE
          </span>
        )}

        {/* Wanted badge - top left */}
        {item.is_wanted && (
          <span className="absolute top-2 left-2 px-2.5 py-1 bg-amber-500 text-white text-[11px] font-bold rounded-lg uppercase shadow-sm">
            Wanted
          </span>
        )}

        {/* Price badge - bottom left (skip for FREE items — badge is on top) */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          {item.is_wanted && item.budget_max ? (
            <span className="px-2 py-0.5 bg-amber-600/90 text-white text-xs font-bold rounded-md">
              Budget: ${Number(item.budget_max).toFixed(0)}
            </span>
          ) : !item.is_free && item.price != null ? (
            <span className="px-2 py-0.5 bg-gray-900/80 text-white text-xs font-bold rounded-md">
              ${Number(item.price).toFixed(0)}
            </span>
          ) : null}
        </div>

        {/* Save button - top right with bounce animation */}
        <button
          onClick={handleSave}
          aria-label={item.userHasSaved ? `Unsave ${item.title}` : `Save ${item.title}`}
          aria-pressed={!!item.userHasSaved}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full bg-app-surface/90 hover:bg-app-surface flex items-center justify-center shadow-sm transition-transform duration-200 ${
            saveAnimating ? 'scale-125' : 'scale-100'
          }`}
        >
          {item.userHasSaved ? (
            <Bookmark className="w-4 h-4 text-primary-600 fill-primary-600" />
          ) : (
            <Bookmark className="w-4 h-4 text-app-text-secondary" />
          )}
        </button>

        {/* Image count badge - bottom right */}
        {item.media_urls && item.media_urls.length > 1 && (
          <span className="absolute bottom-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-black/60 text-white text-[10px] font-semibold rounded-md">
            <ImageIcon className="w-2.5 h-2.5" />
            1/{item.media_urls.length}
          </span>
        )}

        {/* Layer dot indicator - top left (if not wanted/free) */}
        {!item.is_wanted && !item.is_free && item.layer && item.layer !== 'goods' && (
          <span
            className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: layerColor }}
            title={item.layer}
          />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="text-sm font-semibold text-app-text truncate">{item.title}</h4>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.condition && (
            <span className="px-1.5 py-0.5 bg-app-surface-sunken text-app-text-secondary text-[11px] font-medium rounded">
              {CONDITION_LABELS[item.condition] || item.condition}
            </span>
          )}
          {item.context_tags?.[0] && (
            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 text-[11px] font-medium rounded">
              {item.context_tags[0]}
            </span>
          )}
          <span className="text-[11px] text-app-text-muted">{formatTimeAgo(item.created_at)}</span>
        </div>

        {/* Distance + location */}
        <div className="flex items-center gap-1 mt-1.5">
          {distLabel ? (
            <>
              <MapPin className="w-3 h-3 text-primary-600 flex-shrink-0" />
              <span className="text-xs text-primary-600 font-semibold">{distLabel}</span>
              {item.location_name && (
                <span className="text-[11px] text-app-text-muted truncate ml-1">· {item.location_name}</span>
              )}
            </>
          ) : !item.latitude && !item.longitude ? (
            <>
              <Globe className="w-3 h-3 text-app-text-muted flex-shrink-0" />
              <span className="text-xs text-app-text-muted font-medium">Remote</span>
            </>
          ) : item.location_name ? (
            <>
              <MapPin className="w-3 h-3 text-app-text-muted flex-shrink-0" />
              <span className="text-[11px] text-app-text-muted truncate">{item.location_name}</span>
            </>
          ) : null}
        </div>

        {/* Expiration warning */}
        {expLabel && item.expires_at && new Date(item.expires_at).getTime() - Date.now() < 86400000 && (
          <p className="text-[10px] text-orange-600 font-medium mt-1">{expLabel}</p>
        )}

        {/* Seller + Verified Neighbor badge */}
        {item.creator && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {creatorAvatarUrl ? (
              <Image src={creatorAvatarUrl} alt="" width={16} height={16} className="rounded-full object-cover" sizes="16px" quality={75} />
            ) : (
              <div className="w-4 h-4 rounded-full bg-app-surface-sunken" />
            )}
            {creatorHandle ? (
              <Link
                href={`/${creatorHandle}`}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-app-text-secondary truncate max-w-[80px]"
              >
                {creatorDisplayName}
              </Link>
            ) : (
              <span className="text-[11px] text-app-text-secondary truncate max-w-[80px]">
                {creatorDisplayName}
              </span>
            )}
            {item.is_address_attached && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/30 rounded-full">
                <ShieldCheck className="w-3 h-3 text-green-600 dark:text-green-400" />
                <span className="text-[10px] font-semibold text-green-700 dark:text-green-400 whitespace-nowrap">Verified Neighbor</span>
              </span>
            )}
          </div>
        )}

        {/* Save count social proof */}
        {(item.save_count ?? 0) > 0 && (
          <p className="text-[10px] text-app-text-muted mt-1 flex items-center gap-0.5">
            <Bookmark className="w-2.5 h-2.5 inline" />
            {item.save_count} save{item.save_count !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </article>
  );
});
