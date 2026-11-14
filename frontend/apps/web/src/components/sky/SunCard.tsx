'use client';

// ============================================================
// SunCard — sunrise and sunset with the daylight arc (Place's Today detail).
//
// The dot plots the sun's REAL position: the fraction of daylight elapsed
// right now, parametrized along the arc's true ellipse (center 100,52 ·
// rx 96 · ry 44). Before sunrise the dot waits at the left horizon; after
// sunset it rests at the right.
//
// [countdown] (Today and Place before an address, TABCARD 4): how long until
// the next sunset or sunrise leads ("Sunset in 3h 12m" by day, "Sunrise in
// 12h 47m" by night, when the times are today's where the place is), the
// card follows the clock, and by night the sun waits at the horizon where it
// will rise. The arc then says all of it in one sentence for a screen reader.
// ============================================================

import { useEffect, useState } from 'react';
import { Sunrise, Sunset } from 'lucide-react';
import type { PlaceSunriseSunsetData } from '@pantopus/types';
import { fmtTime } from '@/components/place/detail/format';

const SUN_ARC = { cx: 100, cy: 52, rx: 96, ry: 44 };

function sunArcPoint(t: number): { x: number; y: number } {
  const theta = Math.PI * (1 - Math.min(1, Math.max(0, t)));
  return {
    x: SUN_ARC.cx + SUN_ARC.rx * Math.cos(theta),
    y: SUN_ARC.cy - SUN_ARC.ry * Math.sin(theta),
  };
}

/** An instant the server sent, or null. */
function instant(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** The place's date right now ("2026-11-13"), in its own zone when known. */
function placeDate(now: number, timeZone: string | undefined): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  }
}

function span(minutes: number): string {
  const whole = Math.max(1, Math.round(minutes));
  return whole >= 60 ? `${Math.floor(whole / 60)}h ${whole % 60}m` : `${whole}m`;
}

/** Re-renders each half minute while [on], so a countdown stays true. */
function useClock(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [on]);
  return on ? now : Date.now();
}

export default function SunCard({ data, countdown = false, overline, testId }: {
  data: PlaceSunriseSunsetData;
  countdown?: boolean;
  /** A small capitals line at the top of the card ("RIGHT NOW IN VANCOUVER"). */
  overline?: string;
  testId?: string;
}) {
  const now = useClock(countdown);
  const hours = Math.floor(data.daylight_minutes / 60);
  const mins = data.daylight_minutes % 60;

  // The instants when the server sends them; otherwise Open-Meteo's local wall-clock times
  // (no offset), which Date parses in the viewer's zone — viewer ≈ resident there.
  const rise = instant(data.sunrise_utc) ?? new Date(data.sunrise).getTime();
  const set = instant(data.sunset_utc) ?? new Date(data.sunset).getTime();
  const daySpan = Math.max(1, set - rise);
  const t = (now - rise) / daySpan;
  const sunUp = t >= 0 && t <= 1;
  const shown = countdown && !sunUp ? 0 : t;
  const { x, y } = sunArcPoint(shown);

  // Only today's times where the place is can count down (cached times may be another day's).
  const today = (data.date ?? data.sunrise.slice(0, 10)) === placeDate(now, data.time_zone);
  const next = countdown && today
    ? sunUp
      ? { label: 'Sunset in', span: span((set - now) / 60_000) }
      : { label: 'Sunrise in', span: span(((now < rise ? rise : rise + 86_400_000) - now) / 60_000) }
    : null;
  const sentence = `${next ? `${next.label} ${next.span}. ` : ''}Sunrise ${fmtTime(data.sunrise) ?? ''}, sunset ${fmtTime(data.sunset) ?? ''}, `
    + `${hours} hours ${mins} minutes of daylight.`;

  return (
    <div data-testid={testId} className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
      {overline ? (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-muted">{overline}</p>
      ) : null}
      {/* With the countdown the card stays compact on a wide page, and the arc keeps its shape. */}
      <div className={countdown ? 'mx-auto max-w-[420px]' : undefined}>
        {next ? (
          <p className="mb-3 text-center" aria-hidden="true">
            <span className="block text-[12.5px] font-semibold text-app-text-secondary">{next.label}</span>
            <span className="block text-[28px] leading-8 font-bold tabular-nums -tracking-[0.02em] text-app-text">{next.span}</span>
          </p>
        ) : null}
        <div className="flex items-center justify-between">
          <div className="text-center">
            <Sunrise size={22} strokeWidth={2} className="text-app-warning mx-auto" />
            <div className="text-[17px] font-semibold text-app-text mt-1">{fmtTime(data.sunrise)}</div>
            <div className="text-[12px] text-app-text-muted mt-0.5">Sunrise</div>
          </div>
          <div className="flex-1 px-[18px]">
            <svg
              width="100%"
              height={countdown ? undefined : 50}
              viewBox="0 0 200 56"
              preserveAspectRatio="none"
              className="overflow-visible"
              style={countdown ? { aspectRatio: '200 / 56' } : undefined}
              {...(countdown ? { role: 'img', 'aria-label': sentence } : { 'aria-hidden': true })}
            >
              <path d={`M4 52 A ${SUN_ARC.rx} ${SUN_ARC.ry} 0 0 1 196 52`} fill="none" stroke="rgb(var(--app-border))" strokeWidth="2" strokeDasharray="2 4" />
              {shown > 0 ? (
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
              {hours}h {mins}m of daylight{countdown || sunUp ? '' : t < 0 ? ' · before sunrise' : ' · sun has set'}
            </div>
          </div>
          <div className="text-center">
            <Sunset size={22} strokeWidth={2} className="text-app-warning mx-auto" />
            <div className="text-[17px] font-semibold text-app-text mt-1">{fmtTime(data.sunset)}</div>
            <div className="text-[12px] text-app-text-muted mt-0.5">Sunset</div>
          </div>
        </div>
      </div>
    </div>
  );
}
