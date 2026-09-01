'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';

export default function BusinessActivityPage() {
  const params = useParams();
  const businessId = String(params.id || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState<api.businessIam.BusinessAuditEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.businessIam.getAuditLog(businessId, { limit: 100, offset: 0 });
      setEntries(res.entries || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-app-text">Business Activity</h1>
          <p className="text-sm text-app-text-secondary mt-1">Audit log of team actions</p>
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

      {loading && <div className="text-app-text-secondary">Loading...</div>}
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      {!loading && (
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
          {entries.length === 0 ? (
            <div className="p-6 text-center text-app-text-secondary text-sm">No activity yet.</div>
          ) : (
            <div className="divide-y divide-app-border-subtle">
              {entries.map((entry) => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-app-text">
                      {entry.actor?.name || entry.actor?.username || 'Unknown user'}
                    </div>
                    <div className="text-xs text-app-text-muted">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}
                    </div>
                  </div>
                  <div className="text-sm text-app-text-strong mt-1">{entry.action}</div>
                  {entry.target_type && (
                    <div className="text-xs text-app-text-secondary mt-1">
                      Target: {entry.target_type}{entry.target_id ? ` · ${entry.target_id}` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
