'use client';

/* eslint-disable @next/next/no-img-element */
import type { OfferEnvelope } from '@/types/mailbox';

type OfferCardProps = {
  item: OfferEnvelope;
  onOpen: () => void;
  isOpening: boolean;
};

export default function OfferCard({ item, onOpen, isOpening }: OfferCardProps) {
  const isSealed = item.status === 'available' && !isOpening;
  const isActionable = item.status === 'available' || item.status === 'opened';

  return (
    <div className={`rounded-lg border-2 overflow-hidden transition-all duration-300 ${
      isOpening
        ? 'border-amber-400 dark:border-amber-600 bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-900 scale-[1.02]'
        : isSealed
          ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30'
          : item.status === 'opened'
            ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/30'
            : item.status === 'engaged'
              ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30'
              : 'border-app-border bg-app-surface-raised opacity-60'
    }`}>
      {/* Sealed envelope visual */}
      {isSealed && (
        <div className="relative px-4 pt-4 pb-2">
          {/* Envelope flap triangle */}
          <div className="absolute top-0 left-0 right-0 h-8 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[100px] border-r-[100px] border-t-[32px] border-l-transparent border-r-transparent border-t-amber-200 dark:border-t-amber-800/60" />
          </div>
          {/* Wax seal */}
          <div className="mx-auto mt-4 w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-md flex items-center justify-center">
            <span className="text-white text-lg font-bold">$</span>
          </div>
        </div>
      )}

      {/* Opening animation overlay */}
      {isOpening && (
        <div className="px-4 py-6 flex flex-col items-center">
          <div className="w-12 h-12 border-3 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mt-3">Opening your offer...</p>
        </div>
      )}

      {/* Content (hidden when sealed or opening) */}
      {!isSealed && !isOpening && (
        <div className="p-4">
          {/* Header: business info */}
          <div className="flex items-center gap-3">
            {item.business_logo_url ? (
              <img
                src={item.business_logo_url}
                alt={item.business_name}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-app-surface-sunken flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-app-text-muted">
                  {item.business_name.charAt(0)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-app-text truncate">
                {item.offer_title}
              </p>
              <p className="text-xs text-app-text-secondary truncate">
                {item.business_name}
                {item.offer_subtitle && ` · ${item.offer_subtitle}`}
              </p>
            </div>
          </div>

          {/* Payout badge */}
          <div className="mt-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs font-bold rounded-full">
              +${item.payout_amount.toFixed(2)}
            </span>
            {item.expires_at && (
              <span className="text-[10px] text-app-text-muted">
                Expires {new Date(item.expires_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Action */}
          {isActionable && item.status === 'opened' && (
            <button
              type="button"
              onClick={onOpen}
              className="mt-3 w-full py-2 text-sm font-semibold rounded-md transition-colors bg-primary-500 hover:bg-primary-600 text-white"
            >
              Engage Offer
            </button>
          )}

          {/* Status labels for non-actionable states */}
          {item.status === 'engaged' && (
            <p className="mt-3 text-center text-xs font-medium text-green-700 dark:text-green-400">
              Engaged — earning in progress
            </p>
          )}
          {item.status === 'redeemed' && (
            <p className="mt-3 text-center text-xs text-app-text-secondary">Redeemed</p>
          )}
          {item.status === 'expired' && (
            <p className="mt-3 text-center text-xs text-app-text-muted">Expired</p>
          )}
          {item.status === 'capped' && (
            <p className="mt-3 text-center text-xs text-app-text-muted">Offer cap reached</p>
          )}
        </div>
      )}

      {/* Sealed: Open to Earn button below envelope */}
      {isSealed && (
        <div className="px-4 pb-4">
          <p className="text-center text-sm font-semibold text-app-text mb-1">
            {item.offer_title}
          </p>
          <p className="text-center text-xs text-app-text-secondary mb-3">
            {item.business_name}
          </p>
          <button
            type="button"
            onClick={onOpen}
            className="w-full py-2.5 text-sm font-semibold rounded-md transition-colors bg-amber-500 hover:bg-amber-600 text-white"
          >
            Open to Earn +${item.payout_amount.toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
}
