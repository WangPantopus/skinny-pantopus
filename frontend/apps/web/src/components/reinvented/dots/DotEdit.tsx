'use client';

// Illuminate in the Studio (Pulse, reinvented, phase 2; coord/CONTRACT.md §7c): the author taps things in the photo to
// put dots on them, each holding a note, a rating, a link, or "a thing to name" (a reader's tap reads its field card,
// §7d). Up to eight. A thing needs a photo and the author's Pantopus AI on; a link isn't offered under a made-up name.

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '@pantopus/api/client';
import { RecordButton } from '../sound/SoundPanel';
import type { Recording } from '../sound/record';
import './dots.css';

export const MAX_DOTS = 8;

/** A dot while composing: any kind's fields, so switching kinds keeps what was typed. */
export interface DotDraft {
  id: string;
  kind: 'note' | 'rating' | 'link' | 'thing' | 'whisper';
  x: number;
  y: number;
  text: string;
  label: string;
  stars: number;
  url: string;
  title: string;
  size: number;
  /** A whisper's three seconds, sent after the Moment is made (§7e). */
  audio: Recording | null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function newDot(taken: readonly DotDraft[], x: number, y: number): DotDraft {
  let n = 1;
  while (taken.some((d) => d.id === `dot-${n}`)) n++;
  return { id: `dot-${n}`, kind: 'note', x, y, text: '', label: '', stars: 4, url: '', title: '', size: 0.24, audio: null };
}

function thingBox(d: DotDraft) {
  const half = d.size / 2;
  const x = clamp(d.x - half, 0, 1 - d.size),
    y = clamp(d.y - half, 0, 1 - d.size);
  return { x: +x.toFixed(3), y: +y.toFixed(3), w: +d.size.toFixed(3), h: +d.size.toFixed(3) };
}

function httpsUrl(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(t) ? t : `https://${t}`);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Whether a draft is complete enough to post. */
export function dotReady(d: DotDraft): boolean {
  if (d.kind === 'note') return !!d.text.trim();
  if (d.kind === 'rating') return !!d.label.trim() && d.stars >= 1 && d.stars <= 5;
  if (d.kind === 'link') return !!httpsUrl(d.url);
  if (d.kind === 'whisper') return !!d.audio;
  return true;
}

/**
 * What the server takes (§7c): each ready dot's kind and fields; unfinished ones are left out, and so are kinds this
 * post can't carry (a thing on a video, a link under a made-up name).
 */
export function dotsWire(
  drafts: readonly DotDraft[],
  { things, links, whispers = false }: { things: boolean; links: boolean; whispers?: boolean },
): Record<string, unknown>[] {
  return drafts
    .filter((d) => dotReady(d) && (things || d.kind !== 'thing') && (links || d.kind !== 'link') && (whispers || d.kind !== 'whisper'))
    .map((d) => {
      const at = { id: d.id, x: +d.x.toFixed(3), y: +d.y.toFixed(3) };
      if (d.kind === 'note') return { ...at, kind: 'note', text: d.text.trim() };
      if (d.kind === 'rating') return { ...at, kind: 'rating', label: d.label.trim(), stars: d.stars };
      if (d.kind === 'link') return { ...at, kind: 'link', url: httpsUrl(d.url)!, ...(d.title.trim() ? { title: d.title.trim() } : {}) };
      if (d.kind === 'whisper') return { ...at, kind: 'whisper' };
      return { ...at, kind: 'thing', box: thingBox(d), ...(d.label.trim() ? { label: d.label.trim() } : {}) };
    });
}

/** The person's own Pantopus AI choice (§7d): a thing to name is offered only while it is on. */
export function usePantopusAiOn(enabled: boolean): boolean {
  const q = useQuery({
    queryKey: ['reinvented', 'settings'],
    queryFn: ({ signal }) => get<{ pantopus_ai: boolean }>('/api/reinvented/settings', undefined, { signal }),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  return q.data?.pantopus_ai === true;
}

/** The dots over the picture while composing; with `active`, a tap on the picture puts a new one there. */
export function DotEditLayer({
  dots,
  active,
  selected,
  onAdd,
  onSelect,
  onMove,
}: {
  dots: DotDraft[];
  active: boolean;
  selected: string | null;
  onAdd(x: number, y: number): void;
  onSelect(id: string): void;
  /** A dot dragged to a new spot (PHASE-6 F2: an item goes where the finger takes it); unset while another tool is on. */
  onMove?(id: string, x: number, y: number): void;
}) {
  // The dot being dragged, and whether the press moved it (then its click picks nothing).
  const moving = useRef<{ id: string; x0: number; y0: number; on: boolean } | null>(null);
  const moved = useRef(false);
  if (!dots.length && !active) return null;
  const sel = dots.find((d) => d.id === selected);
  return (
    <div
      className="dt-layer"
      data-edit={active || undefined}
      onClick={(e) => {
        if (!active || e.target !== e.currentTarget) return;
        const b = e.currentTarget.getBoundingClientRect();
        onAdd(clamp((e.clientX - b.left) / b.width, 0.03, 0.97), clamp((e.clientY - b.top) / b.height, 0.03, 0.97));
      }}
    >
      {sel?.kind === 'thing' && (
        <span
          className="dt-box"
          aria-hidden="true"
          style={{ left: `${thingBox(sel).x * 100}%`, top: `${thingBox(sel).y * 100}%`, width: `${sel.size * 100}%`, height: `${sel.size * 100}%` }}
        />
      )}
      {dots.map((d) => (
        <button
          key={d.id}
          type="button"
          className="dt-dot"
          data-kind={d.kind}
          data-unfinished={!dotReady(d) || undefined}
          aria-label={`Dot ${d.id.replace('dot-', '')}: ${d.kind === 'thing' ? 'a thing to name' : d.kind}`}
          aria-pressed={selected === d.id}
          style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
          data-movable={onMove ? true : undefined}
          onPointerDown={(e) => {
            if (!onMove || (e.pointerType === 'mouse' && e.button !== 0)) return;
            e.stopPropagation();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* a pointer that is already gone */
            }
            moving.current = { id: d.id, x0: e.clientX, y0: e.clientY, on: false };
            moved.current = false;
          }}
          onPointerMove={(e) => {
            const m = moving.current;
            if (!m || m.id !== d.id || !onMove) return;
            if (!m.on && Math.hypot(e.clientX - m.x0, e.clientY - m.y0) < 4) return;
            m.on = moved.current = true;
            const b = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
            onMove(d.id, clamp((e.clientX - b.left) / b.width, 0.03, 0.97), clamp((e.clientY - b.top) / b.height, 0.03, 0.97));
          }}
          onLostPointerCapture={() => {
            moving.current = null;
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (moved.current) {
              moved.current = false;
              return;
            }
            onSelect(d.id);
          }}
        />
      ))}
    </div>
  );
}

const KINDS: { kind: DotDraft['kind']; label: string }[] = [
  { kind: 'note', label: 'Note' },
  { kind: 'rating', label: 'Rating' },
  { kind: 'link', label: 'Link' },
  { kind: 'thing', label: 'A thing to name' },
  { kind: 'whisper', label: 'Whisper' },
];

/** The panel for the picked dot: its kind and words, and Remove. */
export function DotEditPanel({
  dot,
  count,
  allowLink,
  allowThing,
  allowWhisper = false,
  onChange,
  onRemove,
  onDone,
}: {
  dot: DotDraft | null;
  count: number;
  allowLink: boolean;
  allowThing: boolean;
  /** A three-second voice whisper: a Moment under the author's own name only (§7e). */
  allowWhisper?: boolean;
  onChange(d: DotDraft): void;
  onRemove(id: string): void;
  onDone(): void;
}) {
  const set = (patch: Partial<DotDraft>) => dot && onChange({ ...dot, ...patch });
  return (
    <div className="st-toolpanel dt-panel" role="group" aria-label="Illuminate">
      {!dot ? (
        <p className="st-hint">
          {count < MAX_DOTS ? 'Tap something in the photo to put a dot on it.' : `Up to ${MAX_DOTS} dots. Tap one to change it.`}
        </p>
      ) : (
        <>
          <div className="st-tray-stamps" role="group" aria-label="What the dot holds">
            {KINDS.filter((k) => (k.kind !== 'link' || allowLink) && (k.kind !== 'thing' || allowThing) && (k.kind !== 'whisper' || allowWhisper)).map((k) => (
              <button key={k.kind} type="button" aria-pressed={dot.kind === k.kind} onClick={() => set({ kind: k.kind })}>
                {k.label}
              </button>
            ))}
          </div>
          {dot.kind === 'note' && (
            <input className="dt-input" value={dot.text} maxLength={140} placeholder="What should people know here?" aria-label="Note" onChange={(e) => set({ text: e.target.value })} />
          )}
          {dot.kind === 'rating' && (
            <div className="dt-row">
              <input className="dt-input" value={dot.label} maxLength={40} placeholder="What you rate" aria-label="What you rate" onChange={(e) => set({ label: e.target.value })} />
              <div className="st-tray-stamps" role="group" aria-label="Stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-pressed={dot.stars === n} aria-label={`${n} of 5`} onClick={() => set({ stars: n })}>
                    {'★'.repeat(n)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {dot.kind === 'link' && (
            <div className="dt-row">
              <input className="dt-input" value={dot.url} maxLength={500} placeholder="https://…" aria-label="Link" inputMode="url" onChange={(e) => set({ url: e.target.value })} />
              <input className="dt-input" value={dot.title} maxLength={60} placeholder="Title (optional)" aria-label="Link title" onChange={(e) => set({ title: e.target.value })} />
              {dot.url.trim() && !httpsUrl(dot.url) && <p className="st-hint">Only an https link.</p>}
            </div>
          )}
          {dot.kind === 'whisper' && (
            <div className="dt-row">
              <RecordButton kind="whisper" value={dot.audio} onChange={(r) => set({ audio: r })} />
              <p className="st-hint">A reader hears it when they tap the dot.</p>
            </div>
          )}
          {dot.kind === 'thing' && (
            <div className="dt-row">
              <input className="dt-input" value={dot.label} maxLength={40} placeholder="What you think it is (optional)" aria-label="Your guess" onChange={(e) => set({ label: e.target.value })} />
              <button type="button" className="st-chip" onClick={() => set({ size: clamp(+(dot.size - 0.06).toFixed(2), 0.1, 0.8) })}>
                Smaller outline
              </button>
              <button type="button" className="st-chip" onClick={() => set({ size: clamp(+(dot.size + 0.06).toFixed(2), 0.1, 0.8) })}>
                Larger outline
              </button>
              <p className="st-hint">A reader’s tap names it with Pantopus AI and a source. It always says “likely”.</p>
            </div>
          )}
        </>
      )}
      <div className="dt-row">
        {dot && (
          <button type="button" className="st-chip" onClick={() => onRemove(dot.id)}>
            Remove dot
          </button>
        )}
        <button type="button" className="st-done" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
