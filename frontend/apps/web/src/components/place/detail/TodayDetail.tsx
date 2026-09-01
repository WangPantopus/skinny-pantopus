// ============================================================
// Place — Today / Environment detail (C3).
// Current conditions + hourly + 5-day, AQI with its scale and plain
// meaning, NWS alerts (list or "no active alerts"), and the sun arc.
// Post-v1 rows (pollen, trash, outages) render as "coming soon".
// Everything reads from the `today` group of the PlaceIntelligence
// contract and degrades section-by-section.
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import type {
  PlaceIntelligence,
  PlaceWeatherData,
  PlaceWeatherDay,
  PlaceAirQualityData,
  PlaceAlertsData,
  PlaceWeatherAlert,
  PlaceSunriseSunsetData,
  WeatherConditionCode,
  AirQualityCategory,
} from '@pantopus/types';
import {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudFog,
  CloudHail,
  CloudLightning,
  Wind,
  Sunrise,
  Sunset,
  Check,
  Flower2,
  Trash2,
  ZapOff,
} from 'lucide-react';
import { SectionCard, DetailHeader, DetailSectionLabel, SourceNote, ComingSoonRow } from '@/components/archetypes/place';
import { findPlaceSection, detailAddress } from './sections';
import { fmtTime, statusToState } from './format';

// ── Weather glyphs — condition → lucide icon + token tint ────
// sun amber == app-warning; rain/snow == sky primary; rest == muted.
const WX: Record<WeatherConditionCode, { icon: LucideIcon; tint: string }> = {
  clear: { icon: Sun, tint: 'text-app-warning' },
  partly_cloudy: { icon: CloudSun, tint: 'text-app-text-muted' },
  cloudy: { icon: Cloud, tint: 'text-app-text-muted' },
  fog: { icon: CloudFog, tint: 'text-app-text-muted' },
  rain: { icon: CloudRain, tint: 'text-primary-500' },
  snow: { icon: CloudSnow, tint: 'text-primary-400' },
  sleet: { icon: CloudHail, tint: 'text-primary-500' },
  thunderstorm: { icon: CloudLightning, tint: 'text-app-warning' },
  wind: { icon: Wind, tint: 'text-app-text-muted' },
};

function WxGlyph({ code, size = 22 }: { code: WeatherConditionCode; size?: number }) {
  const w = WX[code] ?? WX.cloudy;
  const Icon = w.icon;
  return <Icon size={size} strokeWidth={2} className={w.tint} />;
}

function fmtHour(iso: string, isNow: boolean): string {
  if (isNow) return 'Now';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const suffix = h >= 12 ? 'p' : 'a';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}${suffix}`;
}

function fmtDay(iso: string, isToday: boolean): string {
  if (isToday) return 'Today';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

// ── Now / current conditions ────────────────────────────────
function NowCard({ data }: { data: PlaceWeatherData }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] font-semibold text-app-text-secondary">Now</div>
          <div className="flex items-start gap-0.5 mt-0.5">
            <span className="text-[56px] font-light leading-[60px] -tracking-[0.03em] text-app-text">{Math.round(data.current_temp_f)}</span>
            <span className="text-[24px] font-light text-app-text mt-1.5">°</span>
          </div>
          {data.condition_label ? (
            <div className="text-[15px] font-semibold text-app-text-strong mt-0.5">{data.condition_label}</div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2.5">
          <span className="w-[54px] h-[54px] rounded-[15px] bg-app-warning-bg border border-app-warning-light flex items-center justify-center">
            <WxGlyph code={data.condition_code} size={30} />
          </span>
          <div className="text-right text-[13.5px] text-app-text-secondary leading-[19px]">
            {data.high_f != null && data.low_f != null ? <div>H {Math.round(data.high_f)}° · L {Math.round(data.low_f)}°</div> : null}
            {data.feels_like_f != null ? <div>Feels like {Math.round(data.feels_like_f)}°</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hourly strip ────────────────────────────────────────────
function HourlyStrip({ data }: { data: PlaceWeatherData }) {
  const hours = data.hourly.slice(0, 12);
  if (hours.length === 0) return null;
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm py-3.5 px-1">
      <div className="flex overflow-x-auto gap-0.5 pb-0.5">
        {hours.map((h, i) => (
          <div key={h.time + i} className="flex-none w-14 flex flex-col items-center gap-2 py-0.5">
            <span className={`text-[13px] font-semibold ${i === 0 ? 'text-app-text' : 'text-app-text-secondary'}`}>{fmtHour(h.time, i === 0)}</span>
            <WxGlyph code={h.condition_code} size={21} />
            <span className="text-[15px] font-semibold text-app-text">{Math.round(h.temp_f)}°</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 5-day forecast ──────────────────────────────────────────
function ForecastRow({ day, isToday, isLast, lo, hi }: { day: PlaceWeatherDay; isToday: boolean; isLast: boolean; lo: number; hi: number }) {
  const span = Math.max(1, hi - lo);
  const left = ((day.low_f - lo) / span) * 100;
  const width = ((day.high_f - day.low_f) / span) * 100;
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${isLast ? '' : 'border-b border-app-border-subtle'}`}>
      <span className="w-11 text-[14.5px] font-semibold text-app-text shrink-0">{fmtDay(day.date, isToday)}</span>
      <span className="w-[30px] flex justify-center shrink-0"><WxGlyph code={day.condition_code} size={19} /></span>
      <span className={`w-7 text-[12.5px] font-semibold shrink-0 ${day.precip_chance > 0 ? 'text-primary-500' : 'text-transparent'}`}>{day.precip_chance > 0 ? `${day.precip_chance}%` : '–'}</span>
      <span className="w-6 text-[14.5px] text-app-text-muted text-right shrink-0">{Math.round(day.low_f)}°</span>
      <div className="flex-1 h-[5px] rounded-full bg-app-surface-sunken relative min-w-[40px]">
        {/* warm-to-cool range fill — sky→amber, mapped to tokens */}
        <div className="absolute inset-y-0 rounded-full bg-gradient-to-r from-primary-400 to-app-warning" style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }} />
      </div>
      <span className="w-6 text-[14.5px] font-semibold text-app-text text-right shrink-0">{Math.round(day.high_f)}°</span>
    </div>
  );
}

function ForecastList({ data }: { data: PlaceWeatherData }) {
  const days = data.daily.slice(0, 5);
  if (days.length === 0) return null;
  const lows = days.map((d) => d.low_f);
  const highs = days.map((d) => d.high_f);
  const lo = Math.min(...lows) - 2;
  const hi = Math.max(...highs) + 2;
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
      {days.map((d, i) => (
        <ForecastRow key={d.date} day={d} isToday={i === 0} isLast={i === days.length - 1} lo={lo} hi={hi} />
      ))}
    </div>
  );
}

// ── AQI — EPA index with its 6-band scale + plain meaning ───
// The six band colors are the standardized US EPA AQI category colors;
// they're a data-viz scale with no design-token equivalent.
const AQI_BANDS = ['#16A34A', '#EAB308', '#F97316', '#DC2626', '#7C3AED', '#7F1D1D'];
const AQI_BAND_LABELS = ['Good', 'Mod', 'USG', 'Unhlthy', 'V.Unhl', 'Hazard'];
const AQI_BREAKS = [0, 50, 100, 150, 200, 300, 500];

const AQI_BAND_INDEX: Record<AirQualityCategory, number> = {
  good: 0,
  moderate: 1,
  unhealthy_sensitive: 2,
  unhealthy: 3,
  very_unhealthy: 4,
  hazardous: 5,
};

function aqiMarkerPct(index: number): number {
  const v = Math.max(0, Math.min(500, index));
  for (let b = 0; b < AQI_BREAKS.length - 1; b += 1) {
    if (v <= AQI_BREAKS[b + 1]) {
      const within = (v - AQI_BREAKS[b]) / (AQI_BREAKS[b + 1] - AQI_BREAKS[b]);
      return ((b + within) / 6) * 100;
    }
  }
  return 100;
}

function AqiCard({ data }: { data: PlaceAirQualityData }) {
  const band = AQI_BAND_INDEX[data.category] ?? 0;
  const labelColor = AQI_BANDS[band];
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[38px] leading-10 font-semibold -tracking-[0.02em] text-app-text">{data.index}</span>
            <span className="text-base font-semibold" style={{ color: labelColor }}>{data.category_label}</span>
          </div>
          <div className="text-[13px] text-app-text-secondary mt-0.5">
            US Air Quality Index{data.dominant_pollutant ? ` (${data.dominant_pollutant.toUpperCase()})` : ''}
          </div>
        </div>
        <span className="w-11 h-11 rounded-xl bg-app-home-bg flex items-center justify-center shrink-0">
          <Wind size={23} strokeWidth={2} className="text-app-home" />
        </span>
      </div>

      <div className="relative mb-2">
        <div className="flex h-2 rounded-full overflow-hidden">
          {AQI_BANDS.map((c, i) => (
            <div key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>
        <div
          className="absolute -top-[3px] w-3.5 h-3.5 rounded-full bg-app-surface shadow"
          style={{ left: `${aqiMarkerPct(data.index)}%`, transform: 'translateX(-50%)', border: `3px solid ${labelColor}` }}
        />
      </div>
      <div className="flex justify-between text-[9.5px] font-semibold uppercase tracking-[0.01em] text-app-text-muted">
        {AQI_BAND_LABELS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>

      {data.health_message ? (
        <div className="text-[14px] text-app-text-strong leading-5 mt-3.5 pt-3.5 border-t border-app-border-subtle">
          <span className="font-semibold">What it means:</span> {data.health_message}
        </div>
      ) : null}
    </div>
  );
}

// ── Alerts — list, or the calm "no active alerts" card ──────
function AlertRow({ alert }: { alert: PlaceWeatherAlert }) {
  const warn = alert.severity === 'warning';
  const wrap = warn ? 'bg-app-error-bg border-app-error-light' : 'bg-app-warning-bg border-app-warning-light';
  const tile = warn ? 'bg-app-error-light text-app-error' : 'bg-app-warning-light text-app-warning';
  const accent = warn ? 'text-app-error' : 'text-app-warning';
  return (
    <div className={`rounded-2xl shadow-sm p-[15px] border ${wrap}`}>
      <div className="flex items-center gap-3 mb-2.5">
        <span className={`w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0 ${tile}`}>
          <Wind size={18} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-app-text -tracking-[0.01em]">{alert.event}</div>
          {alert.headline ? <div className={`text-[12.5px] font-semibold mt-0.5 ${accent}`}>{alert.headline}</div> : null}
        </div>
      </div>
      {alert.description ? <div className="text-[13.5px] text-app-text-strong leading-[19px]">{alert.description}</div> : null}
    </div>
  );
}

function AlertsCard({ data }: { data: PlaceAlertsData }) {
  if (!data.active || data.active.length === 0) {
    return (
      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-[11px] bg-app-home-bg flex items-center justify-center shrink-0">
          <Check size={21} strokeWidth={2.5} className="text-app-home" />
        </span>
        <div>
          <div className="text-[15px] font-semibold text-app-text">No active alerts</div>
          <div className="text-[13px] text-app-text-secondary mt-0.5">No weather or hazard warnings for your area.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {data.active.map((a) => (
        <AlertRow key={a.id} alert={a} />
      ))}
    </div>
  );
}

// ── Sun — sunrise / sunset with the daylight arc ────────────
// The dot plots the sun's REAL position: the fraction of daylight
// elapsed right now, parametrized along the arc's true ellipse
// (center 100,52 · rx 96 · ry 44). Before sunrise the dot waits at
// the left horizon; after sunset it rests at the right.
const SUN_ARC = { cx: 100, cy: 52, rx: 96, ry: 44 };

function sunArcPoint(t: number): { x: number; y: number } {
  const theta = Math.PI * (1 - Math.min(1, Math.max(0, t)));
  return {
    x: SUN_ARC.cx + SUN_ARC.rx * Math.cos(theta),
    y: SUN_ARC.cy - SUN_ARC.ry * Math.sin(theta),
  };
}

function SunCard({ data }: { data: PlaceSunriseSunsetData }) {
  const hours = Math.floor(data.daylight_minutes / 60);
  const mins = data.daylight_minutes % 60;

  // Open-Meteo returns the home's local wall-clock time (no offset);
  // Date parses it in the viewer's zone — viewer ≈ resident here.
  const rise = new Date(data.sunrise).getTime();
  const set = new Date(data.sunset).getTime();
  const now = Date.now();
  const span = Math.max(1, set - rise);
  const t = (now - rise) / span;
  const sunUp = t >= 0 && t <= 1;
  const { x, y } = sunArcPoint(t);

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
      <div className="flex items-center justify-between">
        <div className="text-center">
          <Sunrise size={22} strokeWidth={2} className="text-app-warning mx-auto" />
          <div className="text-[17px] font-semibold text-app-text mt-1">{fmtTime(data.sunrise)}</div>
          <div className="text-[12px] text-app-text-muted mt-0.5">Sunrise</div>
        </div>
        <div className="flex-1 px-[18px]">
          <svg width="100%" height="50" viewBox="0 0 200 56" preserveAspectRatio="none" className="overflow-visible" aria-hidden="true">
            <path d={`M4 52 A ${SUN_ARC.rx} ${SUN_ARC.ry} 0 0 1 196 52`} fill="none" stroke="rgb(var(--app-border))" strokeWidth="2" strokeDasharray="2 4" />
            {t > 0 ? (
              <path
                d={`M4 52 A ${SUN_ARC.rx} ${SUN_ARC.ry} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`}
                fill="none"
                stroke="var(--color-warning)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ) : null}
            <circle
              cx={x.toFixed(1)}
              cy={y.toFixed(1)}
              r="5.5"
              fill={sunUp ? 'var(--color-warning)' : 'rgb(var(--app-text-muted))'}
              stroke="rgb(var(--app-surface))"
              strokeWidth="2"
            />
          </svg>
          <div className="text-center text-[12px] text-app-text-muted mt-0.5">
            {hours}h {mins}m of daylight{sunUp ? '' : t < 0 ? ' · before sunrise' : ' · sun has set'}
          </div>
        </div>
        <div className="text-center">
          <Sunset size={22} strokeWidth={2} className="text-app-warning mx-auto" />
          <div className="text-[17px] font-semibold text-app-text mt-1">{fmtTime(data.sunset)}</div>
          <div className="text-[12px] text-app-text-muted mt-0.5">Sunset</div>
        </div>
      </div>
    </div>
  );
}

export default function TodayDetail({ intelligence }: { intelligence: PlaceIntelligence }) {
  const weather = findPlaceSection(intelligence, 'weather');
  const aqi = findPlaceSection(intelligence, 'air_quality');
  const alerts = findPlaceSection(intelligence, 'alerts');
  const sun = findPlaceSection(intelligence, 'sunrise_sunset');

  const weatherReady = weather && (weather.status === 'ready' || weather.status === 'stale' || weather.status === 'partial') && weather.data;
  const aqiReady = aqi && (aqi.status === 'ready' || aqi.status === 'stale' || aqi.status === 'partial') && aqi.data;
  const alertsReady = alerts && (alerts.status === 'ready' || alerts.status === 'stale' || alerts.status === 'partial') && alerts.data;
  const sunReady = sun && (sun.status === 'ready' || sun.status === 'stale' || sun.status === 'partial') && sun.data;

  return (
    <>
      <DetailHeader title="Today" address={detailAddress(intelligence.place)} />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        <DetailSectionLabel>Weather</DetailSectionLabel>
        {weatherReady ? (
          <div className="flex flex-col gap-2.5">
            <NowCard data={weather!.data as PlaceWeatherData} />
            <HourlyStrip data={weather!.data as PlaceWeatherData} />
            <ForecastList data={weather!.data as PlaceWeatherData} />
          </div>
        ) : (
          <SectionCard icon={CloudSun} title="Weather" state={weather ? statusToState(weather.status) : 'unavailable'} caption={weather?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
        )}
        {weather?.source ? <SourceNote name={weather.source} asOf={fmtTime(weather.as_of) ? `as of ${fmtTime(weather.as_of)}` : undefined} /> : null}

        <DetailSectionLabel>Air quality</DetailSectionLabel>
        {aqiReady ? (
          <AqiCard data={aqi!.data as PlaceAirQualityData} />
        ) : (
          <SectionCard icon={Wind} title="Air quality" state={aqi ? statusToState(aqi.status) : 'unavailable'} caption={aqi?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
        )}
        {aqi?.source ? <SourceNote name={aqi.source} asOf={fmtTime(aqi.as_of) ? `as of ${fmtTime(aqi.as_of)}` : undefined} /> : null}

        <DetailSectionLabel>Alerts</DetailSectionLabel>
        {alertsReady ? (
          <AlertsCard data={alerts!.data as PlaceAlertsData} />
        ) : (
          <SectionCard icon={Check} title="Alerts" state={alerts ? statusToState(alerts.status) : 'unavailable'} caption={alerts?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
        )}
        {alerts?.source ? <SourceNote name={alerts.source} asOf="live" /> : null}

        <DetailSectionLabel>Sun</DetailSectionLabel>
        {sunReady ? (
          <SunCard data={sun!.data as PlaceSunriseSunsetData} />
        ) : (
          <SectionCard icon={Sunrise} title="Sunrise & sunset" state={sun ? statusToState(sun.status) : 'unavailable'} caption={sun?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
        )}
        {sun?.source ? <SourceNote name={sun.source} asOf="today" /> : null}

        <DetailSectionLabel>Coming soon</DetailSectionLabel>
        <div className="flex flex-col gap-2">
          <ComingSoonRow icon={Flower2} title="Allergen & pollen" sub="Tree, grass, and weed pollen counts" />
          <ComingSoonRow icon={Trash2} title="Trash & recycling" sub="Your pickup day and what goes out" />
          <ComingSoonRow icon={ZapOff} title="Power outages" sub="Live outage map for your block" />
        </div>
      </div>
    </>
  );
}
