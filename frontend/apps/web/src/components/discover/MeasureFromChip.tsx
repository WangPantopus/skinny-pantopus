'use client';

import type { MeasureFrom } from './DiscoverMap';

interface MeasureFromChipProps {
  value: MeasureFrom;
  onChange: (v: MeasureFrom) => void;
  /** Whether the user has a home set */
  hasHome: boolean;
  /** Whether GPS is available */
  hasGps: boolean;
  /** Home city for label */
  homeCity?: string;
}

export default function MeasureFromChip({
  value,
  onChange,
  hasHome,
  hasGps,
  homeCity,
}: MeasureFromChipProps) {
  // If only one option is usable, don't show
  if (!hasHome && !hasGps) return null;
  if (!hasHome && hasGps) return null; // default to "here", no toggle needed

  const isHome = value === 'home';

  return (
    <button
      onClick={() => onChange(isHome ? 'here' : 'home')}
      disabled={isHome ? !hasGps : !hasHome}
      aria-label={`Measuring from ${isHome ? (homeCity || 'Home') : 'current location'}. Click to switch.`}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
        border transition-all shadow-sm
        ${isHome
          ? 'bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100'
          : 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
        }
        disabled:opacity-40 disabled:cursor-not-allowed
      `}
    >
      <span aria-hidden="true">{isHome ? '🏠' : '📍'}</span>
      <span>
        Measuring from:{' '}
        <span className="font-bold">
          {isHome ? (homeCity || 'Home') : 'Here'}
        </span>
      </span>
    </button>
  );
}
