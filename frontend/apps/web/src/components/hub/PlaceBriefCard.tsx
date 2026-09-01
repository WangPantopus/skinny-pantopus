'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import {
  AlertTriangle,
  CloudRain,
  Wind,
  Leaf,
  Users,
  Home,
  MapPin,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Plus,
  Send,
  Briefcase,
} from 'lucide-react';
import type { NeighborhoodPulse, PulseSignal } from '@pantopus/types';

interface PlaceBriefCardProps {
  homeId: string;
  homeName?: string;
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtValue(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function fmtSqft(sqft: number): string {
  return `${sqft.toLocaleString()} sqft`;
}

// ── Signal icon + color helpers ─────────────────────────────────────────────

function signalIcon(signal: PulseSignal) {
  const cls = 'w-3.5 h-3.5 flex-shrink-0';
  switch (signal.signal_type) {
    case 'air_quality':
      return <Wind className={`${cls} ${colorToTextClass(signal.color)}`} />;
    case 'weather':
      return <CloudRain className={`${cls} ${colorToTextClass(signal.color)}`} />;
    case 'seasonal_suggestion':
      return <Leaf className={`${cls} ${colorToTextClass(signal.color)}`} />;
    case 'community':
      return <Users className={`${cls} ${colorToTextClass(signal.color)}`} />;
    case 'local_services':
      return <Briefcase className={`${cls} ${colorToTextClass(signal.color)}`} />;
    default:
      return <Sparkles className={`${cls} text-violet-400`} />;
  }
}

function colorToTextClass(color: string) {
  switch (color) {
    case 'green': return 'text-green-500';
    case 'amber': return 'text-amber-500';
    case 'red': return 'text-red-500';
    case 'blue': return 'text-blue-500';
    default: return 'text-gray-400 dark:text-gray-500';
  }
}

function colorToBgClass(color: string) {
  switch (color) {
    case 'green': return 'bg-green-50 dark:bg-green-900/20';
    case 'amber': return 'bg-amber-50 dark:bg-amber-900/20';
    case 'red': return 'bg-red-50 dark:bg-red-900/20';
    case 'blue': return 'bg-blue-50 dark:bg-blue-900/20';
    default: return 'bg-gray-50 dark:bg-gray-800';
  }
}

function statusGradient(status: string) {
  switch (status) {
    case 'alert': return 'from-red-50/80 to-white dark:from-red-900/20 dark:to-gray-900 border-red-200 dark:border-red-800';
    case 'advisory': return 'from-amber-50/80 to-white dark:from-amber-900/20 dark:to-gray-900 border-amber-200 dark:border-amber-800';
    case 'active': return 'from-violet-50/60 to-white dark:from-violet-900/20 dark:to-gray-900 border-violet-200 dark:border-violet-800';
    default: return 'from-green-50/60 to-white dark:from-green-900/20 dark:to-gray-900 border-green-200 dark:border-green-800';
  }
}

function statusIconBg(status: string) {
  switch (status) {
    case 'alert': return 'bg-red-100 dark:bg-red-900/30';
    case 'advisory': return 'bg-amber-100 dark:bg-amber-900/30';
    case 'active': return 'bg-violet-100 dark:bg-violet-900/30';
    default: return 'bg-green-100 dark:bg-green-900/30';
  }
}

function statusIconColor(status: string) {
  switch (status) {
    case 'alert': return 'text-red-600';
    case 'advisory': return 'text-amber-600';
    case 'active': return 'text-violet-600';
    default: return 'text-green-600';
  }
}

function StatusIcon({ status }: { status: string }) {
  const cls = `w-4 h-4 ${statusIconColor(status)}`;
  switch (status) {
    case 'alert': return <AlertTriangle className={cls} />;
    case 'advisory': return <AlertTriangle className={cls} />;
    default: return <Sparkles className={cls} />;
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function PlaceBriefCard({ homeId, homeName }: PlaceBriefCardProps) {
  const router = useRouter();
  const [pulse, setPulse] = useState<NeighborhoodPulse['pulse'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.ai.getNeighborhoodPulse(homeId);
      setPulse(result.pulse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (homeId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId]);

  // Fade-in on first load
  useEffect(() => {
    if (!loading && pulse) {
      requestAnimationFrame(() => setVisible(true));
    }
  }, [loading, pulse]);

  // ── Loading skeleton ──────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface p-4 animate-pulse space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-app-surface-sunken" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 bg-app-surface-sunken rounded w-40" />
            <div className="h-3 bg-app-surface-sunken rounded w-64" />
          </div>
        </div>
        <div className="h-3 bg-app-surface-sunken rounded w-full mt-1" />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Neighborhood pulse unavailable</span>
          </div>
          <button onClick={load} className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!pulse) return null;

  const signalCount = pulse.signals.length;
  const status = pulse.overall_status;
  const toggleExpanded = () => setExpanded((current) => !current);

  return (
    <div
      ref={cardRef}
      className={`rounded-xl border overflow-hidden bg-gradient-to-r ${statusGradient(status)} transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* ── Header (collapsed) ─────────────────────────────────── */}
      <div
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <button
          type="button"
          aria-expanded={expanded}
          onClick={toggleExpanded}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${statusIconBg(status)}`}
          >
            <StatusIcon status={status} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {pulse.greeting}{homeName ? ` — ${homeName}` : ''}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
              {pulse.summary}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {signalCount > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300">
              {signalCount} update{signalCount !== 1 ? 's' : ''}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); load(); }}
            className="p-1 rounded hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors cursor-pointer inline-flex"
            aria-label="Refresh neighborhood pulse"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          </button>
          <button
            type="button"
            aria-label={expanded ? 'Collapse neighborhood pulse' : 'Expand neighborhood pulse'}
            aria-expanded={expanded}
            onClick={toggleExpanded}
            className="p-1 rounded hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors inline-flex"
          >
            {expanded
              ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            }
          </button>
        </div>
      </div>

      {/* ── Expanded body ──────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">

          {/* Property snapshot */}
          {pulse.property && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <Home className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span>
                {[
                  pulse.property.year_built,
                  pulse.property.sqft ? fmtSqft(pulse.property.sqft) : null,
                  pulse.property.estimated_value
                    ? `Est. ${fmtValue(pulse.property.estimated_value)}`
                    : null,
                ].filter(Boolean).join(' · ')}
              </span>
              {pulse.property.zip_median_value && (
                <span className="text-gray-400">
                  · Area median {fmtValue(pulse.property.zip_median_value)}
                </span>
              )}
            </div>
          )}

          {/* Neighborhood context */}
          {pulse.neighborhood && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span>
                {[
                  pulse.neighborhood.walk_score != null ? `Walk Score: ${pulse.neighborhood.walk_score}` : null,
                  pulse.neighborhood.median_household_income != null
                    ? `Median income: ${fmtValue(pulse.neighborhood.median_household_income)}`
                    : null,
                  pulse.neighborhood.flood_zone
                    ? `Flood zone: ${pulse.neighborhood.flood_zone} (${(pulse.neighborhood.flood_zone_description || '').toLowerCase()})`
                    : null,
                ].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}

          {/* Signal list */}
          <div className="space-y-2">
            {pulse.signals.map((signal, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg px-2.5 py-2 ${colorToBgClass(signal.color)}`}>
                <div className="mt-0.5">{signalIcon(signal)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{signal.title}</p>
                  {signal.detail && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {signal.detail}
                    </p>
                  )}
                </div>
                {signal.actions && signal.actions.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0 mt-0.5">
                    {signal.actions.map((action, j) => (
                      <button
                        key={j}
                        onClick={(e) => {
                          e.stopPropagation();
                          const prefill: Record<string, string> = {};
                          if (signal.signal_type === 'seasonal_suggestion') {
                            const nudge = pulse.seasonal_context?.first_action_nudge;
                            if (nudge?.gig_title) prefill.title = nudge.gig_title;
                            if (nudge?.gig_category) prefill.category = nudge.gig_category;
                            if (nudge?.prompt) prefill.description = nudge.prompt;
                          }
                          const qs = Object.keys(prefill).length > 0
                            ? `?prefill=${encodeURIComponent(JSON.stringify(prefill))}`
                            : '';
                          router.push(`/app/gigs/new${qs}`);
                        }}
                        className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition whitespace-nowrap"
                      >
                        {action.label.length > 30 ? 'Post a gig' : action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Seasonal tip */}
          {pulse.seasonal_context.tip && (
            <div className="bg-amber-50/50 dark:bg-amber-900/20 rounded-lg px-3 py-2 border border-amber-100 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <Leaf className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                  {pulse.seasonal_context.tip}
                </p>
              </div>
            </div>
          )}

          {/* Community density + first-action CTA */}
          {pulse.community_density.neighbor_count === 0 && (
            <div className="bg-violet-50/50 dark:bg-violet-900/20 rounded-lg px-3 py-3 border border-violet-100 dark:border-violet-800">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-3.5 h-3.5 text-violet-500" />
                <p className="text-xs text-violet-700 dark:text-violet-300 font-medium">
                  {pulse.community_density.density_message}
                </p>
              </div>
              <div className="flex gap-2">
                {pulse.seasonal_context?.first_action_nudge && (
                  <button
                    onClick={() => {
                      const nudge = pulse.seasonal_context?.first_action_nudge;
                      const prefill: Record<string, string> = {};
                      if (nudge?.gig_title) prefill.title = nudge.gig_title;
                      if (nudge?.gig_category) prefill.category = nudge.gig_category;
                      if (nudge?.prompt) prefill.description = nudge.prompt;
                      const qs = Object.keys(prefill).length > 0
                        ? `?prefill=${encodeURIComponent(JSON.stringify(prefill))}`
                        : '';
                      router.push(`/app/gigs/new${qs}`);
                    }}
                    className="flex items-center gap-1.5 py-2 px-4 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition shadow-sm shadow-primary-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    Post your first gig
                  </button>
                )}
                <button
                  onClick={async () => {
                    const msg = "I'm using Pantopus to connect with my neighborhood. Check out what's happening near your home: https://pantopus.com";
                    const nav = typeof window !== 'undefined' ? window.navigator : null;
                    if (nav && typeof nav.share === 'function') {
                      try { await nav.share({ title: 'Join Pantopus', text: msg, url: 'https://pantopus.com' }); } catch { /* cancelled */ }
                    } else if (nav?.clipboard) {
                      try { await nav.clipboard.writeText('https://pantopus.com'); } catch { /* fallback */ }
                    }
                  }}
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-white dark:bg-gray-800 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700 rounded-lg text-xs font-medium hover:bg-violet-50 dark:hover:bg-violet-900/20 transition"
                >
                  <Send className="w-3 h-3" />
                  Invite a neighbor
                </button>
              </div>
            </div>
          )}

          {/* Source footer */}
          {pulse.sources.length > 0 && (
            <div className="flex items-center gap-3 pt-1">
              {pulse.sources.map((src, i) => (
                <span key={i} className="text-[9px] text-gray-400 dark:text-gray-500">
                  {src.provider}
                  {src.updated_at && (
                    <> · {new Date(src.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
