'use client';

import type { TrustLevel } from '@/types/mailbox';

type TrustBadgeProps = {
  trust: TrustLevel;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
};

// How Pantopus checked the sender, in the Mail tab's words (2026-10-27):
// verified senders in green, an unknown one says "Unverified sender" in red.
const config: Record<TrustLevel, { bg: string; label: string; icon: string }> = {
  verified_gov: {
    bg: 'bg-emerald-600 text-white',
    label: 'Verified government',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  verified_utility: {
    bg: 'bg-emerald-600 text-white',
    label: 'Verified utility',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  verified_business: {
    bg: 'bg-emerald-600 text-white',
    label: 'Verified business',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  pantopus_user: {
    bg: 'bg-slate-600 text-white',
    label: 'Pantopus neighbor',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  unknown: {
    bg: 'bg-red-700 text-white',
    label: 'Unverified sender',
    icon: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  },
};

export default function TrustBadge({ trust, size = 'md', showLabel }: TrustBadgeProps) {
  // A trust level this build doesn't know reads as unverified, never as a crash.
  const c = config[trust] ?? config.unknown;

  if (size === 'sm') {
    return (
      <span
        role="img"
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
