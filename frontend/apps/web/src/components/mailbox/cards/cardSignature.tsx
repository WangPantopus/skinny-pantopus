'use client';

// ============================================================
// The sender's own signature beside FROM (design plan 8.2, launch key card_table): a few pen strokes in a 400 × 100
// box, kept by the server with the note (never in a share picture's name, logs or public pages). Drawn the same in
// every app: 48% of the card's width after FROM, its line y = 72 on FROM's baseline, round 4-unit strokes in the
// pen's ink. Without one, the first name is set in the pen as before.
// ============================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { CardSignature } from '@pantopus/api';

export const SIGNATURE_W = 400;
export const SIGNATURE_H = 100;
/** Where the strokes' line sits in the box: it goes on FROM's baseline. */
export const SIGNATURE_LINE = 72;
/** The box's width on the card, as a share of the card's width. */
export const SIGNATURE_ON_CARD = 0.48;
export const SIGNATURE_INK = '#1b2a5c';
export const SIGNATURE_STROKE = 4;
const MAX_BYTES = 2048;
const MAX_STROKES = 40;

type Point = { x: number; y: number };

/** The strokes as one SVG path in box units: smooth curves through the points; a dot is a tiny line, round-capped. */
export function signaturePath(signature: Pick<CardSignature, 'strokes'>): string {
  return signature.strokes.map((stroke) => {
    const points: Point[] = [];
    for (let i = 0; i + 1 < stroke.length; i += 2) points.push({ x: stroke[i], y: stroke[i + 1] });
    if (!points.length) return '';
    if (points.length === 1) return `M${points[0].x} ${points[0].y}l0.01 0`;
    let d = `M${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i += 1) {
      const mx = (points[i].x + points[i + 1].x) / 2;
      const my = (points[i].y + points[i + 1].y) / 2;
      d += `Q${points[i].x} ${points[i].y} ${mx} ${my}`;
    }
    const last = points[points.length - 1];
    return `${d}L${last.x} ${last.y}`;
  }).join('');
}

/** Whether a card's signature is one this app can draw. */
export function drawableSignature(value: unknown): CardSignature | null {
  const s = value as CardSignature | null | undefined;
  return s && s.w === SIGNATURE_W && s.h === SIGNATURE_H && Array.isArray(s.strokes) && s.strokes.length ? s : null;
}

/** The signature in the pen's ink, filling its 400 × 100 box (the parent places and sizes it). */
export function SignatureInk({ signature, className, style }: { signature: CardSignature; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox={`0 0 ${SIGNATURE_W} ${SIGNATURE_H}`} className={className} style={{ overflow: 'visible', ...style }} aria-hidden="true" focusable="false">
      <path d={signaturePath(signature)} fill="none" stroke={SIGNATURE_INK} strokeWidth={SIGNATURE_STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Ramer–Douglas–Peucker: the fewest points that stay within `epsilon` of the line drawn.
function simplify(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  let far = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = Math.abs(dy * points[i].x - dx * points[i].y + b.x * a.y - b.y * a.x) / len;
    if (d > far) { far = d; index = i; }
  }
  if (far <= epsilon) return [a, b];
  return [...simplify(points.slice(0, index + 1), epsilon).slice(0, -1), ...simplify(points.slice(index), epsilon)];
}

/**
 * Strokes drawn on the pad (box units, any precision) as the server keeps them: simplified, whole numbers, inside
 * the box, at most 2 KB. Null when nothing was drawn, 'too_long' when it can't be made to fit.
 */
export function fitSignature(strokes: Point[][]): CardSignature | null | 'too_long' {
  const drawn = strokes.filter((stroke) => stroke.length);
  if (!drawn.length) return null;
  if (drawn.length > MAX_STROKES) return 'too_long';
  const clampX = (v: number) => Math.min(SIGNATURE_W, Math.max(0, Math.round(v)));
  const clampY = (v: number) => Math.min(SIGNATURE_H, Math.max(0, Math.round(v)));
  for (const epsilon of [0.6, 0.9, 1.3, 1.9, 2.8, 4]) {
    const fitted = drawn.map((stroke) => {
      const flat: number[] = [];
      for (const p of simplify(stroke, epsilon)) {
        const x = clampX(p.x);
        const y = clampY(p.y);
        if (flat.length >= 2 && flat[flat.length - 2] === x && flat[flat.length - 1] === y) continue;
        flat.push(x, y);
      }
      return flat;
    });
    const signature: CardSignature = { w: SIGNATURE_W, h: SIGNATURE_H, strokes: fitted };
    if (new TextEncoder().encode(JSON.stringify(signature)).length <= MAX_BYTES) return signature;
  }
  return 'too_long';
}

/**
 * Sign your name: a strip of the card's paper, four times as wide as it is tall, to sign with a finger, a mouse or a
 * pen. Done keeps it; Use my typed name puts the typed first name back.
 */
export function SignaturePad({
  initial,
  onDone,
  onTyped,
  onClose,
  wax,
}: {
  initial: CardSignature | null;
  onDone: (signature: CardSignature) => void;
  onTyped: () => void;
  onClose: () => void;
  wax: string;
}) {
  const [strokes, setStrokes] = useState<Point[][]>(() => (initial?.strokes ?? []).map((stroke) => {
    const points: Point[] = [];
    for (let i = 0; i + 1 < stroke.length; i += 2) points.push({ x: stroke[i], y: stroke[i + 1] });
    return points;
  }));
  const [tooLong, setTooLong] = useState(false);
  const padRef = useRef<SVGSVGElement | null>(null);
  const drawing = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const at = useCallback((event: ReactPointerEvent): Point => {
    const r = padRef.current!.getBoundingClientRect();
    return {
      x: Math.min(SIGNATURE_W, Math.max(0, ((event.clientX - r.left) / r.width) * SIGNATURE_W)),
      y: Math.min(SIGNATURE_H, Math.max(0, ((event.clientY - r.top) / r.height) * SIGNATURE_H)),
    };
  }, []);

  const down = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = event.pointerId;
    setTooLong(false);
    setStrokes((now) => [...now, [at(event)]]);
  };
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawing.current !== event.pointerId) return;
    const events = (event.nativeEvent.getCoalescedEvents?.() ?? []) as PointerEvent[];
    const points = (events.length ? events : [event.nativeEvent]).map((e) => at(e as unknown as ReactPointerEvent));
    setStrokes((now) => {
      const last = now[now.length - 1];
      return last ? [...now.slice(0, -1), [...last, ...points]] : now;
    });
  };
  const up = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawing.current === event.pointerId) drawing.current = null;
  };

  const done = () => {
    const fitted = fitSignature(strokes);
    if (fitted === 'too_long') { setTooLong(true); return; }
    if (fitted) onDone(fitted);
  };

  const live = { strokes: strokes.map((stroke) => stroke.flatMap((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10])) };
  const hasInk = strokes.some((stroke) => stroke.length);
  const button = 'inline-flex min-h-[44px] items-center justify-center rounded-full px-4 text-[15px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1d1d]';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-sign-title"
        data-testid="cardSignPad"
        className="w-full max-w-[560px] rounded-t-2xl bg-[#fbf6ec] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="card-sign-title" className="text-[17px] font-semibold text-[#2a1a12]">Sign your name</h2>
          <button ref={closeRef} type="button" onClick={onClose} className={`${button} -mr-2 text-[#374151]`}>Close</button>
        </div>
        <p className="mt-1 text-[14px] leading-5 text-[#6b5f50]">Sign with your finger, a pen or the mouse. It goes beside FROM, in the card’s ink.</p>
        <div className="mt-3 rounded-[4px] bg-[#f7f0e2] shadow-[inset_0_0_0_1px_rgba(110,80,30,0.18)]" style={{ backgroundImage: "url('/holiday-cards/table/paper.webp')", backgroundSize: 220, backgroundBlendMode: 'multiply' }}>
          <svg
            ref={padRef}
            viewBox={`0 0 ${SIGNATURE_W} ${SIGNATURE_H}`}
            data-testid="cardSignArea"
            role="img"
            aria-label={hasInk ? 'Your signature' : 'Space to sign your name'}
            className="block aspect-[4/1] w-full cursor-crosshair select-none"
            style={{ touchAction: 'none' }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <line x1="12" x2="388" y1={SIGNATURE_LINE} y2={SIGNATURE_LINE} stroke="rgba(74,84,118,0.28)" strokeWidth="1" strokeDasharray="4 5" />
            <path d={signaturePath(live)} fill="none" stroke={SIGNATURE_INK} strokeWidth={SIGNATURE_STROKE} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {tooLong ? <p role="alert" className="mt-2 text-[13px] font-medium text-[#a81a1a]">Sign a little more simply, or leave your name typed.</p> : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            <button type="button" data-testid="cardSignClear" disabled={!hasInk} onClick={() => { setStrokes([]); setTooLong(false); }} className={`${button} border border-[#d6cbb6] bg-[#fffdf8] text-[#374151] disabled:opacity-50`}>Clear</button>
            {initial ? <button type="button" data-testid="cardSignTyped" onClick={onTyped} className={`${button} text-[#374151] underline underline-offset-4`}>Use my typed name</button> : null}
          </div>
          <button type="button" data-testid="cardSignDone" disabled={!hasInk} onClick={done} className={`${button} min-w-[120px] text-white disabled:opacity-50`} style={{ backgroundColor: wax }}>Done</button>
        </div>
      </div>
    </div>
  );
}
