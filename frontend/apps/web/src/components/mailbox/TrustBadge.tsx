'use client';

import type { TrustLevel } from '@/types/mailbox';

type TrustBadgeProps = {
  trust: TrustLevel;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
};

const config: Record<TrustLevel, { bg: string; label: string; icon: string }> = {
  verified_gov: {
    bg: 'bg-red-800 text-white',
    label: 'Gov. Verified',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  verified_utility: {
    bg: 'bg-green-800 text-white',
    label: 'Utility',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  verified_business: {
    bg: 'bg-blue-800 text-white',
    label: 'Verified Biz',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  pantopus_user: {
    bg: 'bg-purple-600 text-white',
    label: 'Neighbor',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  unknown: {
    bg: 'bg-gray-400 text-white',
    label: 'Unknown',
    icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01',
  },
};

export default function TrustBadge({ trust, size = 'md', showLabel }: TrustBadgeProps) {
  const c = config[trust];

  if (size === 'sm') {
    return (
      <span
        className={`inline-block w-3 h-3 rounded-full ${c.bg}`}
        title={c.label}
        aria-label={c.label}
      />
    );
  }

  if (size === 'lg') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg}`}>
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
        </svg>
        {c.label}
      </span>
    );
  }

  // md (default)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg}`}>
      <span className="w-2 h-2 rounded-full bg-glass/30" />
      {(showLabel !== false) && c.label}
    </span>
  );
}
