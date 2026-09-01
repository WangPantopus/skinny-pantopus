'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  Wind,
  Thermometer,
  AlertTriangle,
  CreditCard,
  Wrench,
  Calendar,
  Mail,
  Briefcase,
  Leaf,
  MapPin,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import type { HubToday } from '@pantopus/types';

interface HubTodayCardProps {
  today: HubToday | null;
  loading: boolean;
}

// ── Weather icon ────────────────────────────────────────────────

function WeatherIcon({ code, className }: { code: string; className?: string }) {
  const cls = className || 'w-7 h-7 text-blue-500 dark:text-blue-400';
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
  const cls = className || 'w-3.5 h-3.5';
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

// ── Urgency color classes ───────────────────────────────────────

const URGENCY_BG: Record<string, string> = {
  critical: 'bg-red-100 dark:bg-red-900/30',
  high: 'bg-orange-100 dark:bg-orange-900/30',
  medium: 'bg-amber-100 dark:bg-amber-900/30',
  low: 'bg-blue-100 dark:bg-blue-900/30',
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

// ── Component ───────────────────────────────────────────────────

export function HubTodayCard({ today, loading }: HubTodayCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-xl border border-app bg-surface dark:bg-surface-dark p-4 animate-pulse space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-muted dark:bg-gray-700" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 bg-surface-muted dark:bg-gray-700 rounded w-32" />
            <div className="h-3 bg-surface-muted dark:bg-gray-700 rounded w-56" />
          </div>
        </div>
      </div>
    );
  }

  if (!today || today.display_mode === 'hidden') return null;

  const { weather, aqi, alerts, signals, seasonal, location, summary, display_mode } = today;
  const minimalSummary = summary.trim() || weather?.condition_label || 'View details';

  // ── MINIMAL ───────────────────────────────────────────────
  if (display_mode === 'minimal') {
    return (
      <button
        onClick={() => router.push('/app/hub/today')}
        className="w-full rounded-xl border border-app bg-surface dark:bg-surface-dark px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-left"
      >
        {weather && <WeatherIcon code={weather.condition_code} className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0" />}
        {weather?.current_temp_f != null && (
          <span className="text-base font-bold text-gray-900 dark:text-white">{weather.current_temp_f}°</span>
        )}
        <span className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">{minimalSummary}</span>
      </button>
    );
  }

  // ── REDUCED + FULL ────────────────────────────────────────
  const showAlerts = display_mode === 'full' && alerts.length > 0;
  const showSignals = display_mode === 'full' && signals.length > 0;
  const showSeasonal = display_mode === 'full' && seasonal?.tip;
  const showActions = display_mode === 'full' && today.actions.length > 0;

  return (
    <div className="rounded-xl border border-app bg-surface dark:bg-surface-dark overflow-hidden">
      {/* Header */}
      <div
        role={display_mode === 'full' ? 'button' : undefined}
        tabIndex={display_mode === 'full' ? 0 : undefined}
        onClick={display_mode === 'full' ? () => setExpanded(!expanded) : undefined}
        className={`w-full flex items-center justify-between px-4 pt-3 pb-1 text-left ${display_mode === 'full' ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
          <MapPin className="w-3 h-3" />
          <span>{location.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{freshnessLabel(today.fetched_at)}</span>
          {display_mode === 'full' && (
            expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
              : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Main row: weather + summary */}
      <div className="flex items-center gap-3 px-4 py-2">
        {weather && (
          <div className="flex flex-col items-center gap-0.5 flex-shrink-0 min-w-[56px]">
            <WeatherIcon code={weather.condition_code} />
            {weather.current_temp_f != null && (
              <span className="text-xl font-bold text-gray-900 dark:text-white">{weather.current_temp_f}°</span>
            )}
            {weather.high_f != null && weather.low_f != null && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                H:{weather.high_f}° L:{weather.low_f}°
              </span>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{summary}</p>
          {weather && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{weather.condition_label}</p>
          )}
        </div>
      </div>

      {/* AQI chip (reduced + full) */}
      {aqi?.is_noteworthy && (
        <div className="mx-4 mb-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20">
          <Wind className="w-3 h-3 text-orange-500 dark:text-orange-400" />
          <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-400">
            AQI {aqi.index} — {aqi.category}
          </span>
        </div>
      )}

      {/* Expanded content (full mode only, toggled) */}
      {display_mode === 'full' && expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700/50 pt-3 space-y-2.5">

          {/* Alert banners */}
          {showAlerts && alerts.map((alert) => (
            <div key={alert.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-400">{alert.title}</span>
            </div>
          ))}

          {/* Signal list (up to 5) */}
          {showSignals && (
            <div className="space-y-1.5">
              {signals.slice(0, 5).map((signal, i) => {
                const bg = URGENCY_BG[signal.urgency] || URGENCY_BG.low;
                const text = URGENCY_TEXT[signal.urgency] || URGENCY_TEXT.low;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (signal.action) router.push(signal.action.route);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg ${bg} text-left transition hover:opacity-80`}
                  >
                    <SignalIcon kind={signal.kind} className={`w-3.5 h-3.5 ${text} flex-shrink-0`} />
                    <span className={`text-xs font-medium ${text} truncate`}>{signal.label}</span>
                    {signal.action && (
                      <span className={`text-[10px] ${text} opacity-70 ml-auto flex-shrink-0`}>{signal.action.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Seasonal tip */}
          {showSeasonal && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30">
              <Leaf className="w-3.5 h-3.5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-green-800 dark:text-green-400 leading-relaxed">{seasonal!.tip}</p>
            </div>
          )}

          {/* Action buttons */}
          {showActions && (
            <div className="flex gap-2 pt-1">
              {today.actions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => router.push(action.route)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-app text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
