'use client';

// ============================================================
// The Today scene: the Living Sky's canvas and loop with the Today sky's
// rules and drawing. Its own chunk, which SkyCard loads after first paint.
//
// The numbers read over it are the page's, so to a screen reader the picture
// is decoration, as on the apps. With Reduce Motion it is a still picture of
// the same scene.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import SkyCanvas from './SkyCanvas';
import { todaySkyScene, type TodaySkyInput } from './todaySky';
import { todaySkyPainter } from './todaySkyPainter';

/** The minute clock: the sky moves from day to dusk while the page stays open. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        setNow(Date.now());
        next();
      }, 60_000 - (Date.now() % 60_000));
    };
    next();
    return () => window.clearTimeout(timer);
  }, []);
  return now;
}

// The first picture this session fades in over the plain sky; after that the chunk is here and it's simply there.
let shownOnce = false;

export default function TodaySkyCanvas({ input }: { input: TodaySkyInput }) {
  const now = useMinuteClock();
  const scene = useMemo(() => {
    try {
      return todaySkyScene(input, now);
    } catch {
      // A picture never takes the page down: the plain sky stays.
      return null;
    }
  }, [input, now]);
  const draw = useMemo(todaySkyPainter, []);

  const [shown, setShown] = useState(shownOnce);
  useEffect(() => {
    shownOnce = true;
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!scene) return null;
  return (
    // The app's Reduce Motion rule removes the fade (globals.css).
    <div className="absolute inset-0" aria-hidden="true" style={{ opacity: shown ? 1 : 0, transition: 'opacity .4s ease' }}>
      <SkyCanvas className="absolute inset-0 h-full w-full" label="The sky over your home" draw={draw} options={scene} hour={0} rise={false} />
    </div>
  );
}
