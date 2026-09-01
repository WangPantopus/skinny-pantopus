'use client';

/* eslint-disable @next/next/no-img-element */
import type { MailItemV2 } from '@/types/mailbox';
import TrustBadge from './TrustBadge';
import UrgencyIndicator from './UrgencyIndicator';
import DrawerBadge from './DrawerBadge';
import { formatTimeAgo as timeAgo } from '@pantopus/ui-utils';

type MailItemCardProps = {
  item: MailItemV2;
  isSelected?: boolean;
  isRead?: boolean;
  onClick: () => void;
};

function mailObjectIcon(type: string): string {
  switch (type) {
    case 'package': return 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4';
    case 'postcard': return 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
    case 'booklet': return 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253';
    case 'bundle': return 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10';
    default: return 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
  }
}

/** Detect if item is a certified mail (duck-typed from MailItemV2) */
function isCertified(item: MailItemV2): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (item as any).certified === true;
}

/** Detect earn offer payout from the item */
function getOfferPayout(item: MailItemV2): number | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (item as any).payout_amount;
  return typeof p === 'number' && p > 0 ? p : null;
}

const drawerBorderColor: Record<string, string> = {
  personal: 'border-l-sky-500',
  home: 'border-l-emerald-500',
  business: 'border-l-indigo-500',
  earn: 'border-l-amber-500',
};

export default function MailItemCard({
  item,
  isSelected = false,
  isRead,
  onClick,
}: MailItemCardProps) {
  const read = isRead ?? !!item.opened_at;
  const urgencyClass = item.urgency === 'overdue' ? 'bg-red-50 dark:bg-red-950/20' : '';
  const isBundle = item.mail_object_type === 'bundle';
  const isBooklet = item.mail_object_type === 'booklet';
  const certified = isCertified(item);
  const offerPayout = item.drawer === 'earn' ? getOfferPayout(item) : null;

  const selectedBorder = drawerBorderColor[item.drawer] ?? 'border-l-primary-500';

  return (
    <div className={`relative ${isBundle ? 'mt-1.5' : ''}`}>
      {/* Bundle: stacked shadow cards behind */}
      {isBundle && (
        <>
          <div className="absolute -top-1.5 left-3 right-3 h-2 rounded-t border border-b-0 border-app-border bg-app-surface-sunken" />
          <div className="absolute -top-0.5 left-1.5 right-1.5 h-1 rounded-t border border-b-0 border-app-border bg-app-surface-raised" />
        </>
      )}

      <button
        type="button"
        onClick={onClick}
        className={`relative w-full text-left px-3 py-3 border-b border-app-border-subtle transition-colors duration-150 min-h-[44px] ${
          isSelected
            ? `bg-primary-50 dark:bg-primary-900/20 border-l-2 ${selectedBorder}`
            : `hover:bg-app-hover dark:hover:bg-gray-900 border-l-2 border-l-transparent ${urgencyClass}`
        }`}
      >
        <div className="flex items-start gap-2.5">
          {/* Unread dot — left edge */}
          {!read && (
            <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary-500" />
          )}

          {/* Avatar / Mail object icon */}
          <div className={`flex-shrink-0 mt-0.5 ${read ? 'text-app-text-muted' : 'text-primary-600'}`}>
            {item.sender_logo_url ? (
              <img
                src={item.sender_logo_url}
                alt={item.sender_display || ''}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={read ? 1.5 : 2} d={mailObjectIcon(item.mail_object_type)} />
              </svg>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Top row: sender + date + certified lock */}
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate text-sm ${read ? 'text-app-text-secondary dark:text-app-text-muted' : 'text-app-text font-semibold'}`}>
                {item.sender_display || 'Unknown Sender'}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {certified && (
                  <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Certified">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
                <span className="text-xs text-app-text-muted">
                  {timeAgo(item.created_at)}
                </span>
              </div>
            </div>

            {/* Title */}
            <p className={`truncate text-sm mt-0.5 ${read ? 'text-app-text-secondary dark:text-app-text-secondary' : 'text-app-text'}`}>
              {item.display_title || item.subject || 'No subject'}
            </p>

            {/* Offer subtext */}
            {offerPayout !== null && !item.opened_at && (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                Open to earn ${offerPayout.toFixed(2)}
              </p>
            )}

            {/* Preview (non-offer items) */}
            {offerPayout === null && item.preview_text && (
              <p className="truncate text-xs text-app-text-muted mt-0.5">
                {item.preview_text}
              </p>
            )}

            {/* Bottom row: badges */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <TrustBadge trust={item.sender_trust} size="sm" />
              <DrawerBadge drawer={item.drawer} size="sm" />
              <UrgencyIndicator urgency={item.urgency} due_date={item.due_date} compact />
              {item.starred && (
                <span className="text-amber-400 text-xs" aria-label="Starred">&#9733;</span>
              )}
            </div>
          </div>

          {/* Booklet: page-fan edge on right */}
          {isBooklet && (
            <div className="flex-shrink-0 flex flex-col gap-px mt-1" aria-hidden="true">
              <div className="w-0.5 h-3 bg-gray-300 rounded-full" />
              <div className="w-0.5 h-3 bg-app-surface-sunken rounded-full ml-0.5" />
              <div className="w-0.5 h-3 bg-app-surface-sunken rounded-full ml-1" />
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
