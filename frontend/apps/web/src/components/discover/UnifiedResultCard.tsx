'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Briefcase,
  MapPin,
  Radio,
  Search,
  ShoppingBag,
  Store,
  type LucideIcon,
} from 'lucide-react';
import type { UnifiedResult } from './discoverTypes';

const TYPE_STYLE: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  local_profile:  { icon: MapPin,      color: 'text-sky-700 bg-sky-50',       label: 'Profile' },
  public_profile: { icon: Radio,       color: 'text-fuchsia-700 bg-fuchsia-50', label: 'Beacon' },
  business:       { icon: Store,       color: 'text-emerald-700 bg-emerald-50', label: 'Business' },
  task:           { icon: Briefcase,   color: 'text-orange-700 bg-orange-50', label: 'Task' },
  listing:        { icon: ShoppingBag, color: 'text-violet-700 bg-violet-50', label: 'Listing' },
};

export function UnifiedResultCard({ item }: { item: UnifiedResult }) {
  const router = useRouter();
  const style = TYPE_STYLE[item.type];
  const Icon = style?.icon ?? Search;
  const hasVerifiedBadge = item.badges?.some((badge) => ['verified', 'verified_resident'].includes(badge));
  const linkedLabel = item.linkedProfile?.type === 'public_profile' ? 'Linked Beacon' : 'Linked Profile';

  return (
    <button
      onClick={() => router.push(item.href)}
      className="w-full text-left flex items-center gap-3 p-3 bg-surface border border-app rounded-lg hover:bg-surface-raised transition"
    >
      {item.imageUrl ? (
        <Image src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" width={40} height={40} sizes="40px" quality={75} />
      ) : (
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${style?.color ?? 'text-app-muted bg-surface-muted'}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-semibold text-app truncate">{item.title}</p>
          {hasVerifiedBadge && <BadgeCheck className="h-3.5 w-3.5 flex-shrink-0 text-sky-600" aria-label="Verified" />}
        </div>
        {item.subtitle && <p className="text-xs text-app-muted truncate">{item.subtitle}</p>}
        {item.linkedProfile && (
          <p className="mt-0.5 text-xs text-app-secondary truncate">
            {linkedLabel}: {item.linkedProfile.title}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-0">
        {item.meta && (
          <span className="max-w-32 truncate text-xs font-semibold text-app-secondary">{item.meta}</span>
        )}
        <span className={`max-w-32 truncate text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${style?.color ?? 'text-app-muted bg-surface-muted'}`}>
          {style?.label ?? item.type}
        </span>
      </div>
    </button>
  );
}

export function UnifiedResultSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 bg-surface border border-app rounded-lg animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-surface-muted flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-surface-muted rounded w-2/3" />
        <div className="h-2.5 bg-surface-muted rounded w-1/3" />
      </div>
    </div>
  );
}

export default UnifiedResultCard;
