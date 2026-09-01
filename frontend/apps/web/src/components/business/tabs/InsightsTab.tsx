import { useCallback, useEffect, useState } from 'react';
import * as api from '@pantopus/api';
import MetricTile from '../shared/MetricTile';

interface InsightsTabProps {
  businessId: string;
}

export default function InsightsTab({ businessId }: InsightsTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [insights, setInsights] = useState<Record<string, any> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.businesses.getBusinessInsights(businessId, '30d');
      setInsights(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load insights';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="bg-surface rounded-xl border border-app p-6 text-app-secondary">Loading insights...</div>;
  if (error) return <div className="bg-surface rounded-xl border border-app p-6 text-red-600 text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricTile label="Views (30d)" value={insights?.views?.total ?? 0} />
        <MetricTile label="Followers" value={insights?.followers?.total ?? 0} />
        <MetricTile label="Avg Rating" value={insights?.reviews?.average_rating ? Number(insights.reviews.average_rating).toFixed(2) : '0.00'} />
      </div>
      <div className="bg-surface rounded-xl border border-app p-4">
        <div className="text-sm font-semibold text-app mb-2">Top Sources</div>
        <div className="space-y-1">
          {(insights?.views?.by_source || []).map((s: { source: string; count: number }) => (
            <div key={s.source} className="flex items-center justify-between text-sm">
              <span className="text-app-secondary">{s.source}</span>
              <span className="font-medium text-app">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
