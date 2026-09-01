'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ChangeLocationModal from '@/components/hub/ChangeLocationModal';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Calendar,
  Cloud,
  CloudDrizzle,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CreditCard,
  Droplets,
  Leaf,
  Mail,
  MapPin,
  RefreshCw,
  Sparkles,
  Sun,
  Thermometer,
  Wind,
  Wrench,
} from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import type { HubToday } from '@pantopus/types';

// ── Icon helpers ─────────────────────────────────────────────────

function WeatherIcon({ code, className }: { code: string; className?: string }) {
  const cls = className || 'w-12 h-12 text-blue-500 dark:text-blue-400';
  const c = (code || '').toLowerCase();
  if (c.includes('clear') || c === 'hot' || c.includes('mostly_clear')) return <Sun className={cls} />;
  if (c.includes('heavy_rain') || c.includes('violent')) return <CloudRain className={cls} />;
  if (c.includes('rain') || c.includes('shower')) return <CloudRain className={cls} />;
  if (c.includes('drizzle')) return <CloudDrizzle className={cls} />;
  if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard') || c.includes('sleet') || c.includes('freezing') || c === 'frigid') return <CloudSnow className={cls} />;
  if (c.includes('thunder') || c.includes('storm')) return <CloudLightning className={cls} />;
  if (c.includes('wind') || c.includes('breez')) return <Wind className={cls} />;
  if (c.includes('cloudy') || c.includes('overcast') || c.includes('fog') || c.includes('haze') || c.includes('smoke') || c.includes('dust')) return <Cloud className={cls} />;
  return <Sun className={cls} />;
}

function SignalIcon({ kind, className }: { kind: string; className?: string }) {
  const cls = className || 'w-4 h-4';
  switch (kind) {
    case 'alert': return <AlertTriangle className={cls} />;
    case 'weather': return <Sun className={cls} />;
    case 'precipitation': return <CloudRain className={cls} />;
    case 'aqi': return <Wind className={cls} />;
    case 'temperature': return <Thermometer className={cls} />;
    case 'bill_due': return <CreditCard className={cls} />;
    case 'task_due': return <Wrench className={cls} />;
    case 'calendar': return <Calendar className={cls} />;
    case 'mail': return <Mail className={cls} />;
    case 'gig': return <Briefcase className={cls} />;
    case 'seasonal': return <Leaf className={cls} />;
    case 'local_update': return <Sparkles className={cls} />;
    default: return <Sparkles className={cls} />;
  }
}

const URGENCY_BG: Record<string, string> = {
  critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40',
  high: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40',
  medium: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40',
  low: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40',
};

const URGENCY_TEXT: Record<string, string> = {
  critical: 'text-red-700 dark:text-red-400',
  high: 'text-orange-700 dark:text-orange-400',
  medium: 'text-amber-700 dark:text-amber-400',
  low: 'text-blue-700 dark:text-blue-400',
};

function freshnessLabel(fetchedAt: string): string {
  const mins = Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

// ── Page ─────────────────────────────────────────────────────────

export default function HubTodayPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (!getAuthToken()) router.replace('/login?redirectTo=%2Fapp%2Fhub%2Ftoday');
  }, [router, mounted]);

  const hasToken = mounted && !!getAuthToken();

  const query = useQuery<HubToday | null>({
    queryKey: queryKeys.hubToday(),
    queryFn: () => api.hub.getHubToday({ retries: 1, retryDelayMs: 800 }),
    staleTime: 120_000,
    enabled: hasToken,
  });

  const today = query.data ?? null;
  const loading = !mounted || (query.isPending && hasToken);
  const error = query.error instanceof Error ? query.error.message : '';

  return (
    <div className="min-h-screen bg-app pb-16">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-1.5 hover:bg-app-hover rounded-lg transition"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-app-text" />
            </button>
            <h1 className="text-xl font-bold text-app-text">Today</h1>
          </div>
          <button
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="flex items-center gap-1.5 text-sm text-app-text-secondary hover:text-app-text transition disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="rounded-2xl border border-app bg-surface dark:bg-surface-dark p-6 animate-pulse space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-surface-muted dark:bg-gray-700" />
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-surface-muted dark:bg-gray-700 rounded w-24" />
                <div className="h-3 bg-surface-muted dark:bg-gray-700 rounded w-40" />
              </div>
            </div>
            <div className="h-4 bg-surface-muted dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-surface-muted dark:bg-gray-700 rounded w-5/6" />
            <div className="h-20 bg-surface-muted dark:bg-gray-700 rounded" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{error || 'Could not load today’s briefing'}</span>
            </div>
            <button
              onClick={() => query.refetch()}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && (!today || today.display_mode === 'hidden') && (
          <div className="rounded-xl border border-app bg-surface dark:bg-surface-dark p-8 text-center">
            <p className="text-sm text-app-text-secondary">No briefing available right now.</p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && today && today.display_mode !== 'hidden' && (
          <div className="space-y-4">
            {/* Main card */}
            <div className="rounded-2xl border border-app bg-surface dark:bg-surface-dark overflow-hidden">
              {/* Location + freshness */}
              <div className="flex items-center justify-between px-5 pt-4">
                <div className="flex items-center gap-1.5 text-xs text-app-text-muted">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate">{today.location.label}</span>
                </div>
                <span className="text-[11px] text-app-text-muted">
                  Updated {freshnessLabel(today.fetched_at)}
                </span>
              </div>

              {/* Weather panel */}
              {today.weather && (
                <div className="flex items-center gap-5 px-5 py-4">
                  <WeatherIcon code={today.weather.condition_code} />
                  <div className="flex-1 min-w-0">
                    {today.weather.current_temp_f != null && (
                      <div className="text-4xl font-bold text-gray-900 dark:text-white leading-none">
                        {today.weather.current_temp_f}°
                      </div>
                    )}
                    <div className="text-sm text-app-text-secondary mt-1">
                      {today.weather.condition_label}
                    </div>
                    {(today.weather.high_f != null && today.weather.low_f != null) && (
                      <div className="text-xs text-app-text-muted mt-0.5">
                        H {today.weather.high_f}° · L {today.weather.low_f}°
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Precipitation outlook */}
              {today.weather?.precipitation_next_6h && (
                <div className="mx-5 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <Droplets className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-blue-700 dark:text-blue-400">
                    Precipitation expected in the next 6 hours
                    {today.weather.precipitation_start_at && (
                      <> — around {new Date(today.weather.precipitation_start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</>
                    )}
                  </span>
                </div>
              )}

              {/* Summary */}
              {today.summary && (
                <p className="px-5 pb-4 text-[15px] leading-relaxed text-app-text">
                  {today.summary}
                </p>
              )}

              {/* AQI */}
              {today.aqi?.is_noteworthy && (
                <div className="mx-5 mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <Wind className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                  <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                    AQI {today.aqi.index} — {today.aqi.category}
                  </span>
                </div>
              )}

              {/* Actions */}
              {today.actions.length > 0 && (
                <div className="border-t border-app-border/50 px-5 py-3 flex flex-wrap gap-2">
                  {today.actions.map((action, i) => {
                    const isChangeLocation = action.route === '/app/location';
                    const isViewDetails = action.route === '/app/hub/today';
                    if (isViewDetails) return null; // already on this page
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (isChangeLocation) {
                            setShowLocationPicker(true);
                          } else {
                            router.push(action.route);
                          }
                        }}
                        className="text-sm font-semibold px-3.5 py-2 rounded-lg border border-app text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition"
                      >
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Alerts */}
            {today.alerts.length > 0 && (
              <div className="space-y-2">
                {today.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                        {alert.title}
                      </div>
                      {(alert.starts_at || alert.ends_at) && (
                        <div className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">
                          {alert.starts_at && new Date(alert.starts_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          {alert.ends_at && <> – {new Date(alert.ends_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Seasonal tip */}
            {today.seasonal?.tip && (
              <div className="flex items-start gap-2.5 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
                <Leaf className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 dark:text-green-400 leading-relaxed">
                  {today.seasonal.tip}
                </p>
              </div>
            )}

            {/* Signals */}
            {today.signals.length > 0 && (
              <div className="rounded-2xl border border-app bg-surface dark:bg-surface-dark p-5">
                <h2 className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-3">
                  Signals
                </h2>
                <div className="space-y-2">
                  {today.signals.map((signal, i) => {
                    const bg = URGENCY_BG[signal.urgency] || URGENCY_BG.low;
                    const text = URGENCY_TEXT[signal.urgency] || URGENCY_TEXT.low;
                    const body = (
                      <>
                        <div className={`mt-0.5 ${text}`}>
                          <SignalIcon kind={signal.kind} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold ${text}`}>
                            {signal.label}
                          </div>
                          {signal.detail && (
                            <div className="text-xs text-app-text-secondary mt-1 leading-relaxed">
                              {signal.detail}
                            </div>
                          )}
                        </div>
                        {signal.action && (
                          <span className={`text-[11px] font-semibold ${text} opacity-80 flex-shrink-0 mt-1 whitespace-nowrap`}>
                            {signal.action.label} →
                          </span>
                        )}
                      </>
                    );
                    const baseCls = `w-full flex items-start gap-3 px-3.5 py-3 rounded-xl border ${bg} text-left`;
                    return signal.action ? (
                      <button
                        key={i}
                        onClick={() => router.push(signal.action!.route)}
                        className={`${baseCls} hover:opacity-80 transition`}
                      >
                        {body}
                      </button>
                    ) : (
                      <div key={i} className={baseCls}>
                        {body}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Meta footer */}
            {today.meta.providers_used.length > 0 && (
              <div className="text-[11px] text-app-text-muted px-1">
                Sources: {today.meta.providers_used.join(', ')}
                {today.meta.partial_failures.length > 0 && (
                  <> · Some data unavailable: {today.meta.partial_failures.join(', ')}</>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showLocationPicker && (
        <ChangeLocationModal
          onClose={() => setShowLocationPicker(false)}
          onLocationChanged={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.hubToday() });
            queryClient.invalidateQueries({ queryKey: queryKeys.hub() });
          }}
        />
      )}
    </div>
  );
}
