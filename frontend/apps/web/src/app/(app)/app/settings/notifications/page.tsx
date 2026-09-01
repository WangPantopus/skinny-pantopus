'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import {
  ArrowLeft, Sun, Clock, CloudLightning, Wind, Home, Briefcase, Mail,
  Moon, Navigation, Smartphone, Check,
} from 'lucide-react';
import type { UserNotificationPreferences } from '@pantopus/types';

type Prefs = UserNotificationPreferences;

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00',
];

const EVENING_TIME_OPTIONS = [
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',
];

const LOCATION_MODES = [
  { value: 'primary_home', label: 'Primary Home', icon: Home },
  { value: 'viewing_location', label: 'Current Viewing Location', icon: Navigation },
  { value: 'device_location', label: 'Device Location', icon: Smartphone },
] as const;

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPrefs = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) { router.replace('/login'); return; }
      const res = await api.getHubPreferences();
      setPrefs(res.preferences);
    } catch (err: any) {
      setError(err?.message || 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => prev ? { ...prev, ...patch } : prev);
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await api.updateHubPreferences(patch);
        setSaveStatus('saved');
        statusTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('error');
        fetchPrefs();
      }
    }, 600);
  }, [fetchPrefs]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-app">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-surface-muted rounded w-64" />
            <div className="h-48 bg-surface-muted rounded-xl" />
            <div className="h-48 bg-surface-muted rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error || !prefs) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Something went wrong'}</p>
          <button onClick={() => { setLoading(true); setError(''); fetchPrefs(); }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notification Preferences</h1>
          {saveStatus === 'saving' && <span className="text-xs text-gray-400">Saving...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-green-500">Saved</span>}
          {saveStatus === 'error' && <span className="text-xs text-red-500">Failed to save</span>}
        </div>

        {/* 1. Briefings */}
        <Section title="Briefings">
          <BriefingRow
            icon={<Sun className="w-5 h-5" />}
            title="Morning Briefing"
            subtitle="Current weather plus the most relevant thing for today"
            enabled={prefs.daily_briefing_enabled}
            selectedTime={prefs.daily_briefing_time_local}
            timeOptions={TIME_OPTIONS}
            onToggle={(value) => update({ daily_briefing_enabled: value })}
            onSelectTime={(value) => update({ daily_briefing_time_local: value })}
          />
          <BriefingRow
            icon={<Moon className="w-5 h-5" />}
            title="Evening Briefing"
            subtitle="Tomorrow's forecast plus one useful thing to handle tonight"
            enabled={prefs.evening_briefing_enabled}
            selectedTime={prefs.evening_briefing_time_local}
            timeOptions={EVENING_TIME_OPTIONS}
            onToggle={(value) => update({ evening_briefing_enabled: value })}
            onSelectTime={(value) => update({ evening_briefing_time_local: value })}
            last
          />
        </Section>

        {/* 2. Alert Preferences */}
        <Section title="Alert Preferences">
          <ToggleRow icon={<CloudLightning className="w-5 h-5" />}
            title="Weather Alerts" subtitle="Severe weather and storm warnings"
            value={prefs.weather_alerts_enabled} onChange={(v) => update({ weather_alerts_enabled: v })} />
          <ToggleRow icon={<Wind className="w-5 h-5" />}
            title="Air Quality Alerts" subtitle="Unhealthy AQI notifications"
            value={prefs.aqi_alerts_enabled} onChange={(v) => update({ aqi_alerts_enabled: v })} />
          <ToggleRow icon={<Home className="w-5 h-5" />}
            title="Home Reminders" subtitle="Bills, tasks, and calendar events"
            value={prefs.home_reminders_enabled} onChange={(v) => update({ home_reminders_enabled: v })} />
          <ToggleRow icon={<Briefcase className="w-5 h-5" />}
            title="Gig Updates" subtitle="Active gig status changes"
            value={prefs.gig_updates_enabled} onChange={(v) => update({ gig_updates_enabled: v })} />
          <ToggleRow icon={<Mail className="w-5 h-5" />}
            title="Mail Summary" subtitle="Daily mailbox digest"
            value={prefs.mail_summary_enabled} onChange={(v) => update({ mail_summary_enabled: v })} last />
        </Section>

        {/* 3. Quiet Hours */}
        <Section title="Quiet Hours">
          <ToggleRow icon={<Moon className="w-5 h-5" />}
            title="Quiet Hours" subtitle="Silence briefings during set hours"
            value={prefs.quiet_hours_start_local != null}
            onChange={(v) => {
              if (v) update({ quiet_hours_start_local: '22:00', quiet_hours_end_local: '07:00' });
              else update({ quiet_hours_start_local: null, quiet_hours_end_local: null });
            }} />
          {prefs.quiet_hours_start_local != null && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700/50 pt-3 flex items-center justify-center gap-6">
              <div className="text-center">
                <span className="text-xs text-gray-400">From</span>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{prefs.quiet_hours_start_local}</p>
              </div>
              <span className="text-gray-300 dark:text-gray-600">→</span>
              <div className="text-center">
                <span className="text-xs text-gray-400">Until</span>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{prefs.quiet_hours_end_local}</p>
              </div>
            </div>
          )}
        </Section>

        {/* 4. Briefing Location */}
        <Section title="Briefing Location">
          {LOCATION_MODES.map((mode, i) => {
            const active = prefs.location_mode === mode.value;
            const Icon = mode.icon;
            const last = i === LOCATION_MODES.length - 1;
            return (
              <button key={mode.value} onClick={() => update({ location_mode: mode.value as Prefs['location_mode'] })}
                className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  !last ? 'border-b border-gray-100 dark:border-gray-700/50' : ''
                }`}>
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {mode.label}
                  </span>
                </div>
                {active && <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
              </button>
            );
          })}
        </Section>
      </div>
    </div>
  );
}

// ── Section wrapper ─────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
        {title}
      </h2>
      <div className="rounded-xl border border-app bg-surface dark:bg-surface-dark overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ── Toggle row ──────────────────────────────────────────────────

function ToggleRow({ icon, title, subtitle, value, onChange, last }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${!last ? 'border-b border-gray-100 dark:border-gray-700/50' : ''}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="text-gray-400 dark:text-gray-500 flex-shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <button onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          value ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </div>
  );
}

function BriefingRow({
  icon,
  title,
  subtitle,
  enabled,
  selectedTime,
  timeOptions,
  onToggle,
  onSelectTime,
  last,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  enabled: boolean;
  selectedTime: string;
  timeOptions: string[];
  onToggle: (value: boolean) => void;
  onSelectTime: (value: string) => void;
  last?: boolean;
}) {
  return (
    <>
      <ToggleRow
        icon={icon}
        title={title}
        subtitle={subtitle}
        value={enabled}
        onChange={onToggle}
        last={!enabled && last}
      />
      {enabled && (
        <div className={`px-4 pb-4 border-t border-gray-100 dark:border-gray-700/50 pt-3 ${last ? '' : 'border-b border-gray-100 dark:border-gray-700/50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Briefing Time</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {timeOptions.map((timeValue) => {
              const active = selectedTime === timeValue;
              return (
                <button
                  key={timeValue}
                  onClick={() => onSelectTime(timeValue)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                    active
                      ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {timeValue}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
