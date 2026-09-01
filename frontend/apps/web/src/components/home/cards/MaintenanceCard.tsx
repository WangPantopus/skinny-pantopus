'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, ChevronLeft, CheckCircle, XCircle, Calendar, ClipboardList, Building, Snowflake, CloudRain, Sprout, Thermometer, Palette, Home, Flame, DoorOpen, Paintbrush, ThermometerSnowflake, HousePlus, Flashlight } from 'lucide-react';
import * as api from '@pantopus/api';
import type { HomeVendor } from '@pantopus/types';
import DashboardCard from '../DashboardCard';
import VisibilityChip from '../VisibilityChip';

type SubTab = 'suggested' | 'scheduled' | 'history' | 'providers';

// Seasonal suggestions based on month (hardcoded initial set)
function getSeasonalSuggestions(): { title: string; description: string; icon: ReactNode; season: string }[] {
  const month = new Date().getMonth();
  const base = [
    // Spring (Mar-May)
    { title: 'HVAC Filter Replacement', description: 'Replace air filters before summer cooling season', icon: <Snowflake className="w-5 h-5" />, season: 'spring' },
    { title: 'Gutter Cleaning', description: 'Clear debris from winter storms', icon: <CloudRain className="w-5 h-5" />, season: 'spring' },
    { title: 'Lawn Care Startup', description: 'First mow and fertilization of the season', icon: <Sprout className="w-5 h-5" />, season: 'spring' },
    // Summer (Jun-Aug)
    { title: 'AC System Check', description: 'Ensure cooling system is operating efficiently', icon: <Thermometer className="w-5 h-5" />, season: 'summer' },
    { title: 'Exterior Paint Inspection', description: 'Check for peeling or chipping exterior paint', icon: <Palette className="w-5 h-5" />, season: 'summer' },
    { title: 'Deck/Patio Maintenance', description: 'Pressure wash and reseal outdoor surfaces', icon: <Home className="w-5 h-5" />, season: 'summer' },
    // Fall (Sep-Nov)
    { title: 'Heating System Tune-up', description: 'Service furnace before winter', icon: <Flame className="w-5 h-5" />, season: 'fall' },
    { title: 'Weatherstripping Check', description: 'Inspect and replace door/window seals', icon: <DoorOpen className="w-5 h-5" />, season: 'fall' },
    { title: 'Chimney Inspection', description: 'Annual chimney cleaning and inspection', icon: <Paintbrush className="w-5 h-5" />, season: 'fall' },
    // Winter (Dec-Feb)
    { title: 'Pipe Insulation', description: 'Protect exposed pipes from freezing', icon: <ThermometerSnowflake className="w-5 h-5" />, season: 'winter' },
    { title: 'Roof Inspection', description: 'Check for ice dam risk and missing shingles', icon: <HousePlus className="w-5 h-5" />, season: 'winter' },
    { title: 'Emergency Kit Review', description: 'Ensure emergency supplies are stocked and fresh', icon: <Flashlight className="w-5 h-5" />, season: 'winter' },
  ];

  const currentSeason = month >= 2 && month <= 4 ? 'spring' : month >= 5 && month <= 7 ? 'summer' : month >= 8 && month <= 10 ? 'fall' : 'winter';
  // Show current season first, then next season
  const seasons = ['spring', 'summer', 'fall', 'winter'];
  const nextSeason = seasons[(seasons.indexOf(currentSeason) + 1) % 4];

  return base.filter((s) => s.season === currentSeason || s.season === nextSeason);
}

// ---- Preview ----

export function MaintenanceCardPreview({
  issues,
  onExpand,
}: {
  issues: Record<string, any>[];
  onExpand: () => void;
}) {
  const scheduledCount = issues.filter((i) => i.status === 'scheduled').length;
  const nextScheduled = issues
    .filter((i) => i.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime())[0];

  return (
    <DashboardCard
      title="Maintenance"
      icon={<Wrench className="w-5 h-5" />}
      visibility="members"
      count={scheduledCount}
      onClick={onExpand}
    >
      {nextScheduled ? (
        <div className="space-y-1">
          <div className="text-sm font-medium text-app-text-strong truncate">{nextScheduled.title}</div>
          <div className="text-xs text-app-text-muted">
            Next: {nextScheduled.scheduled_at
              ? new Date(nextScheduled.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : 'TBD'}
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="mb-1"><CheckCircle className="w-5 h-5 mx-auto text-app-text-muted" /></div>
          <p className="text-xs text-app-text-muted">No scheduled maintenance</p>
        </div>
      )}
    </DashboardCard>
  );
}

// ---- Expanded ----

export default function MaintenanceCard({
  issues,
  homeId,
  home: _home,
  onAddIssue,
  onViewIssue,
  onBack,
}: {
  issues: Record<string, any>[];
  homeId: string;
  home: Record<string, any>;
  onAddIssue: () => void;
  onViewIssue: (issue: Record<string, any>) => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [subTab, setSubTab] = useState<SubTab>('suggested');
  const [vendors, setVendors] = useState<HomeVendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  const suggestions = getSeasonalSuggestions();

  useEffect(() => {
    if (subTab === 'providers') {
      setLoadingVendors(true);
      api.homeProfile.getHomeVendors(homeId)
        .then((res) => setVendors(res.vendors || []))
        .catch(() => setVendors([]))
        .finally(() => setLoadingVendors(false));
    }
  }, [subTab, homeId]);

  const scheduled = issues.filter((i) => i.status === 'scheduled');
  const history = issues.filter((i) => i.status === 'resolved' || i.status === 'canceled');

  const SUB_TABS: { key: SubTab; label: string; count?: number }[] = [
    { key: 'suggested', label: 'Suggested', count: suggestions.length },
    { key: 'scheduled', label: 'Scheduled', count: scheduled.length },
    { key: 'history', label: 'History', count: history.length },
    { key: 'providers', label: 'Providers' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-app-text-secondary hover:text-app-text-strong transition flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2"><Wrench className="w-5 h-5" /> Maintenance</h2>
        </div>
        <button
          onClick={onAddIssue}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
        >
          + Log Maintenance
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
            {t.count != null && t.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center ${
                subTab === t.key ? 'bg-glass/20 text-white' : 'bg-app-surface-sunken text-app-text-secondary'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Suggested */}
      {subTab === 'suggested' && (
        <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
          {suggestions.map((s, i) => (
            <div key={i} className="px-4 py-3 flex items-start gap-3">
              <span className="flex-shrink-0">{s.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-app-text">{s.title}</div>
                <div className="text-xs text-app-text-secondary mt-0.5">{s.description}</div>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 mt-1 inline-block capitalize">
                  {s.season}
                </span>
              </div>
              <button
                onClick={() => router.push(`/app/gigs/new?home_id=${homeId}&title=${encodeURIComponent(s.title)}`)}
                className="text-[10px] font-medium px-2 py-1 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition flex-shrink-0"
              >
                Hire Help
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Scheduled */}
      {subTab === 'scheduled' && (
        <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
          {scheduled.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="mb-2"><Calendar className="w-8 h-8 mx-auto text-app-text-muted" /></div>
              <p className="text-sm text-app-text-secondary">No scheduled maintenance</p>
            </div>
          ) : (
            scheduled.map((issue) => (
              <div
                key={issue.id}
                onClick={() => onViewIssue(issue)}
                className="px-4 py-3 flex items-center gap-3 hover:bg-app-hover/50 transition cursor-pointer"
              >
                <Wrench className="w-5 h-5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-app-text">{issue.title}</div>
                  <div className="text-xs text-app-text-secondary mt-0.5">
                    {issue.scheduled_at && new Date(issue.scheduled_at).toLocaleDateString()}
                  </div>
                </div>
                {issue.visibility && <VisibilityChip visibility={issue.visibility} />}
              </div>
            ))
          )}
        </div>
      )}

      {/* History */}
      {subTab === 'history' && (
        <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
          {history.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="mb-2"><ClipboardList className="w-8 h-8 mx-auto text-app-text-muted" /></div>
              <p className="text-sm text-app-text-secondary">No maintenance history</p>
            </div>
          ) : (
            history.map((issue) => (
              <div
                key={issue.id}
                onClick={() => onViewIssue(issue)}
                className="px-4 py-3 flex items-center gap-3 hover:bg-app-hover/50 transition cursor-pointer"
              >
                <span className="flex-shrink-0">{issue.status === 'resolved' ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-app-text-strong">{issue.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-app-text-muted">{issue.updated_at && new Date(issue.updated_at).toLocaleDateString()}</span>
                    {issue.estimated_cost && <span className="text-xs text-app-text-muted">${Number(issue.estimated_cost).toFixed(0)}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Providers */}
      {subTab === 'providers' && (
        <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
          {loadingVendors ? (
            <div className="px-5 py-8 text-center text-sm text-app-text-muted">Loading vendors…</div>
          ) : vendors.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="mb-2"><Building className="w-8 h-8 mx-auto text-app-text-muted" /></div>
              <p className="text-sm text-app-text-secondary">No vendors yet</p>
            </div>
          ) : (
            vendors.map((v) => (
              <div key={v.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xs flex-shrink-0">
                  {(v.name || 'V')[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-app-text">{v.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {v.service_category && <span className="text-[10px] text-app-text-secondary">{v.service_category}</span>}
                    {v.phone && <span className="text-[10px] text-app-text-muted">{v.phone}</span>}
                    {v.rating && <span className="text-[10px] text-yellow-500">{'★'.repeat(v.rating)}</span>}
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/app/gigs/new?home_id=${homeId}&vendor=${encodeURIComponent(v.name)}`)}
                  className="text-[10px] font-medium px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex-shrink-0"
                >
                  Hire
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
