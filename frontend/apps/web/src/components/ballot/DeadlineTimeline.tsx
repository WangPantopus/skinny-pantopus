// ============================================================
// Deadline timeline (Chart catalog: "Deadlines for the home address";
// Board: Place: Your ballot card). Real calendar spacing from today to
// Election Day, drawn at the canvas's exact geometry: a 3px track at
// y=38 from x=8 to width−8, r5 markers, the Election Day marker r6
// with a 2px ring, 11px labels that alternate above and below, and the
// one deadline that needs action in the warning ink.
//
// Width follows the container (the canvas card is 326 wide at a 390
// phone); text never scales with it.
// ============================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import type { BallotDeadline } from '@pantopus/types';
import { monthDay } from './format';

const PAD = 8;
const TRACK_Y = 38;
const HEIGHT = 74;
const MIN_LABEL_GAP = 70;
const EDGE = 40;

// The repair pass after the canvas arrangement (shared by web, iOS and
// Android; docs/ballot timeline spec). Widths are estimated at 11px
// semibold: CHAR_W px per character, measured 4.9 to 6.2 across states.
const CHAR_W = 5.5;
const LABEL_GAP = 4; // clear space kept between two labels on one side
// A label that slides along its row keeps more room from the one it moved past,
// so two short lines side by side never read as one phrase ("Oct 13 Ballots mailed").
const SLIDE_GAP = 12;
const BOUND = 12; // a label may run this far past the chart (the card has 17px padding)
const NUDGE = 4; // start / end anchored text sits 4px outside its marker
const MAX_PUSH = 48; // a label slides at most this far from its marker
const MAX_PASSES = 6;

type Side = 'above' | 'below';
type Anchor = 'start' | 'middle' | 'end';

export interface TimelineMarker {
  key: string;
  x: number;
  side: Side;
  /** How far the repair pass slid the label along its row (text is drawn at the anchor x + dx). */
  dx: number;
  date: string;
  label: string;
  kind: 'today' | 'deadline' | 'final';
  needsAction: boolean;
  anchor: Anchor;
  aria: string;
}

/** The two text lines of a marker's label, top to bottom. */
function labelLines(m: Pick<TimelineMarker, 'kind' | 'label' | 'date'>): [string, string] {
  return m.kind === 'today' ? [m.label, m.date] : [m.date, m.label];
}

interface Extent {
  left: number;
  right: number;
}

function extentOf(m: TimelineMarker): Extent {
  const [first, second] = labelLines(m);
  const w = Math.max(first.length, second.length) * CHAR_W;
  if (m.anchor === 'start') return { left: m.x - NUDGE + m.dx, right: m.x - NUDGE + m.dx + w };
  if (m.anchor === 'end') return { left: m.x + NUDGE + m.dx - w, right: m.x + NUDGE + m.dx };
  return { left: m.x + m.dx - w / 2, right: m.x + m.dx + w / 2 };
}

/** Positive when two labels on one side are closer than LABEL_GAP (or overlap). */
const overlapOf = (a: Extent, b: Extent) => Math.min(a.right, b.right) - Math.max(a.left, b.left) + LABEL_GAP;

/** How badly marker `i` collides with the card edge and its same-side neighbours (0 = fine). */
function troubleOf(markers: TimelineMarker[], i: number, width: number): number {
  const m = markers[i];
  const e = extentOf(m);
  let t = 0;
  if (e.left < -BOUND || e.right > width + BOUND) t += Math.max(-BOUND - e.left, e.right - width - BOUND, 0) + 1;
  markers.forEach((o, j) => {
    if (j === i || o.side !== m.side) return;
    const ov = overlapOf(e, extentOf(o));
    if (ov > 0) t += ov;
  });
  return t;
}

/** Today and the final marker never move; the deadline someone must act on moves last. */
function priorityOf(m: TimelineMarker): number {
  if (m.kind === 'today' || m.kind === 'final') return 3;
  return m.needsAction ? 2 : 1;
}

interface Placement {
  side: Side;
  anchor: Anchor;
  dx: number;
}

/**
 * Moves the labels that still collide after the canvas arrangement: a
 * label that overlaps a same-side neighbour (or leaves the card) tries
 * the other anchors, the other row, then a slide along the row. A layout
 * where nothing collides comes out exactly as the canvas arrangement.
 */
function repairLabels(markers: TimelineMarker[], width: number): void {
  const other = (s: Side): Side => (s === 'above' ? 'below' : 'above');
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    // Lowest priority first; of equal priority the right-hand label moves.
    const troubled = markers
      .map((m, i) => ({ m, i }))
      .filter(({ m, i }) => priorityOf(m) < 3 && troubleOf(markers, i, width) > 0)
      .sort((a, b) => priorityOf(a.m) - priorityOf(b.m) || b.m.x - a.m.x || a.i - b.i);
    if (!troubled.length) return;
    const { m, i } = troubled[0];
    const original: Placement = { side: m.side, anchor: m.anchor, dx: m.dx };
    const sides: Side[] = [m.side, other(m.side)];
    const candidates: Placement[] = [];
    sides.forEach((side) => (['middle', 'start', 'end'] as const).forEach((anchor) => candidates.push({ side, anchor, dx: 0 })));
    // Last resort: slide a start / end label along its row until it clears its neighbours.
    sides.forEach((side) => (['start', 'end'] as const).forEach((anchor) => {
      m.side = side;
      m.anchor = anchor;
      m.dx = 0;
      const mine = extentOf(m);
      let need = 0;
      markers.forEach((o, j) => {
        if (j === i || o.side !== side) return;
        const theirs = extentOf(o);
        if (overlapOf(mine, theirs) <= 0) return;
        need = anchor === 'start' ? Math.max(need, theirs.right + SLIDE_GAP - mine.left) : Math.min(need, theirs.left - SLIDE_GAP - mine.right);
      });
      if (need !== 0 && Math.abs(need) <= MAX_PUSH) candidates.push({ side, anchor, dx: need });
    }));
    // The least troubled candidate wins; an earlier one wins a tie.
    let chosen: Placement = candidates[0];
    let least = Infinity;
    for (const c of candidates) {
      m.side = c.side;
      m.anchor = c.anchor;
      m.dx = c.dx;
      const trouble = troubleOf(markers, i, width);
      if (trouble < least) {
        least = trouble;
        chosen = c;
      }
    }
    m.side = chosen.side;
    m.anchor = chosen.anchor;
    m.dx = chosen.dx;
    if (chosen.side === original.side && chosen.anchor === original.anchor && chosen.dx === original.dx) return;
  }
}

// Read from each deadline's own label: states differ ("By 7 p.m.",
// "Ballots arrive", registration that stays open online).
const lowerFirst = (s: string) => `${s.charAt(0).toLowerCase()}${s.slice(1)}`;
const ARIA: Record<string, (d: BallotDeadline) => string> = {
  return_by: (d) => `return ${lowerFirst(d.label)} ${d.month_day}`,
};

/**
 * Pure layout: markers for today and each upcoming timeline deadline,
 * spaced by real days. Returns null when there is no span to draw
 * (Election Day itself, or nothing ahead).
 */
export function timelineLayout(deadlines: BallotDeadline[], today: string, width: number) {
  const ahead = deadlines.filter((d) => d.timeline && d.days_until >= 0).sort((a, b) => a.days_until - b.days_until);
  if (!ahead.length) return null;
  const span = ahead[ahead.length - 1].days_until;
  if (span <= 0) return null;
  const x0 = PAD;
  const x1 = width - PAD;
  const xFor = (days: number) => x0 + ((x1 - x0) * days) / span;

  const markers: TimelineMarker[] = [
    { key: 'today', x: x0, side: 'below', dx: 0, date: monthDay(today), label: 'Today', kind: 'today', needsAction: false, anchor: 'start', aria: `today, ${monthDay(today)}` },
  ];
  ahead.forEach((d, i) => {
    const final = i === ahead.length - 1;
    markers.push({
      key: d.key,
      x: xFor(d.days_until),
      // The final marker always sits above, right-aligned; the ones
      // between alternate starting above (the canvas's arrangement).
      side: final ? 'above' : i % 2 === 0 ? 'above' : 'below',
      dx: 0,
      date: d.month_day,
      label: d.label,
      kind: final ? 'final' : 'deadline',
      needsAction: d.needs_action && !final,
      anchor: final ? 'end' : 'middle',
      aria: (ARIA[d.key] || ((x: BallotDeadline) => `${lowerFirst(x.label)} ${x.month_day}`))(d),
    });
  });

  // A label that would sit within 70px of a same-side neighbour moves to
  // the other side (today and the final marker never move).
  for (let i = 1; i < markers.length - 1; i += 1) {
    const m = markers[i];
    const clash = markers.some((o, j) => j !== i && o.side === m.side && Math.abs(o.x - m.x) < MIN_LABEL_GAP);
    if (clash) m.side = m.side === 'above' ? 'below' : 'above';
    if (m.x < EDGE) m.anchor = 'start';
    else if (m.x > width - EDGE) m.anchor = 'end';
  }
  // Then the labels that still overlap a neighbour or leave the card move
  // (nothing collides on most days, and then nothing changes).
  repairLabels(markers, width);

  const mailed = ahead.find((d) => d.key === 'ballots_mailed');
  return { markers, waitUntilX: mailed ? xFor(mailed.days_until) : null, x0, x1 };
}

function useWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export default function DeadlineTimeline({ deadlines, today }: { deadlines: BallotDeadline[]; today: string }) {
  const [ref, measured] = useWidth(324);
  // The canvas draws a 326-wide timeline in the card's 324-wide content
  // box (its arithmetic left out the 1px borders), so the chart runs 2px
  // into the padding. Reproduced so marker positions match the board.
  const width = measured + 2;
  const layout = timelineLayout(deadlines, today, width);
  if (!layout) return null;
  const aria = `Timeline: ${layout.markers.map((m) => m.aria).join('; ')}`;

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={aria} className="block overflow-visible">
        <line x1={layout.x0} y1={TRACK_Y} x2={layout.x1} y2={TRACK_Y} strokeWidth={3} strokeLinecap="round" className="stroke-app-border" />
        {layout.waitUntilX != null ? (
          <line x1={layout.x0} y1={TRACK_Y} x2={layout.waitUntilX} y2={TRACK_Y} strokeWidth={3} strokeLinecap="round" className="stroke-[#9ca3af]" />
        ) : null}
        {layout.markers.map((m) => {
          const textX = (m.anchor === 'start' ? m.x - NUDGE : m.anchor === 'end' ? m.x + NUDGE : m.x) + m.dx;
          const [y1, y2] = m.side === 'above' ? [14, 26] : [60, 72];
          const [firstLine, secondLine] = labelLines(m);
          const firstTone = m.kind === 'today' ? 'fill-app-home' : m.needsAction ? 'fill-app-warning' : 'fill-app-text';
          return (
            <g key={m.key}>
              {m.kind === 'final' ? (
                <circle cx={m.x} cy={TRACK_Y} r={6} strokeWidth={2} className="fill-app-text stroke-app-surface">
                  <title>{m.aria}</title>
                </circle>
              ) : (
                <circle
                  cx={m.x}
                  cy={TRACK_Y}
                  r={5}
                  className={m.kind === 'today' ? 'fill-app-home' : m.needsAction ? 'fill-app-warning' : 'fill-app-text-strong'}
                >
                  <title>{m.aria}</title>
                </circle>
              )}
              <text x={textX} y={y1} fontSize={11} fontWeight={600} textAnchor={m.anchor} className={firstTone}>
                {firstLine}
              </text>
              <text x={textX} y={y2} fontSize={11} textAnchor={m.anchor} className="fill-app-text-secondary">
                {secondLine}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
