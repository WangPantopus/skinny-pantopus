'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { ListingDetail, ListingUserSummary } from '@pantopus/types';

interface SellerSectionProps {
  listing: ListingDetail;
}

export default function SellerSection({ listing }: SellerSectionProps) {
  const creator: Partial<ListingUserSummary> = listing.creator || {};
  const displayName = creator.displayName || creator.handle || 'User';
  const publicProfileHref = creator.href?.startsWith('/') && !creator.href.startsWith('//')
    ? creator.href
    : null;

  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-6 mb-6">
      <h2 className="text-lg font-semibold text-app-text mb-3">Seller</h2>
      <div className="flex items-center gap-3">
        {creator.avatarUrl ? (
          <Image src={creator.avatarUrl} alt="" width={48} height={48} sizes="48px" quality={75} className="rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
            {(creator.displayName || creator.handle || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {publicProfileHref ? (
            <Link href={publicProfileHref} className="font-semibold text-app-text">
              {displayName}
            </Link>
          ) : (
            <p className="font-semibold text-app-text">{displayName}</p>
          )}
          {creator.handle && <p className="text-sm text-app-text-secondary">@{creator.handle}</p>}
        </div>
        {publicProfileHref ? (
          <Link
            href={publicProfileHref}
            className="px-3 py-1.5 border border-app-border text-app-text-strong rounded-lg text-sm font-medium hover:bg-app-hover"
          >
            View Profile
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="px-3 py-1.5 border border-app-border text-app-text-secondary rounded-lg text-sm font-medium opacity-60 cursor-not-allowed"
          >
            View Profile
          </button>
        )}
      </div>
    </div>
  );
}
