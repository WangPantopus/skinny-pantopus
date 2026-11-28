'use client';

import { useEffect, useRef, useState } from 'react';
import { paintOverlay, type Artwork, type Stroke, type XY } from '@/components/moments/momentArtwork';
import { useSpanLoop, type LoopSpan } from '../loop/loop';
import { backdropCss, paintPicture, stuckTurn, turnOf, zoomRange, type Backdrop } from './whole';

export type StudioTool = 'text' | 'draw' | 'resize' | null;
/** Draw's brushes (design, the Studio's rail: "Draw: brush, highlighter, arrow, eyedropper, eraser"). */
export type StudioBrush = 'pen' | 'highlighter' | 'arrow' | 'eraser';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** A moved picture within 2% of the middle sits exactly in it; its middle stays on the canvas. */
const toMiddle = (v: number) => (Math.abs(v) < 0.02 ? 0 : clamp(v, -0.5, 0.5));
/** The angle between two fingers, in degrees. */
const angleOf = (a: XY, b: XY) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
// The posted frame in pixels (9:16, as the canvas below): lengths and angles are worked out here, not in fractions.
const W = 720,
  H = 1280;
const px = (p: XY) => ({ x: p.x * W, y: p.y * H });
const frac = (p: XY) => ({ x: clamp(p.x / W, 0, 1), y: clamp(p.y / H, 0, 1) });

/**
 * A highlighter is today's stroke in a see-through ink and a wider line: one path is stroked once, so it stays even
 * where it crosses itself, and today's painter draws it unchanged.
 */
export const highlight = (ink: string) => (/^#[0-9a-f]{6}$/i.test(ink) ? ink + '66' : ink);

/** An arrow from where the drag began to where it is now: the shaft and its head in one stroke, so Undo takes it whole. */
function arrow(from: XY, to: XY, width: number): XY[] {
  const a = px(from),
    b = px(to);
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy);
  if (len < 4) return [from];
  const head = Math.min(len * 0.6, Math.max(width * W * 3.5, 22)),
    ux = dx / len,
    uy = dy / len;
  const wing = (turn: number) =>
    frac({
      x: b.x - head * (ux * Math.cos(turn) - uy * Math.sin(turn)),
      y: b.y - head * (uy * Math.cos(turn) + ux * Math.sin(turn)),
    });
  return [from, to, wing(0.5), to, wing(-0.5)];
}

/** How far a point is from a stroke, in the frame's pixels. */
function distance(p: XY, stroke: Stroke) {
  const q = px(p);
  let best = Infinity;
  stroke.points.forEach((pt, i) => {
    const a = px(pt),
      b = px(stroke.points[i + 1] ?? pt);
    const dx = b.x - a.x,
      dy = b.y - a.y,
      l2 = dx * dx + dy * dy;
    const t = l2 ? clamp(((q.x - a.x) * dx + (q.y - a.y) * dy) / l2, 0, 1) : 0;
    best = Math.min(best, Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy) - (stroke.width * W) / 2);
  });
  return best;
}

/**
 * The picture in the Studio, on the 9:16 frame that is posted: whole and upright at first, on its own colours (whole.ts
 * draws what goes out with the same numbers, so what is seen is what goes out). With Resize (or no tool) dragging moves
 * the picture, the wheel or two fingers size it, and two fingers or Shift and the wheel turn it to any angle; with Text
 * the drag moves the words; with Draw it draws.
 */
export default function StudioPicture({
  file,
  art,
  onChange,
  tool,
  ink,
  pen,
  brush = 'pen',
  picking = false,
  onPick,
  onBeforeStrokes,
  onPicture,
  loop = null,
  backdrop = null,
}: {
  file: File;
  art: Artwork;
  onChange(a: Artwork): void;
  tool: StudioTool;
  ink: string;
  pen: number;
  /** Draw's brush; today's pen when unset. */
  brush?: StudioBrush;
  /** The eyedropper is on: the next tap on the picture reads its colour there (as it will be posted) for `onPick`. */
  picking?: boolean;
  onPick?(color: string): void;
  /** The lines as they were before a line is drawn or rubbed out, so Undo can put them back. */
  onBeforeStrokes?(strokes: Stroke[]): void;
  /** The picture as it loaded (a video once its first frame is in), for reading its colours. */
  onPicture?(el: HTMLImageElement | HTMLVideoElement, width: number, height: number): void;
  /** A loop (CONTRACT 7j): the video plays only this part, over and over, as the new viewers will. */
  loop?: LoopSpan | null;
  /** The picture's own two colours (PHASE-5 A), drawn where it doesn't reach, as readers will see it. */
  backdrop?: Backdrop | null;
}) {
  const [url, setUrl] = useState(''),
    [unreadable, setUnreadable] = useState(false),
    [dimensions, setDimensions] = useState<{ w: number; h: number }>({ w: 9, h: 16 });
  const canvas = useRef<HTMLCanvasElement>(null),
    frame = useRef<HTMLDivElement>(null),
    drag = useRef<{ from: XY; original: Artwork } | null>(null),
    media = useRef<HTMLImageElement | HTMLVideoElement | null>(null),
    rubbed = useRef<XY | null>(null),
    fingers = useRef(new Map<number, XY>()),
    pinch = useRef<{ span: number; zoom: number; angle: number; rotation: number } | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    setUnreadable(false);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  useEffect(() => setVideo(media.current instanceof HTMLVideoElement ? media.current : null), [url]);
  useSpanLoop(loop ? video : null, loop);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 720, 1280);
      paintOverlay(ctx, art);
    }
  }, [art]);
  const point = (e: { clientX: number; clientY: number }): XY => {
    const b = frame.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - b.left) / b.width, 0, 1), y: clamp((e.clientY - b.top) / b.height, 0, 1) };
  };
  // The colour under a point of the picture as it will be posted (the same zoom, turn and place), on this device only.
  const colourAt = (p: XY) => {
    const el = media.current;
    if (!el || !dimensions.w || !dimensions.h) return null;
    try {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      paintPicture(ctx, el, dimensions.w, dimensions.h, { ...art, strokes: [], text: '' }, backdrop);
      const [r, g, b] = ctx.getImageData(Math.min(W - 1, Math.round(p.x * W)), Math.min(H - 1, Math.round(p.y * H)), 1, 1).data;
      return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    } catch {
      return null;
    }
  };
  // The eraser takes away every line it touches, all along the drag (points every few pixels from where it last was).
  const rub = (to: XY, strokes: Stroke[]) => {
    const from = rubbed.current ?? to;
    rubbed.current = to;
    const steps = Math.max(1, Math.ceil(Math.hypot((to.x - from.x) * W, (to.y - from.y) * H) / 8));
    const path = Array.from({ length: steps + 1 }, (_, i) => ({
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
    }));
    const reach = Math.max(24, pen * W * 2);
    const kept = strokes.filter((s) => path.every((p) => distance(p, s) > reach));
    return kept.length === strokes.length ? null : kept;
  };
  const span = () => {
    const [a, b] = [...fingers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const twist = () => {
    const [a, b] = [...fingers.current.values()];
    return a && b ? angleOf(a, b) : 0;
  };
  const sizes = zoomRange(dimensions.w, dimensions.h);
  // See the picture first (PHASE-5 A1): every picture opens whole, never cut, as it will look to readers; Fit / Fill,
  // Turn and Reset on the same screen (Studio.tsx), and dragging, zooming and turning here, change it. The picture is
  // whole and upright at zoom 1, then sized and turned to any angle (whole.ts, the same numbers as what is posted).
  const measured = (w: number, h: number) => setDimensions({ w, h });
  const scale = Math.min(9 / dimensions.w, 16 / dimensions.h) * art.zoom;
  const style = {
    width: ((dimensions.w * scale) / 9) * 100 + '%',
    height: ((dimensions.h * scale) / 16) * 100 + '%',
    left: 50 + 100 * art.offset.x + '%',
    top: 50 + 100 * art.offset.y + '%',
    transform: 'translate(-50%, -50%) rotate(' + turnOf(art.rotation) + 'deg)',
  };
  return (
    <div className="st-picture" ref={frame} style={backdrop ? { background: backdropCss(backdrop) } : undefined}>
      {url &&
        (file.type.startsWith('video/') ? (
          <video
            ref={(el) => {
              media.current = el;
            }}
            style={style}
            src={url}
            muted
            playsInline
            autoPlay
            loop
            onLoadedMetadata={(e) => measured(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
            onLoadedData={(e) => onPicture?.(e.currentTarget, e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
            onError={() => setUnreadable(true)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL of the file being posted
          <img
            ref={(el) => {
              media.current = el;
            }}
            src={url}
            style={style}
            alt="Your photo"
            onLoad={(e) => {
              measured(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
              onPicture?.(e.currentTarget, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
            }}
            onError={() => setUnreadable(true)}
          />
        ))}
      {unreadable && <span className="st-unreadable">Preview unavailable for this file</span>}
      <canvas
        ref={canvas}
        width={720}
        height={1280}
        data-picking={picking || undefined}
        aria-label={
          picking
            ? 'Tap the picture to take its colour'
            : tool === 'draw'
            ? 'Draw on your Moment'
            : tool === 'text'
              ? 'Drag to move your words'
              : 'Drag to move the picture'
        }
        onWheel={(e) => {
          if (tool === 'text' || tool === 'draw') return;
          // Shift and the wheel turn it, five degrees a step, sticking at quarter turns; the wheel alone sizes it.
          if (e.shiftKey) onChange({ ...art, rotation: stuckTurn(art.rotation + ((e.deltaY || e.deltaX) < 0 ? -5 : 5)) });
          else onChange({ ...art, zoom: clamp(art.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06), sizes.min, sizes.max) });
        }}
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* a pointer that is already gone: nothing to follow */
          }
          fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (picking) {
            const colour = colourAt(point(e));
            if (colour) onPick?.(colour);
            return;
          }
          if ((!tool || tool === 'resize') && fingers.current.size === 2) {
            drag.current = null;
            pinch.current = { span: span(), zoom: art.zoom, angle: twist(), rotation: art.rotation };
            return;
          }
          const p = point(e);
          drag.current = { original: art, from: p };
          rubbed.current = null;
          if (tool === 'draw' && brush === 'eraser') {
            const kept = rub(p, art.strokes);
            if (kept) {
              onBeforeStrokes?.(art.strokes);
              onChange({ ...art, strokes: kept });
            }
          } else if (tool === 'draw') {
            onBeforeStrokes?.(art.strokes);
            const line =
              brush === 'highlighter'
                ? { width: pen * 2.5, color: highlight(ink), points: [p] }
                : { width: pen, color: ink, points: [p] };
            onChange({ ...art, strokes: [...art.strokes, line] });
          }
        }}
        onPointerMove={(e) => {
          if (fingers.current.has(e.pointerId)) fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          // Two fingers size it and turn it to any angle, sticking at quarter turns (as the phones' Resize does).
          if (pinch.current) {
            const now = span();
            if (now && pinch.current.span)
              onChange({
                ...art,
                zoom: clamp((pinch.current.zoom * now) / pinch.current.span, sizes.min, sizes.max),
                rotation: stuckTurn(pinch.current.rotation + twist() - pinch.current.angle),
              });
            return;
          }
          if (!drag.current) return;
          const p = point(e),
            { original, from } = drag.current;
          if (tool === 'draw' && brush === 'eraser') {
            const kept = rub(p, art.strokes);
            if (kept) {
              // One rub is one step back: the lines as they were when the drag began, kept once.
              if (original.strokes === art.strokes) onBeforeStrokes?.(art.strokes);
              onChange({ ...art, strokes: kept });
            }
          } else if (tool === 'draw') {
            const stroke = art.strokes.at(-1);
            if (stroke)
              onChange({
                ...art,
                strokes: [
                  ...art.strokes.slice(0, -1),
                  { ...stroke, points: brush === 'arrow' ? arrow(from, p, stroke.width) : [...stroke.points, p] },
                ],
              });
          } else if (tool === 'text')
            onChange({
              ...art,
              textAt: {
                x: clamp(original.textAt.x + p.x - from.x, 0, 1),
                y: clamp(original.textAt.y + p.y - from.y, 0, 1),
              },
            });
          // The picture sticks at the middle (as Resize does on the phones), so it goes back there without a hunt.
          else
            onChange({
              ...art,
              offset: { x: toMiddle(original.offset.x + p.x - from.x), y: toMiddle(original.offset.y + p.y - from.y) },
            });
        }}
        onLostPointerCapture={(e) => {
          fingers.current.delete(e.pointerId);
          if (fingers.current.size < 2) pinch.current = null;
          drag.current = null;
        }}
      />
    </div>
  );
}
