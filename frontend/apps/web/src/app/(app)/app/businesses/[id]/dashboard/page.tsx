'use client';

import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  BarChart3, Store, MapPin, Package, FileText, Users, Star, Building2,
  Receipt, Scale, Activity, Inbox,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useBusinessData } from '@/components/business/useBusinessData';
import {
  OverviewTab,
  ProfileTab,
  LocationsTab,
  CatalogTab,
  PagesTab,
  TeamTab,
  ReviewsTab,
  InsightsTab,
  SettingsTab,
  PaymentsTab,
  InvoicesTab,
  LegalTab,
  ActivityTab,
  InboxTab,
} from '@/components/business/tabs';

type Tab =
  | 'overview'
  | 'profile'
  | 'locations'
  | 'catalog'
  | 'pages'
  | 'team'
  | 'reviews'
  | 'insights'
  | 'payments'
  | 'invoices'
  | 'legal'
  | 'activity'
  | 'inbox'
  | 'settings';

const TAB_CONFIG: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'profile', label: 'Profile', icon: Store },
  { key: 'locations', label: 'Locations', icon: MapPin },
  { key: 'catalog', label: 'Catalog', icon: Package },
  { key: 'pages', label: 'Pages', icon: FileText },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'reviews', label: 'Reviews', icon: Star },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
  { key: 'legal', label: 'Legal', icon: Scale },
  { key: 'activity', label: 'Activity', icon: Activity },
  { key: 'inbox', label: 'Inbox', icon: Inbox },
];

export default function BusinessDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const businessId = params.id as string;
  const tab = (searchParams.get('tab') as Tab) || 'overview';

  const {
    business,
    profile,
    locations,
    team,
    catalog,
    pages,
    access,
    onboarding,
    foundingOffer,
    loading,
    error,
    refresh,
  } = useBusinessData(businessId);

  const dashPath = `/app/businesses/${businessId}/dashboard`;

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-app-secondary">Loading business…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-2">{error}</div>
          <button onClick={refresh} className="text-sm text-violet-600 hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app">
      {/* Header banner */}
      <div className="bg-surface border-b border-app">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-violet-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold text-app truncate">
                    {business?.name || 'Business'}
                  </h1>
                  {profile?.verification_status === 'self_attested' && (
                    <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-app-secondary border border-app">
                      Self-attested
                    </span>
                  )}
                  {profile?.verification_status === 'document_verified' && (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                      Verified
                    </span>
                  )}
                  {profile?.verification_status === 'government_verified' && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                      Gov Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-app-secondary">
                  <span>@{business?.username}</span>
                  {profile?.is_published ? (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 border border-green-200">
                      Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                      Draft
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {profile?.is_published && (
                <Link
                  href={`/b/${business?.username}`}
                  target="_blank"
                  className="px-3 py-1.5 rounded-lg border border-app-strong text-sm font-medium text-app-strong hover:bg-surface-raised transition"
                >
                  View public page
                </Link>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="mt-4 -mb-px flex gap-1 overflow-x-auto">
            {TAB_CONFIG.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  if (t.key === 'overview') {
                    router.push(dashPath);
                  } else {
                    router.push(`${dashPath}?tab=${t.key}`);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition whitespace-nowrap ${
                  tab === t.key
                    ? 'border-violet-600 text-violet-700 bg-violet-50'
                    : 'border-transparent text-app-secondary hover:text-app-strong hover:bg-surface-raised'
                }`}
              >
                <t.icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {tab === 'overview' && business && profile && (
          <OverviewTab
            business={business}
            profile={profile}
            locations={locations}
            team={team}
            catalog={catalog}
            pages={pages}
            businessId={businessId}
            onboarding={onboarding}
            foundingOffer={foundingOffer}
            onUpdate={refresh}
          />
        )}
        {tab === 'profile' && business && profile && (
          <ProfileTab
            business={business}
            profile={profile}
            businessId={businessId}
            onUpdate={refresh}
          />
        )}
        {tab === 'locations' && (
          <LocationsTab
            locations={locations}
            businessId={businessId}
            onUpdate={refresh}
          />
        )}
        {tab === 'catalog' && (
          <CatalogTab catalog={catalog} businessId={businessId} onUpdate={refresh} />
        )}
        {tab === 'pages' && (
          <PagesTab pages={pages} businessId={businessId} onUpdate={refresh} />
        )}
        {tab === 'team' && (
          <TeamTab team={team} businessId={businessId} access={access} onUpdate={refresh} />
        )}
        {tab === 'reviews' && <ReviewsTab businessId={businessId} businessName={business?.name || 'Business'} />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'insights' && <InsightsTab businessId={businessId} />}
        {tab === 'invoices' && <InvoicesTab businessId={businessId} />}
        {tab === 'legal' && <LegalTab businessId={businessId} businessType={profile?.business_type} />}
        {tab === 'activity' && <ActivityTab businessId={businessId} />}
        {tab === 'inbox' && <InboxTab businessId={businessId} />}
        {tab === 'settings' && profile && (
          <SettingsTab
            businessId={businessId}
            profile={profile}
            onUpdate={refresh}
          />
        )}
      </div>
    </div>
  );
}
