'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import type { BusinessInsights } from '@pantopus/types';

const PERIODS: Array<'7d' | '30d' | '90d'> = ['7d', '30d', '90d'];

export default function BusinessInsightsPage() {
  const params = useParams();
  const businessId = String(params.id || '');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [insights, setInsights] = useState<BusinessInsights | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.businesses.getBusinessInsights(businessId, period);
      setInsights(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [businessId, period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-app-text">Business Insights</h1>
          <p className="text-sm text-app-text-secondary mt-1">Views, followers, and reviews performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/app/business/${businessId}/dashboard`} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
            Dashboard
          </Link>
          <button onClick={() => void load()} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
            Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              period === p ? 'bg-violet-600 text-white' : 'border border-app-border text-app-text-strong hover:bg-app-hover'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {loading && <div className="text-app-text-secondary">Loading...</div>}
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      {!loading && insights && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Profile Views" value={insights.views?.total ?? 0} />
            <MetricCard label="Followers" value={insights.followers?.total ?? 0} />
            <MetricCard label="New Followers" value={insights.followers?.new ?? 0} />
            <MetricCard label="Avg Rating" value={insights.reviews?.average_rating ? Number(insights.reviews.average_rating).toFixed(2) : '0.00'} />
          </div>

          <div className="bg-app-surface border border-app-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-app-text mb-3">Views by Day</h2>
            <div className="space-y-1">
              {(insights.views?.by_day || []).map((d: { date: string; count: number }) => (
                <div key={d.date} className="flex items-center justify-between text-sm">
                  <span className="text-app-text-secondary">{d.date}</span>
                  <span className="font-medium text-app-text">{d.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-app-surface border border-app-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-app-text mb-3">Traffic Sources</h2>
            <div className="space-y-1">
              {(insights.views?.by_source || []).map((s: { source: string; count: number }) => (
                <div key={s.source} className="flex items-center justify-between text-sm">
                  <span className="text-app-text-secondary">{s.source}</span>
                  <span className="font-medium text-app-text">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-xl p-4">
      <div className="text-xs text-app-text-secondary">{label}</div>
      <div className="text-2xl font-bold text-app-text mt-1">{value}</div>
    </div>
  );
}
