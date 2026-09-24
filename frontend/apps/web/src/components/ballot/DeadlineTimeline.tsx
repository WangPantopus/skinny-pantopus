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

type Side = 'above' | 'below';

export interface TimelineMarker {
  key: string;
  x: number;
  side: Side;
  date: string;
  label: string;
  kind: 'today' | 'deadline' | 'final';
  needsAction: boolean;
  anchor: 'start' | 'middle' | 'end';
  aria: string;
}

const ARIA: Record<string, (d: BallotDeadline) => string> = {
  ballots_mailed: (d) => `ballots mailed ${d.month_day}`,
  register_online_mail: (d) => `register online or by mail by ${d.month_day}`,
  return_by: (d) => `return by 8 p.m. ${d.month_day}`,
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
    { key: 'today', x: x0, side: 'below', date: monthDay(today), label: 'Today', kind: 'today', needsAction: false, anchor: 'start', aria: `today, ${monthDay(today)}` },
  ];
  ahead.forEach((d, i) => {
    const final = i === ahead.length - 1;
    markers.push({
      key: d.key,
      x: xFor(d.days_until),
      // The final marker always sits above, right-aligned; the ones
      // between alternate starting above (the canvas's arrangement).
      side: final ? 'above' : i % 2 === 0 ? 'above' : 'below',
      date: d.month_day,
      label: d.label,
      kind: final ? 'final' : 'deadline',
      needsAction: d.needs_action && !final,
      anchor: final ? 'end' : 'middle',
      aria: (ARIA[d.key] || ((x: BallotDeadline) => `${x.label} ${x.month_day}`))(d),
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
          const textX = m.anchor === 'start' ? m.x - 4 : m.anchor === 'end' ? m.x + 4 : m.x;
          const [y1, y2] = m.side === 'above' ? [14, 26] : [60, 72];
          const firstLine = m.kind === 'today' ? m.label : m.date;
          const secondLine = m.kind === 'today' ? m.date : m.label;
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
