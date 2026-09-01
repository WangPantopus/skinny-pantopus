'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Hammer, ChevronLeft } from 'lucide-react';
import { GIG_STATUS_STYLES, statusClasses, statusLabel } from '@pantopus/ui-utils';
import DashboardCard from '../DashboardCard';
import VisibilityChip from '../VisibilityChip';

type SubTab = 'active' | 'hiring' | 'scheduled' | 'completed';

// ---- Preview ----

export function HomeHelpCardPreview({
  homeGigs,
  nearbyGigs,
  onExpand,
}: {
  homeGigs: Record<string, any>[];
  nearbyGigs: Record<string, any>[];
  onExpand: () => void;
}) {
  const activeGigs = homeGigs.filter((g) => g.status === 'open' || g.status === 'assigned' || g.status === 'in_progress');

  return (
    <DashboardCard
      title="Home Help"
      icon={<Hammer className="w-5 h-5" />}
      count={activeGigs.length}
      badge={activeGigs.length > 0 ? `${activeGigs.length} active` : undefined}
      onClick={onExpand}
    >
      {homeGigs.length > 0 ? (
        <div className="space-y-2">
          {homeGigs.slice(0, 2).map((g) => (
            <div key={g.id} className="flex items-center justify-between text-sm">
              <span className="text-app-text-strong truncate">{g.title}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${statusClasses(GIG_STATUS_STYLES, g.status || 'open')}`}>
                {statusLabel(GIG_STATUS_STYLES, g.status || 'open')}
              </span>
            </div>
          ))}
          {nearbyGigs.length > 0 && (
            <p className="text-xs text-app-text-muted">{nearbyGigs.length} nearby task{nearbyGigs.length !== 1 ? 's' : ''} available</p>
          )}
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="mb-1"><Hammer className="w-5 h-5 mx-auto text-app-text-muted" /></div>
          <p className="text-xs text-app-text-muted">No tasks posted</p>
        </div>
      )}
    </DashboardCard>
  );
}

// ---- Expanded ----

export default function HomeHelpCard({
  homeGigs,
  nearbyGigs,
  homeId,
  tasks,
  onBack,
}: {
  homeGigs: Record<string, any>[];
  nearbyGigs: Record<string, any>[];
  homeId: string;
  tasks: Record<string, any>[];
  onBack: () => void;
}) {
  const router = useRouter();
  const [subTab, setSubTab] = useState<SubTab>('active');

  const filteredGigs = useMemo(() => {
    switch (subTab) {
      case 'active':
        return homeGigs.filter((g) => g.status === 'open');
      case 'hiring':
        return homeGigs.filter((g) => g.status === 'assigned');
      case 'scheduled':
        return homeGigs.filter((g) => g.status === 'in_progress');
      case 'completed':
        return homeGigs.filter((g) => g.status === 'completed' || g.status === 'cancelled');
      default:
        return homeGigs;
    }
  }, [homeGigs, subTab]);

  const SUB_TABS: { key: SubTab; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: homeGigs.filter((g) => g.status === 'open').length },
    { key: 'hiring', label: 'Hiring', count: homeGigs.filter((g) => g.status === 'assigned').length },
    { key: 'scheduled', label: 'Scheduled', count: homeGigs.filter((g) => g.status === 'in_progress').length },
    { key: 'completed', label: 'Completed', count: homeGigs.filter((g) => g.status === 'completed' || g.status === 'cancelled').length },
  ];

  // Find linked task for a gig
  const getLinkedTask = (gigId: string) => tasks.find((t) => t.converted_to_gig_id === gigId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-app-text-secondary hover:text-app-text-strong transition flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2"><Hammer className="w-5 h-5" /> Home Help</h2>
        </div>
        <button
          onClick={() => router.push(`/app/gigs/new?home_id=${homeId}`)}
          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition"
        >
          + Post Home Help Task
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              subTab === t.key ? 'bg-gray-900 text-white' : 'text-app-text-secondary hover:bg-app-hover'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center ${
                subTab === t.key ? 'bg-glass/20 text-white' : 'bg-app-surface-sunken text-app-text-secondary'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
        {filteredGigs.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="mb-2"><Hammer className="w-8 h-8 mx-auto text-app-text-muted" /></div>
            <p className="text-sm text-app-text-secondary">No tasks in this category</p>
          </div>
        ) : (
          filteredGigs.map((gig) => {
            const linkedTask = getLinkedTask(gig.id);
            return (
              <div
                key={gig.id}
                onClick={() => router.push(`/app/gigs/${gig.id}`)}
                className="px-4 py-3.5 flex items-start gap-3 hover:bg-app-hover/50 transition cursor-pointer"
              >
                <div className="flex-shrink-0 px-2.5 py-1 bg-emerald-50 rounded-lg">
                  <div className="text-sm font-bold text-emerald-700">${gig.price ?? gig.budget_min ?? '—'}</div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-app-text truncate">{gig.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-app-text-secondary">
                      {gig.created_at && new Date(gig.created_at).toLocaleDateString()}
                    </span>
                    {gig.visibility && <VisibilityChip visibility={gig.visibility} />}
                    {gig.provider_name && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {gig.provider_name}
                      </span>
                    )}
                    {linkedTask && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        Task: {linkedTask.title}
                      </span>
                    )}
                  </div>
                </div>

                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${statusClasses(GIG_STATUS_STYLES, gig.status || 'open')}`}>
                  {statusLabel(GIG_STATUS_STYLES, gig.status || 'open')}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Nearby gigs section */}
      {nearbyGigs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Nearby Tasks</h3>
          <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
            {nearbyGigs.slice(0, 5).map((gig) => (
              <div
                key={gig.id}
                onClick={() => router.push(`/app/gigs/${gig.id}`)}
                className="px-4 py-3 flex items-center gap-3 hover:bg-app-hover/50 transition cursor-pointer"
              >
                <span className="text-sm font-medium text-app-text truncate flex-1">{gig.title}</span>
                {gig.distance_meters && (
                  <span className="text-xs text-app-text-muted">{Math.round((gig.distance_meters / 1000) * 10) / 10} km</span>
                )}
                <span className="text-xs font-medium text-emerald-600">${gig.price ?? gig.budget_min ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
