'use client';

import { useRef, useState, type ReactNode } from 'react';
import Postmark from './Postmark';
import { clampScale, clampTurn, stampLabel, type PlacedStamp, type SafeBox, type StampKind, type StampValues } from './stampTypes';
import { keepOn } from '../studio/frame';
import './stamps.css';

// The icons of board B5's tray, in one ink.
const PATHS: Record<Exclude<StampKind, 'postmark'>, ReactNode> = {
  weather: <path d="M7 18a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 9.5 4.3 4.3 0 0 1 17.5 18z" />,
  elevation: <path d="M3 19l6-10 4 6 2-3 6 7z" />,
  place: (
    <>
      <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  sunset: <path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 6v3M5.6 9.6l2 2M18.4 9.6l-2 2" />,
  home_distance: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
};
export const STAMP_TINT: Record<StampKind, string> = {
  postmark: '#C81E1E',
  weather: '#0369A1',
  elevation: '#047857',
  place: '#6D28D9',
  time: '#B45309',
  sunset: '#C2410C',
  home_distance: '#0E7490',
};

export function StampIcon({ kind, color = 'currentColor', size = 16 }: { kind: StampKind; color?: string; size?: number }) {
  if (kind === 'postmark')
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
      </svg>
    );
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[kind]}
    </svg>
  );
}

/** What a stamp says, for its accessible name. */
export function stampWords(kind: StampKind, value: unknown, ink: 'wet' | 'dry') {
  if (kind === 'postmark' && value && typeof value === 'object') {
    const v = value as NonNullable<StampValues['postmark']>;
    return [`Postmark${ink === 'dry' ? ', dried' : ''}: ${v.place}`, v.date_label, v.time_label, v.weather ? `${v.weather.temp_f}°F, ${v.weather.label}` : '']
      .filter(Boolean)
      .join(', ');
  }
  return stampLabel(kind, value) || '';
}

function Face({ kind, value, ink }: { kind: StampKind; value: unknown; ink: 'wet' | 'dry' }) {
  if (kind === 'postmark') return <Postmark value={value as NonNullable<StampValues['postmark']>} ink={ink} />;
  return (
    <span className="sp-chip">
      <StampIcon kind={kind} />
      {stampLabel(kind, value)}
    </span>
  );
}

/**
 * Stamps over a picture. The layer fills the picture's 9:16 box; sizes follow its width (container units), so a stamp
 * sits at the same place and size on a phone, a wide window, the viewer and a card. With `onChange` the stamps can be
 * picked up and dragged; the picked one shows a dashed box, a corner handle that sizes and turns it, and a remove
 * button. With `safe`, a stamp being moved or sized stays wholly inside that part of the picture (the part every
 * viewer shows), and its dashed top line shows while it moves.
 */
export default function StampLayer({
  stamps,
  valueOf,
  ink,
  selected = null,
  onSelect,
  onChange,
  safe,
}: {
  stamps: readonly PlacedStamp[];
  safe?: SafeBox;
  valueOf(kind: StampKind): unknown;
  ink: 'wet' | 'dry';
  selected?: StampKind | null;
  onSelect?(kind: StampKind | null): void;
  onChange?(next: PlacedStamp[]): void;
}) {
  const box = useRef<HTMLDivElement>(null),
    faces = useRef(new Map<StampKind, HTMLDivElement>());
  const [moving, setMoving] = useState(false);
  const drag = useRef<
    | { mode: 'move'; kind: StampKind; from: { x: number; y: number }; start: PlacedStamp }
    | { mode: 'turn'; kind: StampKind; center: { x: number; y: number }; span: number; angle: number; start: PlacedStamp }
    | null
  >(null);
  const edit = !!onChange;
  // Keep the whole stamp inside `safe`: measured as it is drawn now (turned and sized), scaled to the size asked for.
  // A stamp grown past the box keeps its size; one moved past an edge stops at it.
  const fitted = (next: PlacedStamp, prev: PlacedStamp): PlacedStamp => {
    const el = faces.current.get(next.kind),
      b = box.current?.getBoundingClientRect();
    if (!safe || !el || !b?.width || !b.height) return next;
    const r = el.getBoundingClientRect();
    const grow = next.scale / prev.scale;
    const hw = (r.width * grow) / 2 / b.width,
      hh = (r.height * grow) / 2 / b.height;
    if (grow > 1 && (hw * 2 > safe.width || hh * 2 > safe.height)) return { ...next, scale: prev.scale, rotation: next.rotation };
    const x = hw * 2 >= safe.width ? safe.x + safe.width / 2 : Math.min(safe.x + safe.width - hw, Math.max(safe.x + hw, next.x));
    const y = hh * 2 >= safe.height ? safe.y + safe.height / 2 : Math.min(safe.y + safe.height - hh, Math.max(safe.y + hh, next.y));
    return { ...next, x, y };
  };
  const put = (next: PlacedStamp) => {
    const prev = stamps.find((s) => s.kind === next.kind) || next;
    const kept = fitted(next, prev);
    onChange?.(stamps.map((s) => (s.kind === kept.kind ? kept : s)));
  };
  const frac = (e: React.PointerEvent) => {
    const b = box.current!.getBoundingClientRect();
    return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height };
  };
  return (
    <div className="sp-layer" ref={box} data-edit={edit || undefined}>
      {edit && safe && moving && (
        <span
          className="sp-safe"
          aria-hidden="true"
          style={{ left: safe.x * 100 + '%', top: safe.y * 100 + '%', width: safe.width * 100 + '%', height: safe.height * 100 + '%' }}
        />
      )}
      {stamps.map((s) => {
        const value = valueOf(s.kind);
        if (value == null) return null;
        const picked = edit && selected === s.kind;
        return (
          <div
            key={s.kind}
            ref={(el) => {
              if (el) faces.current.set(s.kind, el);
              else faces.current.delete(s.kind);
            }}
            className="sp-stamp"
            data-kind={s.kind}
            data-picked={picked || undefined}
            role={edit ? 'button' : 'img'}
            tabIndex={edit ? 0 : undefined}
            aria-label={stampWords(s.kind, value, ink) + (edit ? '. Drag to move' : '')}
            style={
              {
                left: s.x * 100 + '%',
                top: s.y * 100 + '%',
                transform: `translate(-50%, -50%) rotate(${s.rotation}deg) scale(${s.scale})`,
                '--sp-inv': 1 / s.scale,
              } as React.CSSProperties
            }
            onKeyDown={(e) => {
              if (!edit) return;
              const step = e.shiftKey ? 0.05 : 0.01;
              const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
              if (move) {
                e.preventDefault();
                // At least 24 px of the stamp stays on the canvas (PHASE-6 K2).
                const r = e.currentTarget.getBoundingClientRect(),
                  b = box.current?.getBoundingClientRect();
                put({ ...s, x: keepOn(s.x + move[0], r.width, b?.width ?? 0), y: keepOn(s.y + move[1], r.height, b?.height ?? 0) });
              } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                onChange?.(stamps.filter((t) => t.kind !== s.kind));
                onSelect?.(null);
              }
            }}
            onPointerDown={(e) => {
              if (!edit) return;
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              onSelect?.(s.kind);
              setMoving(true);
              drag.current = { mode: 'move', kind: s.kind, from: frac(e), start: s };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || d.kind !== s.kind) return;
              const p = frac(e);
              if (d.mode === 'move') {
                // At least 24 px of the stamp's own box stays on the canvas, on both axes (PHASE-6 K2).
                const r = e.currentTarget.getBoundingClientRect(),
                  b = box.current!.getBoundingClientRect();
                put({
                  ...d.start,
                  x: keepOn(d.start.x + p.x - d.from.x, r.width, b.width),
                  y: keepOn(d.start.y + p.y - d.from.y, r.height, b.height),
                });
              }
              else {
                const b = box.current!.getBoundingClientRect();
                const dx = e.clientX - d.center.x,
                  dy = e.clientY - d.center.y;
                const span = Math.hypot(dx, dy) / b.width;
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                put({ ...d.start, scale: clampScale((d.start.scale * span) / d.span), rotation: clampTurn(d.start.rotation + angle - d.angle) });
              }
            }}
            onLostPointerCapture={() => {
              drag.current = null;
              setMoving(false);
            }}
          >
            <Face kind={s.kind} value={value} ink={ink} />
            {picked && (
              <>
                <span className="sp-box" aria-hidden="true" />
                <button
                  type="button"
                  className="sp-remove"
                  aria-label="Remove this stamp"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    onChange?.(stamps.filter((t) => t.kind !== s.kind));
                    onSelect?.(null);
                  }}
                >
                  ×
                </button>
                <span
                  className="sp-handle"
                  role="presentation"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                    const center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                    const b = box.current!.getBoundingClientRect();
                    setMoving(true);
                    drag.current = {
                      mode: 'turn',
                      kind: s.kind,
                      center,
                      span: Math.hypot(e.clientX - center.x, e.clientY - center.y) / b.width,
                      angle: (Math.atan2(e.clientY - center.y, e.clientX - center.x) * 180) / Math.PI,
                      start: s,
                    };
                  }}
                  onLostPointerCapture={() => {
                    drag.current = null;
                    setMoving(false);
                  }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
