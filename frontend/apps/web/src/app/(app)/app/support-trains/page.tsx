'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { Heart, Plus, Calendar, Users } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';

type RoleFilter = 'all' | 'organizer' | 'helper';

const ROLE_TABS: Array<{ key: RoleFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'organizer', label: 'Organizing' },
  { key: 'helper', label: 'Helping' },
];

function statusBadgeClasses(status: string): string {
  switch (status) {
    case 'draft': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    case 'published': return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200';
    case 'active': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200';
    case 'paused': return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200';
    case 'completed': return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
    case 'archived': return 'bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function roleBadgeClasses(role: string): string {
  if (role === 'organizer' || role === 'primary' || role === 'co_organizer') {
    return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300';
  }
  return 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300';
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

export default function SupportTrainsPage() {
  const router = useRouter();
  const [trains, setTrains] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const fetchTrains = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const params: any = { limit: 50, offset: 0 };
      if (roleFilter !== 'all') params.role = roleFilter;

      const result = await api.supportTrains.listMySupportTrains(params);
      setTrains(result.support_trains || []);
      setTotal(result.total || 0);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Support Trains');
    }
  }, [roleFilter, router]);

  useEffect(() => {
    setLoading(true);
    fetchTrains().finally(() => setLoading(false));
  }, [fetchTrains]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Support Trains</h1>
          <p className="text-sm text-app-text-secondary mt-1">Coordinate meals, groceries, and support for people who need it.</p>
        </div>
        <button
          onClick={() => router.push('/app/support-trains/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition"
        >
          <Plus className="w-4 h-4" />
          Start a Train
        </button>
      </div>

      {/* Role tabs */}
      <div className="flex gap-1 mb-6 border-b border-app-border">
        {ROLE_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setRoleFilter(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              roleFilter === tab.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-app-text-secondary hover:text-app-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTrains} />
      ) : trains.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={roleFilter === 'helper' ? 'Not helping on any trains yet' : roleFilter === 'organizer' ? 'No trains organized yet' : 'No Support Trains yet'}
          description={roleFilter === 'organizer'
            ? 'Start a Support Train to coordinate meals, groceries, or gift funds for someone who needs it.'
            : 'When you sign up to help on a Support Train, it will appear here.'
          }
          actionLabel={roleFilter !== 'helper' ? 'Start a Train' : undefined}
          onAction={roleFilter !== 'helper' ? () => router.push('/app/support-trains/new') : undefined}
        />
      ) : (
        <div className="space-y-3">
          {trains.map(train => (
            <button
              key={train.id}
              onClick={() => router.push(`/app/support-trains/${train.id}`)}
              className="w-full text-left bg-app-surface rounded-xl border border-app-border p-4 hover:border-primary-300 dark:hover:border-primary-700 transition group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-app-text group-hover:text-primary-600 transition truncate">
                    {train.title || 'Untitled Support Train'}
                  </h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClasses(train.status)}`}>
                      {train.status}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClasses(train.my_role)}`}>
                      {train.my_role === 'primary' ? 'Organizer' : train.my_role === 'co_organizer' ? 'Co-organizer' : train.my_role === 'helper' ? 'Helper' : train.my_role}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-app-text-muted whitespace-nowrap">
                  {train.published_at ? formatDate(train.published_at) : formatDate(train.created_at)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
