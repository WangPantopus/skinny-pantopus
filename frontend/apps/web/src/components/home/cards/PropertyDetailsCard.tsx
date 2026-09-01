'use client';

import { Building2, Home, MapPinned, Sparkles } from 'lucide-react';
import DashboardCard from '../DashboardCard';

export function PropertyDetailsCardPreview({
  home,
  onOpen,
}: {
  home: Record<string, any> | null;
  onOpen: () => void;
}) {
  const address = [home?.address, home?.address2]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .trim();
  const cityLine = [home?.city, home?.state, home?.zipcode]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(', ');
  const homeType = typeof home?.home_type === 'string' && home.home_type.trim()
    ? home.home_type.replace(/_/g, ' ')
    : null;

  return (
    <DashboardCard
      title="Property Details"
      icon={<Building2 className="w-5 h-5" />}
      visibility="members"
      badge="ATTOM"
      onClick={onOpen}
    >
      <div className="space-y-2">
        {address ? (
          <div className="flex items-start gap-2 text-sm">
            <Home className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" />
            <span className="line-clamp-2 font-medium text-app-text-strong">{address}</span>
          </div>
        ) : null}

        {cityLine ? (
          <div className="flex items-center gap-2 text-xs text-app-text-secondary">
            <MapPinned className="h-3.5 w-3.5 flex-shrink-0 text-app-text-muted" />
            <span className="truncate">{cityLine}</span>
          </div>
        ) : null}

        <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
          <Sparkles className="h-3.5 w-3.5" />
          {homeType || 'View public records'}
        </div>
      </div>
    </DashboardCard>
  );
}
