'use client';

/* eslint-disable @next/next/no-img-element */
import type { HomeAsset } from '@/types/mailbox';

type AssetCardProps = {
  asset: HomeAsset;
  onClick?: () => void;
};

const categoryIcons: Record<string, string> = {
  appliance: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  structure: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  system: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  vehicle: 'M8 17h.01M16 17h.01M7.5 10.5l1-4.5h7l1 4.5M5 14h14a2 2 0 012 2v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2a2 2 0 012-2z',
  other: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
};

const warrantyColors: Record<string, string> = {
  active: 'text-green-600 bg-green-50 dark:bg-green-950/30',
  expiring_soon: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  expired: 'text-red-600 bg-red-50 dark:bg-red-950/30',
  none: 'text-app-text-secondary bg-app-surface-raised',
};

export default function AssetCard({ asset, onClick }: AssetCardProps) {
  const icon = categoryIcons[asset.category] ?? categoryIcons.other;
  const warrantyStyle = warrantyColors[asset.warranty_status] ?? warrantyColors.none;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 p-3 rounded-lg border border-app-border hover:bg-app-hover dark:hover:bg-gray-800 transition-colors text-left"
    >
      {/* Photo or icon */}
      {asset.photos.length > 0 ? (
        <img
          src={asset.photos[0].url}
          alt={asset.name}
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-app-surface-sunken flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
          </svg>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-app-text truncate">
          {asset.name}
        </p>
        <p className="text-xs text-app-text-secondary mt-0.5">
          {asset.manufacturer && `${asset.manufacturer} · `}
          {asset.room || asset.category}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${warrantyStyle}`}>
            {asset.warranty_status === 'active' && 'Warranty active'}
            {asset.warranty_status === 'expiring_soon' && 'Warranty expiring'}
            {asset.warranty_status === 'expired' && 'Warranty expired'}
            {asset.warranty_status === 'none' && 'No warranty'}
          </span>
          {asset.linked_mail_count > 0 && (
            <span className="text-[10px] text-app-text-muted">
              {asset.linked_mail_count} mail linked
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
