import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type {
  BusinessUser,
  BusinessProfile,
  BusinessLocation,
  OnboardingStatus,
  FoundingOfferStatus,
} from '@pantopus/api';
import type { LucideIcon } from 'lucide-react';
import { MapPin, Package, Users, FileText } from 'lucide-react';
import { toast } from '@/components/ui/toast-store';

interface OverviewTabProps {
  business: BusinessUser;
  profile: BusinessProfile;
  locations: BusinessLocation[];
  team: Record<string, any>[];
  catalog: Record<string, any>[];
  pages: Record<string, any>[];
  businessId: string;
  onboarding: OnboardingStatus | null;
  foundingOffer: FoundingOfferStatus | null;
  onUpdate: () => void;
}

export default function OverviewTab({
  business,
  profile,
  locations,
  team,
  catalog,
  pages,
  businessId,
  onboarding,
  foundingOffer,
  onUpdate,
}: OverviewTabProps) {
  const router = useRouter();
  const dashPath = `/app/businesses/${businessId}/dashboard`;

  // Onboarding checklist dismissal
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(`pantopus_onboarding_dismissed_${businessId}`);
      if (dismissed === 'true') setChecklistDismissed(true);
    } catch {}
  }, [businessId]);

  const dismissChecklist = () => {
    setChecklistDismissed(true);
    try { localStorage.setItem(`pantopus_onboarding_dismissed_${businessId}`, 'true'); } catch {}
  };

  // Founding offer banner dismissal
  const [foundingDismissed, setFoundingDismissed] = useState(false);
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(`pantopus_founding_dismissed_${businessId}`);
      if (dismissed === 'true') setFoundingDismissed(true);
    } catch {}
  }, [businessId]);

  const [claimingSlot, setClaimingSlot] = useState(false);

  const claimFoundingSlot = async () => {
    setClaimingSlot(true);
    try {
      const res = await api.businesses.claimFoundingOffer(businessId);
      toast.success(res.message);
      onUpdate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to claim founding slot';
      toast.error(msg);
    } finally {
      setClaimingSlot(false);
    }
  };

  // Map action paths to tabs
  const actionToTab = (action: string | null): string | null => {
    if (!action) return null;
    if (action.includes('/locations')) return 'locations';
    if (action.includes('/catalog')) return 'catalog';
    if (action.includes('/profile')) return 'profile';
    if (action.includes('/verification') || action.includes('/settings')) return 'settings';
    if (action.includes('/pages')) return 'pages';
    if (action.includes('/team')) return 'team';
    return null;
  };

  // Quick stats
  const stats: { label: string; value: number; icon: LucideIcon; tab: string }[] = [
    { label: 'Locations', value: locations.length, icon: MapPin, tab: 'locations' },
    { label: 'Catalog items', value: catalog.length, icon: Package, tab: 'catalog' },
    { label: 'Team members', value: team.length, icon: Users, tab: 'team' },
    { label: 'Pages', value: pages.length, icon: FileText, tab: 'pages' },
  ];

  // Use backend onboarding if available, fall back to legacy checks
  const hasOnboarding = onboarding && onboarding.checklist && onboarding.total_count > 0;
  const showChecklist = hasOnboarding && onboarding.completed_count < onboarding.total_count && !checklistDismissed;

  // Legacy setup checklist (fallback)
  const checks = [
    { label: 'Add a description', done: !!profile?.description },
    { label: 'Add a location', done: locations.length > 0 },
    { label: 'Add a catalog item', done: catalog.length > 0 },
    { label: 'Publish your profile', done: profile?.is_published },
  ];
  const checksDone = checks.filter((c) => c.done).length;
  const showLegacyChecklist = !hasOnboarding && checksDone < checks.length;

  // Profile completeness
  const completeness = onboarding?.profile_completeness ?? profile?.profile_completeness ?? null;
  const showCompleteness = completeness !== null && completeness < 100;
  const completenessColor = completeness != null
    ? completeness <= 33 ? 'bg-red-500' : completeness <= 66 ? 'bg-yellow-500' : 'bg-green-500'
    : 'bg-surface-muted';

  // Founding offer visibility
  const userHasSlot = foundingOffer?.user_businesses?.some((b) => b.business_user_id === businessId);
  const showFoundingBanner = foundingOffer && foundingOffer.is_offer_active && !userHasSlot && !foundingDismissed;

  return (
    <div className="space-y-6">
      {/* Founding Business Banner */}
      {showFoundingBanner && (
        <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-5 relative">
          <button
            onClick={() => {
              setFoundingDismissed(true);
              try { localStorage.setItem(`pantopus_founding_dismissed_${businessId}`, 'true'); } catch {}
            }}
            className="absolute top-3 left-3 text-amber-600/80 hover:text-amber-800 text-sm font-medium"
            aria-label="Dismiss founding business banner"
          >
            Dismiss
          </button>
          <div className="flex items-center justify-between gap-4 flex-wrap pl-16">
            <div>
              <div className="text-sm font-semibold text-amber-900">
                Become a Founding Business — {foundingOffer.slots_remaining} spots remaining!
              </div>
              <div className="text-xs text-amber-700 mt-1">
                Join the first 50 businesses on Pantopus and get permanent founding status.
              </div>
            </div>
            <button
              onClick={claimFoundingSlot}
              disabled={claimingSlot}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition whitespace-nowrap"
            >
              {claimingSlot ? 'Claiming…' : 'Claim your spot'}
            </button>
          </div>
        </div>
      )}

      {/* Onboarding Checklist (backend-driven) */}
      {showChecklist && (
        <div className="rounded-xl border border-app bg-surface p-5 relative">
          <button
            onClick={dismissChecklist}
            className="absolute top-3 right-3 text-app-muted hover:text-app-secondary text-sm font-medium"
            aria-label="Dismiss Getting Started checklist"
          >
            Dismiss
          </button>
          <div className="flex items-center justify-between mb-2 pr-14">
            <div className="text-sm font-semibold text-app">Getting Started</div>
            <div className="text-xs text-app-secondary">{onboarding!.completed_count} of {onboarding!.total_count} complete</div>
          </div>
          <div className="w-full bg-surface-muted rounded-full h-2 mb-3">
            <div
              className="bg-sky-600 h-2 rounded-full transition-all"
              style={{ width: `${(onboarding!.completed_count / onboarding!.total_count) * 100}%` }}
            />
          </div>
          <div className="space-y-1.5">
            {onboarding!.checklist.map((item) => {
              const targetTab = actionToTab(item.action);
              return (
                <div key={item.key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={item.done ? 'text-green-600' : 'text-app-muted'}>{item.done ? '✓' : '○'}</span>
                    <span className={item.done ? 'text-app-muted line-through' : 'text-app'}>{item.label}</span>
                  </div>
                  {!item.done && targetTab && (
                    <button
                      onClick={() => router.push(`${dashPath}?tab=${targetTab}`)}
                      className="text-sky-600 hover:text-sky-800 text-xs"
                    >
                      &rarr;
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legacy setup progress (fallback when no backend onboarding) */}
      {showLegacyChecklist && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-5">
          <div className="text-sm font-semibold text-violet-800 mb-2">
            Setup Progress ({checksDone}/{checks.length})
          </div>
          <div className="w-full bg-violet-200 rounded-full h-2 mb-3">
            <div
              className="bg-violet-600 h-2 rounded-full transition-all"
              style={{ width: `${(checksDone / checks.length) * 100}%` }}
            />
          </div>
          <div className="space-y-1.5">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={c.done ? 'text-green-600' : 'text-app-muted'}>{c.done ? '✓' : '○'}</span>
                <span className={c.done ? 'text-app-secondary line-through' : 'text-app'}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Completeness */}
      {showCompleteness && (
        <div className="rounded-xl border border-app bg-surface p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-app-strong">Profile Completeness: {completeness}%</div>
          </div>
          <div className="w-full bg-surface-muted rounded-full h-2">
            <div
              className={`${completenessColor} h-2 rounded-full transition-all`}
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={() => router.push(`${dashPath}?tab=${s.tab}`)}
            className="rounded-xl border border-app bg-surface p-4 text-left hover:border-app-strong transition"
          >
            <div className="mb-1"><s.icon className="w-6 h-6 text-app-secondary" /></div>
            <div className="text-2xl font-bold text-app">{s.value}</div>
            <div className="text-xs text-app-secondary">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Rating */}
      {business?.review_count != null && business.review_count > 0 && (
        <div className="rounded-xl border border-app bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold text-app">{business.average_rating?.toFixed(1)}</div>
            <div>
              <div className="text-yellow-500 text-lg">{'★'.repeat(Math.round(business.average_rating || 0))}</div>
              <div className="text-xs text-app-secondary">{business.review_count} reviews</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent catalog */}
      {catalog.length > 0 && (
        <div className="rounded-xl border border-app bg-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-app">Catalog</h3>
            <button onClick={() => router.push(`${dashPath}?tab=catalog`)} className="text-xs text-violet-600 hover:underline">
              View all
            </button>
          </div>
          <div className="space-y-2">
            {catalog.slice(0, 5).map((item: Record<string, any>) => (
              <div key={item.id} className="flex items-center justify-between py-1.5">
                <div>
                  <div className="text-sm font-medium text-app">{item.name}</div>
                  <div className="text-xs text-app-secondary capitalize">{item.kind}</div>
                </div>
                {item.price_cents != null && (
                  <div className="text-sm font-semibold text-app-strong">
                    ${(item.price_cents / 100).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
