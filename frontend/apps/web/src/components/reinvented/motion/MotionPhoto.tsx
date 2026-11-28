'use client';

// A Live Photo's motion in the new viewer (PHASE-5 C; coord/CONTRACT.md §10b): a photo Moment may carry the short clip
// it was taken with. It plays once, silently, when the Moment opens, then rests on the photo; a press and hold plays it
// with its sound, and on a computer it also plays (silently) while the pointer is over the picture. With the device set
// to reduce motion it never plays by itself (a press and hold still plays it). The mark is a small moving-photo sign,
// never the word "Live" ("Live" already means "taken here just now"). A switched-off reader's answer has no `motion`.

import { useEffect, useRef, useState } from 'react';
import type { Moment } from '@pantopus/api/endpoints/moments';
import './motion.css';

export interface Motion {
  url: string;
  duration_ms: number;
}

/** The clip a switch-on reader's answer carries for a photo, with its link given; null otherwise. */
export function motionOf(m: Moment | null | undefined): Motion | null {
  if (!m || m.kind !== 'photo') return null;
  const motion = (m as Moment & { motion?: { url?: unknown; duration_ms?: unknown } | null }).motion;
  if (!motion || typeof motion.url !== 'string' || !motion.url) return null;
  const ms = Number(motion.duration_ms);
  return { url: motion.url, duration_ms: Number.isFinite(ms) && ms > 0 ? ms : 3000 };
}

/** Read at once (this viewer only runs in the browser), so a reader with reduced motion never sees a first frame move. */
function useReducedMotion() {
  const [reduce, setReduce] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setReduce(q.matches);
    read();
    q.addEventListener('change', read);
    return () => q.removeEventListener('change', read);
  }, []);
  return reduce;
}

/** How long a press must last to count as a hold (a shorter one is the viewer's tap). */
const HOLD_MS = 250;

/** The clip over the photo, in the picture's own box, and its mark. Nothing here sends a request but the clip itself. */
export default function MotionPhoto({ moment }: { moment: Moment }) {
  const motion = motionOf(moment);
  const reduce = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  // Why it is playing: the opening play and hover are silent; a hold has its sound and stops when let go.
  const why = useRef<'open' | 'hover' | 'hold' | null>(null);

  useEffect(() => {
    const v = video.current;
    if (!v || !motion) return undefined;
    // This run of the effect only: a play cut short by a later run's pause (or by our own stop) is no failure.
    let live = true;
    const start = (reason: 'open' | 'hover' | 'hold') => {
      why.current = reason;
      v.muted = reason !== 'hold';
      try {
        v.currentTime = 0;
      } catch {
        /* not seekable yet: it plays from where it is */
      }
      setPlaying(true);
      void v.play().catch((e: unknown) => {
        if (!live || (e instanceof DOMException && e.name === 'AbortError')) return;
        // Sound refused (no gesture the browser counts): it plays silently instead.
        if (!v.muted) {
          v.muted = true;
          void v.play().catch(() => stop());
        } else stop();
      });
    };
    const stop = () => {
      why.current = null;
      v.pause();
      setPlaying(false);
    };
    const ended = () => stop();
    v.addEventListener('ended', ended);
    // Once, silently, when the Moment opens (never by itself under reduced motion).
    if (!reduce) start('open');
    const stage = v.closest('.mo-stage');
    let timer = 0;
    const down = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => start('hold'), HOLD_MS);
    };
    const up = () => {
      window.clearTimeout(timer);
      if (why.current === 'hold') stop();
    };
    const enter = (e: Event) => {
      if ((e as PointerEvent).pointerType === 'mouse' && !reduce && !why.current) start('hover');
    };
    const leave = (e: Event) => {
      if ((e as PointerEvent).pointerType === 'mouse' && why.current === 'hover') stop();
    };
    stage?.addEventListener('pointerdown', down);
    stage?.addEventListener('pointerup', up);
    stage?.addEventListener('pointercancel', up);
    stage?.addEventListener('pointerenter', enter);
    stage?.addEventListener('pointerleave', leave);
    return () => {
      live = false;
      window.clearTimeout(timer);
      v.removeEventListener('ended', ended);
      stage?.removeEventListener('pointerdown', down);
      stage?.removeEventListener('pointerup', up);
      stage?.removeEventListener('pointercancel', up);
      stage?.removeEventListener('pointerenter', enter);
      stage?.removeEventListener('pointerleave', leave);
      v.pause();
    };
    // A new Moment (or clip) starts again; the reduced-motion setting is read as it is now.
  }, [moment.id, motion?.url, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!motion) return null;
  return (
    <>
      <video
        ref={video}
        className="mv-motion"
        data-playing={playing || undefined}
        src={motion.url}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <span className="mv-mark" role="img" aria-label="Moving photo. Press and hold to play it with its sound." title="Moving photo">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9.5" strokeDasharray="1.6 2.4" strokeLinecap="round" />
          <circle cx="12" cy="12" r="5.5" />
          <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
        </svg>
      </span>
    </>
  );
}
