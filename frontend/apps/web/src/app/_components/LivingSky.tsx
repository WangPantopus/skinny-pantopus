'use client';

// ============================================================
// LivingSky — the canvas, clock and animation loop around skyScene.ts.
//
// The sky glides to a new hour instead of jumping, rises into place the
// first time it appears (as the Today card's sun and moon do), and keeps
// its ambient motion at ~30 fps only while it is on screen. With Reduce
// Motion it paints still frames.
// ============================================================

import { useEffect, useRef } from 'react';
import { DEFAULT_SKY_OPTIONS, drawSky, makeSkySeeds, type SkyOptions } from './skyScene';

type LivingSkyProps = Partial<SkyOptions> & {
  /** The hour to draw, 0–24. Omit it to follow the device clock. */
  hour?: number;
  /** The sun or moon rises into place when the sky first appears. */
  rise?: boolean;
  /** Drifting clouds, twinkling, rain and chimney smoke. */
  motion?: boolean;
  label: string;
  className?: string;
};

type Glide = { from: number; to: number; t0: number; dur: number };

function nowHour(): number {
  const n = new Date();
  return n.getHours() + n.getMinutes() / 60;
}

export default function LivingSky({ hour, rise = true, motion = true, label, className, ...rest }: LivingSkyProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hourRef = useRef(hour);
  const motionRef = useRef(motion);
  const optionsRef = useRef<SkyOptions>(DEFAULT_SKY_OPTIONS);
  const scene = useRef({ shown: NaN, target: NaN, glide: null as Glide | null, dirty: true, reduce: false });
  const retargetRef = useRef<(h: number) => void>(() => {});

  const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Partial<SkyOptions>;
  optionsRef.current = { ...DEFAULT_SKY_OPTIONS, ...defined };
  motionRef.current = motion;
  scene.current.dirty = true;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const seeds = makeSkySeeds();
    const st = scene.current;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    st.reduce = !!media?.matches;
    const onMotionPref = () => {
      st.reduce = !!media?.matches;
      st.dirty = true;
    };
    media?.addEventListener?.('change', onMotionPref);

    const target = hourRef.current ?? nowHour();
    st.shown = target;
    st.target = target;
    if (rise && !st.reduce) st.glide = { from: target - 1.1, to: target, t0: performance.now(), dur: 1700 };

    retargetRef.current = (h: number) => {
      if (h === st.target) return;
      st.target = h;
      if (st.reduce || Number.isNaN(st.shown)) {
        st.shown = h;
        st.glide = null;
      } else {
        st.glide = { from: st.shown, to: h, t0: performance.now(), dur: 520 };
      }
      st.dirty = true;
    };

    const paint = (t: number) => {
      const ambient = motionRef.current && !st.reduce;
      if (st.glide) {
        const p = Math.min(1, Math.max(0, (t - st.glide.t0) / st.glide.dur));
        const eased = 1 - Math.pow(1 - p, 3);
        st.shown = st.glide.from + (st.glide.to - st.glide.from) * eased;
        if (p >= 1) st.glide = null;
      }
      st.dirty = false;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSky(ctx, w, h, st.shown, t, optionsRef.current, seeds, ambient);
    };

    // A sky that scrolls into view paints at once instead of on the next
    // throttled frame.
    let visible = true;
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          visible = entries.some((e) => e.isIntersecting);
          if (visible) paint(performance.now());
        })
      : null;
    io?.observe(canvas);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { st.dirty = true; }) : null;
    ro?.observe(canvas);
    const clock = window.setInterval(() => {
      if (hourRef.current === undefined) retargetRef.current(nowHour());
    }, 30_000);

    let raf = 0;
    let last = -Infinity;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      const ambient = motionRef.current && !st.reduce;
      if (!ambient && !st.glide && !st.dirty) return;
      if (t - last < 33) return;
      last = t;
      paint(t);
    };
    paint(performance.now());
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(clock);
      io?.disconnect();
      ro?.disconnect();
      media?.removeEventListener?.('change', onMotionPref);
    };
    // The loop reads the latest props through refs; it is set up once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    hourRef.current = hour;
    if (hour !== undefined) retargetRef.current(hour);
  }, [hour]);

  return <canvas ref={canvasRef} role="img" aria-label={label} className={className} />;
}
