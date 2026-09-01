'use client';

/**
 * PropertyDetail — Tabbed view for a single property.
 * Tabs: Units, Requests, Leases, Notices, Settings
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import type { landlord } from '@pantopus/api';
import UnitsTab from './UnitsTab';
import RequestsTab from './RequestsTab';
import LeasesTab from './LeasesTab';
import NoticesTab from './NoticesTab';
import SettingsTab from './SettingsTab';

type PropertyTab = 'units' | 'requests' | 'leases' | 'notices' | 'settings';

const TAB_CONFIG: { key: PropertyTab; label: string }[] = [
  { key: 'units', label: 'Units' },
  { key: 'requests', label: 'Requests' },
  { key: 'leases', label: 'Leases' },
  { key: 'notices', label: 'Notices' },
  { key: 'settings', label: 'Settings' },
];

// ── Verification tier badge ─────────────────────────────────

const TIER_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  weak: { label: 'Unverified', bg: 'bg-app-surface-sunken', text: 'text-app-text-secondary' },
  standard: { label: 'Standard', bg: 'bg-blue-100', text: 'text-blue-700' },
  strong: { label: 'Strong', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  legal: { label: 'Legal', bg: 'bg-purple-100', text: 'text-purple-700' },
};

// ── Props ───────────────────────────────────────────────────

type Props = {
  homeId: string;
};

// ── Main component ──────────────────────────────────────────

export default function PropertyDetail({ homeId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as PropertyTab) || 'units';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<landlord.PropertyDetail | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.landlord.getPropertyDetail(homeId);
      setDetail(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load property details');
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleTabChange = (newTab: PropertyTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  // Count badges
  const requestCount = detail?.pending_requests?.length ?? 0;

  // ── Loading ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-3 border-app-border border-t-primary-500 rounded-full animate-spin" />
          <p className="text-sm text-app-text-secondary mt-4">Loading property...</p>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────
  if (error || !detail) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error || 'Property not found'}</p>
          <button
            type="button"
            onClick={() => router.push('/app/landlord/properties')}
            className="mt-2 text-sm text-red-600 font-medium hover:text-red-700"
          >
            &larr; Back to properties
          </button>
        </div>
      </div>
    );
  }

  const { home, units, leases, pending_requests, occupants, authority } = detail;
  const tierConfig = TIER_CONFIG[authority?.verification_tier || 'weak'] || TIER_CONFIG.weak;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Back + header */}
      <button
        type="button"
        onClick={() => router.push('/app/landlord/properties')}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors mb-4"
      >
        &larr; All Properties
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-app-text">{home.name || 'Unnamed Property'}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${tierConfig.bg} ${tierConfig.text}`}>
              {tierConfig.label}
            </span>
          </div>
          {home.home_type && (
            <p className="text-sm text-app-text-secondary mt-1 capitalize">{home.home_type.replace('_', ' ')}</p>
          )}
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-4 text-sm text-app-text-secondary">
          <span>{units.length} unit{units.length === 1 ? '' : 's'}</span>
          <span>{leases.filter((l) => l.state === 'active').length} active lease{leases.filter((l) => l.state === 'active').length === 1 ? '' : 's'}</span>
          <span>{occupants.length} occupant{occupants.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-app-border mb-6">
        <nav className="flex items-center gap-1 -mb-px">
          {TAB_CONFIG.map((t) => {
            const isActive = tab === t.key;
            const badge = t.key === 'requests' && requestCount > 0 ? requestCount : null;

            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTabChange(t.key)}
                className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-app-text border-b-2 border-gray-900'
                    : 'text-app-text-secondary hover:text-app-text-strong'
                }`}
              >
                {t.label}
                {badge !== null && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {tab === 'units' && (
          <UnitsTab
            homeId={homeId}
            authorityId={authority?.id || ''}
            units={units}
            leases={leases}
            occupants={occupants}
            onRefresh={loadDetail}
          />
        )}
        {tab === 'requests' && (
          <RequestsTab
            homeId={homeId}
            authorityId={authority?.id || ''}
            requests={pending_requests as landlord.TenantRequest[]}
            onRefresh={loadDetail}
          />
        )}
        {tab === 'leases' && (
          <LeasesTab
            homeId={homeId}
            leases={leases}
            onRefresh={loadDetail}
          />
        )}
        {tab === 'notices' && (
          <NoticesTab
            homeId={homeId}
            units={units}
          />
        )}
        {tab === 'settings' && (
          <SettingsTab homeId={homeId} />
        )}
      </div>
    </div>
  );
}
