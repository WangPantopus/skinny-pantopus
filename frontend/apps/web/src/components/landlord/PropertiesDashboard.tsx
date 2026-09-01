'use client';

/**
 * PropertiesDashboard — Card grid of properties where the user has landlord authority.
 *
 * Each card shows: address, verification tier badge, unit count, pending requests,
 * active leases. "Add Property" CTA to start address entry with authority request.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { landlord } from '@pantopus/api';

// ── Verification tier badges ────────────────────────────────

const TIER_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  weak: { label: 'Unverified', bg: 'bg-app-surface-sunken', text: 'text-app-text-secondary', dot: 'bg-gray-400' },
  standard: { label: 'Standard', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  strong: { label: 'Strong', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  legal: { label: 'Legal', bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
};

function TierBadge({ tier }: { tier: string }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.weak;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ── Status badge ────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-700' },
  verified: { label: 'Verified', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  revoked: { label: 'Revoked', bg: 'bg-red-100', text: 'text-red-700' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

// ── Stat pill ───────────────────────────────────────────────

function StatPill({ icon, label, count, accent }: { icon: React.ReactNode; label: string; count: number; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
      accent ? 'bg-amber-50 text-amber-700' : 'bg-app-surface-raised text-app-text-secondary'
    }`}>
      {icon}
      <span>{count}</span>
      <span className="text-app-text-muted font-normal">{label}</span>
    </div>
  );
}

// ── Property card ───────────────────────────────────────────

function PropertyCard({
  property,
  onClick,
}: {
  property: landlord.HomeAuthority & { _unitCount?: number; _requestCount?: number; _leaseCount?: number };
  onClick: () => void;
}) {
  const home = property.home;
  const homeName = home?.name || 'Unnamed Property';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-app-border bg-app-surface p-5 hover:border-app-border hover:shadow-sm transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-app-text-muted flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
            </svg>
            <h3 className="font-semibold text-app-text truncate group-hover:text-primary-700 transition-colors">
              {homeName}
            </h3>
          </div>
          {home?.home_type && (
            <p className="text-xs text-app-text-secondary capitalize">{home.home_type.replace('_', ' ')}</p>
          )}
        </div>
        <TierBadge tier={property.verification_tier} />
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-2">
        <StatPill
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>}
          label="units"
          count={property._unitCount ?? 0}
        />
        <StatPill
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>}
          label="requests"
          count={property._requestCount ?? 0}
          accent={(property._requestCount ?? 0) > 0}
        />
        <StatPill
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>}
          label="leases"
          count={property._leaseCount ?? 0}
        />
      </div>

      {/* Authority status */}
      {property.status !== 'verified' && (
        <div className="mt-3 pt-3 border-t border-app-border-subtle">
          <StatusBadge status={property.status} />
        </div>
      )}
    </button>
  );
}

// ── Empty state ─────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-16 h-16 rounded-full bg-app-surface-sunken flex items-center justify-center mx-auto mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-app-text-muted" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-app-text mb-1">No properties yet</h3>
      <p className="text-sm text-app-text-secondary mb-6 max-w-sm mx-auto">
        Add a property to start managing units, tenants, and leases from one place.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        Add Property
      </button>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────

export default function PropertiesDashboard() {
  const router = useRouter();
  const [properties, setProperties] = useState<landlord.HomeAuthority[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Property-level stats (fetched per-property)
  const [stats, setStats] = useState<Record<string, { units: number; requests: number; leases: number }>>({});

  const loadProperties = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.landlord.getProperties();
      setProperties(res.properties || []);

      // Fetch detail stats for each property in parallel
      const detailResults = await Promise.allSettled(
        (res.properties || []).map((p) =>
          api.landlord.getPropertyDetail(p.home_id),
        ),
      );

      const newStats: Record<string, { units: number; requests: number; leases: number }> = {};
      detailResults.forEach((result, i) => {
        const homeId = res.properties[i]?.home_id;
        if (homeId && result.status === 'fulfilled') {
          const detail = result.value;
          newStats[homeId] = {
            units: detail.units?.length ?? 0,
            requests: detail.pending_requests?.length ?? 0,
            leases: detail.leases?.filter((l) => l.state === 'active').length ?? 0,
          };
        }
      });
      setStats(newStats);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const handleAddProperty = () => {
    router.push('/app/landlord/properties/new');
  };

  const handlePropertyClick = (homeId: string) => {
    router.push(`/app/landlord/properties/${homeId}`);
  };

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Properties</h1>
          <p className="text-sm text-app-text-secondary mt-1">
            Manage your rental properties, tenants, and leases.
          </p>
        </div>
        {properties.length > 0 && (
          <button
            type="button"
            onClick={handleAddProperty}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Property
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-3 border-app-border border-t-primary-500 rounded-full animate-spin" />
          <p className="text-sm text-app-text-secondary mt-4">Loading properties...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={loadProperties}
            className="mt-2 text-sm text-red-600 font-medium hover:text-red-700"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && properties.length === 0 && (
        <EmptyState onAdd={handleAddProperty} />
      )}

      {/* Property grid */}
      {!loading && properties.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property) => {
            const s = stats[property.home_id];
            const enriched = {
              ...property,
              _unitCount: s?.units ?? 0,
              _requestCount: s?.requests ?? 0,
              _leaseCount: s?.leases ?? 0,
            };
            return (
              <PropertyCard
                key={property.id}
                property={enriched}
                onClick={() => handlePropertyClick(property.home_id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
