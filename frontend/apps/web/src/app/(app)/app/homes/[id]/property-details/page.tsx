'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { AttomPropertyDetailPayload } from '@pantopus/api';
import {
  ArrowLeft,
  BedDouble,
  Bath,
  CalendarDays,
  Building2,
  Home,
  Layers3,
  MapPinned,
  Ruler,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import AttomStructuredFields from '@/components/homes/AttomStructuredFields';

type AttomProperty = Record<string, any>;
type HomeRecord = Record<string, any>;

type StatCard = {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tint: string;
};

function getAttomPropertyFromPayload(payload: AttomPropertyDetailPayload | null | undefined): AttomProperty | null {
  if (!payload) return null;
  const fullResponse = payload.full_response as { property?: unknown[] } | undefined;
  if (Array.isArray(fullResponse?.property) && fullResponse.property[0] && typeof fullResponse.property[0] === 'object') {
    return fullResponse.property[0] as AttomProperty;
  }
  if (payload.property && typeof payload.property === 'object') {
    return payload.property as AttomProperty;
  }
  return null;
}

function formatValue(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function formatNumber(value: unknown, suffix = ''): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('en-US')}${suffix}`;
}

function buildHeroStats(property: AttomProperty | null): StatCard[] {
  if (!property) return [];

  const rooms = property.building?.rooms || {};
  const size = property.building?.size || {};
  const summary = property.summary || {};
  const buildingSummary = property.building?.summary || {};
  const lot = property.lot || {};

  const stats: StatCard[] = [];

  if (rooms.beds != null) {
    stats.push({ label: 'Beds', value: formatValue(rooms.beds), icon: BedDouble, tint: 'bg-indigo-50 text-indigo-600' });
  }
  if (rooms.bathstotal != null) {
    stats.push({ label: 'Baths', value: formatValue(rooms.bathstotal), icon: Bath, tint: 'bg-sky-50 text-sky-600' });
  }
  if (size.livingsize != null || size.bldgsize != null) {
    stats.push({
      label: 'Living Sqft',
      value: formatNumber(size.livingsize ?? size.bldgsize),
      icon: Ruler,
      tint: 'bg-emerald-50 text-emerald-600',
    });
  }
  if (lot.lotsize2 != null) {
    stats.push({
      label: 'Lot Sqft',
      value: formatNumber(lot.lotsize2),
      icon: MapPinned,
      tint: 'bg-amber-50 text-amber-600',
    });
  }
  if (summary.yearbuilt != null) {
    stats.push({
      label: 'Year Built',
      value: formatValue(summary.yearbuilt),
      icon: CalendarDays,
      tint: 'bg-rose-50 text-rose-600',
    });
  }
  if (buildingSummary.levels != null) {
    stats.push({
      label: 'Stories',
      value: formatValue(buildingSummary.levels),
      icon: Layers3,
      tint: 'bg-violet-50 text-violet-600',
    });
  }

  return stats;
}

function joinText(parts: unknown[], separator: string): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(separator);
}

export default function HomePropertyDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const homeId = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [home, setHome] = useState<HomeRecord | null>(null);
  const [attomPayload, setAttomPayload] = useState<AttomPropertyDetailPayload | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!homeId) return;
      setLoading(true);
      setError('');
      try {
        const res = await api.homes.getHomePropertyDetail(homeId);
        if (cancelled) return;
        setHome((res as any)?.home || null);
        setAttomPayload((res as any)?.attom_property_detail ?? null);
        setUnavailableReason((res as any)?.unavailable_reason ?? null);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load property details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [homeId]);

  const property = getAttomPropertyFromPayload(attomPayload);
  const stats = buildHeroStats(property);
  const addressLine =
    property?.address?.oneLine ||
    joinText([home?.address, home?.address2], ' ') ||
    'Property details';
  const cityLine =
    property?.address?.line2 ||
    joinText([home?.city, home?.state, home?.zipcode], ', ');
  const propertyType =
    property?.summary?.propertyType ||
    property?.summary?.propclass ||
    home?.home_type ||
    null;
  const yearBuilt = property?.summary?.yearbuilt ?? null;
  const subdivision = property?.area?.subdname ?? null;

  const emptyDescription =
    unavailableReason === 'ATTOM_UNAVAILABLE'
      ? 'Public records could not be loaded right now. Try again in a moment.'
      : unavailableReason === 'ATTOM_NOT_CONFIGURED'
        ? 'Property records are not configured in this environment yet.'
        : 'Property details from public records will appear here once available for this address.';

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          type="button"
          onClick={() => router.push(`/app/homes/${homeId}/dashboard`)}
          className="mb-4 inline-flex items-center gap-2 text-sm text-app-text-secondary hover:text-app-text-strong"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </button>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.08),transparent_38%),linear-gradient(to_bottom,#f8fafc,#ffffff)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/app/homes/${homeId}/dashboard`)}
            className="inline-flex items-center gap-2 rounded-full border border-app-border bg-app-surface px-3 py-2 text-sm font-medium text-app-text-secondary transition hover:text-app-text-strong hover:shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </button>
          <div>
            <p className="text-sm text-app-text-secondary">Home pillar</p>
            <h1 className="text-2xl font-bold text-app-text">Property Details</h1>
          </div>
        </div>

        {!property ? (
          <div className="rounded-[28px] border border-app-border bg-app-surface px-8 py-16 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <Home className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold text-app-text">No Property Data Available</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-app-text-secondary">
              {emptyDescription}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[28px] border border-indigo-200/70 bg-white/90 shadow-[0_18px_60px_-36px_rgba(79,70,229,0.45)] backdrop-blur">
              <div className="px-6 py-8 sm:px-8">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                    <Home className="h-7 w-7" />
                  </div>
                  <h2 className="max-w-3xl text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                    {addressLine}
                  </h2>
                  {cityLine ? (
                    <p className="mt-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                      {cityLine}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    {propertyType ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                        <Sparkles className="h-3.5 w-3.5" />
                        {String(propertyType).toUpperCase()}
                      </span>
                    ) : null}
                    {yearBuilt ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        <Building2 className="h-3.5 w-3.5" />
                        Built {yearBuilt}
                      </span>
                    ) : null}
                    {subdivision ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                        <MapPinned className="h-3.5 w-3.5" />
                        {subdivision}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {stats.length > 0 ? (
              <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className="rounded-3xl border border-app-border bg-app-surface px-4 py-5 text-center shadow-sm"
                    >
                      <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full ${stat.tint}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-2xl font-bold tracking-tight text-app-text">{stat.value}</div>
                      <div className="mt-1 text-xs font-medium text-app-text-secondary">{stat.label}</div>
                    </div>
                  );
                })}
              </section>
            ) : null}

            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-violet-600">
              <ShieldCheck className="h-4 w-4" />
              Data from public records via ATTOM
            </div>

            <section className="rounded-[28px] border border-app-border bg-app-surface px-4 py-4 shadow-sm sm:px-6 sm:py-6">
              <AttomStructuredFields attomPropertyDetail={attomPayload} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
