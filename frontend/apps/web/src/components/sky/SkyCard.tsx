'use client';

// ============================================================
// SkyCard — the Weather box as a sky: the reading in white over the
// Today scene, as on iOS and Android (TodaySky.swift, TodaySky.kt).
//
// The box and its reading go out with the page, over a plain gradient
// (skyHint.ts). The picture is its own chunk, loaded after first paint
// when the browser is idle: it never holds up first content or
// hydration, and until it arrives (or if it can't) the box still reads.
// ============================================================

import { useEffect, useState, type ComponentType } from 'react';
import { skyHint } from './skyHint';
import type { TodaySkyInput } from './todaySky';

type Scene = ComponentType<{ input: TodaySkyInput }>;

// Kept for the session: reopening Today draws the sky at once.
let loadedScene: Scene | null = null;

function useTodayScene(): Scene | null {
  const [scene, setScene] = useState<Scene | null>(() => loadedScene);
  useEffect(() => {
    if (loadedScene) {
      setScene(() => loadedScene);
      return;
    }
    let live = true;
    const load = () => {
      import('./TodaySkyCanvas')
        .then((module) => {
          loadedScene = module.default;
          if (live) setScene(() => module.default);
        })
        // Offline or a stale deploy: the plain sky stays, and the next visit tries again.
        .catch(() => {});
    };
    const idle = window.requestIdleCallback?.(load, { timeout: 2000 });
    const timer = idle === undefined ? window.setTimeout(load, 200) : undefined;
    return () => {
      live = false;
      if (idle !== undefined) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
    };
  }, []);
  return scene;
}

// Keeps the left of the sky dark enough for the white reading (the apps' scrim, slate 950): in every scene "NOW" keeps
// 4.5:1 and the temperature and condition, large text, 3:1. With a hairline edge, so a night sky doesn't melt into a
// dark page. Inline, like the sizes below, so the app's stylesheet doesn't grow.
const SKY_OVER = {
  background: 'linear-gradient(to right, rgba(2,6,23,.46), rgba(2,6,23,0) 80%)',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)',
  borderRadius: 'inherit',
};
// Clear of the home on the right, as on the apps.
const READING = { textShadow: '0 2px 6px rgba(0,0,0,.28)', padding: '14px 110px 14px 18px' };
// On dark glass: near the bright horizon, white text alone can't keep its contrast.
const CHIP = { background: 'rgba(2,6,23,.45)', textShadow: 'none', padding: '4px 9px' };

/** The Weather box: "NOW", the temperature, the condition and its chips, over the sky. */
export default function SkyCard({ input, at, temp, label, chips, className = '' }: {
  input: TodaySkyInput;
  /** When the reading was taken (ms): the plain sky's time of day. */
  at: number;
  temp: number | null;
  label: string;
  chips: string[];
  className?: string;
}) {
  const Scene = useTodayScene();
  return (
    <div
      className={`relative overflow-hidden text-white ${className}`}
      style={{ background: skyHint(input.condition, at, input.sunrise, input.sunset), minHeight: 188 }}
    >
      {Scene ? <Scene input={input} /> : null}
      <div className="absolute inset-0" style={SKY_OVER} aria-hidden="true" />
      <div className="relative" style={READING}>
        <div className="font-bold" style={{ fontSize: 14, letterSpacing: '.9px' }}>NOW</div>
        {temp != null && (
          <div className="flex items-start font-light">
            <span style={{ fontSize: 64, lineHeight: '70px', letterSpacing: '-2px' }}>{Math.round(temp)}</span>
            <span style={{ fontSize: 34, marginTop: 6 }}>°</span>
          </div>
        )}
        {label ? <div className="font-bold" style={{ fontSize: 19, lineHeight: '23px' }}>{label}</div> : null}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {chips.map((chip) => (
              <span key={chip} className="rounded-full text-[13px] font-semibold leading-4" style={CHIP}>{chip}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
